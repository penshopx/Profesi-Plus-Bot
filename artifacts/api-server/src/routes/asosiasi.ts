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
import { eq, and, inArray, desc } from "drizzle-orm";
import {
  db, users,
  pkbActivities, pkbActivitySkk, pkbActivityDocs, pkbActivityJourney, pkbActivityChecklist,
  pkbActivityChecklistHistory,
} from "@workspace/db";
import { asc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { sendPushNotification } from "../lib/push";

const router = Router();

/** Activity IDs are single, positive integer route parameters. */
function parseActivityId(value: string | string[] | undefined): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

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
  const id = parseActivityId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "id kegiatan tidak valid." });
    return;
  }

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

  if (!act) {
    res.status(404).json({ error: "not found" });
    return;
  }

  const [skk, docs, journey, checklist, checklistHistory] = await Promise.all([
    db.select().from(pkbActivitySkk).where(eq(pkbActivitySkk.activityId, id)),
    db.select().from(pkbActivityDocs).where(eq(pkbActivityDocs.activityId, id)),
    db.select().from(pkbActivityJourney).where(eq(pkbActivityJourney.activityId, id)).orderBy(desc(pkbActivityJourney.createdAt)),
    db.select().from(pkbActivityChecklist).where(eq(pkbActivityChecklist.activityId, id)).limit(1),
    // Riwayat checklist yang sudah difinalisasi, urut kronologis (tertua dulu)
    db
      .select({
        id:                 pkbActivityChecklistHistory.id,
        suratUndangan:      pkbActivityChecklistHistory.suratUndangan,
        daftarHadir:        pkbActivityChecklistHistory.daftarHadir,
        foto:               pkbActivityChecklistHistory.foto,
        penyelenggaraValid: pkbActivityChecklistHistory.penyelenggaraValid,
        catatan:            pkbActivityChecklistHistory.catatan,
        outcome:            pkbActivityChecklistHistory.outcome,
        checkedAt:          pkbActivityChecklistHistory.checkedAt,
        checkedByName:      users.name,
      })
      .from(pkbActivityChecklistHistory)
      .leftJoin(users, eq(pkbActivityChecklistHistory.checkedBy, users.id))
      .where(eq(pkbActivityChecklistHistory.activityId, id))
      .orderBy(asc(pkbActivityChecklistHistory.checkedAt)),
  ]);

  res.json({ ...act, skk, docs, journey, checklist: checklist[0] ?? null, checklistHistory });
});

// ─── POST /asosiasi/submissions/:id/checklist ─────────────────────────────────

