import { db, projectBrain, type ProjectBrainEntry } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";

const MAX_ENTRIES = 12;
const MAX_DESC_CHARS = 320;
const MAX_TOTAL_CHARS = 2800;

const KIND_LABELS: Record<string, string> = {
  project: "Proyek",
  role: "Peran/Jabatan",
  achievement: "Pencapaian",
  skill: "Keahlian",
  profile: "Profil",
};

/**
 * Active project-brain entries for a user, newest first. Capped so prompt
 * injection stays bounded.
 */
export async function getUserProjectBrain(userId: number): Promise<ProjectBrainEntry[]> {
  return db
    .select()
    .from(projectBrain)
    .where(and(eq(projectBrain.userId, userId), eq(projectBrain.isActive, true)))
    .orderBy(desc(projectBrain.updatedAt))
    .limit(MAX_ENTRIES);
}

/**
 * Compact career-memory block for prompt injection. Lets the AI reuse a user's
 * real projects/roles across conversations so interviews stay personal and the
 * Exum is grounded in their actual track record. Empty-safe.
 */
export async function buildProjectBrainContext(userId: number): Promise<string> {
  const rows = await getUserProjectBrain(userId);
  if (!rows.length) return "";

  const lines: string[] = [
    "\n\n=== OTAK PROYEK (MEMORI KARIER TKK INI) ===",
    "Rekam jejak yang sudah dikumpulkan TKK lintas sesi. ACU data ini agar wawancara personal & konsisten — JANGAN tanya ulang hal yang sudah jelas di sini:",
  ];

  let budget = MAX_TOTAL_CHARS;
  for (const r of rows) {
    if (budget <= 0) break;
    const label = KIND_LABELS[r.kind] ?? r.kind;
    const meta = [r.role, r.organization, r.period, r.location].filter(Boolean).join(" · ");
    const rawDesc = r.description ?? "";
    const desc = rawDesc.length > MAX_DESC_CHARS ? `${rawDesc.slice(0, MAX_DESC_CHARS)}…` : rawDesc;
    const skk = r.skkUnitCodes ? ` [SKK terkait: ${r.skkUnitCodes}]` : "";
    const hi = r.highlights ? `\n  Capaian kunci: ${r.highlights}` : "";
    const block = `\n[${label}] ${r.title}${meta ? ` — ${meta}` : ""}${desc ? `\n  ${desc}` : ""}${hi}${skk}`;
    lines.push(block);
    budget -= block.length;
  }

  return lines.join("\n");
}
