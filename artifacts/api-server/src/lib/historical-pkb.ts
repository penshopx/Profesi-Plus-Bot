import { db, conversations, evidenceItems, competencyAnalysis } from "@workspace/db";
import type { CompetencyAnalysisResult } from "@workspace/db";
import { and, eq, isNotNull, ne, desc } from "drizzle-orm";

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
