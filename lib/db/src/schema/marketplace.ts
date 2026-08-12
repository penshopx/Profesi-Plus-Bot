import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

/**
 * Records which marketplace courses a user has "watched" (opened via "Buka Kursus").
 * One row per (user, course); upserted on each open so first_watched_at is preserved.
 * Metadata columns (title, provider, jabkerList, skkTagsList) are stored at watch-time
 * so the AI context builder can surface them without duplicating the static catalog.
 */
export const marketplaceWatches = pgTable(
  "marketplace_watches",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: text("course_id").notNull(),
    watchedAt: timestamp("watched_at").defaultNow().notNull(),
    /** Human-readable course title, stored at watch-time. */
    courseTitle: text("course_title"),
    /** Provider / publisher name. */
    courseProvider: text("course_provider"),
    /** Jabker IDs this course targets, e.g. ["pelaksana_konstruksi"]. */
    jabkerList: text("jabker_list").array().default(sql`ARRAY[]::text[]`),
    /** SKK unit codes relevant to the course, e.g. ["SKK.01.01"]. */
    skkTagsList: text("skk_tags_list").array().default(sql`ARRAY[]::text[]`),
  },
  (t) => [
    uniqueIndex("marketplace_watches_user_course_uidx").on(t.userId, t.courseId),
  ],
);
