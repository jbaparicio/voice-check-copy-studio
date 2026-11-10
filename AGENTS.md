<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Architecture rules

- All writing-model calls live in `src/lib/*.server.ts` and are reached only through `createServerFn` + `requireSupabaseAuth` in `src/lib/content.functions.ts` — keeps prompts and keys off the browser.
- Prompt building lives in `src/lib/prompt.server.ts`; channel conventions in `src/lib/channels.ts`; slider wording in `src/lib/sliders.ts` — one place to tune each concern.
- Brand check has two layers sharing the `BrandCheckItem` shape: the pure quick check (`src/lib/brand-check.ts`, runs client and server) and the AI review (`review.server.ts` call + pure helpers in `review.ts`, stored in `content_items.ai_review` with a text fingerprint so edits mark it stale). Card score = the stricter of the two — keeps deterministic failures from being overridden.
- AI "Fix this" replaces only the flagged span in code (`applySpanFix`), falling back to a minimal rewrite only when the span can't be matched; suggested fixes pass `guardSuggestion` so no unsupported number is introduced.
- Data is scoped by workspace: brand child tables carry `brand_id` and RLS uses `can_access_brand()`; new tables must follow the same pattern.
- New users get a profile, workspace (admin role) and the seeded sample brand via the `handle_new_user` trigger and `seed_demo_brand()` SQL function — never seed from app code.
- Guideline files live in the private `guidelines` bucket at `<brand_id>/<file>`; text is extracted server-side in `guidelines.functions.ts` (unpdf / fflate, Worker-safe).
- Status changes go through the `set_content_status()` SQL function (updates + logs to `activity_log` atomically, with the comment). The `content_items_stamp` trigger enforces that only members with the `approver` role can set Approved / Changes requested, stamps `approved_by/approved_at` from `auth.uid()`, and drops approved copy back to draft when its text changes — UI checks in `src/lib/workflow.ts` are convenience only.
- Team roles are multi-row in `workspace_members` (one row per role); role changes, removals and invite acceptance go through security-definer SQL functions (`set_member_role`, `remove_member`, `accept_my_invites`) because the table has no client write policies.
- LinkedIn posting uses the project-linked LinkedIn connection (one account) via `src/lib/linkedin.functions.ts`; who may press "Post now" is the `linkedin_posters` table (checked by `is_linkedin_poster()`), and each live post is recorded once in `linkedin_posts` — prevents teammates posting to someone else's profile and double posts.
- Multi-platform publishing is planned in `src/lib/publish.ts` (`PLATFORMS`, `planPublishing`): each platform lists the channels it accepts and a `live` flag; only live platforms send anything, the rest are plan-only placeholders until connected — one place to add a new platform.
- Deleting content is limited to Draft / Changes requested by the `content_items_guard_delete` trigger (UI check `canDeleteDraft` in `workflow.ts` is convenience only) — reviewed and approved work keeps its record.
- Guest demo uses anonymous sign-in (`TryDemoButton` in `src/components/demo.tsx`); `handle_new_user` gives anonymous users a private "Demo team" (admin+editor+approver), skips onboarding and seeds sample pieces via `seed_demo_content()`. The `stamp_content_item` trigger only skips approval checks for owner-run seeding (`app.demo_seed` + non-client role) — clients can never use that path.
- Writing models are a curated list in `src/lib/models.ts` (browser-safe labels/costs); `writeStructured` routes each id to its gateway endpoint (OpenAI → Responses, Claude → Messages, Gemini → Chat Completions) and ignores ids not on the list. The chosen model is stored on `content_requests.model` / `content_items.writer_model`, and rewrites reuse it; the AI brand check always uses the default model — keeps checks comparable across writers.
- Version history is written only by the `snapshot_content_version` trigger into `content_versions` (read-only to clients); writers label a change by setting `content_items.change_note` in the same update, and back-to-back plain edits by one person merge — so no code path can skip a version.
- Highlight-to-change replaces exactly one range via `src/lib/selection.ts` (`locateSelection` / `spliceText`) after `guardSuggestion`; the model only returns the replacement words.

- Drafts from one brief by different writers are linked on the review page by `src/lib/siblings.ts` (same channel, author and brief within 30 minutes, or same request) — compare runs create one request per writer, so no extra column is needed.
