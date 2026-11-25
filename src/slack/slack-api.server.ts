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
  const token = process.env["SLACK_BOT_TOKEN"];
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
