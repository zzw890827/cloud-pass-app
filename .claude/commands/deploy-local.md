Set up the local development environment for Cloud Pass. Follow these steps in order:

## 1. Check prerequisites

Verify the following tools are installed and print their versions:
- `node` (must be 18+)
- `bun`
- `npm`

If any are missing, tell the user what to install and stop.

## 2. Install dependencies

```bash
cd workers-api && npm install
cd ../frontend && bun install
```

## 3. Run local D1 migrations

```bash
cd workers-api
npm run db:migrate:local
```

## 4. Create admin user

```bash
cd workers-api
npx wrangler d1 execute CLOUD_PASS_DB --local \
  --command "INSERT OR IGNORE INTO users (email, display_name, is_admin) VALUES ('dev@example.com', 'Dev Admin', 1);"
```

## 5. Set up frontend environment

Check if `frontend/.env.local` exists. If it does NOT exist, create it with:

```env
NEXT_PUBLIC_API_URL=http://localhost:8787/api/v1
NEXT_PUBLIC_DEV_MODE=true
NEXT_PUBLIC_DEV_USER_EMAIL=dev@example.com
NEXT_PUBLIC_CF_TEAM_DOMAIN=
```

If it already exists, skip this step and tell the user.

## 6. Print startup instructions

Tell the user:

> Local setup complete! Start the dev servers:
>
> **Terminal 1 — API:**
> ```
> cd workers-api && npm run dev
> ```
>
> **Terminal 2 — Frontend:**
> ```
> cd frontend && bun dev
> ```
>
> Open http://localhost:3000 in your browser.
