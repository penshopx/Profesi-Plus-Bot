import { db, conversations, evidenceItems } from "@workspace/db";
import { and, eq, isNotNull, ne, desc } from "drizzle-orm";

// Token-budget constants — keep prompt injection bounded
const MAX_PAST_EXUMS = 3;
const MAX_EXUM_TEASER_CHARS = 600;   // per past Exum document
const MAX_PAST_EVIDENCE = 8;
const MAX_PAST_EVIDENCE_DESC = 200;  // per evidence item
const MAX_TOTAL_CHARS = 3200;

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
