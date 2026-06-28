import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { exams } from "./exams";

export const examDomains = sqliteTable(
  "exam_domains",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    examId: integer("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    code: text("code").notNull(), // stable per-exam key, e.g. "agent-arch"
    name: text("name").notNull(), // display name
    weight: integer("weight").notNull(), // relative weight, normalized at selection time
    orderIndex: integer("order_index").notNull().default(0),
  },
  (table) => [
    uniqueIndex("idx_exam_domains_exam_code").on(table.examId, table.code),
    index("idx_exam_domains_exam_id").on(table.examId),
  ]
);
