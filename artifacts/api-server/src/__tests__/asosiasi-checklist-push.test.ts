/**
 * Document-checklist push alerts match the actual verification outcome.
 *
 * POST /asosiasi/submissions/:id/checklist sends a push notification to the
 * activity owner after saving the checklist.  These tests guard that:
 *  - all-clear checklist  → "complete" push  ("Dokumen Lengkap")
 *  - any missing item     → "needs fixes" push ("Dokumen Perlu Perbaikan")
 *  - owner without expoPushToken → NO push attempted
 *  - push payload targets the owner (not the verifier) and carries activityId
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Push helper mock ──────────────────────────────────────────────────────────

const mockSendPush = vi.fn().mockResolvedValue(undefined);

vi.mock("../lib/push.js", () => ({
  sendPushNotification: (...args: unknown[]) => mockSendPush(...args),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────

// db.select() calls resolve in order from this queue.
let selectCallCount = 0;
const selectResponses: unknown[][] = [];

function chainFor(resolveWith: unknown) {
  const c: Record<string, unknown> = {};
  c["then"] = (res: (v: unknown) => void) => Promise.resolve(resolveWith).then(res);
  for (const m of ["from", "where", "limit", "orderBy", "innerJoin", "set", "values", "returning"]) {
    c[m] = vi.fn().mockReturnValue(c);
  }
  return c;
}

vi.mock("@workspace/db", () => {
  // tx used inside db.transaction: checklist existence select + writes
  const tx = {
    select: vi.fn().mockImplementation(() => chainFor([])), // no existing checklist → insert path
    insert: vi.fn().mockImplementation(() => chainFor([])),
    update: vi.fn().mockImplementation(() => chainFor([])),
  };

  const dbMock = {
    select: vi.fn().mockImplementation(() => {
      const idx = selectCallCount++;
      return chainFor(selectResponses[idx] ?? []);
    }),
    insert: vi.fn().mockImplementation(() => chainFor([])),
    update: vi.fn().mockImplementation(() => chainFor([])),
    transaction: vi.fn().mockImplementation(async (cb: (t: typeof tx) => Promise<void>) => cb(tx)),
  };

  return {
    db: dbMock,
    users: { id: "id", name: "name", email: "email", expoPushToken: "expoPushToken" },
    pkbActivities:      { id: "id", userId: "userId", status: "status", updatedAt: "updatedAt" },
    pkbActivitySkk:     { activityId: "activityId" },
    pkbActivityDocs:    { activityId: "activityId" },
    pkbActivityJourney: { activityId: "activityId", createdAt: "createdAt" },
    pkbActivityChecklist: { id: "id", activityId: "activityId" },
  };
});

vi.mock("drizzle-orm", () => ({
  eq:      vi.fn().mockReturnValue({}),
  and:     vi.fn().mockReturnValue({}),
  desc:    vi.fn().mockReturnValue({}),
  inArray: vi.fn().mockReturnValue({}),
  sql:     vi.fn().mockReturnValue({}),
}));

// ── Auth middleware mock — asosiasi verifier ──────────────────────────────────

vi.mock("../middlewares/auth.js", () => ({
  requireAuth: vi.fn((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as any).auth   = { userId: "clerk_verifier" };
    (req as any).dbUser = { id: 7, role: "asosiasi" };
    (req as any).log    = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    next();
  }),
}));

// ── App setup ─────────────────────────────────────────────────────────────────

async function buildApp() {
  const app = express();
  app.use(express.json());
  const { default: asosiasiRouter } = await import("../routes/asosiasi.js");
  app.use("/api", asosiasiRouter);
  return app;
}

const OWNER_ID = 42;
const ACTIVITY_ID = 99;

/**
 * Prime db.select responses in call order for the checklist POST:
 *  1st: activity fetch → { id, status, userId }
 *  2nd: owner fetch    → { id, expoPushToken }
 */
function primeSelects(ownerToken: string | null) {
  selectCallCount = 0;
  selectResponses.length = 0;
  selectResponses.push([{ id: ACTIVITY_ID, status: "diajukan", userId: OWNER_ID }]);
  selectResponses.push([{ id: OWNER_ID, expoPushToken: ownerToken }]);
}

const ALL_CLEAR = { suratUndangan: true, daftarHadir: true, foto: true, penyelenggaraValid: true };
const MISSING_ITEM = { suratUndangan: true, daftarHadir: false, foto: true, penyelenggaraValid: true, catatan: "Daftar hadir belum diunggah" };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/asosiasi/submissions/:id/checklist — push alerts", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("sends a 'complete' push when the checklist is all clear", async () => {
    primeSelects("ExponentPushToken[owner-token]");

    const res = await request(app)
      .post(`/api/asosiasi/submissions/${ACTIVITY_ID}/checklist`)
      .send(ALL_CLEAR);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("diverifikasi");

    expect(mockSendPush).toHaveBeenCalledTimes(1);
    const [userId, token, payload] = mockSendPush.mock.calls[0] as [number, string, { title: string; body: string; data?: Record<string, string> }];
    expect(userId).toBe(OWNER_ID); // owner, not the verifier (id 7)
    expect(token).toBe("ExponentPushToken[owner-token]");
    expect(payload.title).toMatch(/Dokumen Lengkap/);
    expect(payload.body).toMatch(/lengkap/i);
    expect(payload.title).not.toMatch(/Perbaikan/);
    expect(payload.data?.activityId).toBe(String(ACTIVITY_ID));
  });

  it("sends a 'needs fixes' push when any checklist item is missing", async () => {
    primeSelects("ExponentPushToken[owner-token]");

    const res = await request(app)
      .post(`/api/asosiasi/submissions/${ACTIVITY_ID}/checklist`)
      .send(MISSING_ITEM);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ditolak");

    expect(mockSendPush).toHaveBeenCalledTimes(1);
    const [userId, , payload] = mockSendPush.mock.calls[0] as [number, string, { title: string; body: string; data?: Record<string, string> }];
    expect(userId).toBe(OWNER_ID);
    expect(payload.title).toMatch(/Perlu Perbaikan/);
    expect(payload.body).toMatch(/kekurangan/i);
    expect(payload.title).not.toMatch(/Dokumen Lengkap/);
    expect(payload.data?.activityId).toBe(String(ACTIVITY_ID));
  });

  it("attempts no push when the owner has no registered device token", async () => {
    primeSelects(null);

    const res = await request(app)
      .post(`/api/asosiasi/submissions/${ACTIVITY_ID}/checklist`)
      .send(ALL_CLEAR);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("diverifikasi");
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it("attempts no push when the owner row is missing entirely", async () => {
    selectCallCount = 0;
    selectResponses.length = 0;
    selectResponses.push([{ id: ACTIVITY_ID, status: "diajukan", userId: OWNER_ID }]);
    selectResponses.push([]); // owner not found

    const res = await request(app)
      .post(`/api/asosiasi/submissions/${ACTIVITY_ID}/checklist`)
      .send(MISSING_ITEM);

    expect(res.status).toBe(200);
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it("still succeeds (200) when the push helper rejects — push is non-blocking", async () => {
    primeSelects("ExponentPushToken[owner-token]");
    mockSendPush.mockRejectedValueOnce(new Error("expo unreachable"));

    const res = await request(app)
      .post(`/api/asosiasi/submissions/${ACTIVITY_ID}/checklist`)
      .send(ALL_CLEAR);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("diverifikasi");
  });
});
