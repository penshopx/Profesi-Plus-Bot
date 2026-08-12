/**
 * /api/kegiatan — Dokumentasi Kegiatan PKB-Exum
 *
 * CRUD kegiatan beserta sub-resources: SKK mapping, dokumen (GCS), dan journey log.
 * Setiap mutasi state signifikan otomatis mencatat entry di pkb_activity_journey.
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { db } from "@workspace/db";
import {
  pkbActivities, pkbActivitySkk, pkbActivityDocs, pkbActivityJourney, marketplaceWatches,
  KEGIATAN_STATUS, type KegiatanStatus, type JourneyEvent,
} from "@workspace/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { consumeUploadToken } from "../lib/uploadTokenStore";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getUserId(clerkId: string): Promise<number | null> {
  const { users } = await import("@workspace/db/schema");
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return u?.id ?? null;
}

async function addJourney(
  activityId: number,
  event: JourneyEvent,
  label: string,
  metadata?: Record<string, unknown>,
) {
  await db.insert(pkbActivityJourney).values({ activityId, event, label, metadata: metadata ?? null });
}

async function recomputeStatus(activityId: number): Promise<KegiatanStatus> {
  const [act] = await db.select().from(pkbActivities).where(eq(pkbActivities.id, activityId)).limit(1);
  if (!act) return "draft";

  const skk  = await db.select().from(pkbActivitySkk).where(eq(pkbActivitySkk.activityId, activityId));
  const docs  = await db.select().from(pkbActivityDocs).where(eq(pkbActivityDocs.activityId, activityId));

  const hasRequired =
    act.namaKegiatan && act.tanggalMulai && act.tempatKegiatan &&
    act.namaMateri   && act.uraianSingkat && skk.length > 0;

  const status: KegiatanStatus = hasRequired ? "lengkap" : "draft";
  if (act.status !== "diajukan" && act.status !== "diverifikasi") {
    await db.update(pkbActivities)
      .set({ status, updatedAt: new Date() })
      .where(eq(pkbActivities.id, activityId));
  }
  return status;
}

// ─── GET /api/kegiatan — list all activities for current user ─────────────────

router.get("/kegiatan", requireAuth, async (req, res) => {
  const userId = await getUserId(req.auth!.userId);
  if (!userId) return res.status(401).json({ error: "user not found" });

  const activities = await db
    .select()
    .from(pkbActivities)
    .where(eq(pkbActivities.userId, userId))
    .orderBy(desc(pkbActivities.tanggalMulai));

  // Attach SKK, doc counts, and latest journey entry per activity
  const ids = activities.map((a) => a.id);
  const [skks, docs, journeys] = await Promise.all([
    ids.length ? db.select().from(pkbActivitySkk).where(inArray(pkbActivitySkk.activityId, ids)) : [],
    ids.length ? db.select().from(pkbActivityDocs).where(inArray(pkbActivityDocs.activityId, ids)) : [],
    ids.length ? db.select().from(pkbActivityJourney).where(inArray(pkbActivityJourney.activityId, ids)).orderBy(desc(pkbActivityJourney.createdAt)) : [],
  ]);

  const result = activities.map((a) => ({
    ...a,
    skk:          skks.filter((s) => s.activityId === a.id),
    docCount:     docs.filter((d) => d.activityId === a.id).length,
    latestJourney: journeys.find((j) => j.activityId === a.id) ?? null,
  }));

  res.json(result);
});

// ─── GET /api/kegiatan/:id — full detail ──────────────────────────────────────

router.get("/kegiatan/:id", requireAuth, async (req, res) => {
  const userId = await getUserId(req.auth!.userId);
  if (!userId) return res.status(401).json({ error: "user not found" });

  const id = parseInt(req.params.id, 10);
  const [act] = await db.select().from(pkbActivities)
    .where(and(eq(pkbActivities.id, id), eq(pkbActivities.userId, userId))).limit(1);
  if (!act) return res.status(404).json({ error: "not found" });

  const [skk, docs, journey] = await Promise.all([
    db.select().from(pkbActivitySkk).where(eq(pkbActivitySkk.activityId, id)),
    db.select().from(pkbActivityDocs).where(eq(pkbActivityDocs.activityId, id)),
    db.select().from(pkbActivityJourney).where(eq(pkbActivityJourney.activityId, id)).orderBy(pkbActivityJourney.createdAt),
  ]);

  res.json({ ...act, skk, docs, journey });
});

// ─── POST /api/kegiatan — create ──────────────────────────────────────────────

router.post("/kegiatan", requireAuth, async (req, res) => {
  const userId = await getUserId(req.auth!.userId);
  if (!userId) return res.status(401).json({ error: "user not found" });

  const {
    namaKegiatan, tanggalMulai, tanggalSelesai, tempatKegiatan, modePelaksanaan,
    namaMateri, penyelenggara, namaInstruktur, marketplaceId,
    courseTitle, courseProvider, courseJabkerList, courseSkkTagsList,
    uraianSingkat, linkRekaman, jenisPkb, jpPkb,
  } = req.body;

  if (!namaKegiatan || !tanggalMulai) {
    return res.status(400).json({ error: "namaKegiatan dan tanggalMulai wajib diisi" });
  }

  const [act] = await db.insert(pkbActivities).values({
    userId, namaKegiatan, tanggalMulai, tanggalSelesai: tanggalSelesai ?? null,
    tempatKegiatan: tempatKegiatan ?? null, modePelaksanaan: modePelaksanaan ?? null,
    namaMateri: namaMateri ?? null, penyelenggara: penyelenggara ?? null,
    namaInstruktur: namaInstruktur ?? null, marketplaceId: marketplaceId ?? null,
    uraianSingkat: uraianSingkat ?? null, linkRekaman: linkRekaman ?? null,
    jenisPkb: jenisPkb ?? null, jpPkb: jpPkb ?? null,
    status: "draft",
  }).returning();

  // Auto-mark the marketplace course as watched when a PKB activity is linked to it.
  // Only triggers when the client supplies both marketplaceId and courseTitle; older
  // clients that omit these fields are unaffected.
  if (marketplaceId && courseTitle) {
    await db
      .insert(marketplaceWatches)
      .values({
        userId,
        courseId:       marketplaceId,
        courseTitle:    courseTitle   ?? null,
        courseProvider: courseProvider ?? null,
        jabkerList:     Array.isArray(courseJabkerList)  ? courseJabkerList  : [],
        skkTagsList:    Array.isArray(courseSkkTagsList) ? courseSkkTagsList : [],
      })
      .onConflictDoNothing();
  }

  await addJourney(act.id, "kegiatan_dibuat", `Kegiatan "${act.namaKegiatan}" dibuat`);
  if (linkRekaman) await addJourney(act.id, "link_rekaman_ditambahkan", "Link rekaman ditambahkan");

  const status = await recomputeStatus(act.id);

  // Automatically map SKK in the background — does not block the response
  void autoMapSkk(act.id, act, req.log);

  res.status(201).json({ ...act, status, skk: [], docs: [], journey: [] });
});

// ─── PATCH /api/kegiatan/:id — update info ────────────────────────────────────

router.patch("/kegiatan/:id", requireAuth, async (req, res) => {
  const userId = await getUserId(req.auth!.userId);
  if (!userId) return res.status(401).json({ error: "user not found" });

  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(pkbActivities)
    .where(and(eq(pkbActivities.id, id), eq(pkbActivities.userId, userId))).limit(1);
  if (!existing) return res.status(404).json({ error: "not found" });
  if (existing.status === "diverifikasi") return res.status(403).json({ error: "sudah diverifikasi, tidak bisa diedit" });

  const allowed = [
    "namaKegiatan","tanggalMulai","tanggalSelesai","tempatKegiatan","modePelaksanaan",
    "namaMateri","penyelenggara","namaInstruktur","marketplaceId",
    "uraianSingkat","linkRekaman","jenisPkb","jpPkb",
  ];
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }

  await db.update(pkbActivities).set(updates).where(eq(pkbActivities.id, id));
  if ("linkRekaman" in req.body && req.body.linkRekaman && !existing.linkRekaman) {
    await addJourney(id, "link_rekaman_ditambahkan", "Link rekaman ditambahkan", { url: req.body.linkRekaman });
  } else {
    await addJourney(id, "info_diperbarui", "Informasi kegiatan diperbarui");
  }

  const status = await recomputeStatus(id);
  res.json({ success: true, status });
});

// ─── DELETE /api/kegiatan/:id ──────────────────────────────────────────────────

router.delete("/kegiatan/:id", requireAuth, async (req, res) => {
  const userId = await getUserId(req.auth!.userId);
  if (!userId) return res.status(401).json({ error: "user not found" });

  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select({ id: pkbActivities.id, userId: pkbActivities.userId })
    .from(pkbActivities).where(and(eq(pkbActivities.id, id), eq(pkbActivities.userId, userId))).limit(1);
  if (!existing) return res.status(404).json({ error: "not found" });

  await db.delete(pkbActivities).where(eq(pkbActivities.id, id));
  res.json({ success: true });
});

// ─── PUT /api/kegiatan/:id/skk — replace all SKK mappings ────────────────────

router.put("/kegiatan/:id/skk", requireAuth, async (req, res) => {
  const userId = await getUserId(req.auth!.userId);
  if (!userId) return res.status(401).json({ error: "user not found" });

  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select({ id: pkbActivities.id })
    .from(pkbActivities).where(and(eq(pkbActivities.id, id), eq(pkbActivities.userId, userId))).limit(1);
  if (!existing) return res.status(404).json({ error: "not found" });

  const items: { skkCode: string; skkName: string; jabkerId?: string; jabkerName?: string }[] = req.body.skk ?? [];
  await db.delete(pkbActivitySkk).where(eq(pkbActivitySkk.activityId, id));
  if (items.length > 0) {
    await db.insert(pkbActivitySkk).values(items.map((s) => ({ activityId: id, ...s })));
  }
  await addJourney(id, "skk_dipetakan", `${items.length} unit SKK dipetakan`, { count: items.length });
  const status = await recomputeStatus(id);
  res.json({ success: true, status, skk: items });
});

// ─── POST /api/kegiatan/:id/docs — register uploaded document ─────────────────
// Client uploads file directly to GCS via presigned URL, then calls this to register.

router.post("/kegiatan/:id/docs", requireAuth, async (req, res) => {
  const userId = await getUserId(req.auth!.userId);
  if (!userId) return res.status(401).json({ error: "user not found" });

  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select({ id: pkbActivities.id, status: pkbActivities.status })
    .from(pkbActivities).where(and(eq(pkbActivities.id, id), eq(pkbActivities.userId, userId))).limit(1);
  if (!existing) return res.status(404).json({ error: "not found" });
  if (existing.status === "diverifikasi") {
    return res.status(403).json({ error: "Kegiatan sudah diverifikasi — bukti tidak dapat diubah" });
  }

  const { docType, filename, objectPath, mimeType, sizeBytes, caption } = req.body;
  if (!docType || !filename || !objectPath) {
    return res.status(400).json({ error: "docType, filename, objectPath wajib" });
  }

  // Verify this objectPath was issued by our presign endpoint to this exact user.
  // Prevents a user from registering a path they didn't personally upload.
  if (!consumeUploadToken(objectPath, userId)) {
    return res.status(403).json({ error: "objectPath tidak valid atau sudah kadaluarsa — silakan upload ulang." });
  }

  const [doc] = await db.insert(pkbActivityDocs).values({
    activityId: id, docType, filename, objectPath, mimeType: mimeType ?? null,
    sizeBytes: sizeBytes ?? null, caption: caption ?? null,
  }).returning();

  const journeyEventMap: Record<string, JourneyEvent> = {
    surat_undangan: "surat_undangan_diunggah",
    daftar_hadir:   "daftar_hadir_diunggah",
    foto:           "foto_diunggah",
    default:        "dokumen_diunggah",
  };
  const event = (journeyEventMap[docType] ?? journeyEventMap.default) as JourneyEvent;
  const labelMap: Record<string, string> = {
    surat_undangan: "Surat undangan diunggah",
    daftar_hadir:   "Daftar hadir diunggah",
    foto:           "Foto dokumentasi diunggah",
    rekaman:        "Rekaman video diunggah",
    lainnya:        "Dokumen lainnya diunggah",
  };
  await addJourney(id, event, labelMap[docType] ?? "Dokumen diunggah", { filename, docType });

  await recomputeStatus(id);
  res.status(201).json(doc);
});

// ─── DELETE /api/kegiatan/:id/docs/:docId ─────────────────────────────────────

router.delete("/kegiatan/:id/docs/:docId", requireAuth, async (req, res) => {
  const userId = await getUserId(req.auth!.userId);
  if (!userId) return res.status(401).json({ error: "user not found" });

  const id    = parseInt(req.params.id, 10);
  const docId = parseInt(req.params.docId, 10);

  const [existing] = await db.select({ id: pkbActivities.id, status: pkbActivities.status })
    .from(pkbActivities).where(and(eq(pkbActivities.id, id), eq(pkbActivities.userId, userId))).limit(1);
  if (!existing) return res.status(404).json({ error: "not found" });
  if (existing.status === "diverifikasi") {
    return res.status(403).json({ error: "Kegiatan sudah diverifikasi — bukti tidak dapat diubah" });
  }

  // Fetch the doc row first so we can delete from object storage after DB removal.
  const [docRow] = await db
    .select({ objectPath: pkbActivityDocs.objectPath })
    .from(pkbActivityDocs)
    .where(and(eq(pkbActivityDocs.id, docId), eq(pkbActivityDocs.activityId, id)))
    .limit(1);

  await db.delete(pkbActivityDocs).where(
    and(eq(pkbActivityDocs.id, docId), eq(pkbActivityDocs.activityId, id))
  );

  // Delete the actual file from object storage so orphaned blobs don't accumulate.
  if (docRow?.objectPath) {
    const storageService = new ObjectStorageService();
    await storageService.deleteObjectEntity(docRow.objectPath);
  }

  await recomputeStatus(id);
  res.json({ success: true });
});

// ─── Automatic SKK mapping helper ────────────────────────────────────────────
// Called fire-and-forget after create/update to map SKK automatically.
// Only runs when the activity has enough content to map; skips silently otherwise.
// Does NOT overwrite SKK entries that already exist (preserves manual edits).

async function autoMapSkk(
  activityId: number,
  act: { namaKegiatan: string; namaMateri?: string | null; jenisPkb?: string | null; penyelenggara?: string | null; uraianSingkat?: string | null },
  log?: import("pino").Logger,
): Promise<void> {
  try {
    // Only map when there's enough signal
    const hasContent = act.namaMateri || act.uraianSingkat;
    if (!hasContent) return;

    // Skip if SKK already exists — respect manual edits
    const existing = await db.select({ id: pkbActivitySkk.id })
      .from(pkbActivitySkk).where(eq(pkbActivitySkk.activityId, activityId)).limit(1);
    if (existing.length > 0) return;

    const { SKK_DATA } = await import("../lib/skk-data");
    const { getClientForModel, DEFAULT_MODEL } = await import("../lib/llm");

    const skkLines = SKK_DATA.flatMap((g) =>
      g.units.map((u) => `${u.code}|${u.name}|${g.name}|${g.klasifikasi}`)
    ).join("\n");

    const activityDesc = [
      `Nama Kegiatan: ${act.namaKegiatan}`,
      act.namaMateri   && `Materi/Modul: ${act.namaMateri}`,
      act.jenisPkb     && `Jenis PKB: ${act.jenisPkb}`,
      act.penyelenggara && `Penyelenggara: ${act.penyelenggara}`,
      act.uraianSingkat && `Uraian: ${act.uraianSingkat}`,
    ].filter(Boolean).join("\n");

    const { client, model } = getClientForModel(DEFAULT_MODEL);
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `Kamu adalah sistem pemetaan SKK konstruksi Indonesia (Standar Kompetensi Kerja BNSP/LPJK).
Pilih 3-5 unit SKK yang paling relevan dengan kegiatan PKB yang diberikan.
Format baris SKK: skkCode|skkName|jabkerName|klasifikasi
Balas HANYA dengan JSON (tidak ada teks lain): {"suggestions":[{"skkCode":"...","skkName":"...","jabkerName":"..."}]}`,
        },
        {
          role: "user",
          content: `Kegiatan PKB:\n${activityDesc}\n\nDaftar seluruh unit SKK:\n${skkLines}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 512,
    });

    let suggestions: { skkCode: string; skkName: string; jabkerName?: string }[] = [];
    try {
      const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
      suggestions = parsed.suggestions ?? parsed.result ?? [];
    } catch {
      suggestions = [];
    }

    if (suggestions.length === 0) return;

    // Validate codes against the authoritative SKK dataset to prevent
    // hallucinated or malformed codes from being persisted.
    const validCodes = new Set(SKK_DATA.flatMap((g) => g.units.map((u) => u.code)));
    const validated = suggestions
      .slice(0, 5)
      .filter((s) => s.skkCode && validCodes.has(s.skkCode));

    if (validated.length === 0) return;

    const items = validated.map((s) => ({
      activityId,
      skkCode: s.skkCode,
      skkName: s.skkName,
      jabkerId: null,
      jabkerName: s.jabkerName ?? null,
    }));

    await db.insert(pkbActivitySkk).values(items);
    await db.insert(pkbActivityJourney).values({
      activityId,
      event: "skk_dipetakan",
      label: `${items.length} unit SKK dipetakan otomatis oleh platform`,
      metadata: { auto: true, count: items.length },
    });
    // Recompute status so activity transitions draft→lengkap when SKK now satisfies requirement
    await recomputeStatus(activityId);
  } catch (err) {
    // Fire-and-forget — log and swallow so the user's request is never affected
    log?.warn({ err, activityId }, "autoMapSkk failed (non-fatal)");
  }
}

// ─── POST /api/kegiatan/:id/suggest-skk — AI SKK mapping suggestion ───────────
// Platform-side on-demand SKK suggestion using LLM + SKK database.
// Returns suggestions without saving — client applies them via PUT /skk.

router.post("/kegiatan/:id/suggest-skk", requireAuth, async (req, res) => {
  const userId = await getUserId(req.auth!.userId);
  if (!userId) return res.status(401).json({ error: "user not found" });

  const id = parseInt(req.params.id, 10);
  const [act] = await db.select().from(pkbActivities)
    .where(and(eq(pkbActivities.id, id), eq(pkbActivities.userId, userId))).limit(1);
  if (!act) return res.status(404).json({ error: "not found" });

  const { SKK_DATA } = await import("../lib/skk-data");
  const { getClientForModel, DEFAULT_MODEL } = await import("../lib/llm");

  // Build condensed SKK index (code|name|jabker) — omit descriptions to save tokens.
  // ~300+ units × ~60 chars ≈ 4 500 tokens, well within context.
  const skkLines = SKK_DATA.flatMap((g) =>
    g.units.map((u) => `${u.code}|${u.name}|${g.name}|${g.klasifikasi}`)
  ).join("\n");

  const activityDesc = [
    `Nama Kegiatan: ${act.namaKegiatan}`,
    act.namaMateri   && `Materi/Modul: ${act.namaMateri}`,
    act.jenisPkb     && `Jenis PKB: ${act.jenisPkb}`,
    act.penyelenggara && `Penyelenggara: ${act.penyelenggara}`,
    act.uraianSingkat && `Uraian: ${act.uraianSingkat}`,
  ].filter(Boolean).join("\n");

  try {
    const { client, model } = getClientForModel(DEFAULT_MODEL);
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `Kamu adalah sistem pemetaan SKK konstruksi Indonesia (Standar Kompetensi Kerja BNSP/LPJK).
Pilih 3-5 unit SKK yang paling relevan dengan kegiatan PKB yang diberikan.
Format baris SKK: skkCode|skkName|jabkerName|klasifikasi
Balas HANYA dengan JSON (tidak ada teks lain): {"suggestions":[{"skkCode":"...","skkName":"...","jabkerName":"..."}]}`,
        },
        {
          role: "user",
          content: `Kegiatan PKB:\n${activityDesc}\n\nDaftar seluruh unit SKK:\n${skkLines}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 512,
    });

    let suggestions: { skkCode: string; skkName: string; jabkerName: string }[] = [];
    try {
      const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
      suggestions = parsed.suggestions ?? parsed.result ?? [];
    } catch {
      suggestions = [];
    }

    res.json({ suggestions: suggestions.slice(0, 5) });
  } catch (err) {
    req.log?.error({ err }, "suggest-skk LLM failed");
    res.status(502).json({ error: "Gagal mendapatkan saran SKK dari AI. Coba lagi." });
  }
});

// ─── POST /api/kegiatan/:id/ajukan — submit for verifier review ───────────────
// Used by the Asosiasi verification flow (Task #58).
// The "ASKOM" label has been removed from this flow; submit now goes to Asosiasi.

router.post("/kegiatan/:id/ajukan", requireAuth, async (req, res) => {
  const userId = await getUserId(req.auth!.userId);
  if (!userId) return res.status(401).json({ error: "user not found" });

  const id = parseInt(req.params.id, 10);
  const [act] = await db.select().from(pkbActivities)
    .where(and(eq(pkbActivities.id, id), eq(pkbActivities.userId, userId))).limit(1);
  if (!act) return res.status(404).json({ error: "not found" });
  if (act.status === "draft") return res.status(400).json({ error: "Lengkapi semua field wajib sebelum mengajukan" });
  if (act.status === "diajukan") return res.status(400).json({ error: "Dokumentasi sudah dalam antrian verifikasi" });
  if (act.status === "diverifikasi") return res.status(400).json({ error: "Dokumentasi sudah diverifikasi" });

  await db.update(pkbActivities).set({
    status: "diajukan",
    askomNote: null,
    askomVerifiedAt: null,
    askomVerifiedBy: null,
    updatedAt: new Date(),
  }).where(eq(pkbActivities.id, id));
  await addJourney(id, "diajukan", act.status === "ditolak"
    ? "Dokumentasi diajukan ulang setelah koreksi"
    : "Dokumentasi diajukan untuk verifikasi");
  res.json({ success: true });
});

export default router;
