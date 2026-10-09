import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { exams } from "./exams";

/**
 * Per-user domain whitelist within one exam. A user with no rows for an exam
 * sees all of its domains; once any row exists, only the listed domains'
 * questions are visible (questions without a domain are hidden too).
 *
 * `exam_id` is stored alongside the domain so the restriction keeps applying
 * — fail closed — even if every whitelisted domain is later deleted.
 */
export const userExamDomainAccess = sqliteTable(
  "user_exam_domain_access",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    examId: integer("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    // Deliberately no FK: a cascade from a deleted domain would silently lift
    // the restriction. The service validates domain ids on write instead.
    domainId: integer("domain_id").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("uq_user_exam_domain_access").on(table.userId, table.domainId),
    index("idx_user_exam_domain_access_user_exam").on(table.userId, table.examId),
    index("idx_user_exam_domain_access_exam_id").on(table.examId),
  ]
);
