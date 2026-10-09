import { eq, and, sql, count, type SQL } from "drizzle-orm";
import type { Database } from "../db/client";
import { questions, userProgress, bookmarks } from "../db/schema";

export interface ProgressSummary {
  total: number;
  attempted: number;
  correct: number;
  incorrect: number;
  bookmarked: number;
}

/**
 * `domainFilter` (from lib/exam-access) limits every count to the questions
 * the user can see, so a domain-restricted user's totals match their list.
 */
export async function getProgressSummary(
  db: Database,
  examId: number,
  userId: number,
  domainFilter?: SQL
): Promise<ProgressSummary> {
  const [totalResult] = await db
    .select({ count: count() })
    .from(questions)
    .where(and(eq(questions.examId, examId), domainFilter));

  const progressRows = await db
    .select({
      isCorrect: userProgress.isCorrect,
      cnt: count(),
    })
    .from(userProgress)
    .innerJoin(questions, eq(userProgress.questionId, questions.id))
    .where(and(eq(userProgress.userId, userId), eq(questions.examId, examId), domainFilter))
    .groupBy(userProgress.isCorrect);

  let correct = 0;
  let incorrect = 0;
  for (const row of progressRows) {
    if (row.isCorrect) correct = row.cnt;
    else incorrect = row.cnt;
  }

  const [bookmarkResult] = await db
    .select({ count: count() })
    .from(bookmarks)
    .innerJoin(questions, eq(bookmarks.questionId, questions.id))
    .where(and(eq(bookmarks.userId, userId), eq(questions.examId, examId), domainFilter));

  return {
    total: totalResult.count,
    attempted: correct + incorrect,
    correct,
    incorrect,
    bookmarked: bookmarkResult.count,
  };
}

export interface ProgressDetailItem {
  question_id: number;
  external_id: string;
  is_correct: boolean;
  selected_option_ids: number[];
}

export async function getProgressDetail(
  db: Database,
  examId: number,
  userId: number,
  domainFilter?: SQL
): Promise<{ summary: ProgressSummary; items: ProgressDetailItem[] }> {
  const summary = await getProgressSummary(db, examId, userId, domainFilter);

  const rows = await db
    .select({
      questionId: userProgress.questionId,
      externalId: questions.externalId,
      isCorrect: userProgress.isCorrect,
      selectedOptionIds: userProgress.selectedOptionIds,
    })
    .from(userProgress)
    .innerJoin(questions, eq(userProgress.questionId, questions.id))
    .where(and(eq(userProgress.userId, userId), eq(questions.examId, examId), domainFilter));

  const items = rows.map((r) => ({
    question_id: r.questionId,
    external_id: r.externalId,
    is_correct: r.isCorrect,
    selected_option_ids: JSON.parse(r.selectedOptionIds) as number[],
  }));

  return { summary, items };
}

export async function resetProgress(
  db: Database,
  examId: number,
  userId: number
): Promise<void> {
  const questionIds = db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.examId, examId));

  await db
    .delete(userProgress)
    .where(
      and(
        eq(userProgress.userId, userId),
        sql`${userProgress.questionId} IN (${questionIds})`
      )
    );
}
