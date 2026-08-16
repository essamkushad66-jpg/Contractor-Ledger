import {
  integer,
  pgTable,
  serial,
  text,
  date,
  timestamp,
} from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const sitePhotosTable = pgTable("site_photos", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  photoPath: text("photo_path").notNull(),
  caption: text("caption"),
  takenAt: date("taken_at", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SitePhoto = typeof sitePhotosTable.$inferSelect;
