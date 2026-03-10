# Cloud Pass

Open-source cloud certification exam practice framework, fully hosted on Cloudflare. Supports practice mode (instant feedback) and exam mode (timed, scored) across any cloud provider.

**Key Features**
- Multi-provider support (AWS, Azure, GCP, etc.)
- Practice mode with instant answer feedback
- Exam mode with timer, scoring, and pass/fail
- Pause & resume exam sessions
- Score trends and performance tracking
- Markdown-rich questions with image support
- Zero Trust auth via Cloudflare Access (OTP built-in, Google/GitHub OAuth optional)
- JSON-based question import with deduplication

## Architecture

```
Cloudflare Access  ──► Zero Trust auth gate (OTP / Google / GitHub)
Cloudflare Workers ──► Next.js frontend (via OpenNext)
Cloudflare Workers ──► Hono API (TypeScript)
Cloudflare D1      ──► SQLite database
Terraform          ──► Manages all Cloudflare resources
```

Both the frontend and API run as Cloudflare Workers. The frontend is built with OpenNext (not Cloudflare Pages).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind CSS |
| Backend | Hono (TypeScript) on Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) via Drizzle ORM |
| Auth | Cloudflare Access (Zero Trust) — OTP built-in, Google/GitHub optional |
| IaC | Terraform (Cloudflare provider v5) |
| CI/CD | GitHub Actions |
| Package managers | bun (frontend), npm (workers-api) |

## Prerequisites

