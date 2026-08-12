import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { db, competencyAnalysis } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { competencyRateLimiter } from "../middlewares/rateLimiter";
import { findJabkerGroup } from "../lib/skk-data";
import { getUserProjectBrain } from "../lib/project-brain";
import { getClientForModel, isKnownModel, DEFAULT_MODEL } from "../lib/llm";
import { buildCompetencyPrompt, parseCompetencyResult } from "../lib/competency-studio";

const router: IRouter = Router();

/** Load an analysis only if it belongs to the authenticated user; 404 otherwise. */
async function loadOwned(req: Request, res: Response, id: number) {
  const rows = await db
    .select()
    .from(competencyAnalysis)
    .where(and(eq(competencyAnalysis.id, id), eq(competencyAnalysis.userId, req.dbUser!.id)))
    .limit(1);
  if (!rows[0]) {
    res.status(404).json({ error: "Analysis not found" });
    return null;
  }
  return rows[0];
}

// ── Check whether the authenticated user has an analysis for a given jabker ───────
// Uses findJabkerGroup for canonical ID resolution so the match is always exact.
router.get("/competency-studio/check", requireAuth, async (req, res) => {
  const jabkerQuery = typeof req.query.jabker === "string" ? req.query.jabker.trim() : "";
  if (!jabkerQuery) {
    res.status(400).json({ error: "jabker query param is required" });
    return;
  }
  const jabker = findJabkerGroup(jabkerQuery);
  if (!jabker) {
    // Unknown jabker — treat as no analysis
    res.json({ hasAnalysis: false });
    return;
  }
  const rows = await db
    .select({ id: competencyAnalysis.id })
    .from(competencyAnalysis)
    .where(and(eq(competencyAnalysis.userId, req.dbUser!.id), eq(competencyAnalysis.jabkerId, jabker.id)))
    .limit(1);
  res.json({ hasAnalysis: rows.length > 0 });
});

// ── List own analyses (summary fields only) ──────────────────────────────────────
router.get("/competency-studio", requireAuth, async (req, res) => {
  const rows = await db
    .select({
      id: competencyAnalysis.id,
      jabkerId: competencyAnalysis.jabkerId,
      jabkerName: competencyAnalysis.jabkerName,
      jenjang: competencyAnalysis.jenjang,
      klasifikasi: competencyAnalysis.klasifikasi,
      estimatedSkpk: competencyAnalysis.estimatedSkpk,
      readiness: competencyAnalysis.readiness,
      summary: competencyAnalysis.summary,
      model: competencyAnalysis.model,
      createdAt: competencyAnalysis.createdAt,
    })
    .from(competencyAnalysis)
    .where(eq(competencyAnalysis.userId, req.dbUser!.id))
    .orderBy(desc(competencyAnalysis.createdAt));
  res.json(rows);
});

// ── Get one full analysis (owner only) ───────────────────────────────────────────
router.get("/competency-studio/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const row = await loadOwned(req, res, id);
  if (!row) return;
  res.json(row);
});

// ── Run a new analysis ───────────────────────────────────────────────────────────
router.post("/competency-studio/analyze", requireAuth, competencyRateLimiter, async (req, res) => {
  const b = req.body as Record<string, unknown>;
  const jabkerQuery = typeof b.jabker === "string" ? b.jabker.trim() : "";
  if (!jabkerQuery) {
    res.status(400).json({ error: "jabker wajib diisi" });
    return;
  }
  const jabker = findJabkerGroup(jabkerQuery);
  if (!jabker) {
    res.status(404).json({ error: "Jabatan kerja tidak dikenal" });
    return;
  }

  const entries = await getUserProjectBrain(req.dbUser!.id);
  if (!entries.length) {
    res.status(400).json({ error: "Tambahkan pengalaman di Otak Proyek dulu sebelum memetakan kompetensi." });
    return;
  }

  const model = typeof b.model === "string" && isKnownModel(b.model) ? b.model : DEFAULT_MODEL;
  let llm: ReturnType<typeof getClientForModel>;
  try {
    llm = getClientForModel(model);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }

  const prompt = buildCompetencyPrompt(jabker, entries);

  try {
    const response = await llm.client.chat.completions.create({
      model: llm.model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = response.choices[0]?.message?.content ?? "";
    const result = parseCompetencyResult(raw, jabker);

    const [saved] = await db
      .insert(competencyAnalysis)
      .values({
        userId: req.dbUser!.id,
        jabkerId: jabker.id,
        jabkerName: jabker.name,
        jenjang: jabker.jenjang,
        klasifikasi: jabker.klasifikasi,
        model: llm.model,
        estimatedSkpk: result.estimatedSkpk,
        readiness: result.readiness,
        summary: result.summary,
        result,
      })
      .returning();

    res.status(201).json(saved);
  } catch (err) {
    req.log.error({ err }, "Competency analysis error");
    res.status(500).json({ error: "Gagal memetakan kompetensi. Coba lagi." });
  }
});

// ── Delete (owner only) ──────────────────────────────────────────────────────────
router.delete("/competency-studio/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const row = await loadOwned(req, res, id);
  if (!row) return;
  await db
    .delete(competencyAnalysis)
    .where(and(eq(competencyAnalysis.id, id), eq(competencyAnalysis.userId, req.dbUser!.id)));
  res.json({ success: true });
});

export default router;
