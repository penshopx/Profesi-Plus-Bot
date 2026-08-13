import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { db, projectBrain, PROJECT_BRAIN_KINDS } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const VALID_KINDS = new Set<string>(PROJECT_BRAIN_KINDS);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Load an entry only if it belongs to the authenticated user; 404 otherwise. */
async function loadOwned(req: Request, res: Response, id: number) {
  const rows = await db
    .select()
    .from(projectBrain)
    .where(and(eq(projectBrain.id, id), eq(projectBrain.userId, req.dbUser!.id)))
    .limit(1);
  if (!rows[0]) {
    res.status(404).json({ error: "Entry not found" });
    return null;
  }
  return rows[0];
}

// ── List own entries ───────────────────────────────────────────────────────────
router.get("/project-brain", requireAuth, async (req, res) => {
  const rows = await db
    .select()
    .from(projectBrain)
    .where(eq(projectBrain.userId, req.dbUser!.id))
    .orderBy(desc(projectBrain.isPinned), desc(projectBrain.updatedAt));
  res.json(rows);
});

// ── Create ─────────────────────────────────────────────────────────────────────
router.post("/project-brain", requireAuth, async (req, res) => {
  const b = req.body as Record<string, unknown>;
  if (typeof b.title !== "string" || !b.title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const kind = typeof b.kind === "string" && VALID_KINDS.has(b.kind) ? b.kind : "project";

  const [entry] = await db
    .insert(projectBrain)
    .values({
      userId: req.dbUser!.id,
      kind,
      title: b.title.trim(),
      organization: str(b.organization),
      role: str(b.role),
      period: str(b.period),
      location: str(b.location),
      description: typeof b.description === "string" ? b.description.trim() : "",
      skkUnitCodes: str(b.skkUnitCodes),
      jenjang: str(b.jenjang),
      highlights: str(b.highlights),
      isActive: typeof b.isActive === "boolean" ? b.isActive : true,
    })
    .returning();

  res.status(201).json(entry);
});

// ── Update (owner only) ─────────────────────────────────────────────────────────
router.patch("/project-brain/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const existing = await loadOwned(req, res, id);
  if (!existing) return;

  const b = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof b.kind === "string" && VALID_KINDS.has(b.kind)) patch.kind = b.kind;
  if (typeof b.title === "string" && b.title.trim()) patch.title = b.title.trim();
  if ("organization" in b) patch.organization = str(b.organization);
  if ("role" in b) patch.role = str(b.role);
  if ("period" in b) patch.period = str(b.period);
  if ("location" in b) patch.location = str(b.location);
  if (typeof b.description === "string") patch.description = b.description.trim();
  if ("skkUnitCodes" in b) patch.skkUnitCodes = str(b.skkUnitCodes);
  if ("jenjang" in b) patch.jenjang = str(b.jenjang);
  if ("highlights" in b) patch.highlights = str(b.highlights);
  if (typeof b.isActive === "boolean") patch.isActive = b.isActive;
  if (typeof b.isPinned === "boolean") patch.isPinned = b.isPinned;

  const [updated] = await db
    .update(projectBrain)
    .set(patch)
    .where(and(eq(projectBrain.id, id), eq(projectBrain.userId, req.dbUser!.id)))
    .returning();
  res.json(updated);
});

// ── Delete (owner only) ─────────────────────────────────────────────────────────
router.delete("/project-brain/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const existing = await loadOwned(req, res, id);
  if (!existing) return;
  await db
    .delete(projectBrain)
    .where(and(eq(projectBrain.id, id), eq(projectBrain.userId, req.dbUser!.id)));
  res.json({ success: true });
});

export default router;
