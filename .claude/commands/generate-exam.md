Generate exam questions for Cloud Pass and save them as an importable JSON file.

## Step 1: Collect exam details

Ask the user for:

- **Provider name** — e.g., "Amazon Web Services"
- **Provider slug** — e.g., "aws" (lowercase, used in filenames)
- **Exam code** — e.g., "SAA-C03"
- **Exam name** — e.g., "AWS Solutions Architect Associate"
- **Topic or focus area** — e.g., "networking and content delivery", "security", or "all topics"
- **Number of questions** — how many to generate
- **Exam settings** (or use defaults):
  - `num_questions` per session (default: 65)
  - `pass_percentage` (default: 72)
  - `time_limit_minutes` (default: 130)

## Step 2: Generate questions

Generate questions following these quality guidelines:

- **Scenario-based**: Each question should present a realistic scenario, not just test definitions
- **4 options minimum**: Labels A through D (or more for multi-select)
- **Mix of single and multi**: ~80% single-choice, ~20% multi-choice
- **Thorough explanations**: Each explanation should explain why the correct answer is right AND why each incorrect option is wrong
- **Unique external_id**: Use format `<slug>-<code>-<number>` (e.g., `aws-saa-001`)
- **Markdown formatting**: Use bold, code blocks, and lists in questions and explanations where appropriate

Each question must match this exact schema:

```json
{
  "external_id": "string — unique ID",
  "text": "string — question text (supports Markdown)",
  "type": "single | multi",
  "explanation": "string — detailed explanation (supports Markdown)",
  "options": [
    {
      "label": "A",
      "text": "string — option text",
      "is_correct": false
    }
  ]
}
```

The full import file schema:

```json
{
  "provider": {
    "name": "string",
    "slug": "string",
    "description": "string (optional)",
    "logo_url": "string (optional)"
  },
  "exam": {
    "code": "string",
    "name": "string",
    "description": "string (optional)",
    "num_questions": "number",
    "pass_percentage": "number",
    "time_limit_minutes": "number",
    "questions": [ ... ]
  }
}
```

## Step 3: Save to file

Save the generated JSON to:

```
seed/<slug>-<code-lowercase>-import.json
```

For example: `seed/aws-saa-c03-import.json`

Create the `seed/` directory if it doesn't exist.

## Step 4: Offer to import

Ask the user if they want to import the questions into their local dev database. If yes:

```bash
curl -X POST http://localhost:8787/api/v1/admin/import \
  -H "Content-Type: application/json" \
  -H "X-Dev-User-Email: dev@example.com" \
  -d @seed/<filename>.json
```

Report the import result (success count or any errors).
