import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { getClientForModel, isKnownModel, listModels } from "../lib/llm";

const router: IRouter = Router();

// Lightweight, anonymous "Dialog Gustafta — Teman Berpikir" used by the public
// landing page. It runs a short 2-gate Socratic dialog and returns a structured
// Profil Awal (G1) and a teaser Blueprint (G2) which the frontend gates behind
// registration.

type ChatMsg = { role: "user" | "assistant"; content: string };

const PERSONA_BASE = [
  "Kamu adalah Dialog Gustafta — teman berpikir AI untuk Tenaga Kerja Konstruksi (TKK) Indonesia",
  "yang sedang menyiapkan Executive Summary PKB sesuai Permen PUPR No. 12 Tahun 2021.",
  "Gaya bicara: hangat, reflektif, dan Socratik. Bahasa Indonesia yang santai namun profesional.",
].join(" ");

const PERSONA_PROBE = [
  PERSONA_BASE,
  "Tujuanmu menggali profesi, keahlian, pengalaman nyata, dan potensi tersembunyi pengguna.",
  "Pertanyaanmu singkat (maksimal 2 kalimat) dan selalu menggali lebih dalam — 'mengapa', 'bagaimana', 'seberapa besar'.",
].join(" ");

const PERSONA_BLUEPRINT = [
  PERSONA_BASE,
  "Tahap menggali sudah selesai. Sekarang kamu beralih peran menjadi penyusun Blueprint:",
  "kamu MERANGKUM dan MENYINTESIS percakapan menjadi profil & potensi diri. Kamu TIDAK lagi bertanya.",
].join(" ");

const MAX_MESSAGES = 8;
const PREFERRED_MODELS = ["gpt-4o-mini", "gemini-2.5-flash", "qwen-turbo", "deepseek-chat"];

// ── Lightweight in-memory rate limiter (per IP) to protect the user's own LLM
// API keys from abuse on this anonymous endpoint (denial-of-wallet). ──────────
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 12;
const rateBuckets = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (rateBuckets.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  rateBuckets.set(ip, hits);
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) {
      if (v.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) rateBuckets.delete(k);
    }
  }
  return hits.length > RATE_LIMIT_MAX;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : fallback;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x.trim() : "")).filter((x) => x.length > 0);
}

function pickModel(requested?: string): string | null {
  if (requested && isKnownModel(requested)) {
    const avail = listModels().find((m) => m.id === requested && m.available);
    if (avail) return requested;
  }
  const available = listModels().filter((m) => m.available);
  for (const id of PREFERRED_MODELS) {
    if (available.some((m) => m.id === id)) return id;
  }
  return available[0]?.id ?? null;
}

function stripToJson(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) s = s.slice(first, last + 1);
  return s;
}

function gateInstruction(stage: 1 | 2): string {
  if (stage === 1) {
    return [
      "TAHAP 1 (Checkpoint G1 — Profil Awal).",
      "Balas HANYA dengan JSON valid, tanpa teks lain, dengan bentuk persis:",
      '{"reply": string, "profile": {"bidang": string, "keahlian": string[], "tantangan": string, "potensiAwal": string}}',
      "- reply: satu pertanyaan lanjutan yang menggali lebih dalam (maks 2 kalimat).",
      "- profile.bidang: bidang/profesi pengguna dalam 2-5 kata.",
      "- profile.keahlian: 2-4 keahlian inti yang tersirat dari cerita pengguna.",
      "- profile.tantangan: satu kalimat ringkas tantangan utama pengguna.",
      "- profile.potensiAwal: satu kalimat potensi tersembunyi yang kamu lihat.",
      "Isi semua field berdasarkan cerita pengguna sejauh ini; jangan mengarang fakta yang bertentangan.",
    ].join("\n");
  }
  return [
    "TAHAP 2 (Checkpoint G2 — Blueprint Profil & Potensi Diri). PENTING: pada tahap ini JANGAN bertanya lagi.",
    "Cukup data sudah terkumpul. Tugasmu sekarang HANYA menyusun Blueprint berdasarkan seluruh percakapan.",
    "WAJIB balas HANYA dengan JSON valid, tanpa teks lain, dan field 'blueprint' WAJIB ada dengan bentuk persis:",
    '{"reply": string, "blueprint": {"ringkasan": string, "potensi": string[], "unitSkkRelevan": string[], "materiExum": string[]}}',
    "- reply: satu kalimat apresiasi + transisi menuju blueprint (maks 2 kalimat, BUKAN pertanyaan).",
    "- blueprint.ringkasan: 1-2 kalimat ringkasan profil & potensi diri pengguna.",
    "- blueprint.potensi: 3-4 potensi/kekuatan konkret pengguna.",
    "- blueprint.unitSkkRelevan: 2-3 contoh area unit kompetensi SKK yang relevan (boleh deskriptif).",
    "- blueprint.materiExum: 3-4 poin materi yang bisa dipakai menulis Executive Summary PKB.",
  ].join("\n");
}

