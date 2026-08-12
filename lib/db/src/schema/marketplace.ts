import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Records which marketplace courses a user has "watched" (opened via "Buka Kursus").
 * One row per (user, course); upserted on each open so first_watched_at is preserved.
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
  },
  (t) => [
    uniqueIndex("marketplace_watches_user_course_uidx").on(t.userId, t.courseId),
  ],
);
