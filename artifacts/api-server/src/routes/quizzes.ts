/**
 * Quiz routes
 *
 * Public (auth required):
 *   GET  /quizzes                — list active quizzes (filter by jabker, type)
 *   GET  /quizzes/:id            — get quiz with questions (options only, no answers)
 *   POST /quizzes/:id/attempt    — submit answers, get score + feedback
 *   GET  /quizzes/my-attempts    — user's attempt history
 *
 * Admin only:
 *   POST   /quizzes              — create quiz
 *   PATCH  /quizzes/:id         — update quiz
 *   DELETE /quizzes/:id         — delete quiz
 *   POST   /quizzes/generate    — AI-generate questions for a jabker + SKK unit
 */

import { Router } from "express";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { db, quizzes, quizAttempts, competencyClaims } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { getClientForModel, DEFAULT_MODEL } from "../lib/llm";

const router = Router();

interface QuizQuestion {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  correctId: string;
  explanation?: string;
}

// Sanitise questions for public consumption (strip correctId)
function sanitiseQuestions(questions: QuizQuestion[]) {
  return questions.map(({ correctId: _c, explanation: _e, ...q }) => q);
}

// ─── Public endpoints ─────────────────────────────────────────────────────────

router.get("/quizzes", requireAuth, async (req, res): Promise<void> => {
  const { jabker, type } = req.query as { jabker?: string; type?: string };

  const all = await db.select().from(quizzes).where(eq(quizzes.isActive, true));
  const filtered = all.filter((q) => {
    if (jabker && q.jabker && q.jabker !== jabker) return false;
    if (type && q.quizType !== type) return false;
    return true;
  });

  // Strip questions from list response
  res.json(filtered.map(({ questions: _q, ...q }) => q));
});

router.get("/quizzes/my-attempts", requireAuth, async (req, res): Promise<void> => {
  const attempts = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.userId, req.dbUser!.id))
    .orderBy(desc(quizAttempts.completedAt));
  res.json(attempts);
});

router.get("/quizzes/:id", requireAuth, async (req, res): Promise<void> => {
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, Number(req.params.id)));
  if (!quiz || !quiz.isActive) { res.status(404).json({ error: "Quiz tidak ditemukan" }); return; }

  const questions = quiz.questions as QuizQuestion[];
  res.json({ ...quiz, questions: sanitiseQuestions(questions) });
});

router.post("/quizzes/:id/attempt", requireAuth, async (req, res): Promise<void> => {
  const quizId = Number(req.params.id);
  const userId = req.dbUser!.id;
  const { answers, attemptType } = req.body as {
    answers: Record<string, string>;  // { questionId: selectedOptionId }
    attemptType: "pre" | "post" | "proficiency";
  };

  if (!answers || !attemptType) {
    res.status(400).json({ error: "answers dan attemptType diperlukan" });
    return;
  }

  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId));
  if (!quiz) { res.status(404).json({ error: "Quiz tidak ditemukan" }); return; }

  const questions = quiz.questions as QuizQuestion[];
  let correct = 0;
  const feedback: { questionId: string; correct: boolean; explanation?: string }[] = [];

  for (const q of questions) {
    const isCorrect = answers[q.id] === q.correctId;
    if (isCorrect) correct++;
    feedback.push({ questionId: q.id, correct: isCorrect, explanation: q.explanation });
  }

  const scorePercent = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
  const passed = scorePercent >= quiz.passingScore;

  const [attempt] = await db
    .insert(quizAttempts)
    .values({
      userId,
      quizId,
      attemptType,
      answers,
      score: correct,
      totalQuestions: questions.length,
      scorePercent,
      passed,
    })
    .returning();

  // If proficiency quiz, update the linked competency claim score
  if (attemptType === "proficiency" && quiz.skkUnitCode) {
    await db
      .update(competencyClaims)
      .set({
        lastProficiencyScore: scorePercent,
        lastProficiencyAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(competencyClaims.userId, userId),
          eq(competencyClaims.skkUnitCode, quiz.skkUnitCode),
        ),
      );
  }

  res.json({ attempt, feedback, scorePercent, passed, passingScore: quiz.passingScore });
});

// ─── Admin endpoints ──────────────────────────────────────────────────────────

/** List ALL quizzes (including inactive) for admin management */
router.get("/quizzes/admin/all", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const all = await db.select().from(quizzes).orderBy(desc(quizzes.updatedAt));
  res.json(all);
});

/**
 * Validate the questions array before saving.
 *
 * @param questions  - raw value from request body
 * @param requireNonEmpty - when true (POST), rejects missing / non-array / empty arrays;
 *                          when false (PATCH), a missing/undefined value is allowed
 * Returns an error string or null.
 */
