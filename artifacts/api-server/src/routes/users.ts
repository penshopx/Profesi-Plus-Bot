import { Router } from "express";
import { db, users, usageEvents, messages, conversations } from "@workspace/db";
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

/**
 * Returns how many chat messages the user has sent in the last hour,
 * plus the limit for their plan, so the frontend can show a usage indicator.
 *
 * Note: counts outbound user messages in the DB (role='user'), which is a faithful
 * proxy for rate-limiter hits. The in-memory limiter resets independently but the
 * delta is negligible for a progress indicator.
 */
router.get("/users/me/usage", requireAuth, async (req, res) => {
  const uid = req.dbUser!.id;
  const isPro = req.dbUser!.plan === "pro" &&
    (!req.dbUser!.planExpiresAt || new Date(req.dbUser!.planExpiresAt) > new Date());
  const limit = isPro ? 120 : 30;

  const windowStart = new Date(Date.now() - 60 * 60 * 1000); // last 1 hour

  // Count user-role messages in conversations owned by this user in the last hour
  const result = await db
    .select({ cnt: count() })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.userId, uid),
        eq(messages.role, "user"),
        gte(messages.createdAt, windowStart),
      ),
    );

  const used = Number(result[0]?.cnt ?? 0);
  const remaining = Math.max(0, limit - used);

  res.json({ used, limit, remaining, windowMs: 60 * 60 * 1000 });
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

// Save the Expo push token for this device so the server can send notifications.
router.post("/users/me/push-token", requireAuth, async (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "token required" });
    return;
  }
  await db.update(users).set({ expoPushToken: token }).where(eq(users.id, req.dbUser!.id));
  res.json({ ok: true });
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
