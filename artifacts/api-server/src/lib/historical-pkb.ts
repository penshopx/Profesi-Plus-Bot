import { db, conversations, evidenceItems, competencyAnalysis, quizAttempts, quizzes } from "@workspace/db";
import type { CompetencyAnalysisResult } from "@workspace/db";
import { and, eq, isNotNull, ne, desc, sql } from "drizzle-orm";

// Token-budget constants — keep prompt injection bounded
const MAX_PAST_EXUMS = 3;
const MAX_EXUM_TEASER_CHARS = 600;   // per past Exum document
const MAX_PAST_EVIDENCE = 8;
const MAX_PAST_EVIDENCE_DESC = 200;  // per evidence item
const MAX_TOTAL_CHARS = 3200;

// Competency snapshot budget
const MAX_COMPETENCY_ANALYSES = 3;  // most recent analyses per user
const MAX_GAPS = 5;                  // cap listed gaps per analysis
const MAX_RECS = 3;                  // cap recommendations per analysis

/**
 * Builds a context block from the user's quiz attempt history.
 *
 * For learning quizzes:  shows pre-score, post-score, and delta (= PKB evidence of improvement).
 * For proficiency quizzes: shows score and pass/fail (= validated mastery of claimed experience).
 *
 * The AI uses this to reference concrete measured competency during interviews and Exum writing.
 */
export async function buildQuizContext(userId: number): Promise<string> {
  // Fetch all attempts joined to quiz metadata, ordered newest first
  const rows = await db
    .select({
      quizId: quizAttempts.quizId,
      quizTitle: quizzes.title,
      jabker: quizzes.jabker,
      skkUnitCode: quizzes.skkUnitCode,
      quizType: quizzes.quizType,
      passingScore: quizzes.passingScore,
      attemptType: quizAttempts.attemptType,
      scorePercent: quizAttempts.scorePercent,
      passed: quizAttempts.passed,
      completedAt: quizAttempts.completedAt,
    })
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
    .where(eq(quizAttempts.userId, userId))
    .orderBy(desc(quizAttempts.completedAt));

  if (!rows.length) return "";

  // Group by quizId — keep best score per attemptType per quiz
  type AttemptSummary = { score: number; passed: boolean; completedAt: Date };
  type QuizGroup = {
    title: string; jabker: string | null; skkUnitCode: string | null;
    quizType: string; passingScore: number;
    pre?: AttemptSummary; post?: AttemptSummary; proficiency?: AttemptSummary;
  };
  const byQuiz = new Map<number, QuizGroup>();

  for (const r of rows) {
    if (!byQuiz.has(r.quizId)) {
      byQuiz.set(r.quizId, {
        title: r.quizTitle, jabker: r.jabker, skkUnitCode: r.skkUnitCode,
        quizType: r.quizType, passingScore: r.passingScore,
      });
    }
    const g = byQuiz.get(r.quizId)!;
    const key = r.attemptType as "pre" | "post" | "proficiency";
    if (!g[key] || r.scorePercent > g[key]!.score) {
      g[key] = { score: r.scorePercent, passed: r.passed, completedAt: r.completedAt };
    }
  }

  if (!byQuiz.size) return "";

  const lines: string[] = [
    "\n\n=== DATA QUIZ PKB TKK ===",
    "Hasil quiz yang telah dikerjakan TKK. GUNAKAN ini untuk menyebut kompetensi terukur secara konkret:",
  ];

  for (const [, g] of byQuiz) {
    const label = g.skkUnitCode ? `[${g.skkUnitCode}] ${g.title}` : g.title;
    if (g.quizType === "learning" && (g.pre || g.post)) {
      const preStr = g.pre ? `${g.pre.score}%` : "—";
      const postStr = g.post ? `${g.post.score}%` : "—";
      const delta = (g.pre && g.post) ? g.post.score - g.pre.score : null;
      const deltaStr = delta !== null ? ` (peningkatan: ${delta > 0 ? "+" : ""}${delta}%)` : "";
      const status = g.post?.passed ? "LULUS" : g.post ? "BELUM LULUS" : g.pre?.passed ? "LULUS (pre)" : "BELUM LULUS (pre)";
      lines.push(`📘 ${label}: Pre=${preStr} → Post=${postStr}${deltaStr} | ${status}`);
    } else if (g.quizType === "proficiency" && g.proficiency) {
      const s = g.proficiency;
      lines.push(`🏆 ${label} (Proficiency): ${s.score}% — ${s.passed ? "LULUS ✓" : `Belum lulus (min. ${g.passingScore}%)`}`);
    }
  }

  lines.push(
    "\nSebut skor quiz di atas saat relevan — ini adalah bukti PKB terukur yang memperkuat narasi kompetensi TKK.",
  );

  const combined = lines.join("\n");
  return combined.length > 1500 ? combined.slice(0, 1500) + "\n…[data quiz dipotong]" : combined;
}

