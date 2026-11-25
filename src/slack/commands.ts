/**
 * `/brand` slash-command parsing. Pure.
 *
 *   /brand check <text>                 check a LinkedIn post (default channel)
 *   /brand check instagram: <text>      check for another channel (the colon is required,
 *                                       so a post starting "LinkedIn is…" isn't misread)
 *   /brand queue                        what's waiting for review
 *   /brand link | unlink | help
 */
import { CHANNEL_MAP, type ChannelId } from "@/lib/channels";

export const DEFAULT_CHECK_CHANNEL: ChannelId = "linkedin";
export const MAX_CHECK_CHARS = 20000;

/** Friendly aliases people actually type in Slack. */
const CHANNEL_ALIASES: Record<string, ChannelId> = {
  li: "linkedin",
  ig: "instagram",
  insta: "instagram",
  carousel: "instagram_carousel",
  twitter: "x",
  fb: "facebook",
  casestudy: "case_study",
  "case-study": "case_study",
};

export type SlackCommand =
  | { kind: "help" }
  | { kind: "link" }
  | { kind: "unlink" }
  | { kind: "queue" }
  | { kind: "check"; channel: ChannelId; text: string }
  | { kind: "error"; message: string };

export function resolveChannel(word: string): ChannelId | null {
  const w = word.toLowerCase();
  if (w in CHANNEL_MAP) return w as ChannelId;
  return CHANNEL_ALIASES[w] ?? null;
}

export function parseCommand(raw: string): SlackCommand {
  const text = String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!text) return { kind: "help" };
  const [first = "", ...rest] = text.split(/\s+/);
  const verb = first.toLowerCase();
  if (verb === "help") return { kind: "help" };
  if (verb === "link" || verb === "connect") return { kind: "link" };
  if (verb === "unlink" || verb === "disconnect") return { kind: "unlink" };
  if (verb === "queue" || verb === "gate") return { kind: "queue" };
  if (verb !== "check") {
    return { kind: "error", message: `I don't know "${first}". Try \`/brand help\`.` };
  }
  // Keep the post's own line breaks: strip only the verb (and optional channel) from the front.
  let body = text.slice(first.length).replace(/^[ \t]+/, "");
  let channel = DEFAULT_CHECK_CHANNEL;
  const maybe = rest[0];
  const resolved = maybe?.endsWith(":") ? resolveChannel(maybe.slice(0, -1)) : null;
  if (maybe && resolved) {
    channel = resolved;
    body = body.slice(maybe.length).replace(/^[ \t]*\n?/, "");
  }
  body = body.trim();
  if (!body) return { kind: "error", message: "Paste the post after `/brand check`." };
  if (body.length > MAX_CHECK_CHARS) {
    return {
      kind: "error",
      message: `That's over ${MAX_CHECK_CHARS.toLocaleString("en-GB")} characters. Paste a shorter post.`,
    };
  }
  return { kind: "check", channel, text: body };
}
