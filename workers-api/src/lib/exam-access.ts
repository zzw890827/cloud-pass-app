import { eq, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import type { Database } from "../db/client";
import { exams, questions } from "../db/schema";
import { AppError } from "./errors";

/** The subset of the authenticated user this module needs. */
export interface AccessUser {
  id: number;
  isAdmin: boolean;
}

/**
 * Condition restricting an `exams` query to what `userId` may see: public exams
 * plus the ones explicitly granted to them.
 *
 * An EXISTS sub-query rather than an `inArray` of granted ids — D1 caps bound
 * parameters at 100, and a user may be granted more exams than that.
 */
export function examVisibleFilter(userId: number): SQL {
  return or(
    eq(exams.isPublic, true),
    sql`EXISTS (SELECT 1 FROM user_exam_access uea WHERE uea.exam_id = ${exams.id} AND uea.user_id = ${userId})`
  )!;
}

/**
 * Same rule as `examVisibleFilter`, but expressed against an arbitrary exam-id
 * column (e.g. `questions.examId`) for queries that do not join `exams`.
 */
export function examIdVisibleFilter(examIdCol: AnyColumn, userId: number): SQL {
  return sql`EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = ${examIdCol}
      AND (e.is_public = 1 OR EXISTS (
        SELECT 1 FROM user_exam_access uea WHERE uea.exam_id = e.id AND uea.user_id = ${userId}
      ))
  )`;
}

/** Same as `examIdVisibleFilter`, but a no-op (undefined) for admins. */
export function examIdVisibleFilterFor(
  examIdCol: AnyColumn,
  user: AccessUser
): SQL | undefined {
  return user.isAdmin ? undefined : examIdVisibleFilter(examIdCol, user.id);
}

/** Same as `examVisibleFilter`, but a no-op (undefined) for admins. */
export function examVisibleFilterFor(user: AccessUser): SQL | undefined {
  return user.isAdmin ? undefined : examVisibleFilter(user.id);
}

/** Throws 403 unless `user` may access `examId`. Admins always may. */
export async function assertExamAccess(
  db: Database,
  examId: number,
  user: AccessUser
): Promise<void> {
  if (user.isAdmin) return;

  const [row] = await db
    .select({ id: exams.id })
    .from(exams)
    .where(sql`${exams.id} = ${examId} AND (${examVisibleFilter(user.id)})`)
    .limit(1);

  if (!row) {
    throw new AppError(403, "You do not have access to this exam");
  }
}

/** Throws 403 unless `user` may access the exam owning `questionId`. */
export async function assertQuestionAccess(
  db: Database,
  questionId: number,
  user: AccessUser
): Promise<void> {
  if (user.isAdmin) return;

  const [row] = await db
    .select({ examId: questions.examId })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);

  // Missing question: let the downstream service raise its own 404.
  if (!row) return;

  await assertExamAccess(db, row.examId, user);
}
