/**
 * APL 01 field definitions — the single source of truth for which profile
 * fields appear on the printable APL 01 form.
 *
 * Both the completeness indicator and the pre-print "incomplete profile"
 * warning derive from this list so they can never disagree.
 */

import type { Profile } from "@/lib/api-profile";

export interface Apl01Field {
  /** Human-readable label as shown on the form / dialog. */
  label: string;
  get: (p: Profile) => unknown;
}

/** Every editable profile field rendered on the printed APL 01 form. */
export const APL01_FIELDS: Apl01Field[] = [
  // A. Identitas Diri
  { label: "NIK", get: (p) => p.nik },
  { label: "Tempat Lahir", get: (p) => p.tempatLahir },
  { label: "Tanggal Lahir", get: (p) => p.tanggalLahir },
  { label: "Jenis Kelamin", get: (p) => p.jenisKelamin },
  { label: "Agama", get: (p) => p.agama },
  { label: "Nomor HP", get: (p) => p.nomorHp },
  // B. Alamat Tempat Tinggal
  { label: "Alamat Lengkap", get: (p) => p.alamat },
  { label: "RT", get: (p) => p.rt },
  { label: "RW", get: (p) => p.rw },
  { label: "Kelurahan/Desa", get: (p) => p.kelurahan },
  { label: "Kecamatan", get: (p) => p.kecamatan },
  { label: "Kota/Kabupaten", get: (p) => p.kotaKabupaten },
  { label: "Provinsi", get: (p) => p.provinsi },
  { label: "Kode Pos", get: (p) => p.kodePos },
  // C. Pendidikan Terakhir
  { label: "Jenjang Pendidikan", get: (p) => p.jenjangPendidikan },
  { label: "Nama Institusi/Sekolah", get: (p) => p.namaInstitusi },
  { label: "Jurusan/Program Studi", get: (p) => p.jurusan },
  { label: "Tahun Lulus", get: (p) => p.tahunLulus },
  // D. Pekerjaan Saat Ini
  { label: "Nama Perusahaan", get: (p) => p.namaPerusahaan },
  { label: "Jabatan Sekarang", get: (p) => p.jabatanSekarang },
  { label: "Tahun Mulai Bekerja", get: (p) => p.tahunMulaiBekerja },
  { label: "Alamat Perusahaan", get: (p) => p.alamatPerusahaan },
  // E. Sertifikat Kompetensi Kerja (SKK)
  { label: "Nomor SKK", get: (p) => p.nomorSkk },
  { label: "Masa Berlaku SKK", get: (p) => p.masaBerlakuSkk },
  { label: "Lembaga Sertifikasi (LSP)", get: (p) => p.lembagaSertifikasi },
];

/** Labels of APL 01 fields that are still blank on this profile. */
export function getMissingAplFields(profile: Profile): string[] {
  return APL01_FIELDS.filter((f) => {
    const v = f.get(profile);
    if (v === null || v === undefined) return true;
    if (typeof v === "string") return v.trim() === "";
    return false; // numeric values (e.g. years) count as filled
  }).map((f) => f.label);
}

/** Completeness percentage (0–100) over all printed APL 01 fields. */
export function getAplCompleteness(profile: Profile): number {
  const missing = getMissingAplFields(profile).length;
  return Math.round(((APL01_FIELDS.length - missing) / APL01_FIELDS.length) * 100);
}
