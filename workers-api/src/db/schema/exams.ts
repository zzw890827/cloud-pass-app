import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { providers } from "./providers";

export const exams = sqliteTable(
  "exams",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    providerId: integer("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    totalQuestions: integer("total_questions").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    numQuestions: integer("num_questions").notNull().default(65),
    passPercentage: integer("pass_percentage").notNull().default(75),
    timeLimitMinutes: integer("time_limit_minutes").notNull().default(180),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`)
      .$onUpdate(() => new Date().toISOString().replace("T", " ").slice(0, 19)),
  },
  (table) => [
    uniqueIndex("idx_exams_code").on(table.code),
    index("idx_exams_provider_id").on(table.providerId),
  ]
);
