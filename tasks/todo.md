# Cloud Pass: Cloudflare Migration

## Phase 1: Foundation — Workers API Skeleton + Drizzle Schema
- [x] package.json, wrangler.toml, tsconfig.json
- [x] Drizzle schema (all 9 tables)
- [x] drizzle.config.ts + src/db/client.ts
- [x] src/index.ts with /health
- [x] Generate migration + verify

## Phase 2: Auth Middleware (CF Access)
- [x] Types (env.ts, context.ts)
- [x] CF Access JWT verification (cf-access.ts)
- [x] Error handling (errors.ts)
- [x] Auth + DB middleware

## Phase 3: Core Routes — Auth(me), Providers, Exams
- [x] Routes: auth.ts, providers.ts, exams.ts
- [x] Services: progress-service.ts

## Phase 4: Questions, Bookmarks, Progress
- [x] Routes: questions.ts, bookmarks.ts, progress.ts
- [x] Services: question-service.ts, bookmark-service.ts

## Phase 5: Exam Sessions
- [x] Routes + service + schemas

## Phase 6: Admin Import + Seed
- [x] Routes + service + schemas + seed script

## Phase 7: Terraform IaC
- [x] All terraform files

## Phase 8: Frontend Adaptation
- [x] Remove login/register, simplify auth, update api-client

## Phase 9: Cleanup
- [x] Remove backend/, update docs

## Code Review Fixes
- [x] CRITICAL: Progress detail camelCase → snake_case keys
- [x] IMPORTANT: Added input validation on session/question submit routes
- [x] IMPORTANT: Added NaN guard on exam_id query params
- [x] MINOR: Removed unused sql import from providers.ts

## Exam Mode: Submit button for single-choice questions
Problem: in exam mode a single-choice answer was auto-submitted and locked the
instant an option was clicked — a misclick was unrecoverable.

- [x] Remove the single-choice auto-submit effect from `ExamQuestionCard`
- [x] Show the `Lock Answer` button for every question type, not just multi
- [x] Add a hint that the selection stays editable until locked
- [x] Ignore option clicks while a submit is in flight (locked answer always
      matches the displayed selection)
- [x] Verify: `tsc --noEmit` clean, no new eslint findings
- [x] Verify: 25/25 headless-Chrome checks (select → change → lock → revisit,
      single and multi), answer persisted via the API

### Review
Single- and multi-choice now share one path: pick freely, then `Lock Answer`.
Locking is still one-way per question — only the pre-lock auto-submit is gone.

## Exam History: Never-drawn questions panel
Goal: on the exam history page, list the questions in the bank that have never
been drawn into any of the user's exam sessions, so gaps in coverage are visible.

