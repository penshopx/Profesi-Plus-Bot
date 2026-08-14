/**
 * Unit tests for buildCompetencyAnalysisContext and buildHistoricalPKBContext.
 *
 * The database is fully mocked via a queue-based chainable stub so the functions
 * can be tested with fixture data without a real Postgres connection.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── db mock setup ─────────────────────────────────────────────────────────────
//
// vi.hoisted() ensures the mock state object is defined before vi.mock() runs
// (vi.mock calls are hoisted to the top of the file by the vitest transformer).

const dbState = vi.hoisted(() => ({
  /** FIFO queue of values returned by each `await db.<chain>` expression. */
  queue: [] as unknown[],
  push(...items: unknown[]) {
    this.queue.push(...items);
  },
  shift(): unknown {
    return this.queue.shift() ?? [];
  },
}));

vi.mock("@workspace/db", () => {
  /**
   * Returns a single chainable / thenable object.
   * Every chain method returns the same object so any sequence of
   * `.select().from().where().orderBy().limit(n)` resolves to the next
   * value in the queue when awaited.
   */
  function makeChain() {
    const obj: Record<string, unknown> = {};
    // Thenable — each `await expr` pops one item from the shared queue.
    obj["then"] = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      Promise.resolve(dbState.shift()).then(resolve, reject);
    obj["catch"] = (reject: (e: unknown) => void) =>
      Promise.resolve(dbState.shift()).catch(reject);
    for (const method of [
      "select", "from", "where", "orderBy", "limit",
      "innerJoin", "insert", "values", "returning",
      "update", "set", "for", "delete",
    ]) {
      obj[method] = vi.fn().mockReturnValue(obj);
    }
    return obj;
  }

  const chain = makeChain();

  return {
    db: {
      select:      vi.fn().mockReturnValue(chain),
      insert:      vi.fn().mockReturnValue(chain),
      update:      vi.fn().mockReturnValue(chain),
      delete:      vi.fn().mockReturnValue(chain),
      transaction: vi.fn(),
    },
    // Schema table objects — only need to exist as stable identifiers.
    competencyAnalysis: { userId: "userId", createdAt: "createdAt" },
    conversations:      { userId: "userId", id: "id", createdAt: "createdAt" },
    evidenceItems:      { conversationId: "conversationId", createdAt: "createdAt" },
    profiles:           { userId: "userId" },
    competencyClaims:   { userId: "userId", createdAt: "createdAt" },
    quizAttempts:       { userId: "userId", quizId: "quizId", completedAt: "completedAt" },
    quizzes:            { id: "id" },
    pkbActivities:      { userId: "userId", tanggalMulai: "tanggalMulai" },
    pkbActivitySkk:     { activityId: "activityId" },
    users:              { id: "id" },
  };
});

// Drizzle operators — used only as arguments; their return values don't matter
// since the db chain is fully mocked.
vi.mock("drizzle-orm", () => ({
  eq:        vi.fn().mockReturnValue({}),
  and:       vi.fn().mockReturnValue({}),
  ne:        vi.fn().mockReturnValue({}),
  desc:      vi.fn().mockReturnValue({}),
  asc:       vi.fn().mockReturnValue({}),
  isNotNull: vi.fn().mockReturnValue({}),
  sql:       vi.fn().mockReturnValue({}),
  inArray:   vi.fn().mockReturnValue({}),
}));

// ── Import after mocks are registered ─────────────────────────────────────────

import {
  buildCompetencyAnalysisContext,
  buildHistoricalPKBContext,
  buildProfileContext,
  MAX_HISTORICAL_PKB_CHARS,
} from "../lib/historical-pkb.js";

// ─── Helpers / Fixtures ───────────────────────────────────────────────────────

