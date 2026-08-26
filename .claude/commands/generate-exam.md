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
- **4 options minimum**: Labels A through D (or more for multi-select). HotSpot questions are the exception — their options are the shared choice list, so 2-3 is normal
- **Mix of types**: ~80% single-choice, ~20% multi-choice. Add HotSpot questions where the topic is genuinely a classification/matching exercise — don't force them
- **Thorough explanations**: Each explanation should explain why the correct answer is right AND why each incorrect option is wrong
- **Unique external_id**: Use format `<slug>-<code>-<number>` (e.g., `aws-saa-001`)
- **Markdown formatting**: Use bold, code blocks, and lists in questions and explanations where appropriate

Each single/multi question must match this exact schema:

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

### HotSpot questions

A HotSpot question is an "Answer Area" table: the stem sets up a classification, then
each **row** is a statement the candidate assigns to one of a **shared** list of choices.
The same choice may be correct for several rows.

`options` is that shared choice list — every row's dropdown offers all of it, so
`is_correct` is omitted (correctness lives on the rows). Each row's `answer` must be
one of the option **labels**; the import API returns 422 if it isn't.

Scoring is all-or-nothing: the candidate must get every row right.

```json
{
  "external_id": "string — unique ID",
  "text": "string — the classification setup (supports Markdown)",
  "type": "hotspot",
  "explanation": "string — detailed explanation (supports Markdown)",
  "options": [
    { "label": "A", "text": "Input Preparation" },
    { "label": "B", "text": "Prompt Construction" },
    { "label": "C", "text": "Output Handling" }
  ],
  "rows": [
    { "text": "Persist the validated output for downstream consumption and audit.", "answer": "C" },
    { "text": "Summarize prior conversation history when full history is no longer needed.", "answer": "A" }
  ]
}
```

Aim for 4-6 rows and 3-4 choices, and make sure at least two rows share a choice —
a HotSpot where every row has a distinct answer is really just a matching puzzle.

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
