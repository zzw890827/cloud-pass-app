import { eq, and, asc, inArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Database } from "../db/client";
import {
  users,
  exams,
  examDomains,
  examSessions,
  userExamAccess,
  userExamDomainAccess,
} from "../db/schema";
import { AppError } from "../lib/errors";

// D1 caps bound parameters at 100 per statement.
const D1_PARAM_BATCH = 95;
// A grant row binds two parameters (user_id, exam_id), so rows-per-insert is half.
const D1_GRANT_ROW_BATCH = Math.floor(D1_PARAM_BATCH / 2);

// A domain-restriction row binds three parameters (user_id, exam_id, domain_id).
const D1_DOMAIN_ROW_BATCH = Math.floor(D1_PARAM_BATCH / 3);

/**
 * Every user, each with the ids of the exams explicitly granted to them and
 * their per-exam domain whitelists (`{ [examId]: domainIds }`; an exam absent
 * from the map is unrestricted).
 */
export async function listUsersWithAccess(db: Database) {
  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      isActive: users.isActive,
      isAdmin: users.isAdmin,
      canUseExamMode: users.canUseExamMode,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.email));

  const grantRows = await db
    .select({ userId: userExamAccess.userId, examId: userExamAccess.examId })
    .from(userExamAccess);

  const byUser = new Map<number, number[]>();
  for (const g of grantRows) {
    const list = byUser.get(g.userId);
    if (list) list.push(g.examId);
    else byUser.set(g.userId, [g.examId]);
  }

  const domainRows = await db
    .select({
      userId: userExamDomainAccess.userId,
      examId: userExamDomainAccess.examId,
      domainId: userExamDomainAccess.domainId,
    })
    .from(userExamDomainAccess);

  const domainsByUser = new Map<number, Record<number, number[]>>();
  for (const r of domainRows) {
    let perExam = domainsByUser.get(r.userId);
    if (!perExam) domainsByUser.set(r.userId, (perExam = {}));
    (perExam[r.examId] ??= []).push(r.domainId);
  }

  return userRows.map((u) => ({
    id: u.id,
    email: u.email,
    display_name: u.displayName,
    is_active: u.isActive,
    is_admin: u.isAdmin,
    can_use_exam_mode: u.canUseExamMode,
    // SQLite's `datetime('now')` has no zone marker; append Z so JS parses UTC.
    created_at: u.createdAt.endsWith("Z") ? u.createdAt : `${u.createdAt}Z`,
    granted_exam_ids: byUser.get(u.id) ?? [],
    domain_restrictions: domainsByUser.get(u.id) ?? {},
  }));
}

/**
 * Flip a user's `is_active` / `is_admin` / `can_use_exam_mode` flags.
 *
 * Admins may not change their own active/admin flags — that is the only way to
 * lock every admin out of the maintenance screens.
 */
export async function updateUserFlags(
  db: Database,
  targetUserId: number,
  actingUserId: number,
  patch: { isActive?: boolean; isAdmin?: boolean; canUseExamMode?: boolean }
) {
  if (
    patch.isActive === undefined &&
    patch.isAdmin === undefined &&
    patch.canUseExamMode === undefined
  ) {
    throw new AppError(400, "is_active, is_admin or can_use_exam_mode is required");
  }
  if (
    targetUserId === actingUserId &&
    (patch.isActive !== undefined || patch.isAdmin !== undefined)
  ) {
    throw new AppError(403, "You cannot change your own admin or active status");
  }

  const [updated] = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, targetUserId))
    .returning({
      id: users.id,
      isActive: users.isActive,
      isAdmin: users.isAdmin,
      canUseExamMode: users.canUseExamMode,
    });

  if (!updated) throw new AppError(404, "User not found");

  return {
    id: updated.id,
    is_active: updated.isActive,
    is_admin: updated.isAdmin,
    can_use_exam_mode: updated.canUseExamMode,
  };
}

