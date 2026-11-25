# Slack gate

Slack is a second front door to the same backend. People check posts and decide on them from Slack. Every rule that applies in the studio applies there too, because the database enforces them rather than the UI.

> **Spec / portfolio build.** A concept for a marketing team of under 50 people. It is not a production deployment for any client.

## What it does

| In Slack | What happens |
|---|---|
| `/brand check <post>` | Saves the post exactly as written to the linked brand. Runs the deterministic check and the editorial AI review, then sets it to **In review**. Posts the recommendation, score, flagged phrases and decision buttons in the channel. |
| `/brand check instagram: <post>` | Same, for another channel. The colon is required so that a post beginning "LinkedIn is…" isn't misread as a channel name. Aliases: `ig`, `carousel`, `twitter`, `fb`, `case-study`. |
| **Approve** button | Approves the piece as the person who clicked. |
| **Send back** / **Kill** buttons | Opens a modal asking for a reason. The database refuses both without one. Kill is final. |
| `/brand queue` | Lists up to 10 pieces waiting for review in your brand. Only you see it. |
| `/brand link` / `unlink` | Connects or disconnects your Slack user and your studio account. |

Once someone decides, the message is rewritten to show who decided and why, with no buttons left to press twice.

## How identity works (the important part)

```
Slack user ──signed request──► /api/slack/*  (signature + 5-min replay window)
                                  │
                       slack_links: (team, slack user) → studio user + brand
                                  │
                 mint a short-lived session for that studio user
                                  │
         same RLS-scoped client the web app uses ──► set_content_status()
                                                         │
                                  stamp_content_item trigger: approver role?
```

- **The bot never decides with the master key.** `stamp_content_item` refuses Approve, Send back and Kill when `auth.uid()` is null, and checks `can_approve_brand`. Each Slack action therefore runs as the linked member, and an editor clicking Approve in Slack gets the same refusal as in the studio.
- **Linking needs two proofs.** `/brand link` returns a signed token valid for 10 minutes that names the Slack user. The person opens it while signed in to the studio, and the server takes the studio user id from that session, never from the request. The token works once (`slack_link_nonces`). Demo guests can't link.
- **The minted session never leaves the server.** It is revoked after each action.
- **The agent proposes and a named person decides.** `src/slack/agent-tools.ts` defines `check_post` and `list_review_queue` as JSON-schema tools for a future LLM agent. There is deliberately no decision tool. Decisions exist only as signed button clicks.

## Files

| Path | Role |
|---|---|
| `src/server.ts` | Sends `/api/slack/*` to the Slack router before TanStack routing. Needed for the raw body and `waitUntil`. |
| `src/slack/router.server.ts` | Endpoints: acknowledges within 3 s, does slow work in `waitUntil`. |
| `src/slack/session.server.ts` | Acts as the linked member. |
| `src/slack/links.server.ts` | Link, unlink, message references. Service-role writes after the checks. |
| `src/slack/verify.ts`, `link-token.ts`, `commands.ts`, `interactions.ts`, `blocks.ts`, `summary.ts` | Pure logic, unit-tested in `slack.test.ts`. |
| `src/lib/content-core.server.ts` | The shared "save, check, send for review" path. Moved out of `content.functions.ts` so the web app and Slack run the same code. |
| `src/routes/_authenticated/connect-slack.tsx`, `src/lib/slack.functions.ts` | The "Connect Slack" page. |
| `drizzle/migrations/0007_slack_gate.sql` | `slack_links`, `slack_link_nonces`, `slack_messages`. RLS on all three, with no client writes. |
| `slack/manifest.yml` | Slack app manifest. |

## Setup (in order)

