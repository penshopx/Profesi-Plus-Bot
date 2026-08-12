/**
 * Quiz system for PKB evidence.
 *
 * Two quiz modes:
 *   "learning"     — Pre-test + Post-test around microlearning content.
 *                    The delta (post − pre) is formal PKB evidence of improvement.
 *   "proficiency"  — Single attempt that validates claimed work experience.
 *                    Score documents the TKK's mastery, not their growth.
 *
 * Questions are stored as JSONB so the schema can evolve without migrations.
 * Each question: { id, text, options: [{id, text}], correctId, explanation? }
 */

import { pgTable, serial, integer, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

export const QUIZ_TYPES = ["learning", "proficiency"] as const;
export type QuizType = (typeof QUIZ_TYPES)[number];

export const ATTEMPT_TYPES = ["pre", "post", "proficiency"] as const;
export type AttemptType = (typeof ATTEMPT_TYPES)[number];

// ─── Quiz definition (admin-created, or AI-generated) ────────────────────────

export const quizzes = pgTable("quizzes", {
  id: serial("id").primaryKey(),

  title: text("title").notNull(),
  description: text("description"),

  // Context — used to scope quizzes to a jabker or unit
  jabker: text("jabker"),            // e.g. "ahli_k3_konstruksi" (null = applies to all)
  skkUnitCode: text("skk_unit_code"), // link to a specific SKK unit if applicable

  quizType: text("quiz_type").notNull().default("learning"),  // QuizType
  passingScore: integer("passing_score").notNull().default(70), // % to pass

  // questions: QuizQuestion[]
  // [{ id: string, text: string, options: [{id: string, text: string}], correctId: string, explanation?: string }]
  questions: jsonb("questions").notNull().default([]),

  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Quiz = typeof quizzes.$inferSelect;
export type InsertQuiz = typeof quizzes.$inferInsert;

// ─── Quiz attempt (one row per user attempt) ──────────────────────────────────

export const quizAttempts = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  quizId: integer("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),

  // "pre" and "post" pair together for learning quizzes.
  // "proficiency" is used for experience-based quizzes.
  attemptType: text("attempt_type").notNull(),  // AttemptType

  // answers: { [questionId]: selectedOptionId }
  answers: jsonb("answers").notNull().default({}),

  score: integer("score").notNull().default(0),      // raw correct count
  totalQuestions: integer("total_questions").notNull().default(0),
  scorePercent: integer("score_percent").notNull().default(0), // 0–100
  passed: boolean("passed").notNull().default(false),

  completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
});

export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type InsertQuizAttempt = typeof quizAttempts.$inferInsert;

// ─── Exum outline (blueprint before full generation) ─────────────────────────

export const exumOutlines = pgTable("exum_outlines", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().unique(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // sections: OutlineSection[]
  // [{ id: string, title: string, points: string[], userNotes: string, order: number }]
  sections: jsonb("sections").notNull().default([]),

  isApproved: boolean("is_approved").notNull().default(false),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ExumOutline = typeof exumOutlines.$inferSelect;
export type InsertExumOutline = typeof exumOutlines.$inferInsert;
