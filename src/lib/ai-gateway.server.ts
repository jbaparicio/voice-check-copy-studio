// Server-only: talks to Lovable AI. Never import this from browser code.
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { APICallError, NoObjectGeneratedError, Output, streamText } from "ai";
import type { z } from "zod/v4";
import { DEFAULT_WRITER_MODEL, getWriterModel, isWriterModel } from "./models";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
/** Default writer; also used for the brand check. */
export const WRITER_MODEL = DEFAULT_WRITER_MODEL;
const RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

function createRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  return {
    getRunId: () => runId,
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(RUN_ID_HEADER)) headers.set(RUN_ID_HEADER, runId);
      const response = await fetch(input, { ...init, headers });
      runId ??= response.headers.get(RUN_ID_HEADER)?.trim() || undefined;
      return response;
    },
  };
}

/** A friendly error the UI can show as-is. */
export class WriterError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function toWriterError(error: unknown): WriterError {
  if (error instanceof WriterError) return error;
  const status = APICallError.isInstance(error) ? (error.statusCode ?? 500) : 500;
  if (status === 402)
    return new WriterError(
      "Your workspace has run out of writing credits. An owner can add more in Settings → Plans & credits.",
      402,
    );
  if (status === 403)
    return new WriterError(
      "Writing is switched off for this workspace right now. Ask a workspace admin to check the AI settings.",
      403,
    );
  if (status === 429)
    return new WriterError("Lots of requests at once — please wait a minute and try again.", 429);
  if (NoObjectGeneratedError.isInstance(error))
    return new WriterError("The draft came back incomplete. Please try again.", 502);
  console.error("Writer call failed", error);
  return new WriterError("Something went wrong while writing. Please try again.", status);
}

/**
 * Build the streaming call for the chosen writing model. OpenAI goes through
 * Responses, Claude through native Messages, Gemini through Chat Completions.
 */
function startStream<T>(
  modelId: string,
  apiKey: string,
  fetchFn: typeof fetch,
  opts: { instructions: string; prompt: string; schema: z.ZodType<T>; effort?: "low" | "medium" },
) {
  const writer = getWriterModel(modelId);
  const output = Output.object({ schema: opts.schema });
  const messages = [{ role: "user" as const, content: opts.prompt }];

  if (writer.provider === "anthropic") {
    const anthropic = createAnthropic({
      baseURL: GATEWAY_URL,
      apiKey,
      headers: { "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: fetchFn,
    });
    return streamText({
      model: anthropic(writer.id),
      system: opts.instructions,
      messages,
      output,
      maxOutputTokens: 16000,
      maxRetries: 0,
      providerOptions: {
        anthropic: {
          structuredOutputMode: "outputFormat",
          effort: opts.effort ?? "low",
        },
      },
    });
  }

  if (writer.provider === "google") {
    const google = createOpenAICompatible({
      name: "lovable",
      baseURL: GATEWAY_URL,
      supportsStructuredOutputs: true,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: fetchFn,
    });
    return streamText({
      model: google(writer.id),
      system: opts.instructions,
      messages,
      output,
    });
  }

  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: fetchFn,
  });
  return streamText({
    model: provider.responses(writer.id),
    instructions: opts.instructions,
    messages,
    output,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: opts.effort ?? "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
}

/**
 * Ask the writer for a structured object. Streams under the hood and returns the final object.
 * `model` must be one of the curated writing models; anything else uses the default.
 */
export async function writeStructured<T>(opts: {
  instructions: string;
  prompt: string;
  schema: z.ZodType<T>;
  effort?: "low" | "medium";
  model?: string | null;
  runId?: string | undefined;
}): Promise<{ data: T; runId?: string | undefined }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new WriterError("Writing isn't set up for this app yet.", 401);

  const runIdFetch = createRunIdFetch(opts.runId);
  const modelId = isWriterModel(opts.model) ? opts.model : WRITER_MODEL;

  try {
    const result = startStream(modelId, apiKey, runIdFetch.fetch as typeof fetch, opts);
    // Drain the stream so errors surface here.
    for await (const part of result.fullStream) {
      if (part.type === "error") throw part.error;
    }
    const finish = await result.finishReason;
    if (finish === "content-filter")
      throw new WriterError(
        "This writer declined to write that piece. Try rewording the brief.",
        422,
      );
    const data = (await result.output) as T;
    if (!data) throw new WriterError("The draft came back empty. Please try again.", 502);
    return { data, runId: runIdFetch.getRunId() };
  } catch (error) {
    throw toWriterError(error);
  }
}
