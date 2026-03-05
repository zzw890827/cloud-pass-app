# Cloud Pass App

Multi-provider cloud certification exam practice app. Supports practice mode (instant feedback) and exam mode (timed, scored).

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Hono (TypeScript) on Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite) via Drizzle ORM
- **Auth**: Cloudflare Access (Zero Trust) — Google + GitHub IdP
- **IaC**: Terraform (Cloudflare provider)
- **Local dev**: wrangler dev (Miniflare)
- **Package managers**: bun (frontend), npm (workers-api)

## Architecture

```
Cloudflare Access --> Zero Trust auth gate (Google/GitHub)
Cloudflare Pages  --> Next.js frontend
Cloudflare Workers --> Hono API (TypeScript)
Cloudflare D1     --> SQLite database
Terraform         --> Manages all Cloudflare resources
```

## Getting Started

### Prerequisites

- Node.js 18+
- bun (frontend)
- npm (workers-api)

### API (Workers)

```bash
cd workers-api
npm install
npm run db:migrate:local   # Apply D1 migrations
npm run dev                # Starts on http://localhost:8787
```

### Create Admin User

```bash
cd workers-api
npx wrangler d1 execute CLOUD_PASS_DB --local \
  --command "INSERT OR IGNORE INTO users (email, display_name, is_admin) VALUES ('dev@example.com', 'Dev Admin', 1);"
```

### Frontend

```bash
cd frontend
bun install
bun dev    # Starts on http://localhost:3000
```

### Local Auth

In dev mode (`DEV_MODE=true` in `workers-api/wrangler.toml`), auth is bypassed:
- API reads `X-Dev-User-Email` header (default: `dev@example.com`)
- Frontend sends the header automatically via `NEXT_PUBLIC_DEV_MODE=true` in `.env.local`
- Users are auto-created on first request

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

`text`, `explanation`, and `options[].text` all support standard Markdown syntax:

| Feature     | Syntax                     | Example               |
|-------------|----------------------------|-----------------------|
| Bold        | `**text**`                 | **bold**              |
| Italic      | `*text*`                   | *italic*              |
| Inline code | `` `code` ``               | `code`                |
| Code block  | ` ```language\ncode\n``` ` | Syntax highlighted    |
| Image       | `![alt](url)`              | Renders inline        |
| Table       | GFM table syntax           | Rendered with borders |
| List        | `- item` or `1. item`      | Bullet / numbered     |
| Blockquote  | `> text`                   | Indented quote        |

### Images in Questions

Use standard Markdown image syntax within any text field:

```json
{
  "text": "Based on the architecture shown below, which solution is optimal?\n\n![Architecture Diagram](https://example.com/images/arch.png)\n\nSelect the best answer."
}
```

Image URLs must be publicly accessible. For local images, place them in `frontend/public/images/` and reference as `/images/filename.png`.

### Import via CLI

```bash
curl -X POST http://localhost:8787/api/v1/admin/import \
  -H "Content-Type: application/json" \
  -H "X-Dev-User-Email: dev@example.com" \
  -d @seed/aws-saa-c03-import.json
```

## DB Migrations

```bash
cd workers-api
npm run db:generate        # Generate SQL from schema changes
npm run db:migrate:local   # Apply locally
npm run db:migrate:remote  # Apply to production D1
```

## Deployment

### Terraform (infrastructure)

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars  # Fill in values
terraform init
terraform plan
terraform apply
```

### Workers API

```bash
cd workers-api
# Update database_id in wrangler.toml with the D1 ID from terraform output
npx wrangler d1 migrations apply CLOUD_PASS_DB --remote
npx wrangler deploy
```

### Frontend (Pages)

Deploy via Cloudflare Pages dashboard or CI, pointing to the `frontend/` directory.
