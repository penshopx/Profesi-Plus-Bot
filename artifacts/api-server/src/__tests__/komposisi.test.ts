/**
 * Pemeriksa komposisi Nilai Kredit — Pasal 20 ayat 4-7 Permen PUPR 12/2021.
 *
 * Kepatuhan HARUS dievaluasi dari rasio mentah, bukan persentase yang sudah
 * dibulatkan: 74.96% tidak boleh lolos sebagai 75%, dan 25.04% tidak boleh
 * lolos sebagai 25%.
 */

import { describe, it, expect } from "vitest";
import { computeKomposisi, validateKomposisiAttrs, type KomposisiActivity } from "../lib/komposisi";

function act(over: Partial<KomposisiActivity>): KomposisiActivity {
  return {
    status: "draft",
    unsurKegiatan: "utama",
    sifatKegiatan: "khusus",
    isPendidikanNonformal: false,
    angkaKredit: 10,
    ...over,
  };
}

function ruleById(summary: ReturnType<typeof computeKomposisi>, id: string) {
  const r = summary.rules.find((r) => r.id === id);
  if (!r) throw new Error(`rule ${id} not found`);
  return r;
}

describe("computeKomposisi — boundary evaluation on raw values", () => {
  it("74.96% utama is NOT ok even though it displays as 75%", () => {
    // utama 74.96 dari total 100
    const s = computeKomposisi([
      act({ unsurKegiatan: "utama", angkaKredit: 74.96 }),
      act({ unsurKegiatan: "penunjang", angkaKredit: 25.04 }),
    ]);
    const r = ruleById(s, "unsur_utama");
    expect(r.actualPct).toBe(75); // tampilan dibulatkan
    expect(r.ok).toBe(false);     // kepatuhan dari nilai mentah
    expect(s.allOk).toBe(false);
  });

  it("exactly 75% utama is ok", () => {
    const s = computeKomposisi([
      act({ unsurKegiatan: "utama", angkaKredit: 75 }),
      act({ unsurKegiatan: "penunjang", angkaKredit: 25 }),
    ]);
    expect(ruleById(s, "unsur_utama").ok).toBe(true);
  });

  it("25.04% nonformal is NOT ok even though it displays as 25%", () => {
    const s = computeKomposisi([
      act({ isPendidikanNonformal: true, angkaKredit: 25.04 }),
      act({ angkaKredit: 74.96 }),
    ]);
    const r = ruleById(s, "pendidikan_nonformal");
    expect(r.actualPct).toBe(25);
    expect(r.ok).toBe(false);
  });

  it("exactly 25% nonformal is ok", () => {
    const s = computeKomposisi([
      act({ isPendidikanNonformal: true, angkaKredit: 25 }),
      act({ angkaKredit: 75 }),
    ]);
    expect(ruleById(s, "pendidikan_nonformal").ok).toBe(true);
  });

  it("59.96% terverifikasi/khusus is NOT ok; exactly 60% is ok", () => {
    const below = computeKomposisi([
      act({ status: "diverifikasi", sifatKegiatan: "khusus", angkaKredit: 59.96 }),
      act({ status: "draft", sifatKegiatan: "umum", angkaKredit: 40.04 }),
    ]);
    expect(ruleById(below, "terverifikasi").actualPct).toBe(60);
    expect(ruleById(below, "terverifikasi").ok).toBe(false);
    expect(ruleById(below, "khusus").ok).toBe(false);

    const exact = computeKomposisi([
      act({ status: "diverifikasi", sifatKegiatan: "khusus", angkaKredit: 60 }),
      act({ status: "draft", sifatKegiatan: "umum", angkaKredit: 40 }),
    ]);
    expect(ruleById(exact, "terverifikasi").ok).toBe(true);
    expect(ruleById(exact, "khusus").ok).toBe(true);
  });

  it("weights by angka kredit, not activity count", () => {
    // 1 kegiatan utama besar vs 3 penunjang kecil → utama 90%
    const s = computeKomposisi([
      act({ unsurKegiatan: "utama", angkaKredit: 90 }),
      act({ unsurKegiatan: "penunjang", angkaKredit: 5 }),
      act({ unsurKegiatan: "penunjang", angkaKredit: 3 }),
      act({ unsurKegiatan: "penunjang", angkaKredit: 2 }),
    ]);
    expect(ruleById(s, "unsur_utama").actualPct).toBe(90);
    expect(ruleById(s, "unsur_utama").ok).toBe(true);
  });
});

describe("computeKomposisi — incomplete/empty data", () => {
  it("zero counted activities → no rule ok, allOk false", () => {
    const s = computeKomposisi([]);
    expect(s.countedActivities).toBe(0);
    expect(s.allOk).toBe(false);
    for (const r of s.rules) {
      expect(r.ok).toBe(false);
      expect(r.actualPct).toBe(0);
    }
  });

  it("excludes activities missing angka kredit or unsur/sifat and reports them", () => {
    const s = computeKomposisi([
      act({ angkaKredit: 50 }),                                 // counted
      act({ angkaKredit: null }),                               // missing angka kredit
      act({ angkaKredit: 0 }),                                  // 0 counts as missing
      act({ unsurKegiatan: null, angkaKredit: 999 }),           // missing unsur
      act({ sifatKegiatan: null, angkaKredit: 999 }),           // missing sifat
    ]);
    expect(s.totalActivities).toBe(5);
    expect(s.countedActivities).toBe(1);
    expect(s.missingAngkaKredit).toBe(2);
    expect(s.missingAtribut).toBe(2);
    // Kegiatan yang dikecualikan tidak mempengaruhi persentase
    expect(s.totalAngkaKredit).toBe(50);
    expect(ruleById(s, "unsur_utama").actualPct).toBe(100);
  });
});

describe("validateKomposisiAttrs", () => {
  it("accepts valid values and normalises empty to null", () => {
    const r = validateKomposisiAttrs({
      unsurKegiatan: "utama", sifatKegiatan: "", isPendidikanNonformal: true, angkaKredit: 12.8,
    });
    expect(r).toEqual({
      unsurKegiatan: "utama", sifatKegiatan: null, isPendidikanNonformal: true, angkaKredit: 12.8,
    });
  });

  it("rejects invalid enum, non-boolean flag, and non-positive/non-finite kredit", () => {
    expect(validateKomposisiAttrs({ unsurKegiatan: "lainnya" })).toHaveProperty("error");
    expect(validateKomposisiAttrs({ sifatKegiatan: "biasa" })).toHaveProperty("error");
    expect(validateKomposisiAttrs({ isPendidikanNonformal: "ya" })).toHaveProperty("error");
    expect(validateKomposisiAttrs({ angkaKredit: -5 })).toHaveProperty("error");
    expect(validateKomposisiAttrs({ angkaKredit: "12" })).toHaveProperty("error");
    expect(validateKomposisiAttrs({ angkaKredit: NaN })).toHaveProperty("error");
    expect(validateKomposisiAttrs({ angkaKredit: Infinity })).toHaveProperty("error");
  });

  it("ignores keys not present in the body", () => {
    expect(validateKomposisiAttrs({ namaKegiatan: "x" })).toEqual({});
  });
});
