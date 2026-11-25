// Server-only: the few Slack Web API calls we need. Bot token from env, never logged.
const SLACK_API = "https://slack.com/api";

export interface SlackApiResult {
  ok: boolean;
  error?: string;
  ts?: string;
  channel?: string;
}

export async function slackApi(
  method: string,
  body: Record<string, unknown>,
): Promise<SlackApiResult> {
  // Tolerate stray whitespace or quotes from pasting the secret.
  const token = (process.env["SLACK_BOT_TOKEN"] ?? "").trim().replace(/^["']|["']$/g, "");
  if (!token) return { ok: false, error: "missing_bot_token" };
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, error: `http_${res.status}` };
  const json = (await res.json()) as SlackApiResult;
  if (!json.ok) console.error(`[slack] ${method} failed: ${json.error}`);
  return json;
}

/** Reply through a command's or action's `response_url` (works without the bot in the channel). */
export async function respond(
  responseUrl: string | null | undefined,
  payload: Record<string, unknown>,
) {
  if (!responseUrl || !responseUrl.startsWith("https://hooks.slack.com/")) return;
  const res = await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) console.error(`[slack] response_url failed: ${res.status}`);
}

export function ephemeral(text: string, extra: Record<string, unknown> = {}) {
  return { response_type: "ephemeral", text, ...extra };
}

/** What kind of token the server holds, without revealing any of it. */
export function tokenKind(raw: string | undefined): "missing" | "bot" | "user" | "other" {
  const t = (raw ?? "").trim().replace(/^["']|["']$/g, "");
  if (!t) return "missing";
  if (t.startsWith("xoxb-")) return "bot";
  if (t.startsWith("xoxp-")) return "user";
  return "other";
}

/** Setup check for `/brand diag`: never returns any part of a secret. */
export async function slackDiagnostics(): Promise<string> {
  const kind = tokenKind(process.env["SLACK_BOT_TOKEN"]);
  const lines = [
    `Bot token: ${kind === "bot" ? "present, bot token (xoxb-)" : kind === "user" ? "present, but it is a USER token (xoxp-). Use the Bot User OAuth Token" : kind === "other" ? "present, but it is not a Slack bot token" : "missing"}`,
    `Link secret: ${process.env["SLACK_LINK_SECRET"] ? "present" : "missing"}`,
  ];
  if (kind !== "missing") {
    const r = (await slackApi("auth.test", {})) as SlackApiResult & {
      team?: string;
      user?: string;
    };
    lines.push(
      r.ok
        ? `Slack accepts the token: bot @${r.user ?? "?"} in ${r.team ?? "?"}`
        : `Slack rejects the token: ${r.error ?? "unknown error"}`,
    );
  }
  return lines.join("\n");
}