1. **Database:** apply `0007_slack_gate.sql` to the Lovable Cloud database. `NEEDS CONFIRMATION`: whether Lovable applies a migration that arrives through GitHub sync, or whether you ask its agent to run it. Then regenerate `src/integrations/supabase/types.ts`. Until then, the new tables are read through an untyped client.
2. **Secrets** (Lovable → Secrets, never `.env`, which is committed):
   - `SLACK_SIGNING_SECRET`: Slack app → Basic Information.
   - `SLACK_BOT_TOKEN`: `xoxb-…`, from OAuth & Permissions after install.
   - `SLACK_LINK_SECRET`: a long random string, for example `openssl rand -hex 32`.
   - `SUPABASE_SERVICE_ROLE_KEY` is already provided by Lovable Cloud.
3. **Slack app:** create it from `slack/manifest.yml`, replace `YOUR-APP-URL` with the published URL, and install it to the workspace.
4. **Per person:** `/brand link`, open the button, pick the brand, Connect.
5. **Per channel:** `/invite @Brand Voice Studio` so results post for the team. Without the invite, the submitter sees the result privately with no buttons.

## Known limits

- **Auth rate limit.** Every Slack action mints one session, which costs one token verification. Supabase limits verifications per IP. Its rate-limits page gives a default of 30 per 5 minutes, and its production checklist says 360 per hour. Both are configurable, and the project's dashboard has the real value. All Slack traffic comes from the server, so the limit is shared by the whole team. That is enough for a small team's review traffic. Beyond that, the upgrade is a `SECURITY DEFINER` function that sets the request claims for the linked user inside Postgres, so no session has to be minted.
- **Only items that start in Slack appear in Slack.** Pieces submitted in the web app aren't pushed to a channel yet. Next step: a cron (the generated `cron-auth.ts` pattern) that posts new `In review` items to a configured channel and stores their `slack_messages` row.
- **Retries are dropped.** If Slack retries (`X-Slack-Retry-Num`), we answer 200 and do nothing, because the first attempt is already running. If that first attempt died, the person runs the command again.
- **Decisions in the studio don't update the Slack message.** The message keeps its buttons. Pressing one on a piece that is no longer In review is refused with a private note. The check happens just before the RPC, so two approvers clicking in the same second could both succeed, which logs two approvals of the same piece. That's harmless, but a status-guarded RPC would close the gap.
- **Supabase verify type:** the code uses `verifyOtp({ type: "magiclink" })` with the admin-generated `hashed_token`. Supabase marks `magiclink` as deprecated in favour of `email`. Not yet verified against this project.

## Verification status (25 Nov 2026)

**Verified locally**
- `tsc --noEmit` passes.
- `vite build` passes, and the client bundle contains none of the Slack secrets, the service-role key or the reviewer prompt.
- ESLint is clean on all new and moved files. The repo already had about 1,200 Prettier errors before this branch.
- Unit tests in `src/slack/slack.test.ts`: signature (valid, stale, tampered, wrong secret, missing), link token (round trip, expired, forged payload, garbage, fresh nonce), command parsing, block layouts, interaction parsing, summary mapping, and a check that no decision is exposed as an agent tool.
- Full suite: 15 files, 148 tests passed (121 existing + 27 new).

**Biggest live risks (check these first)**
1. **Per-user magic-link cooldown.** Supabase allows one magic link per user every 60 s by default. Its docs don't say whether admin `generateLink` is exempt, and one GitHub issue reports that repeated `generateLink` calls return the same token. If either applies, an approver clicking Approve on three posts in a row is refused after the first. Test that sequence first. If it fails, the `SECURITY DEFINER` claims approach under Known limits stops being an upgrade and becomes required.
2. **Workers `waitUntil` cap: 30 s** after the response, shared by all `waitUntil` calls in the request. Unsettled work is cancelled silently. The check runs the editorial AI review, and its duration on the default model hasn't been measured. If it regularly takes 20 s or more, move the slow path to a Cloudflare Queue consumer, which gets 15 min.

**Not verified (needs the live project)**
- The migration applied to Lovable Cloud.
- Session minting (`generateLink` → `verifyOtp` → `signOut`) against the real auth server.
- Any round trip through Slack: slash command, modal, `chat.update`.
- `waitUntil` behaviour on the deployed Worker.
