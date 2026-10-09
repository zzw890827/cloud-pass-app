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

/**
 * Condition restricting rows to the domains `userId` may see within their exam.
 * With no `user_exam_domain_access` rows for the exam every domain is visible;
 * otherwise only the whitelisted ones — and a NULL domain never matches, so
 * domain-less questions are hidden once an exam is restricted.
 *
 * Works for any table carrying an exam id and a domain id: `questions`
 * (exam_id, domain_id) or `exam_domains` (exam_id, id).
 */
export function domainVisibleFilter(
  examIdCol: AnyColumn,
  domainIdCol: AnyColumn,
  userId: number
): SQL {
  return sql`(
    NOT EXISTS (
      SELECT 1 FROM user_exam_domain_access ueda
      WHERE ueda.user_id = ${userId} AND ueda.exam_id = ${examIdCol}
    )
    OR EXISTS (
      SELECT 1 FROM user_exam_domain_access ueda
      WHERE ueda.user_id = ${userId}
        AND ueda.exam_id = ${examIdCol}
        AND ueda.domain_id = ${domainIdCol}
    )
  )`;
}

/** Domain filter over `questions`, or a no-op (undefined) for admins. */
export function questionDomainFilterFor(user: AccessUser): SQL | undefined {
  return user.isAdmin
    ? undefined
    : domainVisibleFilter(questions.examId, questions.domainId, user.id);
}

/**
 * `exams.total_questions` as `user` sees it: the stored count unless their
 * domains are restricted for that exam, in which case only whitelisted-domain
 * questions are counted. Use in a select over `exams`.
 *
 * The expression is nested inside an outer `sql` on purpose: drizzle renders a
 * bare top-level `sql` select field over a single (un-joined) table with
 * unqualified columns, so `${exams.id}` inside the sub-queries would bind to
 * `q.id` / `ueda.id` instead. Nested, the columns come out fully qualified.
 */
export function visibleQuestionCountFor(user: AccessUser): SQL<number> {
  if (user.isAdmin) return sql<number>`${exams.totalQuestions}`;
  const count = sql`CASE
    WHEN EXISTS (
      SELECT 1 FROM user_exam_domain_access ueda
      WHERE ueda.user_id = ${user.id} AND ueda.exam_id = ${exams.id}
    )
    THEN (
      SELECT COUNT(*) FROM questions q
      WHERE q.exam_id = ${exams.id}
        AND q.domain_id IN (
          SELECT ueda.domain_id FROM user_exam_domain_access ueda
          WHERE ueda.user_id = ${user.id} AND ueda.exam_id = ${exams.id}
        )
    )
    ELSE ${exams.totalQuestions}
  END`;
  return sql<number>`${count}`;
}

/** Throws 403 unless `user` may start or continue exam-mode sessions. */
export function assertExamModeAllowed(user: AccessUser & { canUseExamMode: boolean }): void {
  if (user.isAdmin || user.canUseExamMode) return;
  throw new AppError(403, "Exam mode is not enabled for your account");
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

/**
 * Throws 403 unless `user` may access the exam owning `questionId` and the
 * question's domain is not hidden from them.
 */
export async function assertQuestionAccess(
  db: Database,
  questionId: number,
  user: AccessUser
): Promise<void> {
  if (user.isAdmin) return;

  const [row] = await db
    .select({
      examId: questions.examId,
      domainVisible: sql<number>`${domainVisibleFilter(questions.examId, questions.domainId, user.id)}`,
    })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);

  // Missing question: let the downstream service raise its own 404.
  if (!row) return;

  await assertExamAccess(db, row.examId, user);

  if (!row.domainVisible) {
    throw new AppError(403, "You do not have access to this question");
  }
}
