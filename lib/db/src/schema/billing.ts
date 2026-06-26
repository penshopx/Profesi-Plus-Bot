import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Payment records (one per external order). `externalId` is unique so webhook
 * delivery is idempotent — a retried/duplicate Scalev event cannot upgrade twice.
 */
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  provider: text("provider").notNull().default("scalev"),
  externalId: text("external_id").notNull().unique(),
  customerEmail: text("customer_email").notNull().default(""),
  status: text("status").notNull().default(""),
  amount: integer("amount").notNull().default(0),
  raw: text("raw").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const USAGE_KINDS = ["exum"] as const;
export type UsageKind = (typeof USAGE_KINDS)[number];

/** Append-only usage log used to enforce per-period freemium quotas. */
export const usageEvents = pgTable("usage_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  kind: text("kind").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type UsageEvent = typeof usageEvents.$inferSelect;
