/**
 * APL 01 — Profil Tenaga Kerja Konstruksi (BNSP standard)
 * APL 02 — Klaim Kompetensi per Unit SKK
 *
 * These tables extend the base `users` record with the structured data
 * required for PKB-Exum documentation under Permen PUPR No. 12/2021 and
 * SK Dirjen Bina Konstruksi No. 114/2024.
 */

import { pgTable, serial, integer, text, date, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

// ─── APL 01 — Profil TKK ─────────────────────────────────────────────────────

export const JENIS_KELAMIN = ["L", "P"] as const;
export const JENJANG_PENDIDIKAN = ["SD", "SMP", "SMA/SMK", "D1", "D2", "D3", "D4", "S1", "S2", "S3"] as const;

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),

  // ── Identitas Diri ──────────────────────────────────────────────────────────
  nik: text("nik"),                          // Nomor Induk Kependudukan (16 digits)
  tempatLahir: text("tempat_lahir"),
  tanggalLahir: date("tanggal_lahir"),
  jenisKelamin: text("jenis_kelamin"),       // "L" | "P"
  agama: text("agama"),
  kewarganegaraan: text("kewarganegaraan").default("WNI"),

  // ── Alamat ──────────────────────────────────────────────────────────────────
  alamat: text("alamat"),
  rt: text("rt"),
  rw: text("rw"),
  kelurahan: text("kelurahan"),
  kecamatan: text("kecamatan"),
  kotaKabupaten: text("kota_kabupaten"),
  provinsi: text("provinsi"),
  kodePos: text("kode_pos"),

  // ── Kontak ──────────────────────────────────────────────────────────────────
  nomorHp: text("nomor_hp"),

  // ── Pendidikan Terakhir ─────────────────────────────────────────────────────
  jenjangPendidikan: text("jenjang_pendidikan"),  // SD … S3
  namaInstitusi: text("nama_institusi"),
  jurusan: text("jurusan"),
  tahunLulus: integer("tahun_lulus"),

  // ── Pekerjaan Saat Ini ──────────────────────────────────────────────────────
  namaPerusahaan: text("nama_perusahaan"),
  alamatPerusahaan: text("alamat_perusahaan"),
  jabatanSekarang: text("jabatan_sekarang"),
  tahunMulaiBekerja: integer("tahun_mulai_bekerja"),

  // ── SKK & Sertifikasi ───────────────────────────────────────────────────────
  nomorSkk: text("nomor_skk"),               // Nomor SKK yang sudah dimiliki
  masaBerlakuSkk: date("masa_berlaku_skk"),
  lembagaSertifikasi: text("lembaga_sertifikasi"),

  // ── Status ──────────────────────────────────────────────────────────────────
  isComplete: boolean("is_complete").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;

// ─── APL 02 — Klaim Kompetensi ───────────────────────────────────────────────

export const EVIDENCE_TYPES = ["portofolio", "sertifikat", "laporan", "foto", "video", "testimoni", "lainnya"] as const;
export const PENCAPAIAN_LEVELS = ["kompeten", "belum_kompeten", "dalam_proses"] as const;

export const competencyClaims = pgTable("competency_claims", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // ── Identitas Unit Kompetensi ───────────────────────────────────────────────
  skkUnitCode: text("skk_unit_code").notNull(),
  skkUnitName: text("skk_unit_name").notNull(),
  jabker: text("jabker").notNull(),
  jenjang: text("jenjang"),

  // ── Klaim ──────────────────────────────────────────────────────────────────
  pencapaian: text("pencapaian").notNull().default("dalam_proses"),  // enum PENCAPAIAN_LEVELS
  buktiUtama: text("bukti_utama"),   // Deskripsi bukti utama yang diklaim
  jenisBukti: text("jenis_bukti"),   // enum EVIDENCE_TYPES
  catatanTambahan: text("catatan_tambahan"),

  // ── Proficiency Quiz Link ───────────────────────────────────────────────────
  lastProficiencyScore: integer("last_proficiency_score"),  // 0–100 from quiz
  lastProficiencyAt: timestamp("last_proficiency_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CompetencyClaim = typeof competencyClaims.$inferSelect;
export type InsertCompetencyClaim = typeof competencyClaims.$inferInsert;