export function validateQuestions(questions: unknown, requireNonEmpty = false): string | null {
  // undefined means the field was omitted (valid for PATCH); any other non-array is malformed
  if (questions === undefined) {
    if (requireNonEmpty) return "questions harus berupa array dan tidak boleh kosong.";
    return null; // PATCH: field intentionally omitted
  }
  if (!Array.isArray(questions)) {
    return "questions harus berupa array.";
  }
  if (requireNonEmpty && questions.length === 0) {
    return "Quiz harus memiliki minimal 1 soal.";
  }

  const ids: string[] = [];
  // Normalized texts for duplicate detection: trimmed + collapsed whitespace + lowercased
  const normalizedTexts: string[] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const num = i + 1;

    // Guard: must be an object
    if (typeof q !== "object" || q === null) {
      return `Soal #${num}: format tidak valid.`;
    }
    const qObj = q as Record<string, unknown>;

    // Question text
    if (typeof qObj["text"] !== "string" || !qObj["text"].trim()) {
      return `Soal #${num}: teks soal tidak boleh kosong.`;
    }
    const normalizedText = qObj["text"].trim().replace(/\s+/g, " ").toLowerCase();
    const dupTextIdx = normalizedTexts.indexOf(normalizedText);
    if (dupTextIdx !== -1) {
      return `Soal #${num}: teks soal sama dengan soal #${dupTextIdx + 1} (duplikat).`;
    }
    normalizedTexts.push(normalizedText);

    // Options
    if (!Array.isArray(qObj["options"]) || (qObj["options"] as unknown[]).length === 0) {
      return `Soal #${num}: pilihan jawaban tidak boleh kosong.`;
    }
    for (const opt of qObj["options"] as unknown[]) {
      if (typeof opt !== "object" || opt === null) {
        return `Soal #${num}: format opsi tidak valid.`;
      }
      const optObj = opt as Record<string, unknown>;
      if (typeof optObj["text"] !== "string" || !optObj["text"].trim()) {
        const optId = typeof optObj["id"] === "string" ? optObj["id"].toUpperCase() : "?";
        return `Soal #${num}: opsi ${optId} tidak boleh kosong.`;
      }
    }

    // correctId
    if (typeof qObj["correctId"] !== "string" || !qObj["correctId"]) {
      return `Soal #${num}: jawaban benar belum dipilih.`;
    }

    // Duplicate IDs
    if (typeof qObj["id"] === "string") {
      if (ids.includes(qObj["id"])) {
        return `Soal #${num}: ID soal "${qObj["id"]}" duplikat.`;
      }
      ids.push(qObj["id"]);
    }
  }
  return null;
}

router.post("/quizzes", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const body = req.body as typeof quizzes.$inferInsert;
  const qError = validateQuestions(body.questions, /* requireNonEmpty */ true);
  if (qError) { res.status(400).json({ error: qError }); return; }
  const [quiz] = await db.insert(quizzes).values(body).returning();
  res.status(201).json(quiz);
});

router.patch("/quizzes/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const body = req.body as Partial<typeof quizzes.$inferInsert>;
  if (body.questions !== undefined) {
    const qError = validateQuestions(body.questions, /* requireNonEmpty */ false);
    if (qError) { res.status(400).json({ error: qError }); return; }
  }
  const [updated] = await db
    .update(quizzes)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(quizzes.id, Number(req.params.id)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Tidak ditemukan" }); return; }
  res.json(updated);
});

router.delete("/quizzes/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  await db.update(quizzes).set({ isActive: false }).where(eq(quizzes.id, Number(req.params.id)));
  res.json({ ok: true });
});

/** Bulk aggregate stats for ALL quizzes — used to show inline counts on the quiz list.
 *  Uses a LEFT JOIN so quizzes with zero attempts still appear (with zeros). */
router.get("/quizzes/admin/all-stats", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const rows = await db
    .select({
      quizId: quizzes.id,
      totalAttempts: count(quizAttempts.id),
      avgScore: sql<number>`COALESCE(ROUND(AVG(${quizAttempts.scorePercent})), 0)`,
      passCount: sql<number>`COALESCE(SUM(CASE WHEN ${quizAttempts.passed} THEN 1 ELSE 0 END), 0)`,
    })
    .from(quizzes)
    .leftJoin(quizAttempts, eq(quizAttempts.quizId, quizzes.id))
    .groupBy(quizzes.id);

  const result = rows.map((r) => {
    const total = Number(r.totalAttempts);
    const passes = Number(r.passCount);
    return {
      quizId: r.quizId,
      totalAttempts: total,
      avgScore: Number(r.avgScore),
      passRate: total > 0 ? Math.round((passes / total) * 100) : 0,
    };
  });

  res.json(result);
});

