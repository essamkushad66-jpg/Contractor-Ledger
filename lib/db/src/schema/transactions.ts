import {
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { vendorsTable } from "./vendors";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  vendorId: integer("vendor_id")
    .references(() => vendorsTable.id, { onDelete: "set null" }),
  type: text("type", { enum: ["deposit", "expense"] }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  category: text("category", { enum: ["materials", "labor", "transport", "permits", "equipment", "others"] }).default("others").notNull(),
  description: text("description").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  receiptPath: text("receipt_path"),
  receiptPaths: text("receipt_paths").array(),
  shopName: text("shop_name"),
  personName: text("person_name"),
  paymentMethod: text("payment_method", { enum: ["cash", "transfer", "card", "check"] }).default("cash"),
  deductionType: text("deduction_type", { enum: ["percentage", "amount"] }).default("percentage"),
  deductionValue: numeric("deduction_value", { precision: 12, scale: 2 }),
  deductionReason: text("deduction_reason"),
  transportCost: numeric("transport_cost", { precision: 12, scale: 2 }),
  laborCost: numeric("labor_cost", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(
  transactionsTable,
).omit({
  id: true,
  createdAt: true,
});
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
