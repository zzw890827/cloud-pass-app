import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { questions } from "./questions";

export const options = sqliteTable(
  "options",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    optionText: text("option_text").notNull(),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull().default(false),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (table) => [index("idx_options_question_id").on(table.questionId)]
);
