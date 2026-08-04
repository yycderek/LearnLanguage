import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const draftHeads = sqliteTable("draft_heads", {
  draftId: text("draft_id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  courseId: text("course_id").notNull(),
  languageId: text("language_id").notNull(),
  title: text("title").notNull(),
  currentRevision: integer("current_revision").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const draftVersions = sqliteTable("draft_versions", {
  draftId: text("draft_id").notNull(),
  revision: integer("revision").notNull(),
  ownerId: text("owner_id").notNull(),
  payload: text("payload").notNull(),
  summary: text("summary").notNull().default("Manual save"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.draftId, table.revision] })]);
