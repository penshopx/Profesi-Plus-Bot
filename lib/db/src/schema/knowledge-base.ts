import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

export const knowledgeBase = pgTable("knowledge_base", {
  id: serial("id").primaryKey(),
  category: text("category").notNull().default("umum"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  klasifikasi: text("klasifikasi"),
  jenjang: text("jenjang"),
  skkUnitCode: text("skk_unit_code"),
  tags: text("tags"),
  source: text("source"),
  priority: integer("priority").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  seedKey: text("seed_key"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertKnowledgeBaseSchema = createInsertSchema(knowledgeBase).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const KB_CATEGORIES = [
  "regulasi",
  "rubrik_exum",
  "contoh_exum",
  "panduan_skk",
  "umum",
] as const;

export type KbCategory = (typeof KB_CATEGORIES)[number];
export type KnowledgeBaseEntry = typeof knowledgeBase.$inferSelect;
export type InsertKnowledgeBase = z.infer<typeof insertKnowledgeBaseSchema>;
