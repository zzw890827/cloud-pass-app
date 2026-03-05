import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { exams } from "./exams";

export const questions = sqliteTable(
  "questions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    examId: integer("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    questionText: text("question_text").notNull(),
    questionType: text("question_type").notNull(), // "single" | "multi"
    explanation: text("explanation"),
    numCorrect: integer("num_correct").notNull().default(1),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`)
      .$onUpdate(() => new Date().toISOString().replace("T", " ").slice(0, 19)),
  },
  (table) => [
    index("idx_questions_exam_id").on(table.examId),
    index("idx_questions_external_id").on(table.externalId),
  ]
);
