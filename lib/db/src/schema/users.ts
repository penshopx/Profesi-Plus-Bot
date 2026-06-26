import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ROLES = ["user", "instruktur", "lembaga_diklat", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const PLANS = ["free", "pro"] as const;
export type Plan = (typeof PLANS)[number];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  role: text("role").notNull().default("user"),
  name: text("name").notNull().default(""),
  email: text("email").notNull().default(""),
  plan: text("plan").notNull().default("free"),
  planExpiresAt: timestamp("plan_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