/** Quiz performance statistics — aggregates all attempts to show per-question failure rates */
router.get("/quizzes/admin/stats/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const quizId = Number(req.params.id);
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId));
  if (!quiz) { res.status(404).json({ error: "Quiz tidak ditemukan" }); return; }

  const attempts = await db.select().from(quizAttempts).where(eq(quizAttempts.quizId, quizId));
  const questions = quiz.questions as QuizQuestion[];

  const totalAttempts = attempts.length;
  const passCount = attempts.filter((a) => a.passed).length;
  const avgScore = totalAttempts > 0
    ? Math.round(attempts.reduce((sum, a) => sum + (a.scorePercent ?? 0), 0) / totalAttempts)
    : 0;

  const questionStats = questions.map((q) => {
    // Initialize counts for every option
    const optionCounts: Record<string, number> = {};
    q.options.forEach((o) => { optionCounts[o.id] = 0; });

    let incorrectCount = 0;
    for (const attempt of attempts) {
      const selected = (attempt.answers as Record<string, string>)?.[q.id];
      if (selected !== undefined && optionCounts[selected] !== undefined) {
        optionCounts[selected]++;
      }
      if (selected !== q.correctId) incorrectCount++;
    }

    return {
      id: q.id,
      text: q.text,
      options: q.options,
      correctId: q.correctId,
      optionCounts,
      failRate: totalAttempts > 0 ? Math.round((incorrectCount / totalAttempts) * 100) : 0,
    };
  });

  // Sort by failure rate descending so problem questions surface first
  questionStats.sort((a, b) => b.failRate - a.failRate);

  res.json({
    quizId,
    title: quiz.title,
    totalAttempts,
    passCount,
    passRate: totalAttempts > 0 ? Math.round((passCount / totalAttempts) * 100) : 0,
    avgScore,
    questions: questionStats,
  });
});

/**
 * AI-generate quiz questions for a given jabker + SKK unit.
 * Returns 10 questions (5 for short quizzes) without saving — admin reviews before saving.
 */
router.post("/quizzes/generate", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { jabker, skkUnitCode, skkUnitName, quizType = "learning", count = 10 } = req.body as {
    jabker: string;
    skkUnitCode?: string;
    skkUnitName?: string;
    quizType?: "learning" | "proficiency";
    count?: number;
  };

  if (!jabker) { res.status(400).json({ error: "jabker diperlukan" }); return; }

  const context = skkUnitName
    ? `Unit Kompetensi: ${skkUnitCode} — ${skkUnitName}`
    : `Jabatan Kerja: ${jabker}`;

  const mode = quizType === "proficiency"
    ? "Buat pertanyaan untuk mengukur penguasaan PENGALAMAN KERJA yang diklaim. Fokus pada situasi nyata, keputusan teknis, dan pemecahan masalah lapangan."
    : "Buat pertanyaan untuk mengukur pemahaman materi pembelajaran PKB. Fokus pada konsep, regulasi, dan penerapan teori.";

  const prompt = `Kamu adalah ahli assessmen kompetensi konstruksi Indonesia.

${context}
Tipe quiz: ${quizType === "proficiency" ? "Proficiency (pengalaman)" : "Learning (pembelajaran)"}
${mode}

Buat ${count} pertanyaan pilihan ganda (A/B/C/D) dalam Bahasa Indonesia yang berkualitas tinggi.
Setiap pertanyaan harus:
- Relevan dengan standar BNSP dan Permen PUPR
- Memiliki satu jawaban yang jelas benar
- Disertai penjelasan singkat mengapa jawaban tersebut benar

Kembalikan HANYA JSON array (tanpa markdown, tanpa komentar):
[
  {
    "id": "q1",
    "text": "pertanyaan...",
    "options": [
      {"id": "a", "text": "opsi A"},
      {"id": "b", "text": "opsi B"},
      {"id": "c", "text": "opsi C"},
      {"id": "d", "text": "opsi D"}
    ],
    "correctId": "a",
    "explanation": "penjelasan..."
  }
]`;

  let llm: ReturnType<typeof getClientForModel>;
  try {
    llm = getClientForModel(DEFAULT_MODEL);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }

  try {
    const response = await llm.client.chat.completions.create({
      model: llm.model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.choices[0]?.message?.content ?? "[]";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) { res.status(500).json({ error: "AI tidak menghasilkan JSON yang valid" }); return; }

    const questions: QuizQuestion[] = JSON.parse(jsonMatch[0]);
    res.json({ questions, suggestedTitle: skkUnitName ?? jabker });
  } catch (err) {
    req.log.error({ err }, "Quiz generation error");
    res.status(500).json({ error: "Gagal generate pertanyaan quiz" });
  }
});

export default router;
