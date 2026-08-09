import { eq, count, asc, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { exams, questions, examDomains } from "../db/schema";
import { AppError } from "../lib/errors";

// Draw weight bounds, mirrored by the selection algorithm in
// exam-session-service.ts: 0 excludes a question, 100 always draws it, 50 is
// the neutral default.
export const MIN_QUESTION_WEIGHT = 0;
export const MAX_QUESTION_WEIGHT = 100;

const MAX_PER_PAGE = 100;
const PREVIEW_LENGTH = 200;

/** Question list for the maintenance screens: draw weight plus enough text to identify a question. */
export async function getQuestionWeightsPage(
  db: Database,
  examId: number,
  page: number,
  perPage: number
) {
  const exam = await db.query.exams.findFirst({ where: eq(exams.id, examId) });
  if (!exam) throw new AppError(404, "Exam not found");

  perPage = Math.min(Math.max(perPage, 1), MAX_PER_PAGE);
  const offset = (Math.max(page, 1) - 1) * perPage;

  const [totalRow] = await db
    .select({ total: count() })
    .from(questions)
    .where(eq(questions.examId, examId));

  const total = totalRow?.total ?? 0;

  const rows = await db
    .select({
      id: questions.id,
      externalId: questions.externalId,
      questionType: questions.questionType,
      weight: questions.weight,
      orderIndex: questions.orderIndex,
      domainName: examDomains.name,
      preview: sql<string>`substr(${questions.questionText}, 1, ${PREVIEW_LENGTH})`,
    })
    .from(questions)
    .leftJoin(examDomains, eq(questions.domainId, examDomains.id))
    .where(eq(questions.examId, examId))
    .orderBy(asc(questions.orderIndex), asc(questions.id))
    .limit(perPage)
    .offset(offset);

  return {
    exam_id: exam.id,
    exam_code: exam.code,
    exam_name: exam.name,
    items: rows.map((r) => ({
      id: r.id,
      external_id: r.externalId,
      question_type: r.questionType,
      question_preview: r.preview,
      domain_name: r.domainName,
      weight: r.weight,
      order_index: r.orderIndex,
    })),
    total,
    page: Math.max(page, 1),
    per_page: perPage,
    total_pages: Math.max(Math.ceil(total / perPage), 1),
  };
}

export async function updateQuestionWeight(db: Database, questionId: number, weight: number) {
  if (!Number.isInteger(weight) || weight < MIN_QUESTION_WEIGHT || weight > MAX_QUESTION_WEIGHT) {
    throw new AppError(
      400,
      `weight must be an integer between ${MIN_QUESTION_WEIGHT} and ${MAX_QUESTION_WEIGHT}`
    );
  }

  const [updated] = await db
    .update(questions)
    .set({ weight })
    .where(eq(questions.id, questionId))
    .returning({ id: questions.id, weight: questions.weight });

  if (!updated) throw new AppError(404, "Question not found");

  return { id: updated.id, weight: updated.weight };
}
