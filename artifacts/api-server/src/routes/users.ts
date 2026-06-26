import { Router } from "express";
import { db, users, usageEvents } from "@workspace/db";
import { eq, and, count, gte } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { FREE_EXUM_LIFETIME } from "../lib/plans";

const router = Router();

router.get("/users/me", requireAuth, async (req, res) => {
  res.json(req.dbUser);
});

// Current Exum credit balance + free-trial status for the authenticated user.
router.get("/users/me/plan", requireAuth, async (req, res) => {
  const u = req.dbUser!;
  const freeExumRemaining = u.freeExumUsed ? 0 : FREE_EXUM_LIFETIME;
  res.json({
    exumCredits: u.exumCredits,
    freeExumUsed: u.freeExumUsed,
    freeExumRemaining,
    canGenerate: u.exumCredits > 0 || freeExumRemaining > 0,
  });
});

router.patch("/users/me/role", requireAuth, async (req, res) => {
  const { role } = req.body as { role: string };
  const allowed = ["user", "instruktur", "lembaga_diklat"];
  if (!allowed.includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  const [updated] = await db
    .update(users)
    .set({ role })
    .where(eq(users.id, req.dbUser!.id))
    .returning();
  res.json(updated);
});

router.get("/users", requireAuth, requireRole("admin"), async (_req, res) => {
  const all = await db.select().from(users).orderBy(users.createdAt);
  res.json(all);
});

router.patch("/users/:id/role", requireAuth, requireRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  const { role } = req.body as { role: string };
  const allowed = ["user", "instruktur", "lembaga_diklat", "admin"];
  if (!allowed.includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  const [updated] = await db
    .update(users)
    .set({ role })
    .where(eq(users.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(updated);
});

export default router;
