/**
 * Pemeriksa komposisi Nilai Kredit — Pasal 20 ayat 4-7 Permen PUPR 12/2021.
 *
 * Perpanjangan SKK mensyaratkan bukan hanya total SKPK, tetapi juga komposisi:
 *   1. Unsur kegiatan utama >= 75% (penunjang <= 25%)
 *   2. Pendidikan nonformal <= 25%
 *   3. Kegiatan terverifikasi >= 60%
 *   4. Kegiatan (sifat) khusus >= 60%
 *
 * Kepatuhan (`ok`) dievaluasi dari rasio MENTAH (tanpa pembulatan) supaya
 * 74.96% tidak pernah dilaporkan "terpenuhi" sebagai 75%. Pembulatan hanya
 * dipakai untuk tampilan (`actualPct`).
 */

export const UNSUR_KEGIATAN = ["utama", "penunjang"] as const;
export const SIFAT_KEGIATAN = ["khusus", "umum"] as const;

export interface KomposisiActivity {
  status: string;
  unsurKegiatan: string | null;
  sifatKegiatan: string | null;
  isPendidikanNonformal: boolean;
  angkaKredit: number | null;
}

export interface KomposisiRule {
  id: string;
  label: string;
  requirement: string;
  actualPct: number;      // dibulatkan 1 desimal — hanya untuk tampilan
  thresholdPct: number;
  direction: "min" | "max";
  ok: boolean;            // dievaluasi dari nilai mentah
  detail: string;
}

export interface KomposisiSummary {
  reference: string;
  totalAngkaKredit: number;
  countedActivities: number;
  totalActivities: number;
  missingAngkaKredit: number;
  missingAtribut: number;
  allOk: boolean;
  rules: KomposisiRule[];
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export function computeKomposisi(activities: KomposisiActivity[]): KomposisiSummary {
  // Kegiatan hanya masuk perhitungan bila punya angka kredit + atribut lengkap.
  const counted = activities.filter(
    (a) => (a.angkaKredit ?? 0) > 0 && a.unsurKegiatan && a.sifatKegiatan,
  );
  const missingAngkaKredit = activities.filter((a) => !((a.angkaKredit ?? 0) > 0)).length;
  const missingAtribut     = activities.filter((a) => !a.unsurKegiatan || !a.sifatKegiatan).length;

  const total = counted.reduce((s, a) => s + (a.angkaKredit ?? 0), 0);
  const sum = (pred: (a: KomposisiActivity) => boolean) =>
    counted.filter(pred).reduce((s, a) => s + (a.angkaKredit ?? 0), 0);

  const utama         = sum((a) => a.unsurKegiatan === "utama");
  const nonformal     = sum((a) => a.isPendidikanNonformal);
  const terverifikasi = sum((a) => a.status === "diverifikasi");
  const khusus        = sum((a) => a.sifatKegiatan === "khusus");

  // Rasio mentah dalam persen — TANPA pembulatan; dasar evaluasi kepatuhan.
  const rawPct = (v: number) => (total > 0 ? (v / total) * 100 : 0);

  function rule(
    id: string, label: string, value: number, thresholdPct: number,
    direction: "min" | "max", detail: string,
  ): KomposisiRule {
    const raw = rawPct(value);
    const ok = total > 0 && (direction === "min" ? raw >= thresholdPct : raw <= thresholdPct);
    return {
      id, label,
      requirement: `${direction === "min" ? "≥" : "≤"} ${thresholdPct}%`,
      actualPct: round1(raw), thresholdPct, direction, ok, detail,
    };
  }

  const rules = [
    rule("unsur_utama", "Unsur kegiatan utama", utama, 75, "min",
      `Penunjang maks 25% (saat ini ${round1(rawPct(total - utama))}%)`),
    rule("pendidikan_nonformal", "Pendidikan nonformal", nonformal, 25, "max",
      "Selain pendidikan nonformal min 75%"),
    rule("terverifikasi", "Kegiatan terverifikasi", terverifikasi, 60, "min",
      "Tidak terverifikasi maks 40%"),
    rule("khusus", "Kegiatan sifat khusus", khusus, 60, "min",
      "Kegiatan umum maks 40%"),
  ];

  return {
    reference: "Pasal 20 ayat 4-7 Permen PUPR No. 12/2021",
    totalAngkaKredit: round1(total),
    countedActivities: counted.length,
    totalActivities: activities.length,
    missingAngkaKredit,
    missingAtribut,
    allOk: total > 0 && rules.every((r) => r.ok),
    rules,
  };
}

// ── Validasi atribut komposisi (dipakai POST & PATCH /kegiatan) ──────────────
// Mengembalikan nilai yang sudah dinormalisasi, atau { error } bila tidak valid.

export function validateKomposisiAttrs(body: Record<string, unknown>):
  | { error: string }
  | {
      unsurKegiatan?: string | null;
      sifatKegiatan?: string | null;
      isPendidikanNonformal?: boolean;
      angkaKredit?: number | null;
    } {
  const out: {
    unsurKegiatan?: string | null;
    sifatKegiatan?: string | null;
    isPendidikanNonformal?: boolean;
    angkaKredit?: number | null;
  } = {};

  if ("unsurKegiatan" in body) {
    const v = body.unsurKegiatan;
    if (v === null || v === "" || v === undefined) out.unsurKegiatan = null;
    else if (typeof v === "string" && (UNSUR_KEGIATAN as readonly string[]).includes(v)) out.unsurKegiatan = v;
    else return { error: `unsurKegiatan harus salah satu dari: ${UNSUR_KEGIATAN.join(", ")}` };
  }
  if ("sifatKegiatan" in body) {
    const v = body.sifatKegiatan;
    if (v === null || v === "" || v === undefined) out.sifatKegiatan = null;
    else if (typeof v === "string" && (SIFAT_KEGIATAN as readonly string[]).includes(v)) out.sifatKegiatan = v;
    else return { error: `sifatKegiatan harus salah satu dari: ${SIFAT_KEGIATAN.join(", ")}` };
  }
  if ("isPendidikanNonformal" in body) {
    const v = body.isPendidikanNonformal;
    if (typeof v !== "boolean" && v !== null && v !== undefined) {
      return { error: "isPendidikanNonformal harus boolean" };
    }
    out.isPendidikanNonformal = v === true;
  }
  if ("angkaKredit" in body) {
    const v = body.angkaKredit;
    if (v === null || v === undefined || v === "") out.angkaKredit = null;
    else if (typeof v === "number" && Number.isFinite(v) && v > 0) out.angkaKredit = v;
    else return { error: "angkaKredit harus angka positif" };
  }
  return out;
}
