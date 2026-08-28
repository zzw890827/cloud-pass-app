import { eq, asc, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Database } from "../db/client";
import { users, exams, userExamAccess } from "../db/schema";
import { AppError } from "../lib/errors";

// D1 caps bound parameters at 100 per statement.
const D1_PARAM_BATCH = 95;
// A grant row binds two parameters (user_id, exam_id), so rows-per-insert is half.
const D1_GRANT_ROW_BATCH = Math.floor(D1_PARAM_BATCH / 2);

/** Every user, each with the ids of the exams explicitly granted to them. */
export async function listUsersWithAccess(db: Database) {
  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      isActive: users.isActive,
      isAdmin: users.isAdmin,
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

  return userRows.map((u) => ({
    id: u.id,
    email: u.email,
    display_name: u.displayName,
    is_active: u.isActive,
    is_admin: u.isAdmin,
    // SQLite's `datetime('now')` has no zone marker; append Z so JS parses UTC.
    created_at: u.createdAt.endsWith("Z") ? u.createdAt : `${u.createdAt}Z`,
    granted_exam_ids: byUser.get(u.id) ?? [],
  }));
}

/**
 * Flip a user's `is_active` / `is_admin` flags.
 *
 * Admins may not change their own flags — that is the only way to lock every
 * admin out of the maintenance screens.
 */
export async function updateUserFlags(
  db: Database,
  targetUserId: number,
  actingUserId: number,
  patch: { isActive?: boolean; isAdmin?: boolean }
) {
  if (patch.isActive === undefined && patch.isAdmin === undefined) {
    throw new AppError(400, "is_active or is_admin is required");
  }
  if (targetUserId === actingUserId) {
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
    });

  if (!updated) throw new AppError(404, "User not found");

  return { id: updated.id, is_active: updated.isActive, is_admin: updated.isAdmin };
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
