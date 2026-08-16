import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  action: text("action", { enum: ["created", "updated", "deleted"] }).notNull(),
  entityType: text("entity_type", {
    enum: ["project", "transaction", "member", "change_order", "recurring", "photo"],
  }).notNull(),
  entityId: integer("entity_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ActivityLog = typeof activityLogTable.$inferSelect;
