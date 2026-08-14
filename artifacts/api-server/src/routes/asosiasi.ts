/**
 * Asosiasi verification routes
 *
 * Asosiasi memeriksa kelengkapan formal dokumen kegiatan PKB:
 *   1. Surat undangan ada dan valid
 *   2. Daftar hadir ada dan lengkap
 *   3. Foto dokumentasi ada
 *   4. Penyelenggara terdaftar (BNSP/LPJK)
 *
 * Asosiasi TIDAK menilai kualitas konten atau kesesuaian SKK — hanya kelengkapan
 * administratif dokumen dan validitas penyelenggara.
 *
 * GET  /asosiasi/submissions            — list kegiatan dengan status "diajukan"
 * GET  /asosiasi/submissions/:id        — detail lengkap + dokumen + checklist saat ini
 * POST /asosiasi/submissions/:id/checklist — simpan checklist, transisi status
 */

import { Router } from "express";
import { eq, inArray, desc } from "drizzle-orm";
import {
  db, users,
  pkbActivities, pkbActivitySkk, pkbActivityDocs, pkbActivityJourney, pkbActivityChecklist,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { sendPushNotification } from "../lib/push";

const router = Router();

/** Middleware: only users with role "asosiasi" or "admin" may call these routes. */
async function requireAsosiasi(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
): Promise<void> {
  const role = req.dbUser?.role;
  if (role !== "asosiasi" && role !== "admin") {
    res.status(403).json({ error: "Akses ditolak — hanya Asosiasi atau admin." });
    return;
  }
  next();
}

// ─── GET /asosiasi/submissions ────────────────────────────────────────────────

router.get("/asosiasi/submissions", requireAuth, requireAsosiasi, async (req, res) => {
  const activities = await db
    .select({
      id:           pkbActivities.id,
      namaKegiatan: pkbActivities.namaKegiatan,
      tanggalMulai: pkbActivities.tanggalMulai,
      jenisPkb:     pkbActivities.jenisPkb,
      penyelenggara: pkbActivities.penyelenggara,
      status:       pkbActivities.status,
      askomNote:    pkbActivities.askomNote,
      askomVerifiedAt: pkbActivities.askomVerifiedAt,
      updatedAt:    pkbActivities.updatedAt,
      ownerName:    users.name,
      ownerEmail:   users.email,
    })
    .from(pkbActivities)
    .innerJoin(users, eq(pkbActivities.userId, users.id))
    .where(inArray(pkbActivities.status, ["diajukan", "diverifikasi", "ditolak"]))
    .orderBy(desc(pkbActivities.updatedAt));

  res.json(activities);
});

// ─── GET /asosiasi/submissions/:id ───────────────────────────────────────────

router.get("/asosiasi/submissions/:id", requireAuth, requireAsosiasi, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  const [act] = await db
    .select({
      id:           pkbActivities.id,
      namaKegiatan: pkbActivities.namaKegiatan,
      tanggalMulai: pkbActivities.tanggalMulai,
      tanggalSelesai: pkbActivities.tanggalSelesai,
      tempatKegiatan: pkbActivities.tempatKegiatan,
      modePelaksanaan: pkbActivities.modePelaksanaan,
      namaMateri:   pkbActivities.namaMateri,
      penyelenggara: pkbActivities.penyelenggara,
      namaInstruktur: pkbActivities.namaInstruktur,
      uraianSingkat: pkbActivities.uraianSingkat,
      linkRekaman:  pkbActivities.linkRekaman,
      jenisPkb:     pkbActivities.jenisPkb,
      jpPkb:        pkbActivities.jpPkb,
      status:       pkbActivities.status,
      askomNote:    pkbActivities.askomNote,
      askomVerifiedAt: pkbActivities.askomVerifiedAt,
      updatedAt:    pkbActivities.updatedAt,
      ownerName:    users.name,
      ownerEmail:   users.email,
    })
    .from(pkbActivities)
    .innerJoin(users, eq(pkbActivities.userId, users.id))
    .where(eq(pkbActivities.id, id))
    .limit(1);

  if (!act) return res.status(404).json({ error: "not found" });

  const [skk, docs, journey, checklist] = await Promise.all([
    db.select().from(pkbActivitySkk).where(eq(pkbActivitySkk.activityId, id)),
    db.select().from(pkbActivityDocs).where(eq(pkbActivityDocs.activityId, id)),
    db.select().from(pkbActivityJourney).where(eq(pkbActivityJourney.activityId, id)).orderBy(desc(pkbActivityJourney.createdAt)),
    db.select().from(pkbActivityChecklist).where(eq(pkbActivityChecklist.activityId, id)).limit(1),
  ]);

  res.json({ ...act, skk, docs, journey, checklist: checklist[0] ?? null });
});

