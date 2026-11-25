/**
 * Slack request signing (v0). Pure and runtime-neutral: WebCrypto works in Cloudflare
 * Workers and in Node 20+. Always verify the raw body before parsing it.
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */

/** Slack's own guidance: reject anything older than five minutes (replay protection). */
export const MAX_SKEW_SECONDS = 60 * 5;

const enc = new TextEncoder();

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison so timing doesn't leak how much of a signature matched. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export type SignatureResult =
  { ok: true } | { ok: false; reason: "missing" | "stale" | "mismatch" };

export async function verifySlackSignature(opts: {
  signingSecret: string;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  /** Seconds since epoch; injectable for tests. */
  nowSeconds?: number;
}): Promise<SignatureResult> {
  const { signingSecret, timestamp, signature, rawBody } = opts;
  if (!signingSecret || !timestamp || !signature) return { ok: false, reason: "missing" };
  const ts = Number(timestamp);
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > MAX_SKEW_SECONDS) {
    return { ok: false, reason: "stale" };
  }
  const expected = `v0=${await hmacSha256Hex(signingSecret, `v0:${timestamp}:${rawBody}`)}`;
  return timingSafeEqualStr(expected, signature) ? { ok: true } : { ok: false, reason: "mismatch" };
}