router.post("/dialog-gustafta", async (req, res): Promise<void> => {
  try {
    const ip = (req.ip ?? req.socket?.remoteAddress ?? "unknown").toString();
    if (isRateLimited(ip)) {
      res.status(429).json({ error: "Terlalu banyak permintaan. Coba lagi sebentar lagi." });
      return;
    }

    const body = req.body as { messages?: ChatMsg[]; model?: string };
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const messages: ChatMsg[] = rawMessages
      .filter(
        (m): m is ChatMsg =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim().length > 0,
      )
      .slice(-MAX_MESSAGES)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));

    const userTurns = messages.filter((m) => m.role === "user").length;
    if (userTurns < 1) {
      res.status(400).json({ error: "messages must contain at least one user turn" });
      return;
    }
    const stage: 1 | 2 = userTurns >= 2 ? 2 : 1;

    const model = pickModel(body?.model);
    if (!model) {
      res
        .status(503)
        .json({ error: "Belum ada model AI yang dikonfigurasi. Tambahkan API key di Secrets." });
      return;
    }

    const persona = stage === 2 ? PERSONA_BLUEPRINT : PERSONA_PROBE;
    const convo: ChatMsg[] = [...messages];
    if (stage === 2) {
      convo.push({
        role: "user",
        content:
          "Cukup. Jangan bertanya lagi. Sekarang keluarkan Blueprint Profil & Potensi Diri saya dalam format JSON yang diminta (wajib ada field 'blueprint').",
      });
    }

    const { client, model: resolvedModel } = getClientForModel(model);
    const completion = await client.chat.completions.create({
      model: resolvedModel,
      temperature: 0.6,
      messages: [
        { role: "system", content: `${persona}\n\n${gateInstruction(stage)}` },
        ...convo,
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(stripToJson(raw));
    } catch {
      parsed = { reply: raw.trim() || "Bisa ceritakan sedikit lebih detail?" };
    }

    if (stage === 1) {
      const p = (parsed.profile ?? {}) as Record<string, unknown>;
      res.json({
        stage,
        reply: asString(parsed.reply, "Boleh ceritakan sedikit lebih detail?"),
        profile: {
          bidang: asString(p.bidang),
          keahlian: asStringArray(p.keahlian),
          tantangan: asString(p.tantangan),
          potensiAwal: asString(p.potensiAwal),
        },
      });
      return;
    }

    // Stage 2 (G2): the full Blueprint is the gated asset. Anonymous callers only
    // ever receive a teaser (ringkasan + counts) so the gate is enforced
    // server-side, not just visually. Full content is unlocked after registration.
    const b = (parsed.blueprint ?? {}) as Record<string, unknown>;
    const potensi = asStringArray(b.potensi);
    const unitSkkRelevan = asStringArray(b.unitSkkRelevan);
    const materiExum = asStringArray(b.materiExum);
    res.json({
      stage,
      reply: asString(parsed.reply, "Blueprint Profil & Potensi Diri Anda sudah siap."),
      blueprintTeaser: {
        ringkasan: asString(b.ringkasan),
        potensiCount: potensi.length,
        unitSkkCount: unitSkkRelevan.length,
        materiExumCount: materiExum.length,
        potensiPreview: potensi.slice(0, 1),
      },
      locked: true,
    });
  } catch (err) {
    logger.error({ err }, "dialog-gustafta failed");
    res.status(500).json({ error: "Dialog Gustafta sedang sibuk. Coba lagi sebentar." });
  }
});

export default router;
