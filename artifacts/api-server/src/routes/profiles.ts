/**
 * Profile routes — APL 01 (TKK identity) + APL 02 (competency claims)
 *
 * GET  /profiles/me              — fetch own APL 01 profile (create if missing)
 * PATCH /profiles/me             — upsert APL 01 fields
 * GET  /profiles/me/claims       — list APL 02 competency claims
 * POST /profiles/me/claims       — add a claim
 * PATCH /profiles/me/claims/:id  — update a claim
 * DELETE /profiles/me/claims/:id — remove a claim
 */

import { Router } from "express";
import { eq, and, isNotNull } from "drizzle-orm";
import { db, profiles, competencyClaims, quizzes, quizAttempts } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// ─── APL 01 ──────────────────────────────────────────────────────────────────

router.get("/profiles/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.dbUser!.id;

  let [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  if (!profile) {
    [profile] = await db.insert(profiles).values({ userId }).returning();
  }
  res.json(profile);
});

router.patch("/profiles/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.dbUser!.id;
  const body = req.body as Partial<typeof profiles.$inferInsert>;

  // Strip fields that cannot be user-patched
  const { id: _id, userId: _uid, createdAt: _ca, ...allowed } = body as Record<string, unknown>;
  void _id; void _uid; void _ca;

  // Determine completeness: at minimum NIK, nama (from users), tanggal lahir, jabker, and pendidikan
  const existing = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const merged = { ...(existing[0] ?? {}), ...allowed };
  const isComplete = !!(
    merged.nik &&
    merged.tanggalLahir &&
    merged.jenjangPendidikan &&
    merged.namaPerusahaan
  );

  const [updated] = await db
    .insert(profiles)
    .values({ userId, ...allowed, isComplete, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: { ...allowed, isComplete, updatedAt: new Date() },
    })
    .returning();

  res.json(updated);
});

// ─── APL 02 — Competency Claims ──────────────────────────────────────────────

router.get("/profiles/me/claims", requireAuth, async (req, res): Promise<void> => {
  const claims = await db
    .select()
    .from(competencyClaims)
    .where(eq(competencyClaims.userId, req.dbUser!.id));
  res.json(claims);
});

router.post("/profiles/me/claims", requireAuth, async (req, res): Promise<void> => {
  const userId = req.dbUser!.id;
  const body = req.body as {
    skkUnitCode: string;
    skkUnitName: string;
    jabker: string;
    jenjang?: string;
    pencapaian?: string;
    buktiUtama?: string;
    jenisBukti?: string;
    catatanTambahan?: string;
  };

  if (!body.skkUnitCode || !body.skkUnitName || !body.jabker) {
    res.status(400).json({ error: "skkUnitCode, skkUnitName, jabker diperlukan" });
    return;
  }

  const [claim] = await db
    .insert(competencyClaims)
    .values({ userId, ...body })
    .returning();

  res.status(201).json(claim);
});

router.patch("/profiles/me/claims/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.dbUser!.id;
  const claimId = Number(req.params.id);
  const body = req.body as Partial<typeof competencyClaims.$inferInsert>;
  const { id: _id, userId: _uid, createdAt: _ca, ...allowed } = body as Record<string, unknown>;
  void _id; void _uid; void _ca;

  const [updated] = await db
    .update(competencyClaims)
    .set({ ...allowed, updatedAt: new Date() })
    .where(and(eq(competencyClaims.id, claimId), eq(competencyClaims.userId, userId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Tidak ditemukan" }); return; }
  res.json(updated);
});

router.delete("/profiles/me/claims/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.dbUser!.id;
  const claimId = Number(req.params.id);

  const [deleted] = await db
    .delete(competencyClaims)
    .where(and(eq(competencyClaims.id, claimId), eq(competencyClaims.userId, userId)))
    .returning();

  if (!deleted) { res.status(404).json({ error: "Tidak ditemukan" }); return; }
  res.json({ ok: true });
});

// ─── Quiz coverage gap check ──────────────────────────────────────────────────
// GET /profiles/me/quiz-coverage
// Cross-references the user's APL 02 competency claims against their passing
// quiz attempts. Returns an array of "gap" entries — claimed units with no
// passing quiz attempt on record. Also indicates whether a quiz exists for that
// unit so the UI can link the user directly to it.

router.get("/profiles/me/quiz-coverage", requireAuth, async (req, res): Promise<void> => {
  const userId = req.dbUser!.id;

  // 1. All APL 02 competency claims for this user
  const claims = await db
    .select()
    .from(competencyClaims)
    .where(eq(competencyClaims.userId, userId));

  if (claims.length === 0) {
    res.json({ gaps: [], claimsCount: 0 });
    return;
  }

  // 2. All active quizzes that target a specific SKK unit
  const unitQuizzes = await db
    .select({ id: quizzes.id, title: quizzes.title, skkUnitCode: quizzes.skkUnitCode })
    .from(quizzes)
    .where(and(eq(quizzes.isActive, true), isNotNull(quizzes.skkUnitCode)));

  // 3. SKK unit codes where the user has at least one passing attempt
  const passingRows = await db
    .select({ skkUnitCode: quizzes.skkUnitCode })
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
    .where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.passed, true)));

  const passedCodes = new Set(
    passingRows.map((r) => r.skkUnitCode).filter(Boolean) as string[]
  );

  // Build a lookup from unit code → first available quiz
  const quizByCode = new Map<string, { id: number; title: string }>();
  for (const q of unitQuizzes) {
    if (q.skkUnitCode && !quizByCode.has(q.skkUnitCode)) {
      quizByCode.set(q.skkUnitCode, { id: q.id, title: q.title });
    }
  }

  // 4. Claims with no passing attempt = gaps
  const gaps = claims
    .filter((c) => !passedCodes.has(c.skkUnitCode))
    .map((c) => {
      const quiz = quizByCode.get(c.skkUnitCode) ?? null;
      return {
        skkUnitCode: c.skkUnitCode,
        skkUnitName: c.skkUnitName,
        quizId: quiz?.id ?? null,
        quizTitle: quiz?.title ?? null,
      };
    });

  res.json({ gaps, claimsCount: claims.length });
});

export default router;
