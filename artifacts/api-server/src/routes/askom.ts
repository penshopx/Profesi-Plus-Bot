/**
 * Internal verification routes (admin-only)
 *
 * Used by Gustafta admin to review kegiatan PKB that have been submitted.
 * SKK mapping is now performed automatically by the platform AI, so these
 * routes are for document completeness review only.
 *
 * Note: ASKOM (Asesor BNSP) should not review PKB documentation per
 * regulation — this panel is restricted to admin role only.
 *
 * GET  /askom/submissions        — list all kegiatan with status "diajukan"
 * GET  /askom/submissions/:id    — full detail of one submission
 * POST /askom/submissions/:id/verify  — approve with note
 * POST /askom/submissions/:id/reject  — reject with reason
 */

import { Router } from "express";
import { eq, inArray, desc, and } from "drizzle-orm";
import {
  db, users,
  pkbActivities, pkbActivitySkk, pkbActivityDocs, pkbActivityJourney,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

// ─── Push notification helper ─────────────────────────────────────────────────

async function sendPushNotification(
  log: import("pino").Logger,
  userId: number,
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  try {
    const pushRes = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Encoding": "gzip, deflate" },
      body: JSON.stringify({ to: pushToken, title, body, data: data ?? {}, channelId: "kegiatan" }),
    });
    if (!pushRes.ok) {
      log.warn({ status: pushRes.status }, "Expo push HTTP error (askom)");
      return;
    }
    const pushBody = await pushRes.json() as { data?: Array<{ status?: string; details?: { error?: string } }> };
    const tickets = pushBody?.data ?? [];
    const isDeviceNotRegistered = tickets.some(
      (t) => t.status === "error" && t.details?.error === "DeviceNotRegistered",
    );
    if (isDeviceNotRegistered) {
      // Log a fingerprint (last 8 chars) instead of the full token — tokens are bearer credentials.
      log.warn({ tokenSuffix: pushToken.slice(-8), userId }, "Expo token DeviceNotRegistered (askom) — clearing from DB");
      await db.update(users)
        .set({ expoPushToken: null })
        .where(and(eq(users.id, userId), eq(users.expoPushToken, pushToken)));
    }
  } catch (err) {
    log.warn({ err }, "Failed to send Expo push (askom)");
  }
}

const router = Router();

/** Middleware: only users with role "admin" may call these routes. */
async function requireAskom(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
): Promise<void> {
  const role = req.dbUser?.role;
  if (role !== "admin") {
    res.status(403).json({ error: "Akses ditolak — hanya admin." });
    return;
  }
  next();
}

// ─── GET /askom/submissions ───────────────────────────────────────────────────

router.get("/askom/submissions", requireAuth, requireAskom, async (req, res) => {
  // Load all submitted + verified activities with owner info
  const activities = await db
    .select({
      id:              pkbActivities.id,
      namaKegiatan:    pkbActivities.namaKegiatan,
      tanggalMulai:    pkbActivities.tanggalMulai,
      tanggalSelesai:  pkbActivities.tanggalSelesai,
      jenisPkb:        pkbActivities.jenisPkb,
      jpPkb:           pkbActivities.jpPkb,
      penyelenggara:   pkbActivities.penyelenggara,
      namaMateri:      pkbActivities.namaMateri,
      status:          pkbActivities.status,
      askomNote:       pkbActivities.askomNote,
      askomVerifiedAt: pkbActivities.askomVerifiedAt,
      updatedAt:       pkbActivities.updatedAt,
      userId:          pkbActivities.userId,
      ownerName:       users.name,
      ownerEmail:      users.email,
    })
    .from(pkbActivities)
    .innerJoin(users, eq(pkbActivities.userId, users.id))
    .where(inArray(pkbActivities.status, ["diajukan", "diverifikasi", "ditolak"]))
    .orderBy(desc(pkbActivities.updatedAt));

  // Batch-load SKK for all activities
  if (!activities.length) { res.json([]); return; }

  const ids = activities.map((a) => a.id);
  const allSkk = await db
    .select()
    .from(pkbActivitySkk)
    .where(inArray(pkbActivitySkk.activityId, ids));

  const skkByActivity = new Map<number, typeof allSkk>();
  for (const s of allSkk) {
    if (!skkByActivity.has(s.activityId)) skkByActivity.set(s.activityId, []);
    skkByActivity.get(s.activityId)!.push(s);
  }

  const result = activities.map((a) => ({
    ...a,
    skk: skkByActivity.get(a.id) ?? [],
  }));

  res.json(result);
});

// ─── GET /askom/submissions/:id ───────────────────────────────────────────────

