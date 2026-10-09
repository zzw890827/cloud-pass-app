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

## User Management — per-user exam access

Users could all see every exam. Adds a control column plus a grant table so an
admin can restrict an exam to named users, managed from a new **User
Management** screen.

Access rule: `exams.is_public` OR a `user_exam_access` row OR `user.is_admin`.
`is_public` defaults to true, so every already-imported exam stayed open — no
backfill.

- [x] `exams.is_public` column + `user_exam_access(user_id, exam_id)` table,
      migration `0006_robust_zarek.sql`
- [x] `lib/exam-access.ts` — one module holding the rule: `examVisibleFilter`
      (list queries), `examIdVisibleFilter` (queries that don't join `exams`),
      `assertExamAccess` / `assertQuestionAccess` (403), each admin-bypassing
- [x] Enforced at every entry point: exams list/detail, providers list/detail,
      questions list/detail/submit, progress, bookmarks (add/remove and the
      Review list), and exam-sessions — the latter via a `/:id*` middleware on
      the session's exam, so revoking access also stops resuming an old session
- [x] `exam-delete-service` also drops the exam's grants (D1 has no FK enforcement)
- [x] Admin API: `GET/PATCH /admin/users`, `PUT /admin/users/:id/exams`,
      `PATCH /admin/exams/:id` (visibility)
- [x] `/admin/users` page — searchable user list, Active/Admin toggles, exam
      checkboxes grouped by provider; public exams greyed out with a badge
- [x] Maintenance page: Public/Restricted badge + toggle per exam, link to Users
- [x] Navbar: Users link (desktop + mobile)
- [x] `ErrorState` + `errorMessage()` — a 403 now renders a message instead of a
      forever-spinner on the exam, practice and session pages

### Verification
Both dev servers, migration applied locally. Restricted MLS-C01 and confirmed
for a non-admin: hidden from `/exams`, `/providers` (the provider itself drops
out at 0 visible exams) and the provider page; 403 on exam detail, questions
list, question detail, submit, progress, session create, `history?exam_id=`,
and — after revoking mid-session — on the session and its questions; the
bookmark on that exam disappeared from `/bookmarks`. Granting reopened all of
it. Guard rails: self-demotion 403s, unknown exam id 404s, empty patch 400s,
deactivating a user 403s every call. Browser-verified as `final01@example.com`:
one provider listed, granted exam fully usable, restricted exam renders
"Exam unavailable" / "Questions unavailable". `tsc --noEmit` clean in both
packages; eslint clean on all changed files (3 pre-existing errors in
AuthContext/ThemeContext/QuestionNavigator, untouched).

Note: `/admin/users` shows the exam checkboxes for an admin too, but they are
inert — admins bypass grants. Left visible so a demoted admin's grants are
already in place.

### Review
Two rounds, both clean of CRITICAL. Round 2 re-tested the whole endpoint matrix
live as a non-admin and found no un-gated route.

Round 1's real find was a D1 bound-parameter overflow in `setUserExamAccess`:
the grant insert chunked by *row* count (95) but each row binds two parameters
against D1's cap of 100. Granting 51+ exams 500'd, and since the UI re-sends the
whole grant list on every checkbox toggle, that user's access would have become
permanently uneditable. Reproduced the 500 with 60 exams, fixed by halving the
chunk, re-verified. Round 1 also caught that the exam/practice/session pages
never reset `error` between loads — App Router keeps the component mounted
across a dynamic-segment change, so a 403 followed the user to an exam they
*could* access — and that `GET /providers/:id` was ungated while the list route
hid the same provider.

Round 2 found that fix's own fallout: `providers/[providerId]` had no `.catch`,
so the newly-possible 404 rendered a permanent spinner. Same bug in the result
page, which `[sessionId]/page.tsx` redirects to whenever a session isn't
in-progress. Both now use the state-tagged-by-id pattern already established in
`exams/[examId]/history/page.tsx` — it fixes the stale-state class outright
rather than resetting, and satisfies `react-hooks/set-state-in-effect`. The
multi-page load in `practice/page.tsx` also got a `cancelled` guard: switching
exams mid-load could land page A's questions under exam B's URL.

Fixed while here, pre-existing and unrelated to access control:
`deleteExam` passed every question and session id to `inArray` unchunked, so
`DELETE /admin/exams/:id` 500'd for any exam over ~100 questions — including the
real 107-question MLS-C01, i.e. the Maintenance Delete button was already broken
for it. Reproduced with a 105-question throwaway exam, chunked the same way,
re-verified the delete succeeds.

Known gaps left in place:
- A public exam's checkbox renders checked-and-disabled whether or not a grant
  row exists, so a grant made while the exam was restricted is invisible until
  it is restricted again. The checkbox answers "can this user reach this exam",
  which is the more useful question.
- `assertExamAccess` 403s for exams that don't exist, so a non-admin sees "you
  do not have access" where an admin sees 404. No information leak.
- Newly imported exams default to `is_public = true`, matching the migration's
  treatment of existing rows. An import does not silently unrestrict an exam
  that was already restricted.

---

# Feature: Per-user domain restriction + exam-mode permission

Decisions (confirmed with user 2026-10-09):
- Domain restriction is per (user, exam); no rows = all domains visible. Applies to public and restricted exams.
- When restricted, questions with `domain_id = NULL` are hidden (whitelist semantics).
- Exam mode is a global per-user flag `users.can_use_exam_mode`, default true.
- Exam mode draws only from the allowed domains (quotas re-normalised over allowed domains).
- Admins bypass both (consistent with existing exam-access rule).

## Backend (workers-api)
- [x] Schema: `users.can_use_exam_mode` (bool, default true)
- [x] Schema: new table `user_exam_domain_access(user_id, exam_id, domain_id)`, unique (user_id, domain_id), index (user_id, exam_id). `exam_id` stored so a deleted domain fails closed.
- [x] Migration 0007 via `npm run db:generate`
- [x] `lib/exam-access.ts`: `questionDomainVisibleFilter(user)` SQL (EXISTS-based, no inArray); extend `assertQuestionAccess` to check domain; `assertExamModeAllowed(user)`
- [x] Apply domain filter: practice question list + total, question detail/submit, bookmarks add/remove/list, progress summary/detail, exam detail domain list, unused-questions, weighted selection in `createSession`
- [x] Exam mode gate: 403 on create session, get session question, submit, resume (pause/complete/abandon/result/history still allowed)
- [x] Auth: put `canUseExamMode` on context user, expose `can_use_exam_mode` in `/auth/me`
- [x] Admin API: PATCH `/admin/users/:id` accepts `can_use_exam_mode`; `GET /admin/users` returns `can_use_exam_mode` + `domain_restrictions` ({exam_id: domain_ids}); `PUT /admin/users/:id/exams/:examId/domains {domain_ids}` (empty = unrestricted, validates domains belong to exam); `GET /admin/exam-domains`
- [x] `deleteExam` also clears `user_exam_domain_access`

## Frontend
- [x] Types + api-client for the new fields/endpoints
- [x] `/admin/users`: "Exam mode" toggle; per-exam "Domains" expander with checkboxes and an "All domains / N of M" summary
- [x] Exam overview: hide Start/Resume Exam and show a note when exam mode is disabled

## Verification
- [x] `tsc --noEmit` + eslint in both packages
- [x] Local wrangler dev: as non-admin with restriction, check practice list/total, detail 403 on hidden domain, exam session draws only allowed domains, exam mode 403
- [x] Admin UI check in browser
- [x] code-reviewer loop until no CRITICAL/IMPORTANT

Known non-goal: sessions completed before a restriction was added stay reviewable as-is (result / error report).

## Review (2026-10-09)
- Implemented as planned. Migration: `workers-api/drizzle/0007_modern_metal_master.sql` (applied locally only — prod is applied by CI on deploy).
- Deviations from plan, from code review:
  - `user_exam_domain_access.domain_id` has no FK, so a deleted domain can never cascade a restriction away.
  - `visibleQuestionCountFor` nests its SQL so drizzle qualifies columns (bare top-level select `sql` renders unqualified on un-joined queries → wrong counts).
  - Provider detail count also domain-filtered.
  - Narrowing a user's domains abandons their in-progress session for that exam if it holds a now-hidden question (otherwise the session would keep serving hidden questions).
  - Exam overview offers "Abandon" when exam mode is off and a session is active.
- Verification: tsc (both packages), eslint on changed frontend files, 46-check API e2e script against local wrangler dev, headless-Chrome check of /admin/users (as admin) and the exam overview (as restricted user).
- Review loop: round 1 → 2 IMPORTANT + 7 MINOR (all fixed except cosmetic #7); round 2 → 0 CRITICAL/IMPORTANT, 2 MINOR (fixed).
- Pre-existing, out of scope: `deleteExam` does not delete `exam_domains` rows; 3 pre-existing eslint errors (QuestionNavigator, AuthContext, ThemeContext).