router.post("/asosiasi/submissions/:id/checklist", requireAuth, requireAsosiasi, async (req, res) => {
  const id = parseActivityId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "id kegiatan tidak valid." });
    return;
  }

  const [act] = await db.select({ id: pkbActivities.id, status: pkbActivities.status, userId: pkbActivities.userId, updatedAt: pkbActivities.updatedAt })
    .from(pkbActivities).where(eq(pkbActivities.id, id)).limit(1);
  if (!act) {
    res.status(404).json({ error: "not found" });
    return;
  }
  if (!["diajukan", "diverifikasi", "ditolak"].includes(act.status)) {
    res.status(400).json({ error: "Kegiatan belum diajukan ke Asosiasi." });
    return;
  }

  const { suratUndangan, daftarHadir, foto, penyelenggaraValid, catatan, expectedUpdatedAt } = req.body;
  const verifierId = req.dbUser!.id;

  const CONFLICT_MESSAGE =
    "Kegiatan ini baru saja diperiksa oleh verifikator lain. Muat ulang halaman untuk melihat hasil terbaru sebelum menyimpan.";

  // Optimistic concurrency, phase 1 (stale page): the client sends the
  // updatedAt it displayed to the officer. A status-only check would miss
  // same-outcome races (e.g. two officers both re-verifying an activity that
  // is already "diverifikasi" — the status never changes), so we compare the
  // revision timestamp instead. If another officer's decision already landed
  // since the page was loaded, surface a 409 instead of silently overwriting.
  if (expectedUpdatedAt !== undefined && expectedUpdatedAt !== null) {
    const expected = new Date(expectedUpdatedAt);
    if (Number.isNaN(expected.getTime())) {
      res.status(400).json({ error: "expectedUpdatedAt tidak valid." });
      return;
    }
    if (expected.getTime() !== act.updatedAt.getTime()) {
      res.status(409).json({ error: CONFLICT_MESSAGE, currentStatus: act.status });
      return;
    }
  }
  // Phase 2 (write-time race) conditions the UPDATE on the exact revision we
  // just read — see the transaction below.
  const guardUpdatedAt = act.updatedAt;
  const allClear = suratUndangan && daftarHadir && foto && penyelenggaraValid;
  const newStatus = allClear ? "diverifikasi" : "ditolak";
  const now = new Date();

  // Rejection must include a note so the owner knows what to fix.
  if (!allClear && (typeof catatan !== "string" || catatan.trim().length === 0)) {
    res.status(400).json({ error: "Catatan wajib diisi jika ada item checklist yang belum lengkap." });
    return;
  }

  // All writes (status transition, checklist upsert, journey entry) run
  // in ONE transaction: a crash between any two would otherwise leave the
  // activity in an inconsistent state (e.g. checklist saved but status stale).
  //
  // The status transition is a CONDITIONAL update (WHERE updatedAt =
  // guardUpdatedAt): if a second officer's request raced past the read above,
  // the first writer bumped updatedAt, so the condition fails, zero rows
  // update, and we roll everything back with a 409 instead of silently
  // letting the last writer win — even when both decisions would produce the
  // same status.
  class ChecklistConflictError extends Error {}

  try {
    await db.transaction(async (tx) => {
      // Conditional status transition — the concurrency guard. Run first so a
      // conflict aborts before any other write happens.
      const updated = await tx.update(pkbActivities).set({
        status: newStatus,
        askomNote: catatan ?? null,
        askomVerifiedAt: allClear ? now : null,
        askomVerifiedBy: allClear ? verifierId : null,
        updatedAt: now,
      })
        .where(and(eq(pkbActivities.id, id), eq(pkbActivities.updatedAt, guardUpdatedAt)))
        .returning({ id: pkbActivities.id });

      if (updated.length === 0) {
        throw new ChecklistConflictError(CONFLICT_MESSAGE);
      }

      // Upsert checklist (one record per activity)
      const existing = await tx.select({ id: pkbActivityChecklist.id })
        .from(pkbActivityChecklist).where(eq(pkbActivityChecklist.activityId, id)).limit(1);

      if (existing.length > 0) {
        await tx.update(pkbActivityChecklist).set({
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
        await tx.insert(pkbActivityChecklist).values({
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

      // Archive a snapshot of this finalized checklist so past results survive
      // the reset that happens on resubmission (history view for verifiers).
      await tx.insert(pkbActivityChecklistHistory).values({
        activityId: id,
        checkedBy: verifierId,
        suratUndangan: !!suratUndangan,
        daftarHadir: !!daftarHadir,
        foto: !!foto,
        penyelenggaraValid: !!penyelenggaraValid,
        catatan: catatan ?? null,
        outcome: newStatus,
        checkedAt: now,
      });

      await tx.insert(pkbActivityJourney).values({
        activityId: id,
        event: newStatus,
        label: allClear
          ? "Dokumen diverifikasi lengkap oleh Asosiasi"
          : "Dokumen perlu perbaikan — catatan dari Asosiasi",
        metadata: { suratUndangan, daftarHadir, foto, penyelenggaraValid, catatan, verifierId },
      });
    });
  } catch (err) {
    if (err instanceof ChecklistConflictError) {
      // Another officer's decision landed between our read and write — the
      // transaction rolled back, nothing was overwritten.
      const [fresh] = await db.select({ status: pkbActivities.status })
        .from(pkbActivities).where(eq(pkbActivities.id, id)).limit(1);
      res.status(409).json({ error: CONFLICT_MESSAGE, currentStatus: fresh?.status ?? null });
      return;
    }
    throw err;
  }

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
