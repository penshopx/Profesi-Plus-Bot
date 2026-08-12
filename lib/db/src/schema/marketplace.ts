import {
  pgTable, serial, integer, text, timestamp, uniqueIndex,
  real, boolean, jsonb,
} from "drizzle-orm/pg-core";
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

export const marketplaceWatched = pgTable("marketplace_watched", {
  id:          serial("id").primaryKey(),
  userId:      integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  courseId:    text("course_id").notNull(),   // matches Course.id in marketplace catalog
  courseTitle: text("course_title").notNull(),
  provider:    text("provider").notNull(),
  watchedAt:   timestamp("watched_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Enforce one row per user+course — prevents duplicate entries from concurrent requests
  userCourseIdx: uniqueIndex("marketplace_watched_user_course_idx").on(table.userId, table.courseId),
}));

export type MarketplaceWatched = typeof marketplaceWatched.$inferSelect;

// ─── Catalog tables ───────────────────────────────────────────────────────────
// Courses and reviews are now stored in the DB so admins can add/edit
// courses without code changes.

/**
 * marketplace_courses — kursus/webinar/diklatkerja/modul yang tersedia.
 *
 * skkTags   : [{code, name}][]  — unit SKK yang dicakup
 * curriculum: [{title, duration, type}][] — daftar modul
 * jabker    : string[]          — jabatan kerja yang relevan
 * highlights: string[]          — poin-poin unggulan
 */
export const marketplaceCourses = pgTable("marketplace_courses", {
  id:               text("id").primaryKey(),         // e.g. "k3-dasar-pupr"
  title:            text("title").notNull(),
  provider:         text("provider").notNull(),
  providerLogo:     text("provider_logo"),
  thumbnail:        text("thumbnail").notNull(),      // Tailwind gradient classes
  type:             text("type").notNull(),           // "video"|"webinar"|"diklatkerja"|"modul"
  price:            text("price").notNull(),          // "gratis"|"berbayar"
  priceIdr:         integer("price_idr"),
  priceOriginalIdr: integer("price_original_idr"),
  rating:           real("rating").notNull(),
  ratingCount:      integer("rating_count").notNull(),
  durationMinutes:  integer("duration_minutes").notNull(),
  videoCount:       integer("video_count").notNull(),
  quizCount:        integer("quiz_count").notNull(),
  hasCertificate:   boolean("has_certificate").notNull().default(false),
  jabker:           text("jabker").array().notNull().default(sql`ARRAY[]::text[]`),
  skkTags:          jsonb("skk_tags").notNull().default(sql`'[]'::jsonb`),
  description:      text("description").notNull(),
  highlights:       text("highlights").array().notNull().default(sql`ARRAY[]::text[]`),
  curriculum:       jsonb("curriculum").notNull().default(sql`'[]'::jsonb`),
  url:              text("url").notNull(),
  isBestSeller:     boolean("is_best_seller").notNull().default(false),
  isFeatured:       boolean("is_featured").notNull().default(false),
  isNew:            boolean("is_new").notNull().default(false),
  sortOrder:        integer("sort_order").notNull().default(0),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MarketplaceCourse = typeof marketplaceCourses.$inferSelect;

/**
 * marketplace_ai_reviews — penilaian dari platform AI (ChatGPT, Gemini, Claude, dll.)
 */
export const marketplaceAiReviews = pgTable("marketplace_ai_reviews", {
  id:             serial("id").primaryKey(),
  courseId:       text("course_id").notNull().references(() => marketplaceCourses.id, { onDelete: "cascade" }),
  platform:       text("platform").notNull(),       // "ChatGPT", "Gemini", dll.
  platformIcon:   text("platform_icon").notNull(),  // emoji
  rating:         real("rating").notNull(),          // 1–5
  relevanceScore: integer("relevance_score").notNull(), // 0–100
  comment:        text("comment").notNull(),
  reviewedAt:     text("reviewed_at").notNull(),     // "Oktober 2025"
  createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MarketplaceAiReview = typeof marketplaceAiReviews.$inferSelect;

/**
 * marketplace_askom_reviews — penilaian resmi dari Asesor Kompetensi BNSP
 */
export const marketplaceAskomReviews = pgTable("marketplace_askom_reviews", {
  id:               serial("id").primaryKey(),
  courseId:         text("course_id").notNull().references(() => marketplaceCourses.id, { onDelete: "cascade" }),
  reviewerName:     text("reviewer_name").notNull(),
  credential:       text("credential").notNull(),
  institution:      text("institution").notNull(),
  credentialNumber: text("credential_number"),
  rating:           real("rating").notNull(),
  relevanceScore:   integer("relevance_score").notNull(),
  recommendation:   text("recommendation").notNull(), // "direkomendasikan"|"direkomendasikan_dengan_catatan"|"tidak_direkomendasikan"
  comment:          text("comment").notNull(),
  strengths:        text("strengths").array().notNull().default(sql`ARRAY[]::text[]`),
  notes:            text("notes"),
  reviewedAt:       text("reviewed_at").notNull(),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MarketplaceAskomReview = typeof marketplaceAskomReviews.$inferSelect;
