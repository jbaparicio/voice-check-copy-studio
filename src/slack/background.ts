/**
 * Keeps slow Slack work alive after the 3-second acknowledgement.
 *
 * On Lovable's Cloudflare deployment, nitro calls our server entry as `fetch(req)` with no
 * `ctx`, but it attaches the Worker's `waitUntil` to the request itself (`req.waitUntil`).
 * Without it, the Worker stops the work as soon as Slack gets its reply. Pure and tested.
 */
type WaitUntilFn = (p: Promise<unknown>) => void;

function pick(source: unknown): WaitUntilFn | null {
  const fn = (source as { waitUntil?: unknown } | null | undefined)?.waitUntil;
  return typeof fn === "function" ? (fn as WaitUntilFn).bind(source) : null;
}

export function resolveWaitUntil(request: unknown, ctx: unknown): WaitUntilFn {
  const keepAlive =
    pick(ctx) ??
    pick(request) ??
    pick(
      (request as { runtime?: { cloudflare?: { context?: unknown } } })?.runtime?.cloudflare
        ?.context,
    );
  if (!keepAlive) console.warn("[background] no waitUntil available; work may be cut short");
  return (p: Promise<unknown>) => {
    const guarded = p.catch((e: unknown) => console.error("[background]", e));
    keepAlive?.(guarded);
  };
}
