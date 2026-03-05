## Agent Workflow

### Workflow Orchestration

#### 1. Plan Node Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

#### 2. Subagent Strategy

- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One tack per subagent for focused execution

#### 3. Self-Improvement Loop

- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules that prevent the same mistake from recurring
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant context

#### 4. Develop → Review → Fix Loop

For non-trivial implementation tasks, use the iterative review loop:

1. **Develop**: Implement features (use agent teams for parallel work when possible)
2. **Full Review**: Launch `code-reviewer` subagent to review ALL changed files against the plan. Check cross-file consistency, schema compliance, data flow, error handling, security, edge cases
3. **Fix**: Fix all CRITICAL and IMPORTANT issues found. Run lint/type checks after fixes
4. **Re-review**: Launch another review round to verify fixes and find remaining issues
5. **Repeat** until the review finds zero CRITICAL/IMPORTANT issues

Key points:
- Each review must read every line of every changed file — no shortcuts
- Classify findings as CRITICAL (runtime errors), IMPORTANT (incorrect behavior), MINOR (code quality)
- Fix all CRITICAL/IMPORTANT before declaring done; MINOR can be batched
- Run `eslint`, `tsc --noEmit` after each fix round to catch regressions

#### 5. Verification Before Done

- Never mark a task complete without proving it works
- Diff behavior between `develop` and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

#### 5. Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

#### 6. Autonomous Bug Fixing

- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

### Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

### Core Principles

- **Simplicity First**: Make every change as simple as possible. Minimal code impact.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
