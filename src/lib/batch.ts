import { CHANNELS, type ChannelId } from "./channels";

export interface BatchPost {
  channel: ChannelId;
  text: string;
}

/** Match "Instagram", "linkedin", "LinkedIn post", "X", "twitter" etc. to a channel id. */
export function matchChannel(name: string): ChannelId | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  if (n === "twitter" || n === "x / twitter") return "x";
  for (const c of CHANNELS) {
    const id = c.id.replace(/_/g, " ");
    if (n === id || n === c.id || n === c.short.toLowerCase() || n === c.label.toLowerCase()) return c.id;
  }
  for (const c of CHANNELS) {
    if (c.id !== "x" && c.label.toLowerCase().startsWith(n)) return c.id;
  }
  return null;
}

/**
 * Split a pasted batch into posts. Posts are separated by a line containing only "---".
 * A post may open with "Channel: Instagram" on its own line; otherwise the batch channel is used.
 * The post text is otherwise kept exactly as pasted (only surrounding blank lines trimmed).
 */
export function splitBatch(input: string, fallback: ChannelId): BatchPost[] {
  const chunks = input.replace(/\r\n/g, "\n").split(/^[ \t]*---[ \t]*$/m);
  const posts: BatchPost[] = [];
  for (const chunk of chunks) {
    let text = chunk.replace(/^\s*\n/, "").replace(/\s+$/, "");
    let channel = fallback;
    const m = /^[ \t]*channel[ \t]*:[ \t]*(.+?)[ \t]*(\n|$)/i.exec(text);
    if (m) {
      channel = matchChannel(m[1]) ?? fallback;
      text = text.slice(m[0].length).replace(/^\s*\n/, "");
    }
    if (text.trim()) posts.push({ channel, text });
  }
  return posts;
}
