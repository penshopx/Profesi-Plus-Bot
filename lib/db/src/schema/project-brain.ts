import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

export const projectBrain = pgTable("project_brain", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("project"),
  title: text("title").notNull(),
  organization: text("organization"),
  role: text("role"),
  period: text("period"),
  location: text("location"),
  description: text("description").notNull().default(""),
  skkUnitCodes: text("skk_unit_codes"),
  jenjang: text("jenjang"),
  highlights: text("highlights"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertProjectBrainSchema = createInsertSchema(projectBrain).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const PROJECT_BRAIN_KINDS = [
  "project",
  "role",
  "achievement",
  "skill",
  "profile",
] as const;

export type ProjectBrainKind = (typeof PROJECT_BRAIN_KINDS)[number];
export type ProjectBrainEntry = typeof projectBrain.$inferSelect;
export type InsertProjectBrain = z.infer<typeof insertProjectBrainSchema>;
