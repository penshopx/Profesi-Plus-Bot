import { db, knowledgeBase, type KnowledgeBaseEntry } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { findJabkerGroup, type JabkerGroup } from "./skk-data";

const MAX_KB_ENTRIES = 5;
const MAX_KB_CHARS = 3500;
const MAX_CONTENT_CHARS = 900;
const MAX_SKK_UNITS = 30;
const MAX_UNIT_DESC_CHARS = 160;

const STOPWORDS = new Set([
  "yang", "dan", "atau", "untuk", "dari", "pada", "dengan", "dalam", "saya",
  "ini", "itu", "ada", "akan", "agar", "adalah", "saat", "kerja", "konstruksi",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

/**
 * Compact official SKK catalog for a user's jabker, pulled from the hardcoded
 * source of truth. Gives the AI the REAL unit codes so it cannot hallucinate them.
 */
export function getSkkCatalogBlock(jabker: string | null): string {
  if (!jabker) return "";
  const group: JabkerGroup | null = findJabkerGroup(jabker);
  if (!group || !group.units.length) return "";

  const lines: string[] = [
    "\n\n=== KATALOG UNIT SKK RESMI (SK Dirjen Bina Konstruksi No. 114/2024) ===",
    `Jabatan Kerja: ${group.name} | Jenjang: ${group.jenjang} | Klasifikasi: ${group.klasifikasi} — ${group.subklasifikasi}`,
    "GUNAKAN HANYA kode & nama unit di bawah ini saat mengaitkan kompetensi. JANGAN mengarang kode SKK lain:",
  ];
  const units = group.units.slice(0, MAX_SKK_UNITS);
  for (const u of units) {
    const desc = u.description.length > MAX_UNIT_DESC_CHARS
      ? `${u.description.slice(0, MAX_UNIT_DESC_CHARS)}…`
      : u.description;
    lines.push(`  • ${u.code} — ${u.name}: ${desc}`);
  }
  if (group.units.length > MAX_SKK_UNITS) {
    lines.push(`  …dan ${group.units.length - MAX_SKK_UNITS} unit lain untuk jabatan ini.`);
  }
  return lines.join("\n");
}

export type RetrievedEntry = {
  id: number;
  category: string;
  title: string;
  content: string;
  source: string | null;
};

/**
 * Keyword/structured retrieval over the managed knowledge base. Scores active
 * entries by classification/level match, category priority and query keywords.
 */
export async function retrieveKnowledgeEntries(opts: {
  klasifikasi?: string | null;
  jenjang?: string | null;
  query?: string | null;
  limit?: number;
}): Promise<RetrievedEntry[]> {
  const limit = opts.limit ?? MAX_KB_ENTRIES;
  const rows: KnowledgeBaseEntry[] = await db
    .select()
    .from(knowledgeBase)
    .where(eq(knowledgeBase.isActive, true))
    .orderBy(desc(knowledgeBase.priority))
    .limit(200);

  if (!rows.length) return [];

  const klasifikasi = (opts.klasifikasi ?? "").toLowerCase();
  const jenjang = (opts.jenjang ?? "").toLowerCase();
  const queryTokens = opts.query ? tokenize(opts.query) : [];

  const scored = rows.map((r) => {
    let score = r.priority * 2;
    // Regulasi & rubrik are foundational — always relevant.
    if (r.category === "regulasi" || r.category === "rubrik_exum") score += 6;
    if (r.category === "panduan_skk") score += 2;

    const klasMatch =
      klasifikasi && r.klasifikasi && r.klasifikasi.toLowerCase().includes(klasifikasi);
    if (klasMatch) score += 5;
    // Entries scoped to a different classification are deprioritised.
    if (r.klasifikasi && klasifikasi && !klasMatch) score -= 4;

    if (jenjang && r.jenjang && r.jenjang.toLowerCase().includes(jenjang)) score += 2;

    if (queryTokens.length) {
      const hay = `${r.title} ${r.content} ${r.tags ?? ""}`.toLowerCase();
      const hits = queryTokens.filter((t) => hay.includes(t)).length;
      score += Math.min(hits, 6);
    }
    return { r, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored
    .filter((s) => s.score > 0)
    .slice(0, limit)
    .map(({ r }) => ({
      id: r.id,
      category: r.category,
      title: r.title,
      content: r.content,
      source: r.source,
    }));
}

function renderKbEntries(entries: RetrievedEntry[]): string {
  if (!entries.length) return "";
  const lines: string[] = [
    "\n\n=== REFERENSI RESMI (KNOWLEDGE BASE GUSTAFTA) ===",
    "Gunakan referensi terverifikasi berikut sebagai dasar. JANGAN bertentangan dengannya:",
  ];
  let budget = MAX_KB_CHARS;
  for (const e of entries) {
    if (budget <= 0) break;
    const body = e.content.length > MAX_CONTENT_CHARS
      ? `${e.content.slice(0, MAX_CONTENT_CHARS)}…`
      : e.content;
    const block = `\n[${e.category.toUpperCase()}] ${e.title}${e.source ? ` (${e.source})` : ""}\n${body}`;
    lines.push(block);
    budget -= block.length;
  }
  return lines.join("\n");
}

/**
 * Full grounding context for an authenticated interview/Exum: real SKK catalog
 * for the user's jabker + the most relevant managed knowledge base entries.
 */
export async function buildKnowledgeContext(opts: {
  jabker?: string | null;
  jenjang?: string | null;
  query?: string | null;
}): Promise<string> {
  const group = opts.jabker ? findJabkerGroup(opts.jabker) : null;
  const skkBlock = getSkkCatalogBlock(opts.jabker ?? null);
  const entries = await retrieveKnowledgeEntries({
    klasifikasi: group?.klasifikasi ?? null,
    jenjang: opts.jenjang ?? group?.jenjang ?? null,
    query: opts.query ?? opts.jabker ?? null,
  });
  return `${skkBlock}${renderKbEntries(entries)}`;
}

/**
 * Lighter grounding for the anonymous landing-page Dialog Gustafta: regulasi +
 * rubrik + entries matched by the visitor's free-text input. No jabker known.
 */
export async function buildAnonymousKnowledgeContext(query: string | null): Promise<string> {
  const entries = await retrieveKnowledgeEntries({ query, limit: 3 });
  return renderKbEntries(entries);
}