router.get("/askom/submissions/:id", requireAuth, requireAskom, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  const [act] = await db
    .select({
      id:              pkbActivities.id,
      userId:          pkbActivities.userId,
      namaKegiatan:    pkbActivities.namaKegiatan,
      tanggalMulai:    pkbActivities.tanggalMulai,
      tanggalSelesai:  pkbActivities.tanggalSelesai,
      tempatKegiatan:  pkbActivities.tempatKegiatan,
      modePelaksanaan: pkbActivities.modePelaksanaan,
      namaMateri:      pkbActivities.namaMateri,
      penyelenggara:   pkbActivities.penyelenggara,
      namaInstruktur:  pkbActivities.namaInstruktur,
      uraianSingkat:   pkbActivities.uraianSingkat,
      linkRekaman:     pkbActivities.linkRekaman,
      jenisPkb:        pkbActivities.jenisPkb,
      jpPkb:           pkbActivities.jpPkb,
      status:          pkbActivities.status,
      askomNote:       pkbActivities.askomNote,
      askomVerifiedAt: pkbActivities.askomVerifiedAt,
      updatedAt:       pkbActivities.updatedAt,
      ownerName:       users.name,
      ownerEmail:      users.email,
    })
    .from(pkbActivities)
    .innerJoin(users, eq(pkbActivities.userId, users.id))
    .where(eq(pkbActivities.id, id))
    .limit(1);

  if (!act) { res.status(404).json({ error: "Tidak ditemukan" }); return; }

  const [skk, docs, journey] = await Promise.all([
    db.select().from(pkbActivitySkk).where(eq(pkbActivitySkk.activityId, id)),
    db.select().from(pkbActivityDocs).where(eq(pkbActivityDocs.activityId, id)),
    db.select().from(pkbActivityJourney).where(eq(pkbActivityJourney.activityId, id)),
  ]);

  res.json({ ...act, skk, docs, journey });
});

// ─── POST /askom/submissions/:id/verify ──────────────────────────────────────

router.post("/askom/submissions/:id/verify", requireAuth, requireAskom, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { note } = req.body as { note?: string };

  const [act] = await db
    .select({
      id:          pkbActivities.id,
      userId:      pkbActivities.userId,
      namaKegiatan: pkbActivities.namaKegiatan,
      status:      pkbActivities.status,
    })
    .from(pkbActivities)
    .where(eq(pkbActivities.id, id))
    .limit(1);

  if (!act) { res.status(404).json({ error: "Tidak ditemukan" }); return; }
  if (act.status !== "diajukan") {
    res.status(400).json({ error: `Status saat ini adalah "${act.status}" — hanya kegiatan "diajukan" yang bisa diverifikasi.` });
    return;
  }

  const now = new Date();
  await db.update(pkbActivities).set({
    status: "diverifikasi",
    askomNote: note ?? null,
    askomVerifiedAt: now,
    askomVerifiedBy: req.dbUser!.id,
    updatedAt: now,
  }).where(eq(pkbActivities.id, id));

  // Journey entry
  await db.insert(pkbActivityJourney).values({
    activityId: id,
    event: "diverifikasi",
    label: "Tim verifikasi: kegiatan diverifikasi",
    metadata: { askomNote: note ?? null, verifiedBy: req.dbUser!.id },
  });

  req.log.info({ askomId: req.dbUser!.id, activityId: id }, "ASKOM verified kegiatan");

  // Non-blocking push notification to activity owner
  const [owner] = await db
    .select({ id: users.id, expoPushToken: users.expoPushToken })
    .from(users)
    .where(eq(users.id, act.userId))
    .limit(1);
  if (owner?.expoPushToken) {
    (async () => {
      await sendPushNotification(
        req.log,
        owner.id,
        owner.expoPushToken!,
        "Kegiatan PKB Diverifikasi ✅",
        `"${act.namaKegiatan}" telah diverifikasi oleh tim Gustafta. Ketuk untuk melihat detail.`,
        { activityId: String(id) },
      );
    })();
  }

  res.json({ ok: true, status: "diverifikasi" });
});

// ─── POST /askom/submissions/:id/reject ──────────────────────────────────────

router.post("/askom/submissions/:id/reject", requireAuth, requireAskom, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { note } = req.body as { note?: string };

  if (!note?.trim()) {
    res.status(400).json({ error: "Catatan alasan penolakan wajib diisi." });
    return;
  }

  const [act] = await db
    .select({
      id:           pkbActivities.id,
      userId:       pkbActivities.userId,
      namaKegiatan: pkbActivities.namaKegiatan,
      status:       pkbActivities.status,
    })
    .from(pkbActivities)
    .where(eq(pkbActivities.id, id))
    .limit(1);

  if (!act) { res.status(404).json({ error: "Tidak ditemukan" }); return; }
  if (act.status !== "diajukan") {
    res.status(400).json({ error: `Status saat ini adalah "${act.status}" — hanya kegiatan "diajukan" yang bisa ditolak.` });
    return;
  }

  const now = new Date();
  await db.update(pkbActivities).set({
    status: "ditolak",
    askomNote: note,
    askomVerifiedAt: now,
    askomVerifiedBy: req.dbUser!.id,
    updatedAt: now,
  }).where(eq(pkbActivities.id, id));

  await db.insert(pkbActivityJourney).values({
    activityId: id,
    event: "ditolak",
    label: `Tim verifikasi: Ditolak — ${note.slice(0, 80)}`,
    metadata: { rejected: true, askomNote: note, verifiedBy: req.dbUser!.id },
  });

  req.log.info({ askomId: req.dbUser!.id, activityId: id }, "ASKOM rejected kegiatan");

  // Non-blocking push notification to activity owner
  const [owner] = await db
    .select({ id: users.id, expoPushToken: users.expoPushToken })
    .from(users)
    .where(eq(users.id, act.userId))
    .limit(1);
  if (owner?.expoPushToken) {
    (async () => {
      await sendPushNotification(
        req.log,
        owner.id,
        owner.expoPushToken!,
        "Kegiatan PKB Perlu Diperbaiki ⚠️",
        `"${act.namaKegiatan}" dikembalikan untuk perbaikan. Buka aplikasi untuk melihat catatan tim verifikasi.`,
        { activityId: String(id) },
      );
    })();
  }

  res.json({ ok: true, status: "ditolak" });
});

export default router;
