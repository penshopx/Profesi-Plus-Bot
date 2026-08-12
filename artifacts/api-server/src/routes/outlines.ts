/**
 * Exum Outline (Blueprint) routes
 *
 * GET  /outlines/:conversationId   — get or AI-generate outline for a conversation
 * PATCH /outlines/:conversationId  — user edits the outline sections
 * POST /outlines/:conversationId/approve — approve outline (ready for full Exum)
 */

import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, exumOutlines, conversations, evidenceItems, messages } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getClientForModel, DEFAULT_MODEL } from "../lib/llm";

const router = Router();

interface OutlineSection {
  id: string;
  title: string;
  points: string[];
  userNotes: string;
  order: number;
}

/**
 * Generate a structured Exum outline from the conversation transcript + evidence.
 */
async function generateOutline(
  conversationId: number,
  userId: number,
): Promise<OutlineSection[]> {
  // Gather context
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
  const convMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .limit(60);
  const evidence = await db
    .select()
    .from(evidenceItems)
    .where(eq(evidenceItems.conversationId, conversationId));

  const transcript = convMessages
    .map((m) => `[${m.role.toUpperCase()}] ${m.content}`)
    .join("\n")
    .slice(0, 6000);

  const evidenceSummary = evidence
    .map((e) => `- ${e.title}: ${e.description ?? ""}`)
    .join("\n")
    .slice(0, 1500);

  const prompt = `Kamu adalah konsultan PKB senior yang membantu pemegang SKK konstruksi Indonesia menyusun kerangka Executive Summary (Exum) PKB sesuai Permen PUPR No. 12/2021.

JABATAN KERJA: ${conv?.jabker ?? "TKK"}
JENJANG SKK: ${conv?.jenjang ?? ""}

TRANSKRIP WAWANCARA:
${transcript}

BUKTI/SERPIHAN YANG DIKUMPULKAN:
${evidenceSummary || "(belum ada bukti)"}

Berdasarkan data di atas, buat KERANGKA OUTLINE Exum PKB yang:
1. Mencakup semua aspek PKB yang ditemukan dalam wawancara
2. Terstruktur sesuai standar BNSP (identitas, latar belakang, kegiatan PKB per unit, refleksi, rencana ke depan)
3. Setiap bagian berisi poin-poin spesifik yang HARUS ditulis (bukan generik)

Kembalikan HANYA JSON array (tanpa markdown):
[
  {
    "id": "section-1",
    "title": "Judul Bagian",
    "points": ["poin spesifik 1", "poin spesifik 2"],
    "userNotes": "",
    "order": 1
  }
]

Minimal 6 bagian, maksimal 10 bagian.`;

  let llm: ReturnType<typeof getClientForModel>;
  try {
    llm = getClientForModel(DEFAULT_MODEL);
  } catch {
    return defaultOutlineSections(conv?.jabker ?? "TKK");
  }

  try {
    const response = await llm.client.chat.completions.create({
      model: llm.model,
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.choices[0]?.message?.content ?? "[]";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return defaultOutlineSections(conv?.jabker ?? "TKK");

    return JSON.parse(jsonMatch[0]) as OutlineSection[];
  } catch {
    return defaultOutlineSections(conv?.jabker ?? "TKK");
  }
}

function defaultOutlineSections(jabker: string): OutlineSection[] {
  return [
    { id: "s1", title: "Identitas Pemegang SKK", points: ["Data diri lengkap", "Jabatan kerja dan jenjang SKK", "Nomor SKK dan masa berlaku"], userNotes: "", order: 1 },
    { id: "s2", title: "Latar Belakang PKB", points: ["Alasan mengikuti PKB", "Tujuan yang ingin dicapai", "Keterkaitan dengan jabatan " + jabker], userNotes: "", order: 2 },
    { id: "s3", title: "Rencana PKB Awal", points: ["Unit kompetensi yang disasar", "Jenis kegiatan PKB yang direncanakan", "Target pencapaian"], userNotes: "", order: 3 },
    { id: "s4", title: "Pelaksanaan Kegiatan PKB", points: ["Kegiatan pembelajaran yang diikuti", "Pengalaman penugasan selama periode PKB", "Tantangan dan solusi"], userNotes: "", order: 4 },
    { id: "s5", title: "Bukti Kompetensi per Unit SKK", points: ["Unit kompetensi yang dicapai", "Bukti penguasaan per unit", "Nilai proficiency test"], userNotes: "", order: 5 },
    { id: "s6", title: "Evaluasi dan Refleksi", points: ["Pencapaian vs target awal", "Pembelajaran yang didapat", "Area yang masih perlu ditingkatkan"], userNotes: "", order: 6 },
    { id: "s7", title: "Rencana PKB Berikutnya", points: ["Target kompetensi periode selanjutnya", "Rencana kegiatan spesifik", "Dukungan yang dibutuhkan"], userNotes: "", order: 7 },
  ];
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/outlines/:conversationId", requireAuth, async (req, res): Promise<void> => {
  const conversationId = Number(req.params.conversationId);
  const userId = req.dbUser!.id;

  // Verify ownership
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));
  if (!conv) { res.status(404).json({ error: "Sesi tidak ditemukan" }); return; }

  let [outline] = await db
    .select()
    .from(exumOutlines)
    .where(eq(exumOutlines.conversationId, conversationId));

  if (!outline) {
    // Generate on first access
    const sections = await generateOutline(conversationId, userId);
    [outline] = await db
      .insert(exumOutlines)
      .values({ conversationId, userId, sections })
      .returning();
  }

  res.json(outline);
});

router.patch("/outlines/:conversationId", requireAuth, async (req, res): Promise<void> => {
  const conversationId = Number(req.params.conversationId);
  const userId = req.dbUser!.id;
  const { sections } = req.body as { sections: OutlineSection[] };

  if (!Array.isArray(sections)) { res.status(400).json({ error: "sections harus array" }); return; }

  const [updated] = await db
    .insert(exumOutlines)
    .values({ conversationId, userId, sections, isApproved: false, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: exumOutlines.conversationId,
      set: { sections, isApproved: false, updatedAt: new Date() },
    })
    .returning();

  res.json(updated);
});

router.post("/outlines/:conversationId/approve", requireAuth, async (req, res): Promise<void> => {
  const conversationId = Number(req.params.conversationId);
  const userId = req.dbUser!.id;

  const [updated] = await db
    .update(exumOutlines)
    .set({ isApproved: true, approvedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(exumOutlines.conversationId, conversationId),
        eq(exumOutlines.userId, userId),
      ),
    )
    .returning();

  if (!updated) { res.status(404).json({ error: "Outline tidak ditemukan" }); return; }
  res.json(updated);
});

router.post("/outlines/:conversationId/regenerate", requireAuth, async (req, res): Promise<void> => {
  const conversationId = Number(req.params.conversationId);
  const userId = req.dbUser!.id;

  const sections = await generateOutline(conversationId, userId);
  const [updated] = await db
    .insert(exumOutlines)
    .values({ conversationId, userId, sections, isApproved: false })
    .onConflictDoUpdate({
      target: exumOutlines.conversationId,
      set: { sections, isApproved: false, updatedAt: new Date() },
    })
    .returning();

  res.json(updated);
});

export default router;
