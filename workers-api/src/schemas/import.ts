import { z } from "zod";

export const importOptionSchema = z.object({
  label: z.string(),
  text: z.string(),
  is_correct: z.boolean(),
});

export const importQuestionSchema = z.object({
  external_id: z.string(),
  text: z.string(),
  type: z.enum(["single", "multi"]),
  explanation: z.string().optional().nullable(),
  options: z.array(importOptionSchema).min(2),
});

export const importExamSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  num_questions: z.number().int().optional(),
  pass_percentage: z.number().int().optional(),
  time_limit_minutes: z.number().int().optional(),
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