/** Replace a user's exam grants with exactly `examIds`. Idempotent. */
export async function setUserExamAccess(db: Database, userId: number, examIds: number[]) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new AppError(404, "User not found");

  const unique = [...new Set(examIds)];
  if (unique.some((id) => !Number.isInteger(id))) {
    throw new AppError(400, "exam_ids must contain integers only");
  }

  // Reject unknown exam ids rather than silently storing dangling grants.
  if (unique.length > 0) {
    const found: number[] = [];
    for (let i = 0; i < unique.length; i += D1_PARAM_BATCH) {
      const chunk = unique.slice(i, i + D1_PARAM_BATCH);
      const rows = await db
        .select({ id: exams.id })
        .from(exams)
        .where(inArray(exams.id, chunk));
      found.push(...rows.map((r) => r.id));
    }
    const missing = unique.filter((id) => !found.includes(id));
    if (missing.length > 0) {
      throw new AppError(404, `Unknown exam id(s): ${missing.join(", ")}`);
    }
  }

  const statements: BatchItem<"sqlite">[] = [
    db.delete(userExamAccess).where(eq(userExamAccess.userId, userId)),
  ];
  for (let i = 0; i < unique.length; i += D1_GRANT_ROW_BATCH) {
    statements.push(
      db
        .insert(userExamAccess)
        .values(unique.slice(i, i + D1_GRANT_ROW_BATCH).map((examId) => ({ userId, examId })))
    );
  }

  await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);

  return { user_id: userId, granted_exam_ids: unique };
}

/**
 * Replace a user's domain whitelist for one exam with exactly `domainIds`.
 * An empty list removes the restriction (every domain visible). Idempotent.
 *
 * Setting a restriction also abandons the user's in-progress session for the
 * exam if it holds any question the new whitelist hides — that session was
 * drawn under the old rules. Sessions with only still-visible questions stay.
 */
export async function setUserExamDomains(
  db: Database,
  userId: number,
  examId: number,
  domainIds: number[]
) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new AppError(404, "User not found");

  const exam = await db.query.exams.findFirst({ where: eq(exams.id, examId) });
  if (!exam) throw new AppError(404, "Exam not found");

  const unique = [...new Set(domainIds)];
  if (unique.some((id) => !Number.isInteger(id))) {
    throw new AppError(400, "domain_ids must contain integers only");
  }

  // Domains must belong to this exam — a foreign domain id would never match a
  // question and would silently hide the whole exam.
  if (unique.length > 0) {
    const examDomainIds = new Set(
      (
        await db
          .select({ id: examDomains.id })
          .from(examDomains)
          .where(eq(examDomains.examId, examId))
      ).map((d) => d.id)
    );
    const foreign = unique.filter((id) => !examDomainIds.has(id));
    if (foreign.length > 0) {
      throw new AppError(400, `Domain id(s) not in this exam: ${foreign.join(", ")}`);
    }
  }

  const statements: BatchItem<"sqlite">[] = [
    db
      .delete(userExamDomainAccess)
      .where(
        and(eq(userExamDomainAccess.userId, userId), eq(userExamDomainAccess.examId, examId))
      ),
  ];
  if (unique.length > 0) {
    statements.push(
      db
        .update(examSessions)
        .set({ status: "abandoned", pausedAt: null, completedAt: sql`datetime('now')` })
        .where(
          and(
            eq(examSessions.userId, userId),
            eq(examSessions.examId, examId),
            eq(examSessions.status, "in_progress"),
            // Raw `exam_sessions.id`: a drizzle column here could render
            // unqualified and bind to `esq.id` inside the sub-query.
            sql`EXISTS (
              SELECT 1 FROM exam_session_questions esq
              INNER JOIN questions q ON q.id = esq.question_id
              WHERE esq.session_id = exam_sessions.id
                AND (q.domain_id IS NULL OR q.domain_id NOT IN (${sql.join(
                  unique.map((id) => sql`${id}`),
                  sql`, `
                )}))
            )`
          )
        )
    );
  }
  for (let i = 0; i < unique.length; i += D1_DOMAIN_ROW_BATCH) {
    statements.push(
      db
        .insert(userExamDomainAccess)
        .values(
          unique
            .slice(i, i + D1_DOMAIN_ROW_BATCH)
            .map((domainId) => ({ userId, examId, domainId }))
        )
    );
  }

  await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);

  return { user_id: userId, exam_id: examId, domain_ids: unique };
}

/** Every exam's content domains, for the User Management domain pickers. */
export async function listExamDomains(db: Database) {
  const rows = await db
    .select({
      id: examDomains.id,
      examId: examDomains.examId,
      code: examDomains.code,
      name: examDomains.name,
    })
    .from(examDomains)
    .orderBy(asc(examDomains.examId), asc(examDomains.orderIndex));

  return rows.map((d) => ({ id: d.id, exam_id: d.examId, code: d.code, name: d.name }));
}

/** Toggle an exam between public (open to all) and restricted (grant-only). */
export async function updateExamVisibility(db: Database, examId: number, isPublic: boolean) {
  const [updated] = await db
    .update(exams)
    .set({ isPublic })
    .where(eq(exams.id, examId))
    .returning({ id: exams.id, isPublic: exams.isPublic });

  if (!updated) throw new AppError(404, "Exam not found");

  return { id: updated.id, is_public: updated.isPublic };
}
