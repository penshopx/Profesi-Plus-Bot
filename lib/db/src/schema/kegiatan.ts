/**
 * Dokumentasi Kegiatan PKB-Exum
 *
 * Setiap kegiatan PKB yang diikuti user (webinar, diklatkerja, pelatihan, dll.)
 * didokumentasikan secara terstruktur sesuai 11 field standar BNSP/LPJK.
 * Dokumentasi ini menjadi bukti portofolio formal untuk proses Exum / SKK.
 */

import {
  pgTable, serial, integer, text, date, timestamp, jsonb, boolean,
} from "drizzle-orm/pg-core";
import { users } from "./users";

// ─── Status lifecycle kegiatan ────────────────────────────────────────────────

export const KEGIATAN_STATUS = [
  "draft",        // sedang diisi
  "lengkap",      // semua field wajib terisi
  "diajukan",     // sudah dikirim ke Asosiasi untuk verifikasi kelengkapan dokumen
  "diverifikasi", // Asosiasi sudah menyatakan dokumen lengkap dan penyelenggara valid
  "ditolak",      // Asosiasi menemukan kekurangan — perlu perbaikan
] as const;
export type KegiatanStatus = (typeof KEGIATAN_STATUS)[number];

export const DOC_TYPE = [
  "surat_undangan",
  "daftar_hadir",
  "foto",
  "rekaman",
  "lainnya",
] as const;
export type DocType = (typeof DOC_TYPE)[number];

export const JOURNEY_EVENT = [
  "kegiatan_dibuat",
  "info_diperbarui",
  "skk_dipetakan",
  "surat_undangan_diunggah",
  "daftar_hadir_diunggah",
  "foto_diunggah",
  "link_rekaman_ditambahkan",
  "dokumen_diunggah",
  "siap_diajukan",
  "diajukan",
  "diverifikasi",
  "ditolak",
] as const;
export type JourneyEvent = (typeof JOURNEY_EVENT)[number];

// ─── Tabel utama ──────────────────────────────────────────────────────────────

