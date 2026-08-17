/**
 * Integration tests: pinned Project Brain entries must always reach the AI
 * context first, even when many newer unpinned entries exist (task #240).
 *
 * Uses the real PostgreSQL database (same DATABASE_URL as dev) so the
 * ORDER BY isPinned DESC, updatedAt DESC + LIMIT 12 behaviour is exercised
 * against actual SQL, not scripted mocks. Without this, pinning could
 * silently become cosmetic: an old pinned entry would be pushed out of the
 * 12-entry cap by newer unpinned ones.
 *
 * Test data is uniquely tagged per run and cleaned up in afterAll.
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { db, users, projectBrain } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUserProjectBrain, buildProjectBrainContext } from "../lib/project-brain.js";

// ── Auth mock — inject the real DB user row without Clerk ─────────────────────
const testUserSlot = vi.hoisted(() => ({
  user: null as null | typeof users.$inferSelect,
}));

vi.mock("../middlewares/auth.js", () => ({
  requireAuth: vi.fn((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!testUserSlot.user) {
      res.status(500).json({ error: "Test setup error: no user in slot" });
      return;
    }
    req.dbUser = testUserSlot.user;
    next();
  }),
  requireRole: vi.fn(
    () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  ),
}));

async function buildApp() {
  const { default: projectBrainRouter } = await import("../routes/project-brain.js");
  const app = express();
  app.use(express.json());
  app.use("/api", projectBrainRouter);
  return app;
}

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const TEST_CLERK_ID = `test-pb-pinned-${RUN_ID}`;
const PINNED_TITLE = `PINNED-OLD-${RUN_ID}`;
const UNPINNED_COUNT = 14; // > MAX_ENTRIES(12), all newer than the pinned entry
const unpinnedTitle = (i: number) => `UNPINNED-${RUN_ID}-${String(i).padStart(2, "0")}`;

let testUserId = 0;

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({ clerkId: TEST_CLERK_ID, name: "PB Pinned Test", email: "pb-pinned@test.example" })
    .returning();
  testUserId = user.id;
  testUserSlot.user = user;

  // One pinned entry updated long ago …
  await db.insert(projectBrain).values({
    userId: testUserId,
    kind: "project",
    title: PINNED_TITLE,
    description: "Entri lama yang disematkan.",
    isPinned: true,
    updatedAt: new Date("2024-01-01T00:00:00Z"),
  });

  // … plus 14 unpinned entries, all with strictly newer updatedAt.
  await db.insert(projectBrain).values(
    Array.from({ length: UNPINNED_COUNT }, (_, i) => ({
      userId: testUserId,
      kind: "project",
      title: unpinnedTitle(i + 1),
      description: `Entri baru #${i + 1}`,
      isPinned: false,
      // Newest = highest index; every one is newer than the pinned entry.
      updatedAt: new Date(Date.UTC(2026, 0, i + 1)),
    })),
  );
});

afterAll(async () => {
  if (testUserId) {
    await db.delete(projectBrain).where(eq(projectBrain.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
  }
});

describe("pinned Project Brain priority (real DB)", () => {
  it("GET /api/project-brain returns pinned entries first regardless of updatedAt", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/project-brain");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(UNPINNED_COUNT + 1);
    // Old pinned entry beats all 14 newer unpinned ones in list ordering.
    expect(res.body[0].title).toBe(PINNED_TITLE);
    expect(res.body[0].isPinned).toBe(true);
    // Remaining entries follow, newest first.
    const rest = res.body.slice(1).map((r: { title: string }) => r.title);
    expect(rest).toEqual(
      Array.from({ length: UNPINNED_COUNT }, (_, i) => unpinnedTitle(UNPINNED_COUNT - i)),
    );
  });

  it("getUserProjectBrain includes the old pinned entry first despite the 12-entry cap", async () => {
    const rows = await getUserProjectBrain(testUserId);
    expect(rows).toHaveLength(12); // MAX_ENTRIES cap
    expect(rows[0].title).toBe(PINNED_TITLE);
    expect(rows[0].isPinned).toBe(true);
    // The tail of the cap drops the OLDEST unpinned entries, not the pinned one.
    const titles = rows.map((r) => r.title);
    expect(titles).not.toContain(unpinnedTitle(1));
    expect(titles).not.toContain(unpinnedTitle(2));
    expect(titles).not.toContain(unpinnedTitle(3));
    expect(titles).toContain(unpinnedTitle(UNPINNED_COUNT));
  });

  it("buildProjectBrainContext renders the pinned entry ahead of newer unpinned ones", async () => {
    const ctx = await buildProjectBrainContext(testUserId);
    expect(ctx).toContain(PINNED_TITLE);
    // Pinned block appears BEFORE the newest unpinned block in the prompt text.
    expect(ctx.indexOf(PINNED_TITLE)).toBeLessThan(ctx.indexOf(unpinnedTitle(UNPINNED_COUNT)));
    // Oldest unpinned entries fell out of the cap; the pinned one did not.
    expect(ctx).not.toContain(unpinnedTitle(1));
  });
});
