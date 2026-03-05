import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { questions } from "./questions";

export const userProgress = sqliteTable(
  "user_progress",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
    selectedOptionIds: text("selected_option_ids").notNull(), // JSON array string
    attemptedAt: text("attempted_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("uq_user_question").on(table.userId, table.questionId),
    index("idx_user_progress_user_id").on(table.userId),
  ]
);
