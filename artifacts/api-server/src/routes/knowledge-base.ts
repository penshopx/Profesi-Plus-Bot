import { Router, type IRouter } from "express";
import { db, knowledgeBase, KB_CATEGORIES } from "@workspace/db";
import { and, eq, or, ilike, desc, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { KB_SEED } from "../lib/knowledge-base-seed";

const router: IRouter = Router();

const VALID_CATEGORIES = new Set<string>(KB_CATEGORIES);

// ── List / search (any authenticated staff role can read) ──────────────────────
router.get("/knowledge-base", requireAuth, requireRole("instruktur", "lembaga_diklat", "admin"), async (req, res) => {
  const { q, category } = req.query as Record<string, string>;
  const conditions = [];
  if (category && VALID_CATEGORIES.has(category)) conditions.push(eq(knowledgeBase.category, category));
  if (q) conditions.push(
    or(
      ilike(knowledgeBase.title, `%${q}%`),
      ilike(knowledgeBase.content, `%${q}%`),
      ilike(knowledgeBase.tags, `%${q}%`),
    ),
  );

  const rows = conditions.length
    ? await db.select().from(knowledgeBase).where(and(...conditions)).orderBy(desc(knowledgeBase.priority), desc(knowledgeBase.updatedAt))
    : await db.select().from(knowledgeBase).orderBy(desc(knowledgeBase.priority), desc(knowledgeBase.updatedAt));

  res.json(rows);
});

// ── Create (admin only) ────────────────────────────────────────────────────────
router.post("/knowledge-base", requireAuth, requireRole("admin"), async (req, res) => {
  const { category, title, content, klasifikasi, jenjang, skkUnitCode, tags, source, priority, isActive } = req.body as Record<string, unknown>;

  if (typeof title !== "string" || !title.trim() || typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "title and content are required" });
    return;
  }
  const cat = typeof category === "string" && VALID_CATEGORIES.has(category) ? category : "umum";

  const [entry] = await db.insert(knowledgeBase).values({
    category: cat,
    title: title.trim(),
    content: content.trim(),
    klasifikasi: typeof klasifikasi === "string" && klasifikasi.trim() ? klasifikasi.trim() : null,
    jenjang: typeof jenjang === "string" && jenjang.trim() ? jenjang.trim() : null,
    skkUnitCode: typeof skkUnitCode === "string" && skkUnitCode.trim() ? skkUnitCode.trim() : null,
    tags: typeof tags === "string" && tags.trim() ? tags.trim() : null,
    source: typeof source === "string" && source.trim() ? source.trim() : null,
    priority: typeof priority === "number" ? priority : 0,
    isActive: typeof isActive === "boolean" ? isActive : true,
    createdBy: req.dbUser!.id,
  }).returning();

  res.status(201).json(entry);
});

// ── Update (admin only) ────────────────────────────────────────────────────────
router.patch("/knowledge-base/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const existing = await db.select().from(knowledgeBase).where(eq(knowledgeBase.id, id)).limit(1);
  if (!existing[0]) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  const b = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof b.category === "string" && VALID_CATEGORIES.has(b.category)) patch.category = b.category;
  if (typeof b.title === "string" && b.title.trim()) patch.title = b.title.trim();
  if (typeof b.content === "string" && b.content.trim()) patch.content = b.content.trim();
  if ("klasifikasi" in b) patch.klasifikasi = typeof b.klasifikasi === "string" && b.klasifikasi.trim() ? b.klasifikasi.trim() : null;
  if ("jenjang" in b) patch.jenjang = typeof b.jenjang === "string" && b.jenjang.trim() ? b.jenjang.trim() : null;
  if ("skkUnitCode" in b) patch.skkUnitCode = typeof b.skkUnitCode === "string" && b.skkUnitCode.trim() ? b.skkUnitCode.trim() : null;
  if ("tags" in b) patch.tags = typeof b.tags === "string" && b.tags.trim() ? b.tags.trim() : null;
  if ("source" in b) patch.source = typeof b.source === "string" && b.source.trim() ? b.source.trim() : null;
  if (typeof b.priority === "number") patch.priority = b.priority;
  if (typeof b.isActive === "boolean") patch.isActive = b.isActive;

  const [updated] = await db.update(knowledgeBase).set(patch).where(eq(knowledgeBase.id, id)).returning();
  res.json(updated);
});

// ── Delete (admin only) ────────────────────────────────────────────────────────
router.delete("/knowledge-base/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const existing = await db.select().from(knowledgeBase).where(eq(knowledgeBase.id, id)).limit(1);
  if (!existing[0]) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }
  await db.delete(knowledgeBase).where(eq(knowledgeBase.id, id));
  res.json({ success: true });
});

// ── Seed default entries (admin only, idempotent by seedKey) ───────────────────
router.post("/knowledge-base/seed", requireAuth, requireRole("admin"), async (req, res) => {
  const keys = KB_SEED.map((s) => s.seedKey);
  const existing = await db
    .select({ seedKey: knowledgeBase.seedKey })
    .from(knowledgeBase)
    .where(inArray(knowledgeBase.seedKey, keys));
  const existingKeys = new Set(existing.map((e: { seedKey: string | null }) => e.seedKey));

  const toInsert = KB_SEED.filter((s) => !existingKeys.has(s.seedKey)).map((s) => ({
    ...s,
    createdBy: req.dbUser!.id,
  }));

  if (toInsert.length) {
    await db.insert(knowledgeBase).values(toInsert);
  }
  res.json({ inserted: toInsert.length, skipped: KB_SEED.length - toInsert.length });
});

export default router;
