/**
 * Tool contracts for a future Slack *agent* (an LLM that reads a thread and calls tools).
 * Today the slash command calls the same operations directly. Writing them down as JSON
 * Schema now means an agent can be added without changing the backend.
 *
 * Deliberately missing: any tool that approves, sends back or kills. Those exist only as
 * signed Slack button clicks, run as the person who clicked. The agent proposes and a
 * named person decides, and the database enforces it (`stamp_content_item`).
 */
import { CHANNELS } from "@/lib/channels";

export const AGENT_TOOLS = [
  {
    name: "check_post",
    description:
      "Check a post someone already wrote against the brand kit, save it unchanged and send it for human review. Returns the recommendation, score and flagged phrases. Never rewrites the post and never approves it.",
    input_schema: {
      type: "object",
      properties: {
        channel: { type: "string", enum: CHANNELS.map((c) => c.id) },
        text: { type: "string", maxLength: 20000, description: "The post exactly as written." },
      },
      required: ["channel", "text"],
      additionalProperties: false,
    },
  },
  {
    name: "list_review_queue",
    description: "List pieces waiting for review in the caller's brand, newest first.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 20 } },
      additionalProperties: false,
    },
  },
] as const;

export type AgentToolName = (typeof AGENT_TOOLS)[number]["name"];

/** Guard for anything that dispatches agent tool calls: decisions are never agent tools. */
export function isAgentTool(name: string): name is AgentToolName {
  return AGENT_TOOLS.some((t) => t.name === name);
}
