import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, conversations, messages, evidenceItems } from "@workspace/db";
import { logger } from "../../lib/logger";
import { openai } from "../../lib/openai";
import { buildSystemPrompt, getPhaseInstruction } from "../../lib/pkb-system-prompt";

const router: IRouter = Router();

// ─── Conversations ────────────────────────────────────────────────────────────

router.get("/chat/conversations", async (req, res): Promise<void> => {
  const rows = await db.select().from(conversations).orderBy(asc(conversations.createdAt));
  res.json(rows);
});

router.post("/chat/conversations", async (req, res): Promise<void> => {
  const { title, mode, jabker, jenjang } = req.body;
  if (!title || !mode) {
    res.status(400).json({ error: "title and mode are required" });
    return;
  }
  const [conv] = await db
    .insert(conversations)
    .values({ title, mode, jabker, jenjang, phase: "profiling" })
    .returning();
  res.status(201).json(conv);
});

router.get("/chat/conversations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
  const evidence = await db.select().from(evidenceItems).where(eq(evidenceItems.conversationId, id)).orderBy(asc(evidenceItems.createdAt));
  res.json({ ...conv, messages: msgs, evidence });
});

router.delete("/chat/conversations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [conv] = await db.delete(conversations).where(eq(conversations.id, id)).returning();
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
  res.sendStatus(204);
});

// ─── Evidence Items ───────────────────────────────────────────────────────────

router.get("/chat/conversations/:id/evidence", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const items = await db
    .select()
    .from(evidenceItems)
    .where(eq(evidenceItems.conversationId, id))
    .orderBy(asc(evidenceItems.createdAt));
  res.json(items);
});

router.post("/chat/conversations/:id/evidence", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { type, category, title, url, description, skkNotes } = req.body;
  if (!type || !title) {
    res.status(400).json({ error: "type and title are required" });
    return;
  }
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const [item] = await db
    .insert(evidenceItems)
    .values({ conversationId: id, type, category: category ?? "", title, url, description, skkNotes })
    .returning();
  res.status(201).json(item);
});

router.delete("/chat/conversations/:id/evidence/:evidenceId", async (req, res): Promise<void> => {
  const evidenceId = parseInt(req.params.evidenceId, 10);
  const [item] = await db.delete(evidenceItems).where(eq(evidenceItems.id, evidenceId)).returning();
  if (!item) { res.status(404).json({ error: "Evidence not found" }); return; }
  res.sendStatus(204);
});

// ─── Messages / Chat ──────────────────────────────────────────────────────────

router.get("/chat/conversations/:id/messages", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
  res.json(msgs);
});