- [x] Service `getUnusedQuestions` — exam-scoped, user-scoped, NOT IN sub-query
      (no JS id array, so D1's bound-parameter limit is never in play)
- [x] Route `GET /exam-sessions/unused-questions?exam_id=X`, declared before `/:id`
- [x] Bound the payload: 200-char `question_preview` via SQL `substr`, at most
      200 rows, with an exact `unused_count` alongside
- [x] `UnusedQuestionsList` component — count + coverage %, 20 rows then
      "Show all", each row deep-links to `/practice?questionId=`
- [x] History page fetches the panel separately so its failure cannot blank the
      page; exam-tagged state so a change of `examId` can't render stale data
- [x] Verify: API output matches raw SQL for the empty / partial / full cases,
      abandoned and in-progress sessions count as a draw, 400 without exam_id,
      404 for an unknown exam
- [x] Verify: headless Chrome — all three UI states, "Show all" toggle, capped
      notice, row navigation lands on the right question, and a forced 500 on
      the new endpoint leaves the rest of the page intact
- [x] Verify: `tsc --noEmit` and eslint clean in both packages

### Review
Two review rounds. Round 1: the new fetch was inside the page's `Promise.all`,
so an API-before-frontend deploy would have blanked every history page — split
out; and the response shipped full question texts for the whole bank — replaced
with previews. Round 2: sticky error state across `examId` changes — state is
now tagged with the exam it belongs to; and row count was still unbounded —
capped at 200 with an exact count and a UI notice.

Known limitation (pre-existing, unchanged here): the practice page only loads
the first 200 questions when following `?questionId=`, so deep links past that
point land on question 1. Already fixed on `main`; out of scope for this branch.

## Provider-aware theme: Anthropic exams turn orange
Goal: opening an Anthropic exam repaints the app in Anthropic's orange; every
other provider keeps the existing blue.

- [x] `globals.css`: an `accent` palette as design tokens (`@theme static`, so
      the variables survive pruning for the charts that read them from SVG
      attributes), defaulting to the current blue
- [x] `[data-provider="anthropic"]` scope overrides those variables — an
      unlayered rule, so it wins over `@layer theme` regardless of specificity
- [x] Replace the 25 hardcoded `blue-*` utilities across 14 files with
      `accent-*`; `Badge`'s `blue` variant renamed `accent`; chart `stroke`/
      `fill` read `var(--color-accent-*)`
- [x] `ProviderTheme` client component (rendered by the exam layout, which stays
      a server component) sets `data-provider` on `<html>`, with a module-level
      examId→slug cache so navigation inside an exam neither re-fetches nor
      flashes, and applied before paint on a cache hit
- [x] Backend: `provider_slug` on both `GET /exams` and `GET /exams/:id`
- [x] Verify: Chrome — AWS exam still blue, Anthropic exam orange across
      overview / practice / exam session / history, theme cleared on leaving the
      exam section, `--color-accent-600` reads #a94f33 vs #2563eb
- [x] Verify: `tsc --noEmit` and eslint clean in both packages

### Review
Two rounds. Round 1: the brand orange #d97757 failed WCAG AA in six places the
blue had passed (white-on-button 4.23, links 4.23, rings 2.61) — the 500/600/700
steps were darkened to #c96343/#a94f33/#8a3f28, all combinations now ≥ AA; a
plain `@theme` would have pruned the variables the charts read; every exam
sub-page paid an extra `/exams/:id` round trip. Round 2: passive effects run
after paint, so even a cache hit flashed the default palette for one frame —
the cached path moved to a layout effect, and the cleanup no longer wipes the
attribute on every examId change, only when the exam section is left.

Known trade-off: the very first exam page of a session still repaints once the
API answers; removing that would mean resolving the provider server-side.

## Question draw weights
Goal: a question list in Maintenance where each question's draw weight can be
set from 0 to 100, folded into the existing weighted selection algorithm.

Agreed semantics: 0 excludes a question outright, 100 always draws it, and
1–99 scales the existing score by w/50 — so 50 is neutral and leaves selection
exactly as it behaved before the field existed.

- [x] Schema: `questions.weight integer NOT NULL DEFAULT 50` + migration 0003
- [x] Algorithm: clamp weights, drop weight-0 from the pool entirely, take the
      weight-100 questions first (randomly trimmed if they alone overflow the
      session), scale the rest by w/50; domain quotas allocate what is left
- [x] `createSession` refuses with 422 when nothing is drawable, and records the
      number of questions actually drawn so scoring divides by the right total
- [x] Admin API: `GET /admin/exams/:id/questions`, `PATCH /admin/questions/:id`
- [x] CORS: allow PATCH (it was not in allowMethods)
- [x] UI: `/admin/questions/[examId]` — slider + number box per question,
      auto-saving, reachable from a Questions button on each Maintenance card
- [x] Verify: 60 sessions × fresh users — weight 0 drawn 0/60, weight 100 drawn
      60/60, weight 90 ≈ 2× the average of weight-50 questions, weight 10 well
      below; domain path keeps exact session size with quotas 50/30/20
- [x] Verify: empty pool → 422 with no session left behind; partly excluded pool
      → session sized and scored by what remains
- [x] Verify: validation (-1, 101, 50.5, invalid JSON, null body → 400), authz
      (non-admin → 403 API, "Admin access required" in UI), 404s
- [x] Verify: rapid consecutive edits (80→35→60) end with DB matching the UI
- [x] Verify: `tsc --noEmit` and eslint clean in both packages

### Review
Two rounds. Round 1 found the serious one: excluding questions shrank sessions
silently — all-zero weights produced an empty session that still blocked the
exam behind the "active session" check, and a partly excluded pool scored out
of the exam's configured total, making a pass impossible. Also: non-admins hit
an unreachable access-denied branch and span forever. Round 2: a failed page
request left the spinner up with the error UI unreachable, and concurrent
PATCHes had no ordering, so the stored weight could end up behind the UI —
saves for a row now run on one chain, and a pending edit is flushed on unmount.

Note: questions set to 100 take their slots ahead of content-domain quotas, so
marking many of them shifts a session's domain mix. Said so on the page.

## HotSpot question type
Goal: support a third question type alongside `single`/`multi` — an "Answer
Area" table where each row is a statement assigned to one of a shared list of
choices, as used by the real AWS/Azure exams.

Agreed semantics: one shared choice list for the whole question (every row's
dropdown offers all of it), all-or-nothing scoring (every row must be right),
and per-row correct/wrong marks in review.

Key decision: the answer wire format stays `selected_option_ids: number[]`,
reinterpreted for hotspot as **ordered and index-aligned with the rows** —
`selected_option_ids[i]` is the pick for row `i`, duplicates allowed. That means
no payload-schema change and no change to either persistence column; grading
just compares positionally instead of as sets. The only new data is the row
list, stored as JSON in `questions.hotspot_rows` (`[{text, answer}]`, where
`answer` is an option label). A `question_rows` table was rejected: it would add
a fifth `inArray` query to `getSessionResult`, the exact shape that hit D1's
100-bound-parameter limit before, and nothing edits question content anyway.

- [x] Schema: `questions.hotspot_rows text` (nullable) + migration 0004
- [x] Import: `type`-discriminated zod union; hotspot needs `rows` (≥1) and
      every row `answer` must match an option label, else 422; `is_correct` is
      now optional (defaults false) so hotspot choice lists stay terse
- [x] Grading: extract the set-equality block duplicated in `question-service`
      and `exam-session-service` into `lib/grading.ts`, and branch there — the
      two modes can no longer drift apart
- [x] API: return `hotspot_rows` with `answer` **stripped** pre-answer;
      `correct_option_ids` carries the row-ordered key (added to the session
      result, which otherwise has no way to express a per-row answer)
- [x] Types: widen `question_type` from `string` to a union so the compiler
      points at every branch site instead of silently falling through to single
- [x] UI: one `HotspotAnswerArea` used by all three renderers — practice
      (with marks), exam (no marks), result page (read-only with marks);
      submit gated on every row being picked; no auto-submit
- [x] Docs: README, generate-exam, answer-exam, upload-exam-questions skill
- [x] Verify: grading — all-correct, one-row-wrong, right multiset in the wrong
      order, and an incomplete answer
- [x] Verify: single/multi grading unchanged (multi still order-insensitive,
      partial and superset both wrong)
- [x] Verify: answer key absent from the pre-answer payloads in both modes
- [x] Verify: practice UI — submit disabled until all rows picked, per-row
      marks after submit, picks and marks restored on reload
- [x] Verify: exam UI — Lock Answer gated on a complete answer, no correctness
      leaked, locked answer round-trips through the server
- [x] Verify: result page shows per-row marks and the score counts it once
- [x] Verify: `tsc --noEmit` and eslint clean in both packages

### Review
Two rounds. Round 1 found the serious one: `getSessionResult` had no status
guard, so a candidate mid-exam could `GET /exam-sessions/:id/result` and read
the whole answer key — `options[].is_correct` had always leaked there, and this
branch would have added the per-row hotspot key to the same payload. Now 400s
while the session is `in_progress`; `completed` and `abandoned` still return as
before, and a paused session stays blocked because pausing sets `paused_at`
without changing `status`.

Round 1 also caught a regression of my own: making `is_correct` optional for
hotspot had made it optional for single/multi too, so a question that omitted it
would have imported with zero correct options instead of 422ing. Split into two
option schemas. Same round: `z.union` buried the real error under the other
branch's noise (now `z.discriminatedUnion`), the result payload carried the key
in two encodings (rows now stripped everywhere, `correct_option_ids` is the only
one), answer-stripping was duplicated at both read paths (now one
`publicHotspotRows` helper — the single place that rule is enforced), and
hotspot rows stayed editable during an in-flight submit, so the per-row marks
could describe an answer that was never graded.

Found while probing, before review: a hotspot with no rows graded an empty
submission as correct — `[] === []`. `gradeAnswer` now refuses to pass any
question with an empty answer key, which closes the same hole for a choice
question with nothing flagged correct.

Round 2 was run twice and both agents died to an environment error, so the
re-verification was done directly instead: 22 assertions over grading, the
single/multi regression, answer-key confinement and import validation all pass;
all 45 questions in the two real seed files still validate under the stricter
schema; and the practice, exam and result flows were re-driven in the browser.

Known gap left in place: single/multi imports still don't verify that `single`
has exactly one correct option and `multi` two or more — `num_correct` has
always silently assumed it. Pre-existing and out of scope here.