/**
 * Builds a context block from the user's competency analysis snapshot:
 * SKPK estimate, readiness level, covered/partial/gap unit breakdown, and
 * concrete recommendations. This gives the AI an up-to-date picture of where
 * the user stands on their target Jabker so it can give sharper, non-generic advice.
 */
export async function buildCompetencyAnalysisContext(userId: number): Promise<string> {
  const analyses = await db
    .select({
      jabkerName: competencyAnalysis.jabkerName,
      jenjang: competencyAnalysis.jenjang,
      klasifikasi: competencyAnalysis.klasifikasi,
      estimatedSkpk: competencyAnalysis.estimatedSkpk,
      readiness: competencyAnalysis.readiness,
      summary: competencyAnalysis.summary,
      result: competencyAnalysis.result,
      createdAt: competencyAnalysis.createdAt,
    })
    .from(competencyAnalysis)
    .where(eq(competencyAnalysis.userId, userId))
    .orderBy(desc(competencyAnalysis.createdAt))
    .limit(MAX_COMPETENCY_ANALYSES);

  if (!analyses.length) return "";

  const lines: string[] = [
    "\n\n=== ANALISIS KOMPETENSI TKK (STUDIO KOMPETENSI) ===",
    "Hasil penilaian kesiapan kompetensi berdasarkan Otak Proyek TKK. GUNAKAN ini agar saran bersifat spesifik — bukan generik:",
  ];

  for (const row of analyses) {
    const result = row.result as CompetencyAnalysisResult | null;
    const jabkerLine = [row.jabkerName, row.jenjang, row.klasifikasi].filter(Boolean).join(" / ");
    const readinessEmoji = row.readiness === "kuat" ? "🟢" : row.readiness === "cukup" ? "🟡" : "🔴";

    lines.push(`\n📊 Jabker: ${jabkerLine}`);
    lines.push(`   ${readinessEmoji} Kesiapan: ${row.readiness} | SKPK estimasi: ${row.estimatedSkpk}/25`);
    if (row.summary) lines.push(`   Ringkasan: ${row.summary}`);

    if (result) {
      // Unit coverage counts
      const covered = result.units?.filter((u) => u.status === "covered").length ?? 0;
      const partial = result.units?.filter((u) => u.status === "partial").length ?? 0;
      const gap = result.units?.filter((u) => u.status === "gap").length ?? 0;
      if (result.units?.length) {
        lines.push(`   Unit SKK: ✅ ${covered} covered · ⚠️ ${partial} partial · ❌ ${gap} gap`);
      }

      // Key gaps
      const gaps = result.gaps?.slice(0, MAX_GAPS) ?? [];
      if (gaps.length) {
        lines.push(`   Gap utama: ${gaps.map((g) => `"${g}"`).join("; ")}`);
      }

      // Concrete recommendations
      const recs = result.recommendations?.slice(0, MAX_RECS) ?? [];
      if (recs.length) {
        lines.push(`   Rekomendasi: ${recs.map((r, i) => `(${i + 1}) ${r}`).join(" | ")}`);
      }
    }
  }

  lines.push(
    "\nGUNAKAN data di atas: sebut unit yang sudah covered/partial saat wawancara berlangsung, " +
    "arahkan pertanyaan ke gap yang belum terisi, dan sesuaikan rekomendasi dengan status kesiapan TKK.",
  );

  const combined = lines.join("\n");
  // Hard cap so this block doesn't crowd out evidence/messages
  return combined.length > 2000 ? combined.slice(0, 2000) + "\n…[analisis dipotong]" : combined;
}

