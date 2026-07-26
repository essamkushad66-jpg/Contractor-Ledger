import { pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const vendorsTable = pgTable("vendors", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(), // The user who created this vendor
  name: text("name").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // e.g., 'worker', 'engineer', 'supplier', 'other'
  phone: varchar("phone", { length: 50 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Vendor = typeof vendorsTable.$inferSelect;
export type InsertVendor = typeof vendorsTable.$inferInsert;