- **Node.js** 18+ and **npm**
- **[bun](https://bun.sh)** — frontend package manager
- **[Terraform](https://www.terraform.io)** >= 1.5 — infrastructure provisioning

For Cloudflare deployment, you also need:

- A **Cloudflare account** with a registered domain (zone)
- **API token** with permissions: Workers Scripts, D1, DNS, Access
- **Account ID** and **Zone ID** (found in the Cloudflare dashboard under your domain's Overview page)

## Local Development

### 1. Clone and install

```bash
git clone https://github.com/zzw890827/cloud-pass-app.git
cd cloud-pass-app

# Workers API
cd workers-api
npm install

# Frontend
cd ../frontend
bun install
```

### 2. Run local D1 migrations

```bash
cd workers-api
npm run db:migrate:local
```

### 3. Create admin user

```bash
cd workers-api
npx wrangler d1 execute CLOUD_PASS_DB --local \
  --command "INSERT OR IGNORE INTO users (email, display_name, is_admin) VALUES ('dev@example.com', 'Dev Admin', 1);"
```

### 4. Set up frontend environment

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8787/api/v1
NEXT_PUBLIC_DEV_MODE=true
NEXT_PUBLIC_DEV_USER_EMAIL=dev@example.com
NEXT_PUBLIC_CF_TEAM_DOMAIN=
```

### 5. Start dev servers

```bash
# Terminal 1 — API
cd workers-api
npm run dev          # http://localhost:8787

# Terminal 2 — Frontend
cd frontend
bun dev              # http://localhost:3000
```

### Local Auth

In dev mode (`DEV_MODE=true` in `workers-api/wrangler.toml`), auth is bypassed:
- API reads `X-Dev-User-Email` header (default: `dev@example.com`)
- Frontend sends the header automatically when `NEXT_PUBLIC_DEV_MODE=true`
- Users are auto-created on first request

## Deploy to Cloudflare

### 1. Terraform — Provision infrastructure

Create your variables file:

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your values:

```hcl
cloudflare_api_token = "your-api-token"
account_id           = "your-account-id"
zone_id              = "your-zone-id"
domain               = "example.com"
api_subdomain        = "api"
app_subdomain        = "cloudpass"
cf_team_domain       = "your-team"

# Optional — leave empty to use OTP-only auth
google_client_id     = ""
google_client_secret = ""
github_client_id     = ""
github_client_secret = ""
```

Apply infrastructure:

```bash
terraform init
terraform plan    # Review changes
terraform apply   # Confirm to create resources
```

Note the **D1 database ID** from the terraform output — you'll need it next.

### 2. Workers API — Deploy

Update `workers-api/wrangler.toml` under `[env.production]`:

```toml
[env.production.d1_databases]
binding = "DB"
database_name = "cloud-pass-db"
database_id = "<D1_DATABASE_ID_FROM_TERRAFORM>"
migrations_dir = "drizzle"
```

Also set `CF_TEAM_DOMAIN` under `[env.production.vars]` to match your `cf_team_domain`.

Deploy:

```bash
cd workers-api
npx wrangler d1 migrations apply CLOUD_PASS_DB --remote --env production
npx wrangler deploy --env production
```

### 3. Frontend — Deploy

Update `frontend/wrangler.jsonc`:
- Set `route` to `<app_subdomain>.<domain>/*` (e.g., `cloudpass.example.com/*`)
- Set `zone_name` to your domain

Deploy:

```bash
cd frontend
NEXT_PUBLIC_API_URL=https://<api_subdomain>.<domain>/api/v1 bun run deploy
```

### 4. Create admin user in production

```bash
cd workers-api
npx wrangler d1 execute CLOUD_PASS_DB --remote --env production \
  --command "INSERT OR IGNORE INTO users (email, display_name, is_admin) VALUES ('your-email@example.com', 'Admin', 1);"
```

## CI/CD

GitHub Actions workflows auto-deploy on push to `main`:

- `deploy-frontend.yml` — triggers on `frontend/**` changes
- `deploy-workers-api.yml` — triggers on `workers-api/**` changes (runs migrations first)

### Required GitHub configuration

**Secrets:**
| Secret | Description |
|--------|------------|
| `CLOUDFLARE_API_TOKEN` | API token with Workers/D1/DNS permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |

**Variables:**
| Variable | Description |
|----------|------------|
| `NEXT_PUBLIC_API_URL` | Production API URL (e.g., `https://api.example.com/api/v1`) |

## Data Import

Import exam questions via `POST /api/v1/admin/import` (requires admin user).

### JSON Format

```json
{
  "provider": {
    "name": "Amazon Web Services",
    "slug": "aws",
    "description": "Optional provider description",
    "logo_url": "https://example.com/logo.png"
  },
  "exam": {
    "code": "SAA-C03",
    "name": "AWS Solutions Architect Associate",
    "description": "Optional exam description",
    "num_questions": 65,
    "pass_percentage": 72,
    "time_limit_minutes": 130,
    "questions": [
      {
        "external_id": "saa-001",
        "text": "Question text here (supports **Markdown**)",
        "type": "single",
        "explanation": "Explanation text (supports **Markdown**)",
        "options": [
          { "label": "A", "text": "Option text", "is_correct": false },
          { "label": "B", "text": "Correct answer", "is_correct": true }
        ]
      }
    ]
  }
}
```

- `type`: `"single"` (one correct answer) or `"multi"` (multiple correct answers)
- `external_id`: unique per exam, used for dedup on re-import
- Re-import skips existing questions (by `external_id`), updates provider/exam metadata

### Markdown Support

`text`, `explanation`, and `options[].text` all support standard Markdown:

| Feature | Syntax | Example |
|---------|--------|---------|
| Bold | `**text**` | **bold** |
| Italic | `*text*` | *italic* |
| Inline code | `` `code` `` | `code` |
| Code block | ` ```language\ncode\n``` ` | Syntax highlighted |
| Image | `![alt](url)` | Renders inline |
| Table | GFM table syntax | Rendered with borders |
| List | `- item` or `1. item` | Bullet / numbered |
| Blockquote | `> text` | Indented quote |

### Images in Questions

Use standard Markdown image syntax within any text field:

```json
{
  "text": "Based on the architecture shown below:\n\n![Architecture Diagram](https://example.com/arch.png)\n\nSelect the best answer."
}
```

Image URLs must be publicly accessible. For local images, place them in `frontend/public/images/` and reference as `/images/filename.png`.

### Import via CLI

```bash
# Local
curl -X POST http://localhost:8787/api/v1/admin/import \
  -H "Content-Type: application/json" \
  -H "X-Dev-User-Email: dev@example.com" \
  -d @seed/aws-saa-c03-import.json

# Production
curl -X POST https://api.example.com/api/v1/admin/import \
  -H "Content-Type: application/json" \
  -H "cf-access-token: <your-access-jwt>" \
  -d @seed/aws-saa-c03-import.json
```

## DB Migrations

```bash
cd workers-api
npm run db:generate        # Generate SQL from schema changes
npm run db:migrate:local   # Apply locally
npm run db:migrate:remote  # Apply to production D1
```

## Claude Code Skills

This project includes [Claude Code](https://claude.com/claude-code) slash command skills for automated setup and content generation.

| Skill | Description |
|-------|------------|
| `/deploy-local` | Set up local development environment — install deps, migrate DB, create admin user, configure env |
| `/deploy-cloudflare` | Interactive guided deployment to Cloudflare — Terraform, Workers API, frontend, admin user |
| `/generate-exam` | Generate exam questions using AI and save as importable JSON |

### Usage

```bash
# In the project directory with Claude Code:
/deploy-local
/deploy-cloudflare
/generate-exam
```
