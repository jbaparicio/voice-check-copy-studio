export type ChannelId =
  | "linkedin"
  | "instagram"
  | "tiktok"
  | "x"
  | "facebook"
  | "blog"
  | "newsletter"
  | "case_study"
  | "email";

export type ChannelKind = "social" | "long" | "email";

export interface ChannelConfig {
  id: ChannelId;
  label: string;
  short: string;
  kind: ChannelKind;
  /** Recommended character range for the main copy. */
  range: [number, number];
  /** Hard limit, if the platform has one. */
  hardLimit?: number;
  /** How many characters show before "see more". */
  hookLength: number;
  hashtagDefault: number;
  hashtagRange: [number, number];
  /** Plain-language conventions the writer follows. */
  conventions: string;
  help: string;
}

export const CHANNELS: ChannelConfig[] = [
  {
    id: "linkedin",
    label: "LinkedIn post",
    short: "LinkedIn",
    kind: "social",
    range: [600, 1300],
    hardLimit: 3000,
    hookLength: 200,
    hashtagDefault: 3,
    hashtagRange: [3, 5],
    conventions:
      "Put a strong hook in the first two lines (under 200 characters). Then follow: story, proof, takeaway, soft call to action. Use short paragraphs with line breaks. Aim for 600 to 1,300 characters. Use 3 to 5 specific hashtags at the end.",
    help: "Best for professional stories, proof and thought leadership.",
  },
  {
    id: "instagram",
    label: "Instagram caption",
    short: "Instagram",
    kind: "social",
    range: [125, 1000],
    hardLimit: 2200,
    hookLength: 125,
    hashtagDefault: 5,
    hashtagRange: [3, 8],
    conventions:
      "Hook in the first 125 characters. Use line breaks for readability. 3 to 8 specific hashtags at the end. Always write descriptive alt text for the image.",
    help: "Visual, warm and sensory. The first line does the heavy lifting.",
  },
  {
    id: "tiktok",
    label: "TikTok caption + on-screen text",
    short: "TikTok",
    kind: "social",
    range: [50, 300],
    hardLimit: 2200,
    hookLength: 100,
    hashtagDefault: 4,
    hashtagRange: [3, 5],
    conventions:
      "Write a very short caption (under 150 characters ideally). Provide 3 to 6 short on-screen text lines, and a hook that grabs attention in the first 2 seconds of the video.",
    help: "Short caption, on-screen text and a hook for the first 2 seconds.",
  },
  {
    id: "x",
    label: "X / Twitter",
    short: "X",
    kind: "social",
    range: [70, 280],
    hardLimit: 280,
    hookLength: 280,
    hashtagDefault: 1,
    hashtagRange: [0, 2],
    conventions:
      "Must be under 280 characters including hashtags. One clear idea. 0 to 2 hashtags.",
    help: "One sharp idea in under 280 characters.",
  },
  {
    id: "facebook",
    label: "Facebook post",
    short: "Facebook",
    kind: "social",
    range: [100, 600],
    hardLimit: 63206,
    hookLength: 150,
    hashtagDefault: 2,
    hashtagRange: [0, 3],
    conventions:
      "Friendly and conversational. Hook in the first 150 characters. 100 to 600 characters. 0 to 3 hashtags. Write alt text for the image.",
    help: "Friendly, community-minded and easy to share.",
  },
  {
    id: "blog",
    label: "Blog post",
    short: "Blog",
    kind: "long",
    range: [3500, 8000],
    hookLength: 200,
    hashtagDefault: 0,
    hashtagRange: [0, 0],
    conventions:
      "Written for search. Headline (H1) with the outcome, then sections: context, challenge, solution, results, call to action. Provide H2 section headings, a meta description under 155 characters and an FAQ block with 3 questions.",
    help: "Long-form, structured and written to be found in search.",
  },
  {
    id: "newsletter",
    label: "Newsletter",
    short: "Newsletter",
    kind: "email",
    range: [600, 2000],
    hookLength: 150,
    hashtagDefault: 0,
    hashtagRange: [0, 0],
    conventions:
      "A subject line under 50 characters, a warm opening line, two or three short sections and one clear call to action.",
    help: "A friendly update for people who already know you.",
  },
  {
    id: "case_study",
    label: "Website case study",
    short: "Case study",
    kind: "long",
    range: [2500, 6000],
    hookLength: 200,
    hashtagDefault: 0,
    hashtagRange: [0, 0],
    conventions:
      "Headline (H1) with the outcome, then: context, challenge, solution, results, call to action. Provide H2 section headings, a meta description under 155 characters and an FAQ block with 3 questions. Only use results that are in the approved facts or the brief.",
    help: "Proof of what you did and the difference it made.",
  },
  {
    id: "email",
    label: "Outreach email",
    short: "Email",
    kind: "email",
    range: [300, 900],
    hookLength: 120,
    hashtagDefault: 0,
    hashtagRange: [0, 0],
    conventions:
      "A subject line under 50 characters. A personalised first line, one single ask, under 150 words in total. No hashtags.",
    help: "A short, personal note with one clear ask.",
  },
];

export const CHANNEL_MAP: Record<ChannelId, ChannelConfig> = Object.fromEntries(
  CHANNELS.map((c) => [c.id, c]),
) as Record<ChannelId, ChannelConfig>;

export function getChannel(id: string): ChannelConfig {
  return CHANNEL_MAP[id as ChannelId] ?? CHANNELS[0];
}

export function defaultHashtags(): Record<ChannelId, number> {
  return Object.fromEntries(CHANNELS.map((c) => [c.id, c.hashtagDefault])) as Record<
    ChannelId,
    number
  >;
}

export type LengthStatus = "good" | "close" | "off";

/** Green when inside the range, amber when within 20% of it, red otherwise or over a hard limit. */
export function lengthStatus(channel: ChannelConfig, count: number): LengthStatus {
  const [min, max] = channel.range;
  if (channel.hardLimit && count > channel.hardLimit) return "off";
  if (count >= min && count <= max) return "good";
  if (count >= min * 0.8 && count <= max * 1.2) return "close";
  return "off";
}
