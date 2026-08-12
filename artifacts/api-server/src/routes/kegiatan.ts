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
  pkbActivities, pkbActivitySkk, pkbActivityDocs, pkbActivityJourney,
  KEGIATAN_STATUS, type KegiatanStatus, type JourneyEvent,
} from "@workspace/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

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

  await addJourney(act.id, "kegiatan_dibuat", `Kegiatan "${act.namaKegiatan}" dibuat`);
  if (linkRekaman) await addJourney(act.id, "link_rekaman_ditambahkan", "Link rekaman ditambahkan");

  const status = await recomputeStatus(act.id);
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
  const [existing] = await db.select({ id: pkbActivities.id })
    .from(pkbActivities).where(and(eq(pkbActivities.id, id), eq(pkbActivities.userId, userId))).limit(1);
  if (!existing) return res.status(404).json({ error: "not found" });

  const { docType, filename, objectPath, mimeType, sizeBytes, caption } = req.body;
  if (!docType || !filename || !objectPath) {
    return res.status(400).json({ error: "docType, filename, objectPath wajib" });
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

  const [existing] = await db.select({ id: pkbActivities.id })
    .from(pkbActivities).where(and(eq(pkbActivities.id, id), eq(pkbActivities.userId, userId))).limit(1);
  if (!existing) return res.status(404).json({ error: "not found" });

  await db.delete(pkbActivityDocs).where(
    and(eq(pkbActivityDocs.id, docId), eq(pkbActivityDocs.activityId, id))
  );
  await recomputeStatus(id);
  res.json({ success: true });
});

// ─── POST /api/kegiatan/:id/ajukan — submit for ASKOM review ──────────────────

router.post("/kegiatan/:id/ajukan", requireAuth, async (req, res) => {
  const userId = await getUserId(req.auth!.userId);
  if (!userId) return res.status(401).json({ error: "user not found" });

  const id = parseInt(req.params.id, 10);
  const [act] = await db.select().from(pkbActivities)
    .where(and(eq(pkbActivities.id, id), eq(pkbActivities.userId, userId))).limit(1);
  if (!act) return res.status(404).json({ error: "not found" });
  if (act.status === "draft") return res.status(400).json({ error: "Lengkapi semua field wajib sebelum mengajukan" });
  if (act.status === "diajukan") return res.status(400).json({ error: "Dokumentasi sudah dalam antrian verifikasi ASKOM" });
  if (act.status === "diverifikasi") return res.status(400).json({ error: "Dokumentasi sudah diverifikasi oleh ASKOM" });

  // Allow re-submission after ASKOM rejection ("ditolak") by resetting the note
  await db.update(pkbActivities).set({
    status: "diajukan",
    askomNote: null,
    askomVerifiedAt: null,
    askomVerifiedBy: null,
    updatedAt: new Date(),
  }).where(eq(pkbActivities.id, id));
  await addJourney(id, "diajukan", act.status === "ditolak"
    ? "Dokumentasi diajukan ulang setelah koreksi"
    : "Dokumentasi diajukan ke asesor / ASKOM");
  res.json({ success: true });
});

export default router;
