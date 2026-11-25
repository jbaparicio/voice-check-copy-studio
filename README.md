# BRS-Demo-Brand Studio

Build a web app called "Brand Voice Studio": an AI copywriting tool that writes on-brand content for different channels. It's for marketing teams who are not technical. Every screen should be self-explanatory, use plain language (no AI or dev jargon), and have helpful empty states and tooltips. Visual style: clean, calm and modern, with lots of white space and a single accent colour. It must work on mobile and pass basic accessibility (contrast, keyboard navigation, labels).

Use Lovable Cloud for auth, database and file storage, and Lovable's built-in AI for generation. All AI calls go through backend functions, never from the browser.

Core concept

A team sets up a Brand Kit once (rules, tone, guidelines, examples, personas, goals). Then anyone can create content in three steps: What → Who & why → How it should feel. The app generates copy for each selected channel. A second AI pass checks every output against the Brand Kit before a human approves it. Nothing is ever published automatically.

1. Onboarding wizard (first login, about 5 minutes)

A friendly step-by-step setup with a progress bar. Users can skip any step and come back later:
1. Brand basics: name, one-line description, website, industry, language and spelling variant (e.g. British English, American English, German), and number format (e.g. 25,000 or 25.000).
2. Tone of voice: the default tone sliders (see section 4) plus 3–5 voice adjectives, chosen as chips (e.g. confident, warm, witty) or typed in.
3. Optional upload of brand guidelines.
4. First persona and first business goal.
   Finish on a screen that says "Create your first post".

2. Brand Kit (left-nav section with tabs)

- Voice & tone: default slider positions, voice adjectives, "we sound like / we never sound like" pairs, and a short brand story.
- Rules: simple lists users can add to and remove from:
  - Do / Don't rules
  - Banned words and phrases (e.g. "synergy", "game-changer")
  - Preferred terms, written as "say X, not Y"
  - Emoji policy (none / sparing / free)
  - Exclamation marks allowed (yes/no per channel)
  - Spelling variant
  - Formatting rules (e.g. m² not m2)
- Facts & claims: a table of approved facts the AI may use. Columns: fact, number, source, date checked. Plus a list of claims that need a source (e.g. "#1", "biggest", "first ever"). The AI must only use numbers from this table or from the brief.
- Names & clearance: names that can be mentioned (clients, partners, people), names that must never be mentioned, and which handles are allowed to be tagged.
- Guidelines: upload PDF, DOCX or TXT brand guidelines into storage. Show the file list. (Rule extraction comes in a later step; for now just store the files and show their extracted text.)
- Examples library: paste or upload past content that represents the brand well. Each example has a channel, title, text, a "great example" or "avoid this" label, and optional notes. These are used as style references when generating.
- Personas: cards with name, role or job title, company type, goals, pain points, what they care about, preferred channels and language level. Include an "add persona" form with friendly placeholders.
- Business goals: cards with a name (e.g. "Generate leads", "Build employer brand", "Announce an award"), a description, the desired action (CTA type) and how success is measured.

3. Create content (the main screen)

A three-step flow on one page. Left side: inputs. Right side: results.
- Step 1, What: a brief text box ("What do you want to say?"), optional key facts (picked from Facts & claims, or typed in and marked "unverified"), optional link, and optional example references.
- Step 2, Who & why: pick a persona and a business goal from dropdowns that show their cards. Pick one or more channels as big toggle chips: LinkedIn post, Instagram caption, TikTok caption + on-screen text, X/Twitter, Facebook, blog post, newsletter, website case study, outreach email.
- Step 3, How it should feel: sliders (section 4) that start from the Brand Kit defaults, plus a "Reset to brand default" button. Preset buttons above the sliders: "Announcement", "Behind the scenes", "Thought leadership", "Celebration", "Soft sell".
- A big Generate button.

4. Sliders (simple language, 5 steps each, with a label at each end)

- Formal ↔ Casual
- Serious ↔ Playful
- Understated ↔ Bold
- Rational (facts) ↔ Emotional (story)
- Short & punchy ↔ Detailed
- Soft CTA ↔ Direct CTA
- Emoji: None ↔ Plenty (limited by the brand emoji policy)
- Hashtags: number per channel (0–10), defaulting to channel best practice