router.post("/chat/conversations/:id/messages", async (req, res): Promise<void> => {
  const convId = parseInt(req.params.id, 10);
  const { content } = req.body;

  if (!content || typeof content !== "string") {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const [conv] = await db.select().from(conversations).where(eq(conversations.id, convId));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  await db.insert(messages).values({ conversationId: convId, role: "user", content });

  const existingMsgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, convId))
    .orderBy(asc(messages.createdAt));

  const evidence = await db
    .select()
    .from(evidenceItems)
    .where(eq(evidenceItems.conversationId, convId))
    .orderBy(asc(evidenceItems.createdAt));

  const systemPrompt = buildSystemPrompt(conv.mode, conv.jabker, conv.jenjang, conv.phase, evidence);
  const phaseInstruction = getPhaseInstruction(conv.phase, conv.mode);

  const chatMessages = existingMsgs.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 8192,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt + "\n\n" + phaseInstruction },
        ...chatMessages,
      ],
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullResponse += delta;
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
    }

    await db.insert(messages).values({ conversationId: convId, role: "assistant", content: fullResponse });

    const nextPhase = detectNextPhase(conv.phase, conv.mode, existingMsgs.length, fullResponse);
    if (nextPhase !== conv.phase) {
      await db.update(conversations).set({ phase: nextPhase }).where(eq(conversations.id, convId));
    }

    res.write(`data: ${JSON.stringify({ done: true, phase: nextPhase })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "OpenAI stream error");
    res.write(`data: ${JSON.stringify({ error: "AI error occurred" })}\n\n`);
    res.end();
  }
});

// ─── Generate Exum ────────────────────────────────────────────────────────────

router.post("/chat/generate-exum", async (req, res): Promise<void> => {
  const { conversationId } = req.body;
  if (!conversationId) {
    res.status(400).json({ error: "conversationId is required" });
    return;
  }

  const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  const evidence = await db
    .select()
    .from(evidenceItems)
    .where(eq(evidenceItems.conversationId, conversationId))
    .orderBy(asc(evidenceItems.createdAt));

  const transcript = msgs
    .map((m) => `${m.role === "user" ? "TKK" : "Pak Budi"}: ${m.content}`)
    .join("\n\n");

  const exumPrompt = buildExumPrompt(conv.mode, conv.jabker, conv.jenjang, transcript, evidence);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 8192,
      messages: [{ role: "user", content: exumPrompt }],
    });

    const content = response.choices[0]?.message?.content ?? "";
    await db.update(conversations).set({ phase: "done" }).where(eq(conversations.id, conversationId));

    res.json({ content, conversationId });
  } catch (err) {
    req.log.error({ err }, "Generate Exum error");
    res.status(500).json({ error: "Failed to generate Executive Summary" });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectNextPhase(currentPhase: string, mode: string, msgCount: number, lastResponse: string): string {
  const phases = ["profiling", "context", "core_interview", "evidence", "synthesis", "done"];
  const currentIdx = phases.indexOf(currentPhase);
  if (currentIdx === -1) return currentPhase;

  const lower = lastResponse.toLowerCase();
  const progressKeywords = [
    "baik, sekarang", "selanjutnya", "mari kita lanjut", "fase berikutnya",
    "terima kasih", "sudah cukup", "siap untuk", "kita sudah", "lanjut ke",
  ];
  const shouldAdvance = progressKeywords.some((kw) => lower.includes(kw));

  const minMsgsPerPhase: Record<string, number> = {
    profiling: 2, context: 4, core_interview: 8, evidence: 10, synthesis: 12,
  };

  const minMsgs = minMsgsPerPhase[currentPhase] ?? 2;
  if (shouldAdvance && msgCount >= minMsgs && currentIdx < phases.length - 1) {
    return phases[currentIdx + 1];
  }
  return currentPhase;
}

type EvidenceRow = { type: string; category: string; title: string; url: string | null; description: string | null; skkNotes: string | null };

function buildEvidenceContext(evidence: EvidenceRow[]): string {
  if (!evidence.length) return "";

  const learning = evidence.filter((e) => e.type === "learning");
  const workExp = evidence.filter((e) => e.type === "work_experience");

  const lines: string[] = ["\n\n=== BUKTI & SUMBER PENGETAHUAN PKB ==="];

  if (learning.length) {
    lines.push("\n📚 PEMBELAJARAN PKB (Video/Webinar/Diklatkerja):");
    learning.forEach((e, i) => {
      lines.push(`  ${i + 1}. [${e.category || "Video"}] ${e.title}`);
      if (e.url) lines.push(`     Link: ${e.url}`);
      if (e.description) lines.push(`     Deskripsi: ${e.description}`);
      if (e.skkNotes) lines.push(`     ✅ Kesesuaian SKK: ${e.skkNotes}`);
    });
  }

  if (workExp.length) {
    lines.push("\n🏗️ PENGALAMAN PEKERJAAN (Bukti Lapangan):");
    workExp.forEach((e, i) => {
      lines.push(`  ${i + 1}. [${e.category || "Dokumen"}] ${e.title}`);
      if (e.url) lines.push(`     Referensi: ${e.url}`);
      if (e.description) lines.push(`     Keterangan: ${e.description}`);
      if (e.skkNotes) lines.push(`     ✅ Kesesuaian SKK: ${e.skkNotes}`);
    });
  }

  lines.push("\nGUNAKAN semua bukti di atas sebagai referensi konkret dalam wawancara dan penulisan Exum.");
  return lines.join("\n");
}

function buildExumPrompt(
  mode: string,
  jabker: string | null,
  jenjang: string | null,
  transcript: string,
  evidence: EvidenceRow[]
): string {
  const modeLabel =
    mode === "A" ? "Pengalaman Kerja" : mode === "B" ? "Hasil Belajar" : "Hybrid (Pengalaman + Hasil Belajar)";

  const evidenceContext = buildEvidenceContext(evidence);

  return `Kamu adalah penulis profesional yang ahli dalam membuat Executive Summary (Exum) PKB (Pengembangan Keprofesian Berkelanjutan) sesuai Permen PUPR No. 12 Tahun 2021 dan SK Dirjen Bina Konstruksi No. 114 Tahun 2024.

Berdasarkan transkrip wawancara dan bukti-bukti di bawah ini, buatlah Executive Summary yang lengkap, profesional, dan berkualitas tinggi (setara 10-15 halaman A4).

INFORMASI PENULIS:
- Jabatan Kerja: ${jabker ?? "Tenaga Ahli Konstruksi"}
- Jenjang SKK: ${jenjang ?? "Ahli"}
- Mode Exum: ${modeLabel}
${evidenceContext}

TRANSKRIP WAWANCARA:
${transcript}

INSTRUKSI PENULISAN:
1. Tulis dalam bahasa Indonesia yang profesional, akademis, dan mudah dipahami
2. Gunakan struktur yang rapi dengan heading dan sub-heading yang jelas
3. Sebutkan secara eksplisit sumber-sumber pembelajaran / bukti lapangan yang ada dalam Bukti & Sumber Pengetahuan PKB
4. Kaitkan setiap bagian dengan unit SKK yang disebutkan dalam catatan kesesuaian
5. Perkuat dengan data kuantitatif dari wawancara
6. Panjang total setara 10-15 halaman A4 (2500-4000 kata)

${
  mode === "B"
    ? `STRUKTUR EXUM (Mode Hasil Belajar):
# EXECUTIVE SUMMARY
## Pengembangan Keprofesian Berkelanjutan — Hasil Belajar Mandiri

**1. PENDAHULUAN DAN IDENTITAS JABATAN KERJA** (1 halaman)
**2. RINGKASAN MATERI YANG DIPELAJARI** (1,5-2 halaman)
**3. ANALISIS DAN REFLEKSI PEMBELAJARAN** (2 halaman)
**4. RELEVANSI DENGAN KOMPETENSI JABATAN KERJA (SK DJBK 114/2024)** (2 halaman)
**5. PENERAPAN DALAM KONTEKS PEKERJAAN** (2-3 halaman)
**6. DAMPAK DAN MANFAAT YANG DIPEROLEH** (1,5 halaman)
**7. REKOMENDASI DAN RENCANA TINDAK LANJUT** (1,5 halaman)
**8. KESIMPULAN** (0,5 halaman)`
    : `STRUKTUR EXUM (Mode Pengalaman Kerja):
# EXECUTIVE SUMMARY
## Pengembangan Keprofesian Berkelanjutan — Pengalaman Kerja

**1. HALAMAN JUDUL DAN IDENTITAS** (1 halaman)
**2. RINGKASAN EKSEKUTIF** (1-1,5 halaman)
**3. LATAR BELAKANG DAN KONTEKS PROYEK** (1,5-2 halaman)
**4. RUANG LINGKUP DAN PERAN TENAGA KERJA KONSTRUKSI** (1,5-2 halaman)
**5. TANTANGAN UTAMA** (1,5-2 halaman)
**6. PENDEKATAN DAN METODOLOGI YANG DITERAPKAN** (2-3 halaman)
**7. CAPAIAN DAN HASIL** (2-3 halaman — sertakan data kuantitatif)
**8. PEMBELAJARAN DAN REKOMENDASI** (1-1,5 halaman)
**9. PENUTUP** (0,5 halaman)`
}

Mulai langsung dengan konten, tanpa pengantar atau catatan tambahan.`;
}

export default router;
