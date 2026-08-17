/**
 * APL 01 field definitions — the single source of truth for which profile
 * fields appear on the printable APL 01 form.
 *
 * Consumed by BOTH the web app (CompletenessBar / pre-print warning in
 * gustafta-pkb) and the mobile app (profile screen completeness bar), so the
 * two clients can never disagree on the completeness percentage.
 *
 * Fields are addressed by key so this package stays independent of each
 * client's Profile type; any object carrying these keys works.
 */

export interface Apl01Field {
  /** Profile property holding the value. */
  key: string;
  /** Human-readable label as shown on the form / dialog. */
  label: string;
}

/**
 * Any profile-shaped object (web Profile, mobile AplProfile, …).
 * `object` (not an index signature) so interfaces are accepted as-is.
 */
export type AplProfileLike = object;

/** Every editable profile field rendered on the printed APL 01 form. */
export const APL01_FIELDS: Apl01Field[] = [
  // A. Identitas Diri
  { key: "nik", label: "NIK" },
  { key: "tempatLahir", label: "Tempat Lahir" },
  { key: "tanggalLahir", label: "Tanggal Lahir" },
  { key: "jenisKelamin", label: "Jenis Kelamin" },
  { key: "agama", label: "Agama" },
  { key: "nomorHp", label: "Nomor HP" },
  // B. Alamat Tempat Tinggal
  { key: "alamat", label: "Alamat Lengkap" },
  { key: "rt", label: "RT" },
  { key: "rw", label: "RW" },
  { key: "kelurahan", label: "Kelurahan/Desa" },
  { key: "kecamatan", label: "Kecamatan" },
  { key: "kotaKabupaten", label: "Kota/Kabupaten" },
  { key: "provinsi", label: "Provinsi" },
  { key: "kodePos", label: "Kode Pos" },
  // C. Pendidikan Terakhir
  { key: "jenjangPendidikan", label: "Jenjang Pendidikan" },
  { key: "namaInstitusi", label: "Nama Institusi/Sekolah" },
  { key: "jurusan", label: "Jurusan/Program Studi" },
  { key: "tahunLulus", label: "Tahun Lulus" },
  // D. Pekerjaan Saat Ini
  { key: "namaPerusahaan", label: "Nama Perusahaan" },
  { key: "jabatanSekarang", label: "Jabatan Sekarang" },
  { key: "tahunMulaiBekerja", label: "Tahun Mulai Bekerja" },
  { key: "alamatPerusahaan", label: "Alamat Perusahaan" },
  // E. Sertifikat Kompetensi Kerja (SKK)
  { key: "nomorSkk", label: "Nomor SKK" },
  { key: "masaBerlakuSkk", label: "Masa Berlaku SKK" },
  { key: "lembagaSertifikasi", label: "Lembaga Sertifikasi (LSP)" },
];

function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  return false; // numeric values (e.g. years) count as filled
}

/** Labels of APL 01 fields that are still blank on this profile. */
export function getMissingAplFields(profile: AplProfileLike): string[] {
  const p = profile as Record<string, unknown>;
  return APL01_FIELDS.filter((f) => isBlank(p[f.key])).map((f) => f.label);
}

/** Completeness percentage (0–100) over all printed APL 01 fields. */
export function getAplCompleteness(profile: AplProfileLike): number {
  const missing = getMissingAplFields(profile).length;
  return Math.round(((APL01_FIELDS.length - missing) / APL01_FIELDS.length) * 100);
}
