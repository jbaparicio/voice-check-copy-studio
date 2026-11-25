/**
 * Account-link tokens. `/brand link` in Slack hands the person a short-lived signed URL;
 * they open it while signed in to the studio, and the server binds their *session's*
 * user id to the Slack identity in the token. The token alone never grants anything:
 * it says which Slack user is asking, the studio session says who they are.
 * Single use is enforced in the database (`slack_link_nonces`), not here.
 */
import { hmacSha256Hex, timingSafeEqualStr } from "./verify";

export const LINK_TOKEN_TTL_SECONDS = 10 * 60;

export interface LinkTokenPayload {
  /** Slack team (workspace) id. */
  t: string;
  /** Slack user id. */
  u: string;
  /** Expiry, seconds since epoch. */
  exp: number;
  /** Random nonce, recorded on use so a token works once. */
  n: string;
}

function b64url(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad)));
}

function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createLinkToken(opts: {
  teamId: string;
  userId: string;
  secret: string;
  nowSeconds?: number;
  nonce?: string;
}): Promise<string> {
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  const payload: LinkTokenPayload = {
    t: opts.teamId,
    u: opts.userId,
    exp: now + LINK_TOKEN_TTL_SECONDS,
    n: opts.nonce ?? randomNonce(),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = await hmacSha256Hex(opts.secret, `link:${body}`);
  return `${body}.${sig}`;
}

export type LinkTokenResult =
  { ok: true; payload: LinkTokenPayload } | { ok: false; reason: "invalid" | "expired" };

export async function verifyLinkToken(opts: {
  token: string;
  secret: string;
  nowSeconds?: number;
}): Promise<LinkTokenResult> {
  const [body, sig, extra] = String(opts.token ?? "").split(".");
  if (!body || !sig || extra !== undefined || !opts.secret) return { ok: false, reason: "invalid" };
  const expected = await hmacSha256Hex(opts.secret, `link:${body}`);
  if (!timingSafeEqualStr(expected, sig)) return { ok: false, reason: "invalid" };
  let payload: LinkTokenPayload;
  try {
    payload = JSON.parse(fromB64url(body)) as LinkTokenPayload;
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (!payload?.t || !payload.u || !payload.n || typeof payload.exp !== "number") {
    return { ok: false, reason: "invalid" };
  }
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (now > payload.exp) return { ok: false, reason: "expired" };
  return { ok: true, payload };
}
