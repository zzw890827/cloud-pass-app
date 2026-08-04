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
