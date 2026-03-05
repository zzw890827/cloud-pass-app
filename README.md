# Cloud Pass App

Multi-provider cloud certification exam practice app. Supports practice mode (instant feedback) and exam mode (timed, scored).

## Tech Stack

- **Frontend**: Next.js (App Router) + TypeScript + Tailwind CSS
- **Backend**: FastAPI + SQLAlchemy (async) + aiosqlite
- **Database**: SQLite (local), Cloudflare D1 (production target)
- **Auth**: JWT (access + refresh tokens)
- **Package Manager**: bun (frontend)

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+ / bun

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend runs at http://localhost:8000, Swagger UI at http://localhost:8000/docs.

Tables are auto-created on startup via `Base.metadata.create_all`.

### Frontend

```bash
cd frontend
bun install
bun dev
```

Frontend runs at http://localhost:3000.

### Test Accounts

After DB reset, register via API or UI:

- `admin` / `admin123` (set `is_admin=1` in DB manually)
- `test` / `test123`

## Data Import

Import exam questions via `POST /api/v1/admin/import` (requires admin token).

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
    "description": "Optional exam description"
  },
  "questions": [
    {
      "external_id": "saa-001",
      "question_text": "Question text here (supports **Markdown**)",
      "question_type": "single",
      "explanation": "Explanation text (supports **Markdown**)",
      "options": [
        { "label": "A", "text": "Option text (supports **Markdown**)", "is_correct": false },
        { "label": "B", "text": "Correct answer", "is_correct": true }
      ]
    }
  ]
}
```

- `question_type`: `"single"` (one correct answer) or `"multi"` (multiple correct answers)
- `external_id`: unique per exam, used for dedup on re-import
- Re-import skips existing questions (by `external_id`), updates provider/exam metadata

### Markdown Support

`question_text`, `explanation`, and `options[].text` all support standard Markdown syntax:

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
  "question_text": "Based on the architecture shown below, which solution is optimal?\n\n![Architecture Diagram](https://example.com/images/arch.png)\n\nSelect the best answer."
}
```

Image URLs must be publicly accessible. For local images, place them in `frontend/public/images/` and reference as `/images/filename.png`.

### Import via CLI

```bash
# Login as admin
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Import
curl -X POST http://localhost:8000/api/v1/admin/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d @seed/aws-mls-c01-import.json
```
