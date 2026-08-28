import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { exams } from "./exams";

/**
 * Per-user grant for a restricted exam. Only consulted when `exams.is_public`
 * is false — public exams are open to every active user.
 */
export const userExamAccess = sqliteTable(
  "user_exam_access",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    examId: integer("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("uq_user_exam_access").on(table.userId, table.examId),
    index("idx_user_exam_access_user_id").on(table.userId),
    index("idx_user_exam_access_exam_id").on(table.examId),
  ]
);
