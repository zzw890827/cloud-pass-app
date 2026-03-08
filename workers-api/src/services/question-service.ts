import { eq, and, count, sql, inArray } from "drizzle-orm";
import type { Database } from "../db/client";
import { questions, options, userProgress, bookmarks } from "../db/schema";
import { AppError } from "../lib/errors";

// D1 limits bound parameters to 100 per query.
// Batch inArray queries to stay under the limit.
const D1_PARAM_BATCH = 95;

async function batchedQuery<T>(
  ids: number[],
  queryFn: (chunk: number[]) => Promise<T[]>
): Promise<T[]> {
  if (ids.length <= D1_PARAM_BATCH) return queryFn(ids);
  const results: T[] = [];
  for (let i = 0; i < ids.length; i += D1_PARAM_BATCH) {
    results.push(...(await queryFn(ids.slice(i, i + D1_PARAM_BATCH))));
  }
  return results;
}

export async function getQuestionsPage(
  db: Database,
  examId: number,
  userId: number,
  page: number,
  perPage: number
) {
  perPage = Math.min(perPage, 200);
  const offset = (page - 1) * perPage;

  const [totalResult] = await db
    .select({ count: count() })
    .from(questions)
    .where(eq(questions.examId, examId));

  const total = totalResult.count;
  const totalPages = Math.ceil(total / perPage);

  const questionRows = await db
    .select({
      id: questions.id,
      externalId: questions.externalId,
      questionType: questions.questionType,
      numCorrect: questions.numCorrect,
      orderIndex: questions.orderIndex,
    })
    .from(questions)
    .where(eq(questions.examId, examId))
    .orderBy(questions.orderIndex)
    .limit(perPage)
    .offset(offset);

  if (questionRows.length === 0) {
    return { items: [], total, page, per_page: perPage, total_pages: totalPages };
  }

  const qIds = questionRows.map((q) => q.id);

  const progressRows = await batchedQuery(qIds, (chunk) =>
    db
      .select({
        questionId: userProgress.questionId,
        isCorrect: userProgress.isCorrect,
      })
      .from(userProgress)
      .where(and(eq(userProgress.userId, userId), inArray(userProgress.questionId, chunk)))
  );

  const progressMap = new Map(progressRows.map((p) => [p.questionId, p.isCorrect]));

  const bookmarkRows = await batchedQuery(qIds, (chunk) =>
    db
      .select({ questionId: bookmarks.questionId })
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, userId), inArray(bookmarks.questionId, chunk)))
  );

  const bookmarkSet = new Set(bookmarkRows.map((b) => b.questionId));

  const items = questionRows.map((q) => ({
    id: q.id,
    external_id: q.externalId,
    question_type: q.questionType,
    num_correct: q.numCorrect,
    order_index: q.orderIndex,
    is_attempted: progressMap.has(q.id),
    is_correct: progressMap.get(q.id) ?? null,
    is_bookmarked: bookmarkSet.has(q.id),
  }));

  return { items, total, page, per_page: perPage, total_pages: totalPages };
}

export async function getQuestionDetail(
  db: Database,
  questionId: number,
  userId: number
) {
  const question = await db.query.questions.findFirst({
    where: eq(questions.id, questionId),
  });

  if (!question) throw new AppError(404, "Question not found");

  const opts = await db
    .select()
    .from(options)
    .where(eq(options.questionId, questionId))
    .orderBy(options.orderIndex);

  const progress = await db.query.userProgress.findFirst({
    where: and(eq(userProgress.userId, userId), eq(userProgress.questionId, questionId)),
  });

  const bookmark = await db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.userId, userId), eq(bookmarks.questionId, questionId)),
  });

  return {
    id: question.id,
    external_id: question.externalId,
    question_text: question.questionText,
    question_type: question.questionType,
    num_correct: question.numCorrect,
    order_index: question.orderIndex,
    options: opts.map((o) => ({
      id: o.id,
      label: o.label,
      option_text: o.optionText,
    })),
    is_bookmarked: !!bookmark,
    user_progress: progress
      ? {
          is_correct: progress.isCorrect,
          selected_option_ids: JSON.parse(progress.selectedOptionIds) as number[],
        }
      : null,
  };
}

export async function submitAnswer(
  db: Database,
  questionId: number,
  userId: number,
  selectedOptionIds: number[]
) {
  const question = await db.query.questions.findFirst({
    where: eq(questions.id, questionId),
  });
  if (!question) throw new AppError(404, "Question not found");

  const opts = await db
    .select()
    .from(options)
    .where(eq(options.questionId, questionId))
    .orderBy(options.orderIndex);

  const correctIds = new Set(opts.filter((o) => o.isCorrect).map((o) => o.id));
  const selectedSet = new Set(selectedOptionIds);
  const isCorrect =
    correctIds.size === selectedSet.size && [...correctIds].every((id) => selectedSet.has(id));

  // Upsert user progress
  await db
    .insert(userProgress)
    .values({
      userId,
      questionId,
      isCorrect,
      selectedOptionIds: JSON.stringify(selectedOptionIds),
    })
    .onConflictDoUpdate({
      target: [userProgress.userId, userProgress.questionId],
      set: {
        isCorrect,
        selectedOptionIds: JSON.stringify(selectedOptionIds),
        attemptedAt: sql`datetime('now')`,
      },
    });

  return {
    is_correct: isCorrect,
    correct_option_ids: [...correctIds],
    explanation: question.explanation,
    options: opts.map((o) => ({
      id: o.id,
      label: o.label,
      option_text: o.optionText,
      is_correct: o.isCorrect,
    })),
  };
}
