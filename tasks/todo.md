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
