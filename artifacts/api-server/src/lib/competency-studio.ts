import type { JabkerGroup } from "./skk-data";
import type { ProjectBrainEntry } from "@workspace/db";
import type { CompetencyAnalysisResult, CompetencyUnitResult } from "@workspace/db";

const KIND_LABELS: Record<string, string> = {
  project: "Proyek",
  role: "Peran/Jabatan",
  achievement: "Pencapaian",
  skill: "Keahlian",
  profile: "Profil",
};

/** Compact rendering of the user's Otak Proyek for the analysis prompt. */
function renderProjectBrain(entries: ProjectBrainEntry[]): string {
  return entries
    .map((e) => {
      const label = KIND_LABELS[e.kind] ?? e.kind;
      const meta = [e.role, e.organization, e.period, e.location].filter(Boolean).join(" · ");
      const hi = e.highlights ? ` | Capaian: ${e.highlights}` : "";
      const skk = e.skkUnitCodes ? ` | SKK terkait: ${e.skkUnitCodes}` : "";
      return `- [${label}] ${e.title}${meta ? ` (${meta})` : ""}: ${e.description ?? ""}${hi}${skk}`;
    })
    .join("\n");
}

/**
 * Build the analysis prompt that maps a TKK's real experience (Otak Proyek)
 * onto the SKK competency units of a target Jabker, and estimates the SKPK an
 * Exum could realistically claim. Output is strict JSON.
 */
export function buildCompetencyPrompt(jabker: JabkerGroup, entries: ProjectBrainEntry[]): string {
  const units = jabker.units
    .map((u) => `- ${u.code} | ${u.name}: ${u.description}`)
    .join("\n");

  return `Anda adalah asesor kompetensi konstruksi senior (Permen PUPR 12/2021 & SK Dirjen Bina Konstruksi 114/2024). Tugas Anda: petakan PENGALAMAN NYATA seorang Tenaga Kerja Konstruksi (TKK) ke UNIT KOMPETENSI SKK untuk jabatan kerja target, lalu perkirakan nilai SKPK yang realistis untuk sebuah Executive Summary (Exum).

JABATAN KERJA TARGET: ${jabker.name}
Jenjang: ${jabker.jenjang} | Klasifikasi: ${jabker.klasifikasi} / ${jabker.subklasifikasi}

UNIT KOMPETENSI SKK (yang harus dinilai SATU PER SATU):
${units}

PENGALAMAN TKK (dari "Otak Proyek"):
${entries.length ? renderProjectBrain(entries) : "(belum ada pengalaman yang direkam)"}

INSTRUKSI PENILAIAN:
1. Untuk SETIAP unit SKK di atas, tentukan status:
   - "covered": ada bukti pengalaman jelas & relevan yang memenuhi unit ini.
   - "partial": ada pengalaman bersinggungan tetapi belum cukup kuat/lengkap.
   - "gap": tidak ada bukti pengalaman yang relevan.
2. Beri rationale singkat (1 kalimat, Bahasa Indonesia) untuk tiap unit, mengacu pengalaman nyata bila ada.
3. evidenceRef: judul entri Otak Proyek yang menjadi dasar (atau null bila gap).
4. estimatedSkpk: perkiraan nilai SKPK untuk Exum, bilangan bulat 0–25 (maksimum satu Exum berkualitas = 25 SKPK). Dasarkan pada proporsi unit covered/partial dan kekuatan bukti.
5. readiness: "kuat" (siap menyusun Exum), "cukup" (perlu sedikit penguatan), atau "lemah" (bukti masih minim).
6. gaps: daftar singkat area/unit yang masih kosong atau lemah.
7. recommendations: 2–4 langkah konkret untuk memperkuat bukti & menaikkan SKPK.

KELUARKAN HANYA JSON VALID (tanpa teks lain, tanpa markdown code fence) dengan bentuk PERSIS:
{
  "summary": "string ringkas kesiapan TKK",
  "estimatedSkpk": 0,
  "readiness": "kuat|cukup|lemah",
  "units": [{ "code": "string", "name": "string", "status": "covered|partial|gap", "rationale": "string", "evidenceRef": "string atau null" }],
  "gaps": ["string"],
  "recommendations": ["string"]
}`;
}

/** Defensively extract a JSON object from an LLM response (handles code fences). */
export function parseCompetencyResult(raw: string, jabker: JabkerGroup): CompetencyAnalysisResult {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Respons AI tidak berisi JSON yang valid");
  }
  const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<CompetencyAnalysisResult>;

  const validStatuses = new Set(["covered", "partial", "gap"]);

  // Index the LLM's results by unit code so we can guarantee every SKK unit of
  // the target Jabker is represented (any omitted by the model defaults to gap).
  const byCode = new Map<string, CompetencyUnitResult>();
  if (Array.isArray(parsed.units)) {
    for (const u of parsed.units) {
      if (!u || typeof (u as any).code !== "string") continue;
      byCode.set(u.code, {
        code: u.code,
        name: typeof u.name === "string" ? u.name : u.code,
        status: validStatuses.has(u.status) ? u.status : "gap",
        rationale: typeof u.rationale === "string" ? u.rationale : "",
        evidenceRef: typeof u.evidenceRef === "string" && u.evidenceRef.trim() ? u.evidenceRef.trim() : null,
      });
    }
  }

  // Authoritative unit list comes from the Jabker definition, in canonical order.
  const units: CompetencyUnitResult[] = jabker.units.map((def) => {
    const got = byCode.get(def.code);
    return {
      code: def.code,
      name: def.name,
      status: got?.status ?? "gap",
      rationale: got?.rationale ?? "Belum ada bukti pengalaman yang relevan.",
      evidenceRef: got?.evidenceRef ?? null,
    };
  });

  const readiness = parsed.readiness === "kuat" || parsed.readiness === "cukup" ? parsed.readiness : "lemah";
  const rawSkpk = Number(parsed.estimatedSkpk);
  const estimatedSkpk = Number.isFinite(rawSkpk) ? Math.max(0, Math.min(25, Math.round(rawSkpk))) : 0;

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    estimatedSkpk,
    readiness,
    units,
    gaps: Array.isArray(parsed.gaps) ? parsed.gaps.filter((g): g is string => typeof g === "string") : [],
    recommendations: Array.isArray(parsed.recommendations)
      ? parsed.recommendations.filter((r): r is string => typeof r === "string")
      : [],
  };
}