export const pkbActivities = pgTable("pkb_activities", {
  id:              serial("id").primaryKey(),
  userId:          integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // Field 1 — Nama kegiatan
  namaKegiatan:    text("nama_kegiatan").notNull(),

  // Field 2 — Tanggal pelaksanaan
  tanggalMulai:    date("tanggal_mulai").notNull(),
  tanggalSelesai:  date("tanggal_selesai"),          // null = 1 hari

  // Field 3 — Tempat kegiatan
  tempatKegiatan:  text("tempat_kegiatan"),
  modePelaksanaan: text("mode_pelaksanaan"),          // "online" | "offline" | "hybrid"

  // Field 4 — Nama materi / modul
  namaMateri:      text("nama_materi"),
  penyelenggara:   text("penyelenggara"),             // nama lembaga/provider
  namaInstruktur:  text("nama_instruktur"),
  marketplaceId:   text("marketplace_id"),            // link ke marketplace course jika ada

  // Field 8 — Uraian singkat
  uraianSingkat:   text("uraian_singkat"),

  // Field 10 — Link rekaman
  linkRekaman:     text("link_rekaman"),

  // Metadata
  status:          text("status").notNull().default("draft"),
  jenisPkb:        text("jenis_pkb"),                // "seminar" | "webinar" | "diklatkerja" | "workshop" | "kursus" | "mandiri"
  jpPkb:           integer("jp_pkb"),                // jam pelajaran / kredit PKB

  // ── Verification (formerly ASKOM — now Asosiasi) ──────────────────────────
  // Asosiasi verifies document completeness (surat undangan, daftar hadir, foto)
  // and organizer legitimacy (BNSP/LPJK-registered). SKK mapping is automated.
  askomNote:       text("askom_note"),               // Verifier's note (kept as askomNote for BC)
  askomVerifiedAt: timestamp("askom_verified_at", { withTimezone: true }),
  askomVerifiedBy: integer("askom_verified_by"),     // FK users.id of the Asosiasi verifier

  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Field 5 — Mapping SKK ───────────────────────────────────────────────────

export const pkbActivitySkk = pgTable("pkb_activity_skk", {
  id:          serial("id").primaryKey(),
  activityId:  integer("activity_id").notNull().references(() => pkbActivities.id, { onDelete: "cascade" }),
  skkCode:     text("skk_code").notNull(),   // e.g. "F.45.2.0.0.0.0.0.01"
  skkName:     text("skk_name").notNull(),
  jabkerId:    text("jabker_id"),            // e.g. "ahli_k3_konstruksi"
  jabkerName:  text("jabker_name"),
});

// ─── Field 6, 7, 9 — Dokumen (surat undangan, daftar hadir, foto) ─────────────

export const pkbActivityDocs = pgTable("pkb_activity_docs", {
  id:          serial("id").primaryKey(),
  activityId:  integer("activity_id").notNull().references(() => pkbActivities.id, { onDelete: "cascade" }),
  docType:     text("doc_type").notNull(),           // DocType
  filename:    text("filename").notNull(),
  objectPath:  text("object_path").notNull(),        // GCS object path, served via /api/storage/objects/...
  mimeType:    text("mime_type"),
  sizeBytes:   integer("size_bytes"),
  caption:     text("caption"),                      // keterangan foto / label dokumen
  uploadedAt:  timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Field 11 — Timestamp journey ─────────────────────────────────────────────

export const pkbActivityJourney = pgTable("pkb_activity_journey", {
  id:          serial("id").primaryKey(),
  activityId:  integer("activity_id").notNull().references(() => pkbActivities.id, { onDelete: "cascade" }),
  event:       text("event").notNull(),              // JourneyEvent
  label:       text("label").notNull(),              // human-readable label in Bahasa
  metadata:    jsonb("metadata"),                    // { filename?, skkCode?, field?, ... }
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Asosiasi checklist — verifikasi kelengkapan dokumen ─────────────────────
// Asosiasi (bukan ASKOM) mengecek kelengkapan formal dokumen kegiatan PKB:
//   1. Surat undangan ada dan valid
//   2. Daftar hadir ada dan lengkap
//   3. Foto dokumentasi ada
//   4. Penyelenggara terdaftar (BNSP/LPJK-registered)
// Output: checklist saja (bukan approve/reject konten) + catatan opsional.
// Jika semua centang → status diverifikasi; ada yg kosong + catatan → ditolak.

export const pkbActivityChecklist = pgTable("pkb_activity_checklist", {
  id:                 serial("id").primaryKey(),
  activityId:         integer("activity_id").notNull().references(() => pkbActivities.id, { onDelete: "cascade" }),
  checkedBy:          integer("checked_by").references(() => users.id),

  suratUndangan:      boolean("surat_undangan").notNull().default(false),
  daftarHadir:        boolean("daftar_hadir").notNull().default(false),
  foto:               boolean("foto").notNull().default(false),
  penyelenggaraValid: boolean("penyelenggara_valid").notNull().default(false),
  catatan:            text("catatan"),

  checkedAt:          timestamp("checked_at", { withTimezone: true }),
  createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:          timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type PkbActivityChecklist = typeof pkbActivityChecklist.$inferSelect;

// ─── Types ────────────────────────────────────────────────────────────────────

export type PkbActivity    = typeof pkbActivities.$inferSelect;
export type PkbActivitySkk = typeof pkbActivitySkk.$inferSelect;
export type PkbActivityDoc = typeof pkbActivityDocs.$inferSelect;
export type PkbActivityJourney = typeof pkbActivityJourney.$inferSelect;

export type PkbActivityFull = PkbActivity & {
  skk: PkbActivitySkk[];
  docs: PkbActivityDoc[];
  journey: PkbActivityJourney[];
};