// ─── POST /asosiasi/submissions/:id/checklist ─────────────────────────────────

router.post("/asosiasi/submissions/:id/checklist", requireAuth, requireAsosiasi, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  const [act] = await db.select({ id: pkbActivities.id, status: pkbActivities.status, userId: pkbActivities.userId })
    .from(pkbActivities).where(eq(pkbActivities.id, id)).limit(1);
  if (!act) return res.status(404).json({ error: "not found" });
  if (!["diajukan", "diverifikasi", "ditolak"].includes(act.status)) {
    return res.status(400).json({ error: "Kegiatan belum diajukan ke Asosiasi." });
  }

  const { suratUndangan, daftarHadir, foto, penyelenggaraValid, catatan } = req.body;
  const verifierId = req.dbUser!.id;
  const allClear = suratUndangan && daftarHadir && foto && penyelenggaraValid;
  const newStatus = allClear ? "diverifikasi" : "ditolak";
  const now = new Date();

  // Upsert checklist (one record per activity)
  const existing = await db.select({ id: pkbActivityChecklist.id })
    .from(pkbActivityChecklist).where(eq(pkbActivityChecklist.activityId, id)).limit(1);

  if (existing.length > 0) {
    await db.update(pkbActivityChecklist).set({
      checkedBy: verifierId,
      suratUndangan: !!suratUndangan,
      daftarHadir: !!daftarHadir,
      foto: !!foto,
      penyelenggaraValid: !!penyelenggaraValid,
      catatan: catatan ?? null,
      checkedAt: now,
      updatedAt: now,
    }).where(eq(pkbActivityChecklist.activityId, id));
  } else {
    await db.insert(pkbActivityChecklist).values({
      activityId: id,
      checkedBy: verifierId,
      suratUndangan: !!suratUndangan,
      daftarHadir: !!daftarHadir,
      foto: !!foto,
      penyelenggaraValid: !!penyelenggaraValid,
      catatan: catatan ?? null,
      checkedAt: now,
    });
  }

  // Transition status + journey
  await db.update(pkbActivities).set({
    status: newStatus,
    askomNote: catatan ?? null,
    askomVerifiedAt: allClear ? now : null,
    askomVerifiedBy: allClear ? verifierId : null,
    updatedAt: now,
  }).where(eq(pkbActivities.id, id));

  await db.insert(pkbActivityJourney).values({
    activityId: id,
    event: newStatus,
    label: allClear
      ? "Dokumen diverifikasi lengkap oleh Asosiasi"
      : "Dokumen perlu perbaikan — catatan dari Asosiasi",
    metadata: { suratUndangan, daftarHadir, foto, penyelenggaraValid, catatan, verifierId },
  });

  // Non-blocking push notification to activity owner
  const [owner] = await db
    .select({ id: users.id, expoPushToken: users.expoPushToken })
    .from(users)
    .where(eq(users.id, act.userId))
    .limit(1);
  if (owner?.expoPushToken) {
    sendPushNotification(owner.id, owner.expoPushToken!, {
      title: allClear ? "Dokumen Lengkap ✅" : "Dokumen Perlu Perbaikan ⚠️",
      body: allClear
        ? "✅ Dokumen kegiatan Anda dinyatakan lengkap"
        : "⚠️ Asosiasi menemukan kekurangan dokumen — tap untuk lihat catatan",
      data: { activityId: String(id) },
      channelId: "kegiatan",
    }, req.log).catch(() => {/* already logged inside helper */});
  }

  res.json({ success: true, status: newStatus });
});

export default router;
