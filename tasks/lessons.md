# Lessons Learned

## Cloudflare Deployment

### SQLite datetime('now') lacks timezone indicator
- `datetime('now')` stores UTC as `2026-03-06 12:34:56` without `Z` suffix
- JavaScript `new Date()` parses this as **local time**, not UTC
- **Fix**: Append `Z` before parsing: `startedAt.endsWith("Z") ? startedAt : startedAt + "Z"`
- **Impact**: ExamTimer fired `onTimeUp` immediately, redirecting to result page

### Wrangler environments: local vs production
- Keep `database_id = "local"` in default config for local dev
- Use `[env.production]` with real D1 UUID for remote deployment
- CI must pass `--env production` to both `wrangler d1 migrations apply` and `wrangler deploy`
- Must include `name = "cloud-pass-api"` in `[env.production]` or worker name gets `-production` suffix
- **All vars must be duplicated** in `[env.production.vars]` — they don't inherit from default

### Terraform must NOT manage Workers script content
- Terraform `cloudflare_workers_script` with placeholder content **overwrites** the real deployed code on every `terraform apply`
- **Fix**: Remove the script resource from Terraform, only manage the route
- Use `terraform state rm` to detach without deleting the actual Worker
- Let CI/wrangler handle all code deployments

### Next.js on Cloudflare Pages doesn't work for dynamic apps
- `wrangler pages deploy .next` uploads raw build output as static files — dynamic routes return 404
- `output: "export"` requires `generateStaticParams()` on all dynamic routes, can't export from `"use client"` files
- `@cloudflare/next-on-pages` is **deprecated**
- **Solution**: Use **OpenNext** (`@opennextjs/cloudflare`) to deploy Next.js as a Cloudflare Worker
- Config: `open-next.config.ts`, `wrangler.jsonc`, `bun run deploy` = `opennextjs-cloudflare build && deploy`

### CF Access cross-subdomain auth (CORS + cookies)
- CF Access cookie (`CF_Authorization`) is scoped to a single subdomain by default
- Frontend on `cloudpass.nerotechs.com` can't send auth cookie to `api.nerotechs.com`
- **Fix**: Add both domains to `self_hosted_domains` in the CF Access application
- **CORS preflight**: OPTIONS requests have no cookies → CF Access blocks them
- **Fix**: Set `options_preflight_bypass = true` on the Access application
- Also set `same_site_cookie_attribute = "none"` for cross-subdomain cookie sharing

### Workers route pattern needs wildcard
- Route `cloudpass.nerotechs.com` (no `/*`) gets treated as an asset path
- **Fix**: Always use `cloudpass.nerotechs.com/*` for Workers routes

### GitHub Actions variables vs secrets
- `NEXT_PUBLIC_*` values are baked into client-side JS — use `vars.*` not `secrets.*`
- `NEXT_PUBLIC_API_URL` must include full path: `https://api.nerotechs.com/api/v1`
- Set via CLI: `gh variable set NEXT_PUBLIC_API_URL --body "https://api.nerotechs.com/api/v1"`

### D1 bound parameter limit (100 max per query)
- Cloudflare D1 allows **max 100 bound parameters** per SQL query
- Drizzle `inArray(column, ids)` generates `IN (?, ?, ...)` — each ID is one bound parameter
- When `ids.length + other params > 100`, the query fails with a 500 error
- **Trigger**: Adding questions to an exam pushed total past 100; `getQuestionsPage` with `per_page=200` tried 101 IDs + 1 userId = 102 params
- **Fix**: Batch `inArray` queries into chunks of 95 IDs, merge results
- **Rule**: Any `inArray` on user-controlled or growing data must use batched queries

## React Patterns

### useEffect dependency array causes feedback loops
- Including state that the effect *writes to* in its own dependency array creates a feedback loop
- Example: `useEffect(() => { setCurrentPage(targetPage); }, [currentIndex, currentPage])` — clicking a pagination button updates `currentPage`, which re-triggers the effect, which resets `currentPage` back
- **Fix**: Only include the *source of truth* (`currentIndex`) in deps, not the *derived state* (`currentPage`) that the effect sets
- **Rule**: Never list a state variable in `useEffect` deps if the effect calls that variable's setter based on a different input

## Frontend Data Loading

### Hardcoded large per_page hides truncation bugs
- Practice mode used `api.getQuestions(examId, 1, 200)` — exams with >200 questions silently truncated
- The backend already returned `total` and `total_pages` but the frontend ignored them
- **Fix**: Track API pagination state, auto-fetch next page when user reaches the last navigator page (50-item chunk) of loaded questions
- **Rule**: When fetching paginated data, always use the `total` from the API response for counts/progress — never use `array.length` as the total when the API tells you otherwise

## General Patterns

### Don't mix IaC and CI deployments for the same resource
- If CI deploys code via wrangler, Terraform should not manage that Workers script
- Terraform can manage routes, DNS, Access apps — but not the script content
- Running `terraform apply` after CI deploy will revert the Worker to placeholder code
