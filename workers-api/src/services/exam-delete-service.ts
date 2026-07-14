import { eq, inArray } from "drizzle-orm";
import type { Database } from "../db/client";
import type { BatchItem } from "drizzle-orm/batch";
import {
  exams,
  questions,
  options,
  examSessions,
  examSessionQuestions,
  userProgress,
  bookmarks,
} from "../db/schema";
import { AppError } from "../lib/errors";

/**
 * Delete an exam and every row that depends on it, keeping the parent provider.
 *
 * D1 does not enable `PRAGMA foreign_keys=ON`, so `ON DELETE cascade` cannot be
 * relied on. We collect the exam's question/session ids and delete child rows
 * first, atomically, via `db.batch` (a single D1 transaction).
 */
export async function deleteExam(db: Database, examId: number) {
  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
  });

  if (!exam) {
    throw new AppError(404, "Exam not found");
  }

  const questionRows = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.examId, examId));
  const questionIds = questionRows.map((q) => q.id);

  const sessionRows = await db
    .select({ id: examSessions.id })
    .from(examSessions)
    .where(eq(examSessions.examId, examId));
  const sessionIds = sessionRows.map((s) => s.id);

  // Child-first order. Guard `inArray` against empty arrays (invalid SQL).
  const statements: BatchItem<"sqlite">[] = [];

  if (sessionIds.length > 0) {
    statements.push(
      db.delete(examSessionQuestions).where(inArray(examSessionQuestions.sessionId, sessionIds))
    );
  }
  if (questionIds.length > 0) {
    // Defensive: also drop any session-question rows referencing this exam's questions.
    statements.push(
      db.delete(examSessionQuestions).where(inArray(examSessionQuestions.questionId, questionIds))
    );
  }
  statements.push(db.delete(examSessions).where(eq(examSessions.examId, examId)));
  if (questionIds.length > 0) {
    statements.push(db.delete(options).where(inArray(options.questionId, questionIds)));
    statements.push(db.delete(bookmarks).where(inArray(bookmarks.questionId, questionIds)));
    statements.push(db.delete(userProgress).where(inArray(userProgress.questionId, questionIds)));
  }
  statements.push(db.delete(questions).where(eq(questions.examId, examId)));
  statements.push(db.delete(exams).where(eq(exams.id, examId)));

  // `statements` always has at least the two exam-level deletes above.
  await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);

  return {
    exam_id: exam.id,
    code: exam.code,
    name: exam.name,
    questions_deleted: questionIds.length,
    sessions_deleted: sessionIds.length,
  };
}