/**
 * Builds a context block from the user's full PKB history across ALL sessions
 * (excluding the current conversation to avoid duplication with the live evidence block):
 *
 *   1. Past completed Exum summaries — teaser so AI knows what's already been written
 *   2. Evidence items from prior conversations — avoids re-asking about known experiences
 *
 * The AI uses this to give sharper, non-repetitive advice grounded in the user's
 * real track record.
 */
export async function buildHistoricalPKBContext(
  userId: number,
  currentConvId: number,
): Promise<string> {
  const parts: string[] = [];

  // ── 1. Past completed Exum summaries ───────────────────────────────────────
  const pastExums = await db
    .select({
      title: conversations.title,
      jabker: conversations.jabker,
      jenjang: conversations.jenjang,
      exumContent: conversations.exumContent,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        isNotNull(conversations.exumContent),
        ne(conversations.id, currentConvId),
      ),
    )
    .orderBy(desc(conversations.id))
    .limit(MAX_PAST_EXUMS);

  if (pastExums.length) {
    const lines: string[] = [
      "\n\n=== EXUM SEBELUMNYA (SUDAH SELESAI) ===",
      "Executive Summary yang pernah dibuat pengguna ini. Gunakan sebagai referensi agar tidak mengulang hal yang sudah dicakup:",
    ];
    for (const ex of pastExums) {
      const teaser = (ex.exumContent ?? "").slice(0, MAX_EXUM_TEASER_CHARS);
      const jabkerInfo =
        ex.jabker
          ? ` [${ex.jabker}${ex.jenjang ? ` / ${ex.jenjang}` : ""}]`
          : "";
      lines.push(`\n📄 "${ex.title}"${jabkerInfo}`);
      lines.push(`   ${teaser}${teaser.length >= MAX_EXUM_TEASER_CHARS ? "…" : ""}`);
    }
    parts.push(lines.join("\n"));
  }

  // ── 2. Evidence from past conversations ────────────────────────────────────
  const pastEvidence = await db
    .select({
      type: evidenceItems.type,
      category: evidenceItems.category,
      title: evidenceItems.title,
      description: evidenceItems.description,
      skkUnitCode: evidenceItems.skkUnitCode,
      skkUnitName: evidenceItems.skkUnitName,
    })
    .from(evidenceItems)
    .innerJoin(conversations, eq(evidenceItems.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.userId, userId),
        ne(conversations.id, currentConvId),
      ),
    )
    .orderBy(desc(evidenceItems.createdAt))
    .limit(MAX_PAST_EVIDENCE);

  if (pastEvidence.length) {
    const lines: string[] = [
      "\n\n=== SERPIHAN DARI SESI SEBELUMNYA ===",
      "Bukti yang sudah dikumpulkan di wawancara terdahulu — ACU agar tidak tanya ulang hal yang sama:",
    ];
    for (const ev of pastEvidence) {
      const icon = ev.type === "learning" ? "📚" : "🏗️";
      const skk =
        ev.skkUnitCode
          ? ` → ${ev.skkUnitCode}${ev.skkUnitName ? ` — ${ev.skkUnitName}` : ""}`
          : "";
      const rawDesc = ev.description ?? "";
      const desc =
        rawDesc
          ? `\n   ${rawDesc.length > MAX_PAST_EVIDENCE_DESC ? rawDesc.slice(0, MAX_PAST_EVIDENCE_DESC) + "…" : rawDesc}`
          : "";
      lines.push(
        `\n• [${icon} ${ev.category ?? ev.type}] "${ev.title}"${skk}${desc}`,
      );
    }
    parts.push(lines.join("\n"));
  }

  if (!parts.length) return "";

  // Guard total token budget
  const combined = parts.join("");
  return combined.length > MAX_TOTAL_CHARS
    ? combined.slice(0, MAX_TOTAL_CHARS) + "\n…[riwayat terpotong]"
    : combined;
}
