import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  date,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const recurringTransactionsTable = pgTable("recurring_transactions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  frequency: text("frequency", { enum: ["weekly", "biweekly", "monthly"] }).notNull(),
  nextRunDate: date("next_run_date", { mode: "string" }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  templateData: jsonb("template_data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type RecurringTransaction = typeof recurringTransactionsTable.$inferSelect;
