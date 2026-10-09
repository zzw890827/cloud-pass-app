import { z } from "zod";

export const importOptionSchema = z.object({
  label: z.string(),
  text: z.string(),
  is_correct: z.boolean(),
});

// Hotspot choice lists carry no per-option correctness — it lives on the rows —
// so `is_correct` is optional there. Keeping it required on single/multi means a
// payload that omits it still fails loudly instead of importing zero correct options.
export const importHotspotOptionSchema = importOptionSchema.extend({
  is_correct: z.boolean().optional().default(false),
});

export const importHotspotRowSchema = z.object({
  text: z.string(),
  answer: z.string(), // an option `label`
});

const choiceQuestionSchema = z.object({
  external_id: z.string(),
  text: z.string(),
  type: z.enum(["single", "multi"]),
  explanation: z.string().optional().nullable(),
  domain: z.string().optional().nullable(), // references a domain `code` declared on the exam
  options: z.array(importOptionSchema).min(2),
});

const hotspotQuestionSchema = z.object({
  external_id: z.string(),
  text: z.string(),
  type: z.literal("hotspot"),
  explanation: z.string().optional().nullable(),
  domain: z.string().optional().nullable(), // references a domain `code` declared on the exam
  // Column headings for the Answer Area, e.g. "Statements:" and
  // "Select Yes or No:". Optional — the table renders without a header row
  // when they are absent.
  row_header: z.string().optional().nullable(),
  choice_header: z.string().optional().nullable(),
  // The shared choice list every row's dropdown offers.
  options: z.array(importHotspotOptionSchema).min(2),
  rows: z.array(importHotspotRowSchema).min(1),
});

/**
 * Discriminated on `type` so a bad question reports only its own branch's errors —
 * a plain `z.union` would bury the real problem under the other branch's noise.
 */
export const importQuestionSchema = z
  .discriminatedUnion("type", [choiceQuestionSchema, hotspotQuestionSchema])
  .superRefine((q, ctx) => {
    if (q.type !== "hotspot") return;

    // Labels are how a row names its answer, so duplicates make the mapping ambiguous.
    const seen = new Set<string>();
    q.options.forEach((o, i) => {
      if (seen.has(o.label)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options", i, "label"],
          message: `Question ${q.external_id}: duplicate option label "${o.label}"`,
        });
      }
      seen.add(o.label);
    });

    // An `answer` that matches no option label would import a question that can
    // never be answered correctly, so reject it at the boundary.
    q.rows.forEach((row, i) => {
      if (!seen.has(row.answer)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rows", i, "answer"],
          message: `Question ${q.external_id}: row answer "${row.answer}" matches no option label (have: ${[...seen].join(", ")})`,
        });
      }
    });
  });

export const importDomainSchema = z.object({
  code: z.string(), // stable per-exam key referenced by questions
  name: z.string(),
  weight: z.number().int().nonnegative(), // relative weight, normalized at selection time
  order_index: z.number().int().optional(),
});

export const importExamSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  num_questions: z.number().int().optional(),
  pass_percentage: z.number().int().optional(),
  time_limit_minutes: z.number().int().optional(),
  domains: z.array(importDomainSchema).optional(),
  questions: z.array(importQuestionSchema),
});

export const importProviderSchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().optional().nullable(),
  logo_url: z.string().optional().nullable(),
});

export const importPayloadSchema = z.object({
  provider: importProviderSchema,
  exam: importExamSchema,
});

export type ImportPayload = z.infer<typeof importPayloadSchema>;
export type ImportQuestion = z.infer<typeof importQuestionSchema>;

/**
 * Normalize legacy import format (top-level `questions` with `question_text`/`question_type`)
 * into the current format (`questions` inside `exam` with `text`/`type`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeImportPayload(raw: any): any {
  const result = { ...raw };

  // Move top-level questions into exam.questions
  if (Array.isArray(result.questions) && result.exam && !result.exam.questions) {
    result.exam = { ...result.exam, questions: result.questions };
    delete result.questions;
  }

  // Rename question_text -> text, question_type -> type
  if (result.exam?.questions) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result.exam.questions = result.exam.questions.map((q: any) => ({
      ...q,
      text: q.text ?? q.question_text,
      type: q.type ?? q.question_type,
    }));
  }

  return result;
}
