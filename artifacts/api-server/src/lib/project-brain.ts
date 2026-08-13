import { db, projectBrain, type ProjectBrainEntry } from "@workspace/db";
import { and, eq, desc, inArray } from "drizzle-orm";

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
 *
 * IMPORTANT – no caching: this function intentionally queries the database on
 * every call so that entries deleted (or deactivated) by the user are excluded
 * from the AI context in subsequent chat requests immediately, without any
 * cache invalidation step. Do not add an in-memory or Redis cache here unless
 * you also hook into the delete/deactivate paths to purge it.
 */
export async function getUserProjectBrain(userId: number): Promise<ProjectBrainEntry[]> {
  return db
    .select()
    .from(projectBrain)
    .where(and(eq(projectBrain.userId, userId), eq(projectBrain.isActive, true)))
    .orderBy(desc(projectBrain.isPinned), desc(projectBrain.updatedAt))
    .limit(MAX_ENTRIES);
}

/**
 * Compact career-memory block for prompt injection. Lets the AI reuse a user's
 * real projects/roles across conversations so interviews stay personal and the
 * Exum is grounded in their actual track record. Empty-safe.
 */
export interface ProjectBrainContextMeta {
  text: string;
  /** Per-entry rendered blocks, used to detect which entries survive the shared prompt budget. */
  blocks: { id: number; block: string }[];
}

export async function buildProjectBrainContext(userId: number): Promise<string> {
  return (await buildProjectBrainContextWithMeta(userId)).text;
}

export async function buildProjectBrainContextWithMeta(userId: number): Promise<ProjectBrainContextMeta> {
  const rows = await getUserProjectBrain(userId);
  if (!rows.length) return { text: "", blocks: [] };

  const lines: string[] = [
    "\n\n=== OTAK PROYEK (MEMORI KARIER TKK INI) ===",
    "Rekam jejak yang sudah dikumpulkan TKK lintas sesi. ACU data ini agar wawancara personal & konsisten — JANGAN tanya ulang hal yang sudah jelas di sini:",
  ];

  let budget = MAX_TOTAL_CHARS;
  const blocks: { id: number; block: string }[] = [];
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
    blocks.push({ id: r.id, block });
    budget -= block.length;
  }

  return { text: lines.join("\n"), blocks };
}

/**
 * Marks entries whose rendered block survived the shared context budget as
 * "read by the AI" (lastUsedAt). Call AFTER applySharedContextBudget with the
 * final combined context so trimmed/dropped entries are not falsely marked.
 * Fire-and-forget: a failure here must never block or degrade the chat request.
 */
export function markProjectBrainUsed(meta: ProjectBrainContextMeta, finalContext: string): void {
  // Ordered scan with a moving cursor: each rendered block may only match one
  // occurrence in the final context, so duplicate-looking entries are not all
  // marked when only one copy survived the budget.
  const usedIds: number[] = [];
  let cursor = 0;
  for (const b of meta.blocks) {
    const at = finalContext.indexOf(b.block, cursor);
    if (at === -1) break; // budget trims tail-first; once a block is gone, the rest are too
    usedIds.push(b.id);
    cursor = at + b.block.length;
  }
  if (!usedIds.length) return;
  void (async () => {
    await db
      .update(projectBrain)
      .set({ lastUsedAt: new Date() })
      .where(inArray(projectBrain.id, usedIds));
  })().catch((err: unknown) => {
    console.error("project-brain lastUsedAt update failed", err);
  });
}
