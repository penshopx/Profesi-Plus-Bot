import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const competencyAnalysis = pgTable("competency_analysis", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  jabkerId: text("jabker_id").notNull(),
  jabkerName: text("jabker_name").notNull(),
  jenjang: text("jenjang"),
  klasifikasi: text("klasifikasi"),
  model: text("model").notNull(),
  estimatedSkpk: integer("estimated_skpk").notNull().default(0),
  readiness: text("readiness").notNull().default("lemah"),
  summary: text("summary").notNull().default(""),
  result: jsonb("result").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CompetencyAnalysisRow = typeof competencyAnalysis.$inferSelect;

export const COMPETENCY_UNIT_STATUSES = ["covered", "partial", "gap"] as const;
export type CompetencyUnitStatus = (typeof COMPETENCY_UNIT_STATUSES)[number];

export interface CompetencyUnitResult {
  code: string;
  name: string;
  status: CompetencyUnitStatus;
  rationale: string;
  evidenceRef: string | null;
}

export interface CompetencyAnalysisResult {
  summary: string;
  estimatedSkpk: number;
  readiness: "kuat" | "cukup" | "lemah";
  units: CompetencyUnitResult[];
  gaps: string[];
  recommendations: string[];
}
