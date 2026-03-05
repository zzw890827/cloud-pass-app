# Cloud Pass App - Development Progress

## Phase 1: Foundation
- [x] FastAPI project setup with dependencies
- [x] SQLAlchemy models (Provider, Exam, Question, Option, User, UserProgress, Bookmark)
- [x] Database setup (async SQLite)
- [x] Auth API (register, login, refresh, me)
- [x] JSON import API
- [x] Next.js project (bun, Tailwind, TypeScript)
- [x] Root layout + Navbar
- [x] Login/Register pages + AuthContext
- [x] API client (api-client.ts)

## Phase 2: Practice Mode
- [x] Providers/Exams API endpoints
- [x] Questions API (list, detail, submit)
- [x] Progress API
- [x] Dashboard (Provider grid)
- [x] Exam overview page (progress stats)
- [x] Practice page (QuestionCard, SingleChoice, MultiChoice, ExplanationPanel, Navigator)

## Phase 3: Bookmarks + Review
- [x] Bookmarks API
- [x] BookmarkButton component
- [x] Review page (reuses practice components, exam filter)

## Phase 4: Polish
- [x] Progress reset functionality
- [x] Admin import page (file upload UI)
- [x] Responsive design
- [x] Error handling & loading states

## Code Review Fixes Applied
- [x] Fixed order_index calculation in import service
- [x] Added onupdate to attempted_at in UserProgress
- [x] Added is_active check in login_user
- [x] Fixed previously-answered questions not showing correct/incorrect highlighting
- [x] Added per_page cap (200) to prevent abuse
- [x] Provider/exam metadata now updates on re-import
- [x] Fixed auto-submit race condition with useCallback + ref guard
- [x] Pinned bcrypt==4.0.1 for passlib compatibility

## Verification
- [x] Backend: All service layer tests pass (import, auth, questions, bookmarks, progress, reset)
- [x] Frontend: Builds successfully with no TypeScript errors
- [ ] Manual: Start both servers and test full flow
