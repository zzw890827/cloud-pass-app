import { eq, and, desc } from "drizzle-orm";
import type { Database } from "../db/client";
import { bookmarks, questions } from "../db/schema";
import { AppError } from "../lib/errors";

export async function addBookmark(db: Database, userId: number, questionId: number) {
  // Verify question exists
  const question = await db.query.questions.findFirst({
    where: eq(questions.id, questionId),
  });
  if (!question) throw new AppError(404, "Question not found");

  // Check if already bookmarked
  const existing = await db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.userId, userId), eq(bookmarks.questionId, questionId)),
  });
  if (existing) {
    return {
      id: existing.id,
      question_id: existing.questionId,
      created_at: existing.createdAt,
    };
  }

  const [created] = await db
    .insert(bookmarks)
    .values({ userId, questionId })
    .returning();

  return {
    id: created.id,
    question_id: created.questionId,
    created_at: created.createdAt,
  };
}

export async function removeBookmark(db: Database, userId: number, questionId: number) {
  const existing = await db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.userId, userId), eq(bookmarks.questionId, questionId)),
  });
  if (!existing) throw new AppError(404, "Bookmark not found");

  await db.delete(bookmarks).where(eq(bookmarks.id, existing.id));
}

export async function getBookmarks(
  db: Database,
  userId: number,
  examId?: number
) {
  let condition = eq(bookmarks.userId, userId);

  const rows = await db
    .select({
      id: bookmarks.id,
      questionId: bookmarks.questionId,
      createdAt: bookmarks.createdAt,
      questionText: questions.questionText,
      questionType: questions.questionType,
      examId: questions.examId,
    })
    .from(bookmarks)
    .innerJoin(questions, eq(bookmarks.questionId, questions.id))
    .where(
      examId
        ? and(condition, eq(questions.examId, examId))
        : condition
    )
    .orderBy(desc(bookmarks.createdAt));

  return rows.map((r) => ({
    id: r.id,
    question_id: r.questionId,
    created_at: r.createdAt,
    question_text: r.questionText,
    question_type: r.questionType,
    exam_id: r.examId,
  }));
}
