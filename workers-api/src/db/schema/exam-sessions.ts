import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { exams } from "./exams";

export const examSessions = sqliteTable(
  "exam_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    examId: integer("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("in_progress"), // in_progress | completed | abandoned
    // Config snapshot from exam at creation
    numQuestions: integer("num_questions").notNull(),
    passPercentage: integer("pass_percentage").notNull(),
    timeLimitMinutes: integer("time_limit_minutes").notNull(),
    // Results (filled on completion)
    score: real("score"),
    correctCount: integer("correct_count"),
    totalAnswered: integer("total_answered"),
    passed: integer("passed", { mode: "boolean" }),
    startedAt: text("started_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    completedAt: text("completed_at"),
  },
  (table) => [
    index("idx_exam_sessions_user_id").on(table.userId),
    index("idx_exam_sessions_exam_id").on(table.examId),
  ]
);
