import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  uploadedBy: integer("uploaded_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  url: text("url").notNull(),
  platform: text("platform").notNull().default("youtube"),
  jabker: text("jabker"),
  skkUnitCode: text("skk_unit_code"),
  skkUnitName: text("skk_unit_name"),
  description: text("description"),
  tags: text("tags"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertVideoSchema = createInsertSchema(videos).omit({
  id: true,
  createdAt: true,
});

export type Video = typeof videos.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
