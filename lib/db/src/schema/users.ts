import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ROLES = ["user", "instruktur", "lembaga_diklat", "asosiasi", "admin"] as const;
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
  exumCredits: integer("exum_credits").notNull().default(0),
  freeExumUsed: boolean("free_exum_used").notNull().default(false),
  expoPushToken: text("expo_push_token"),
  /** Set whenever a new push token is stored. Used to proactively clear tokens
   *  that have gone stale (e.g. app uninstalled without re-registering). */
  expoPushTokenSetAt: timestamp("expo_push_token_set_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
