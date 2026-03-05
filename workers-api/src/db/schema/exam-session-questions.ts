import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { examSessions } from "./exam-sessions";
import { questions } from "./questions";

export const examSessionQuestions = sqliteTable(
  "exam_session_questions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: integer("session_id")
      .notNull()
      .references(() => examSessions.id, { onDelete: "cascade" }),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    selectedOptionIds: text("selected_option_ids"), // JSON array string, null until answered
    isCorrect: integer("is_correct", { mode: "boolean" }), // null until answered
  },
  (table) => [index("idx_esq_session_id").on(table.sessionId)]
);