Show a one-line live preview under the sliders that describes the current mix in words (e.g. "Warm and confident, short, story-led, gentle call to action").

5. Results

One card per channel with:
- Hook preview: the first ~125–200 characters, highlighted to show what appears before "see more".
- Full copy, editable inline.
- Hashtags as removable chips, with a "suggest more" button. Hashtags should be specific and relevant, never generic filler.
- CTA line.
- Suggested alt text for images (social channels).
- For TikTok: separate caption, on-screen text lines and a hook for the first 2 seconds. Add a reminder to use commercially licensed audio.
- For blog posts and case studies: an H1, H2 structure, meta description and FAQ block.
- Character count against the channel's recommended range, shown as a green/amber/red bar.
- Quick-adjust buttons: Shorter, Longer, More emotional, More factual, Punchier hook, Different angle. Each regenerates only that card.
- "Generate 2 more variants" (shown side by side).
- Copy to clipboard as plain text, with no markdown symbols.

6. Brand check (automatic second AI pass on every card)

Each card shows a Brand score (0–100) and a short checklist with ✓ / ⚠ / ✕:
- Tone matches the sliders and voice adjectives
- No banned words; preferred terms used
- Spelling matches the spelling variant
- Every number and fact is in Facts & claims or the brief. Anything else is flagged "Needs confirmation".
- No names from the "never mention" list. Names not on the "can mention" list are flagged "Needs clearance".
- Unsupported superlatives flagged
- Platform fit (length, hashtag count, emoji policy, exclamation marks)

Each flag explains the problem in plain language and offers a one-click "Fix this" that rewrites only that part. The AI must never invent facts, numbers, clients, awards, quotes or people. If information is missing, it writes a clear placeholder like [NEEDS CONFIRMATION: guest number].

7. Approval and library

- Status on each piece: Draft → In review → Approved (or Changes requested). The Approved status can only be set by a person and is labelled with their name and the date.
- Content library page: filter by channel, persona, goal, status and date; search by text.
- Export approved content as CSV, or copy it as plain text.
- An activity log for each piece: who generated it, which settings, what the brand check flagged, and who edited and approved it.

8. Generation logic (backend function)

Build the AI prompt from:
- Brand Kit: voice, rules, facts, names, and up to 3 relevant "great" examples for that channel, plus any "avoid" examples
- The persona, the business goal, the brief, the slider values turned into plain-language instructions, and channel conventions
- Channel conventions:
  - LinkedIn: a hook in the first 2 lines, then story → proof → takeaway → soft CTA, about 600–1,300 characters, 3–5 hashtags, no exclamation marks if the brand rule says so
  - Instagram: a hook in the first 125 characters, line breaks, 3–8 hashtags, alt text
  - TikTok: a very short caption, on-screen text, and a hook in the first 2 seconds
  - X: under 280 characters
  - Blog / case study: headline with the outcome → context → challenge → solution → results → CTA, written for SEO
  - Email: a personalised first line, one ask, under 150 words

Return structured JSON for each channel (hook, body, hashtags, cta, alt_text, char_count, plus extra fields for each channel type). Then run the brand-check function on each output.

9. Data model

Tables:
- workspaces and members (roles: admin, editor, approver)
- brands: settings, default sliders, spelling, number format, emoji policy
- brand_rules (type, text)
- facts (fact, value, source, checked_at)
- names (name, type, status: allowed / never / tag_allowed)
- guideline_files
- examples
- personas
- goals
- content_requests (brief, persona, goal, channels, sliders)
- content_items (channel, fields, status, brand_score, flags, approved_by, approved_at)
- activity_log

Use row-level security so users only see their own workspace.

10. Demo data

Seed one fictional brand, "Northlight Studio", an experiential events agency with British English. Give it a few rules, 5 facts, 2 personas (e.g. "Brand Marketing Director", "Event Manager"), 2 goals and 3 examples, so the app is usable right away. Don't use any real company's name or branding.

Build order for this first version

Build sections 1–5 and 9–10 now: onboarding, Brand Kit, Create, sliders, results, data and demo. Include a basic version of the brand check (banned words, spelling variant, character limits). Keep the code tidy so the AI brand check, guideline extraction and approvals can be added next.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://voice-check-copy-studio.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6c194e8c-5e05-4e78-8713-bc94b42f2466).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