const FIXTURE_ANALYSIS = {
  jabkerName:      "Ahli Muda Teknik Konstruksi",
  jenjang:         "Muda",
  klasifikasi:     "Sipil",
  estimatedSkpk:   18,
  readiness:       "cukup" as const,
  summary:         "TKK sudah cukup kompeten namun masih ada beberapa gap.",
  result: {
    summary:         "Cukup kompeten.",
    estimatedSkpk:   18,
    readiness:       "cukup" as const,
    units: [
      { code: "M.711000.001.01", name: "Unit A", status: "covered" as const, rationale: "", evidenceRef: null },
      { code: "M.711000.002.01", name: "Unit B", status: "partial" as const, rationale: "", evidenceRef: null },
      { code: "M.711000.003.01", name: "Unit C", status: "gap"     as const, rationale: "", evidenceRef: null },
    ],
    gaps:            ["Gap pertama", "Gap kedua", "Gap ketiga"],
    recommendations: ["Rekomendasi satu", "Rekomendasi dua", "Rekomendasi tiga"],
  },
  createdAt: new Date("2026-01-01"),
};

const FIXTURE_PROFILE = {
  jabatanSekarang:    "Manajer Proyek Konstruksi",
  namaPerusahaan:     "PT Bangun Sejahtera",
  tahunMulaiBekerja:  2010,
  jenjangPendidikan:  "S1",
  jurusan:            "Teknik Sipil",
  namaInstitusi:      "Universitas Indonesia",
  nomorSkk:           "SKK-20240001",
  lembagaSertifikasi: "LPJK",
  kotaKabupaten:      "Jakarta Selatan",
  provinsi:           "DKI Jakarta",
};

const FIXTURE_CLAIM = {
  skkUnitCode: "M.711000.001.01",
  skkUnitName: "Perencanaan Proyek",
  pencapaian:  "kompeten",
};

const FIXTURE_EXUM = {
  title:       "Exum Ahli Muda 2025",
  jabker:      "Ahli Muda Teknik Konstruksi",
  jenjang:     "Muda",
  exumContent: "Executive summary pertama dari pengalaman konstruksi selama 5 tahun.",
};

const FIXTURE_EVIDENCE = {
  type:        "work_experience",
  category:    "Proyek",
  title:       "Proyek Jembatan Surabaya",
  description: "Mengelola proyek jembatan dengan anggaran 10 miliar.",
  skkUnitCode: "M.711000.001.01",
  skkUnitName: "Perencanaan Teknik",
};

beforeEach(() => {
  dbState.queue = [];
});

// ─────────────────────────────────────────────────────────────────────────────
// buildProfileContext
// ─────────────────────────────────────────────────────────────────────────────
//
// buildProfileContext runs TWO parallel DB calls inside Promise.all:
//   1. db.select().from(profiles).where(...).then((r) => r[0] ?? null)
//   2. db.select().from(competencyClaims).where(...).orderBy(...)
//
// Each call pops one item from the shared queue (the chain's .then() method
// calls dbState.shift() synchronously before handing off to Promise.all).
// Push TWO items per test: [profileArray, claimsArray].

