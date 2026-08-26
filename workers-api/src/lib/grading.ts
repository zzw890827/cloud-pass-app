import type { options as optionsTable, questions as questionsTable } from "../db/schema";

export type HotspotRow = { text: string; answer: string };

/** Just the question columns grading needs — so callers can select narrowly. */
type GradableQuestion = Pick<
  typeof questionsTable.$inferSelect,
  "questionType" | "hotspotRows"
>;

type GradableOption = Pick<typeof optionsTable.$inferSelect, "id" | "label" | "isCorrect">;

export function isHotspot(questionType: string): boolean {
  return questionType === "hotspot";
}

export function parseHotspotRows(json: string | null): HotspotRow[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as HotspotRow[]) : [];
  } catch {
    return [];
  }
}

/**
 * The answer key as option IDs.
 *
 * For hotspot this is **ordered and index-aligned with the rows** — entry `i` is
 * the correct option for row `i`, and the same option may repeat. For single/multi
 * it is the (unordered) set of options flagged correct.
 *
 * A row whose `answer` label matches no option yields -1, which can never equal a
 * real option id, so such a question simply grades as wrong rather than throwing.
 * Import validation rejects that case up front.
 */
export function correctOptionIds(
  question: GradableQuestion,
  opts: GradableOption[]
): number[] {
  if (!isHotspot(question.questionType)) {
    return opts.filter((o) => o.isCorrect).map((o) => o.id);
  }
  const idByLabel = new Map(opts.map((o) => [o.label, o.id]));
  return parseHotspotRows(question.hotspotRows).map((row) => {
    const id = idByLabel.get(row.answer);
    if (id === undefined) {
      console.warn(`hotspot row answer "${row.answer}" matches no option label`);
      return -1;
    }
    return id;
  });
}

/**
 * The rows as the client may see them *before* answering — the per-row answer
 * stripped out. Every read path that exposes a hotspot question must go through
 * here; it is the single place the "never leak the key" rule is enforced.
 */
export function publicHotspotRows(question: GradableQuestion): { text: string }[] | null {
  if (!isHotspot(question.questionType)) return null;
  return parseHotspotRows(question.hotspotRows).map((r) => ({ text: r.text }));
}

/** The question columns the Answer Area needs to render its header row. */
type HeaderedQuestion = Pick<
  typeof questionsTable.$inferSelect,
  "questionType" | "hotspotRowHeader" | "hotspotChoiceHeader"
>;

/**
 * Column headings for the hotspot Answer Area, as the client receives them.
 * Null for non-hotspot questions, and individually null when the author didn't
 * set them — the table simply renders without a header row.
 */
export function hotspotHeaders(question: HeaderedQuestion): {
  hotspot_row_header: string | null;
  hotspot_choice_header: string | null;
} {
  if (!isHotspot(question.questionType)) {
    return { hotspot_row_header: null, hotspot_choice_header: null };
  }
  return {
    hotspot_row_header: question.hotspotRowHeader,
    hotspot_choice_header: question.hotspotChoiceHeader,
  };
}

/**
 * Grade a submission. All-or-nothing for every type: hotspot compares the
 * selection to the answer key positionally (one pick per row), single/multi
 * compare as sets.
 */
export function gradeAnswer(
  question: GradableQuestion,
  opts: GradableOption[],
  selectedOptionIds: number[]
): { isCorrect: boolean; correctOptionIds: number[] } {
  const correct = correctOptionIds(question, opts);

  // No answer key means the question is malformed (a hotspot with no rows, or a
  // choice question with nothing flagged correct). Every comparison below is
  // vacuously true against an empty submission, so bail out before handing out a
  // free pass. Import validation rejects both shapes; this guards the rest.
  if (correct.length === 0) return { isCorrect: false, correctOptionIds: correct };

  const isCorrect = isHotspot(question.questionType)
    ? correct.length === selectedOptionIds.length &&
      correct.every((id, i) => id === selectedOptionIds[i])
    : correct.length === new Set(selectedOptionIds).size &&
      correct.every((id) => selectedOptionIds.includes(id));

  return { isCorrect, correctOptionIds: correct };
}