describe("buildProfileContext", () => {
  it("returns empty string when user has no profile", async () => {
    dbState.push([], []); // profile query → [], claims query → []
    const result = await buildProfileContext(1);
    expect(result).toBe("");
  });

  it("includes the section header when a profile exists", async () => {
    dbState.push([FIXTURE_PROFILE], []);
    const result = await buildProfileContext(1);
    expect(result).toContain("PROFIL APL 01 TKK");
  });

  it("includes the current job title", async () => {
    dbState.push([FIXTURE_PROFILE], []);
    const result = await buildProfileContext(1);
    expect(result).toContain("Manajer Proyek Konstruksi");
  });

  it("includes the company name", async () => {
    dbState.push([FIXTURE_PROFILE], []);
    const result = await buildProfileContext(1);
    expect(result).toContain("PT Bangun Sejahtera");
  });

  it("includes years of experience derived from tahunMulaiBekerja", async () => {
    dbState.push([FIXTURE_PROFILE], []);
    const result = await buildProfileContext(1);
    // Year of experience = current year − 2010; just verify the start year appears
    expect(result).toContain("2010");
    expect(result).toContain("Pengalaman kerja");
  });

  it("includes education details joined correctly", async () => {
    dbState.push([FIXTURE_PROFILE], []);
    const result = await buildProfileContext(1);
    expect(result).toContain("S1");
    expect(result).toContain("Teknik Sipil");
    expect(result).toContain("Universitas Indonesia");
  });

  it("includes SKK number and certifying body", async () => {
    dbState.push([FIXTURE_PROFILE], []);
    const result = await buildProfileContext(1);
    expect(result).toContain("SKK-20240001");
    expect(result).toContain("LPJK");
  });

  it("includes city and province location", async () => {
    dbState.push([FIXTURE_PROFILE], []);
    const result = await buildProfileContext(1);
    expect(result).toContain("Jakarta Selatan");
    expect(result).toContain("DKI Jakarta");
  });

  it("includes APL 02 claim with correct status emoji for 'kompeten'", async () => {
    dbState.push([FIXTURE_PROFILE], [FIXTURE_CLAIM]);
    const result = await buildProfileContext(1);
    expect(result).toContain("✅");
    expect(result).toContain("M.711000.001.01");
    expect(result).toContain("Perencanaan Proyek");
  });

  it("uses ⏳ emoji for 'dalam_proses' claims", async () => {
    dbState.push([FIXTURE_PROFILE], [{ ...FIXTURE_CLAIM, pencapaian: "dalam_proses" }]);
    const result = await buildProfileContext(1);
    expect(result).toContain("⏳");
  });

  it("uses ❌ emoji for 'belum_kompeten' claims", async () => {
    dbState.push([FIXTURE_PROFILE], [{ ...FIXTURE_CLAIM, pencapaian: "belum_kompeten" }]);
    const result = await buildProfileContext(1);
    expect(result).toContain("❌");
  });

  it("shows the claim count in the section header", async () => {
    dbState.push([FIXTURE_PROFILE], [FIXTURE_CLAIM]);
    const result = await buildProfileContext(1);
    expect(result).toContain("1 unit");
  });

  it("caps displayed claims at 8 and shows overflow count", async () => {
    const manyClaims = Array.from({ length: 10 }, (_, i) => ({
      ...FIXTURE_CLAIM,
      skkUnitCode: `M.711000.00${i}.01`,
      skkUnitName: `Unit ${i}`,
    }));
    dbState.push([FIXTURE_PROFILE], manyClaims);
    const result = await buildProfileContext(1);
    // Shows the overflow summary for the 2 extra claims
    expect(result).toContain("dan 2 unit lainnya");
    // The 9th claim's code should NOT appear in the individual list
    expect(result).not.toContain("M.711000.008.01");
  });

  it("omits APL 02 section entirely when there are no claims", async () => {
    dbState.push([FIXTURE_PROFILE], []);
    const result = await buildProfileContext(1);
    expect(result).not.toContain("APL 02");
  });

  it("omits optional fields that are null or undefined", async () => {
    const minimalProfile = { jabatanSekarang: "Teknisi" };
    dbState.push([minimalProfile], []);
    const result = await buildProfileContext(1);
    expect(result).toContain("Teknisi");
    // Fields not present should not produce empty labels
    expect(result).not.toContain("🏢 Perusahaan:");
    expect(result).not.toContain("🎓 Pendidikan:");
  });

  it("truncates output at 1600 chars and appends a truncation marker", async () => {
    const MARKER = "\n…[profil dipotong]";
    // Build a profile where the company name is very long to push past 1600 chars
    const longProfile = { ...FIXTURE_PROFILE, namaPerusahaan: "P".repeat(2000) };
    dbState.push([longProfile], []);
    const result = await buildProfileContext(1);
    expect(result.length).toBeLessThanOrEqual(1600 + MARKER.length);
    expect(result).toMatch(/\[profil dipotong\]$/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildCompetencyAnalysisContext
// ─────────────────────────────────────────────────────────────────────────────

describe("buildCompetencyAnalysisContext", () => {
  it("returns empty string when user has no analyses", async () => {
    dbState.push([]); // query returns no rows
    const result = await buildCompetencyAnalysisContext(1);
    expect(result).toBe("");
  });

  it("includes the jabker name in the output", async () => {
    dbState.push([FIXTURE_ANALYSIS]);
    const result = await buildCompetencyAnalysisContext(1);
    expect(result).toContain("Ahli Muda Teknik Konstruksi");
  });

  it("includes the jenjang and klasifikasi in the output", async () => {
    dbState.push([FIXTURE_ANALYSIS]);
    const result = await buildCompetencyAnalysisContext(1);
    expect(result).toContain("Muda");
    expect(result).toContain("Sipil");
  });

  it("includes the SKPK estimate", async () => {
    dbState.push([FIXTURE_ANALYSIS]);
    const result = await buildCompetencyAnalysisContext(1);
    expect(result).toContain("18/25");
  });

  it("includes the readiness level with emoji for 'cukup'", async () => {
    dbState.push([FIXTURE_ANALYSIS]);
    const result = await buildCompetencyAnalysisContext(1);
    expect(result).toContain("🟡");
    expect(result).toContain("cukup");
  });

  it("uses 🟢 emoji for 'kuat' readiness", async () => {
    dbState.push([{ ...FIXTURE_ANALYSIS, readiness: "kuat" }]);
    const result = await buildCompetencyAnalysisContext(1);
    expect(result).toContain("🟢");
  });

  it("uses 🔴 emoji for 'lemah' readiness", async () => {
    dbState.push([{ ...FIXTURE_ANALYSIS, readiness: "lemah" }]);
    const result = await buildCompetencyAnalysisContext(1);
    expect(result).toContain("🔴");
  });

  it("includes the summary text", async () => {
    dbState.push([FIXTURE_ANALYSIS]);
    const result = await buildCompetencyAnalysisContext(1);
    expect(result).toContain("TKK sudah cukup kompeten namun masih ada beberapa gap.");
  });

  it("includes unit coverage counts (covered / partial / gap)", async () => {
    dbState.push([FIXTURE_ANALYSIS]);
    const result = await buildCompetencyAnalysisContext(1);
    expect(result).toContain("✅ 1 covered");
    expect(result).toContain("⚠️ 1 partial");
    expect(result).toContain("❌ 1 gap");
  });

  it("lists gap strings", async () => {
    dbState.push([FIXTURE_ANALYSIS]);
    const result = await buildCompetencyAnalysisContext(1);
    expect(result).toContain("Gap pertama");
    expect(result).toContain("Gap kedua");
  });

  it("lists recommendation strings", async () => {
    dbState.push([FIXTURE_ANALYSIS]);
    const result = await buildCompetencyAnalysisContext(1);
    expect(result).toContain("Rekomendasi satu");
    expect(result).toContain("Rekomendasi dua");
  });

  it("caps gaps at MAX_GAPS (5) even when result contains more", async () => {
    const manyGaps = Array.from({ length: 10 }, (_, i) => `Gap ${i + 1}`);
    dbState.push([{ ...FIXTURE_ANALYSIS, result: { ...FIXTURE_ANALYSIS.result, gaps: manyGaps } }]);
    const result = await buildCompetencyAnalysisContext(1);
    // Gap 6 and beyond should not appear
    expect(result).toContain("Gap 5");
    expect(result).not.toContain("Gap 6");
  });

  it("caps recommendations at MAX_RECS (3) even when result contains more", async () => {
    const manyRecs = Array.from({ length: 8 }, (_, i) => `Rec ${i + 1}`);
    dbState.push([{ ...FIXTURE_ANALYSIS, result: { ...FIXTURE_ANALYSIS.result, recommendations: manyRecs } }]);
    const result = await buildCompetencyAnalysisContext(1);
    expect(result).toContain("Rec 3");
    expect(result).not.toContain("Rec 4");
  });

  it("handles a null result field without throwing", async () => {
    dbState.push([{ ...FIXTURE_ANALYSIS, result: null }]);
    await expect(buildCompetencyAnalysisContext(1)).resolves.not.toThrow();
  });

  it("truncates output at 2000 chars and appends a truncation marker", async () => {
    // The implementation slices at 2000 chars then appends the marker,
    // so the final length is 2000 + len(marker) — not strictly ≤ 2000.
    const MARKER = "\n…[analisis dipotong]";
    const longSummary = "X".repeat(3000);
    dbState.push([{ ...FIXTURE_ANALYSIS, summary: longSummary }]);
    const result = await buildCompetencyAnalysisContext(1);
    expect(result.length).toBeLessThanOrEqual(2000 + MARKER.length);
    expect(result).toMatch(/\[analisis dipotong\]$/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildHistoricalPKBContext
// ─────────────────────────────────────────────────────────────────────────────

describe("buildHistoricalPKBContext", () => {
  it("returns empty string when user has no past exums and no evidence", async () => {
    dbState.push([], []); // exums query, evidence query
    const result = await buildHistoricalPKBContext(1, 99);
    expect(result).toBe("");
  });

  it("includes the past exum title in the output", async () => {
    dbState.push([FIXTURE_EXUM], []); // past exums, no evidence
    const result = await buildHistoricalPKBContext(1, 99);
    expect(result).toContain("Exum Ahli Muda 2025");
  });

  it("includes the jabker info alongside the exum title", async () => {
    dbState.push([FIXTURE_EXUM], []);
    const result = await buildHistoricalPKBContext(1, 99);
    expect(result).toContain("Ahli Muda Teknik Konstruksi");
    expect(result).toContain("Muda");
  });

  it("includes a teaser of the exum content", async () => {
    dbState.push([FIXTURE_EXUM], []);
    const result = await buildHistoricalPKBContext(1, 99);
    expect(result).toContain("Executive summary pertama");
  });

  it("truncates exum teaser at 600 chars", async () => {
    const longExum = { ...FIXTURE_EXUM, exumContent: "Z".repeat(800) };
    dbState.push([longExum], []);
    const result = await buildHistoricalPKBContext(1, 99);
    // 600 chars of 'Z' should appear but not 601
    expect(result).toContain("Z".repeat(600) + "…");
    expect(result).not.toContain("Z".repeat(601));
  });

  it("includes evidence title from past conversations", async () => {
    dbState.push([], [FIXTURE_EVIDENCE]); // no exums, one evidence item
    const result = await buildHistoricalPKBContext(1, 99);
    expect(result).toContain("Proyek Jembatan Surabaya");
  });

  it("includes the SKK unit code for evidence items", async () => {
    dbState.push([], [FIXTURE_EVIDENCE]);
    const result = await buildHistoricalPKBContext(1, 99);
    expect(result).toContain("M.711000.001.01");
    expect(result).toContain("Perencanaan Teknik");
  });

  it("includes the evidence description", async () => {
    dbState.push([], [FIXTURE_EVIDENCE]);
    const result = await buildHistoricalPKBContext(1, 99);
    expect(result).toContain("Mengelola proyek jembatan");
  });

  it("caps total output at MAX_HISTORICAL_PKB_CHARS and appends a truncation marker", async () => {
    // The implementation slices at MAX_HISTORICAL_PKB_CHARS then appends the
    // marker, so the final length is MAX_HISTORICAL_PKB_CHARS + len(marker)
    // — not strictly ≤ MAX_HISTORICAL_PKB_CHARS.
    const MARKER = "\n…[riwayat terpotong]";
    const bigExum = { ...FIXTURE_EXUM, exumContent: "E".repeat(700) };
    const manyExums = Array.from({ length: 3 }, () => bigExum);
    const manyEvidence = Array.from({ length: 8 }, (_, i) => ({
      ...FIXTURE_EVIDENCE, title: `Evidence ${i}`,
      description: "D".repeat(250),
    }));
    dbState.push(manyExums, manyEvidence);
    const result = await buildHistoricalPKBContext(1, 99);
    expect(result.length).toBeLessThanOrEqual(MAX_HISTORICAL_PKB_CHARS + MARKER.length);
    expect(result).toMatch(/\[riwayat terpotong\]$/);
  });

  it("omits the exum section header when there are no past exums", async () => {
    dbState.push([], [FIXTURE_EVIDENCE]);
    const result = await buildHistoricalPKBContext(1, 99);
    expect(result).not.toContain("EXUM SEBELUMNYA");
  });

  it("omits the evidence section header when there is no past evidence", async () => {
    dbState.push([FIXTURE_EXUM], []);
    const result = await buildHistoricalPKBContext(1, 99);
    expect(result).not.toContain("SERPIHAN DARI SESI SEBELUMNYA");
  });
});
