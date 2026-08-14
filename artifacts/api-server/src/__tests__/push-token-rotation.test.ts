/**
 * Integration spec for the full push-token rotation cycle (#145):
 *
 *   1. User has an old token stored.
 *   2. A push is sent → Expo reports DeviceNotRegistered.
 *   3. The server clears the stored token (sendPushNotification helper).
 *   4. The app foregrounds and re-registers via PATCH /users/me/push-token
 *      with a NEW token → the new token is stored with a fresh timestamp.
 *   5. A subsequent push to the new token succeeds → notifications resume.
 *
 * Also covers:
 *   - Idempotent path: the same token submitted twice keeps the token and
 *     refreshes expoPushTokenSetAt both times.
 *   - Race protection: DeviceNotRegistered for the OLD token arriving AFTER
 *     the device already re-registered must NOT wipe the new token.
 *
 * Unlike the unit tests (push-helper.test.ts / push-token-registration.test.ts),
 * this spec uses a STATEFUL in-memory user record so the DB writes from the
 * helper and the route interact with each other, exercising the whole cycle.
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stateful in-memory "users" table (single user, id 7) ─────────────────────
const userRow: {
  id: number;
  expoPushToken: string | null;
  expoPushTokenSetAt: Date | null;
} = { id: 7, expoPushToken: null, expoPushTokenSetAt: null };

// Column sentinels shared by the drizzle-orm mock and the db mock so WHERE
// conditions can be evaluated against the in-memory row.
const USERS_COLS = {
  id: "users.id",
  expoPushToken: "users.expoPushToken",
  expoPushTokenSetAt: "users.expoPushTokenSetAt",
} as const;

type Cond =
  | { kind: "eq"; col: string; val: unknown }
  | { kind: "and"; conds: Cond[] };

function evalCond(cond: Cond): boolean {
  if (cond.kind === "and") return cond.conds.every(evalCond);
  switch (cond.col) {
    case USERS_COLS.id:            return userRow.id === cond.val;
    case USERS_COLS.expoPushToken: return userRow.expoPushToken === cond.val;
    default: return false;
  }
}

vi.mock("drizzle-orm", () => ({
  eq:  vi.fn((col, val): Cond => ({ kind: "eq", col, val })),
  and: vi.fn((...conds: Cond[]): Cond => ({ kind: "and", conds })),
  sql: vi.fn().mockReturnValue({}),
}));

vi.mock("@workspace/db", () => {
  const makeUpdateChain = () => {
    let pendingSet: Record<string, unknown> = {};
    const chain = {
      set: (values: Record<string, unknown>) => {
        pendingSet = values;
        return chain;
      },
      where: (cond: Cond) => {
        if (evalCond(cond)) {
          if ("expoPushToken" in pendingSet) {
            userRow.expoPushToken = pendingSet.expoPushToken as string | null;
          }
          if ("expoPushTokenSetAt" in pendingSet) {
            userRow.expoPushTokenSetAt = pendingSet.expoPushTokenSetAt as Date;
          }
        }
        return chain;
      },
      then: (resolve: (v: unknown) => void) => Promise.resolve(undefined).then(resolve),
      catch: (cb: (e: unknown) => void) => Promise.resolve(undefined).catch(cb),
    };
    return chain;
  };
  return {
    db: { update: vi.fn(() => makeUpdateChain()) },
    users: USERS_COLS,
    payments: {},
    messages: {},
    conversations: {},
    usageEvents: {},
    pool: { query: vi.fn().mockResolvedValue({ rows: [] }) },
  };
});

// ── Auth middleware: reflects the LIVE in-memory row on every request ────────
vi.mock("../middlewares/auth.js", () => ({
  requireAuth: vi.fn((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as any).dbUser = { ...userRow, email: "user@example.com", name: "Test User" };
    (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    next();
  }),
  requireRole: vi.fn(() => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
}));

// ── Expo fetch mock ──────────────────────────────────────────────────────────
const globalFetch = vi.fn();
vi.stubGlobal("fetch", globalFetch);

function expoOk() {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ data: [{ status: "ok" }] }),
  });
}
function expoDeviceNotRegistered() {
  return Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        data: [{ status: "error", details: { error: "DeviceNotRegistered" } }],
      }),
  });
}

function makeLog() {
  return { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

async function buildApp() {
  const { default: usersRouter } = await import("../routes/users.js");
  const app = express();
  app.use(express.json());
  app.use("/api", usersRouter);
  return app;
}

const OLD_TOKEN = "ExponentPushToken[oldExpiredToken1]";
const NEW_TOKEN = "ExponentPushToken[freshRotatedTok2]";
const PAYLOAD = { title: "Hi", body: "There", channelId: "default" };

describe("push token rotation cycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userRow.expoPushToken = OLD_TOKEN;
    userRow.expoPushTokenSetAt = new Date("2026-05-01T00:00:00Z");
  });

  it("full cycle: DeviceNotRegistered clears old token, re-registration stores new token, next push succeeds", async () => {
    const { sendPushNotification } = await import("../lib/push.js");
    const app = await buildApp();

    // Step 1-3: push to the old token → Expo says DeviceNotRegistered → cleared
    globalFetch.mockReturnValueOnce(expoDeviceNotRegistered());
    await sendPushNotification(userRow.id, OLD_TOKEN, PAYLOAD, makeLog() as never);
    expect(userRow.expoPushToken).toBeNull();

    // Step 4: app foregrounds and re-registers with a NEW token
    const res = await request(app)
      .patch("/api/users/me/push-token")
      .send({ token: NEW_TOKEN });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(userRow.expoPushToken).toBe(NEW_TOKEN);
    expect(userRow.expoPushTokenSetAt).toBeInstanceOf(Date);
    expect(userRow.expoPushTokenSetAt!.getTime()).toBeGreaterThan(
      new Date("2026-05-01T00:00:00Z").getTime(),
    );

    // Step 5: a subsequent push to the new token succeeds and leaves it intact
    globalFetch.mockReturnValueOnce(expoOk());
    const log = makeLog();
    await sendPushNotification(userRow.id, NEW_TOKEN, PAYLOAD, log as never);
    expect(userRow.expoPushToken).toBe(NEW_TOKEN);
    expect(log.warn).not.toHaveBeenCalled();

    // Expo was called with the correct recipient each time
    const bodies = globalFetch.mock.calls.map(
      ([, init]) => JSON.parse((init as RequestInit).body as string) as { to: string },
    );
    expect(bodies[0].to).toBe(OLD_TOKEN);
    expect(bodies[1].to).toBe(NEW_TOKEN);
  });

  it("idempotent path: submitting the same token twice keeps it stored and refreshes the timestamp both times", async () => {
    const app = await buildApp();

    const res1 = await request(app)
      .patch("/api/users/me/push-token")
      .send({ token: NEW_TOKEN });
    expect(res1.status).toBe(200);
    expect(userRow.expoPushToken).toBe(NEW_TOKEN);
    const firstSetAt = userRow.expoPushTokenSetAt!;

    // Ensure a measurable clock difference between the two writes
    await new Promise((r) => setTimeout(r, 5));

    const res2 = await request(app)
      .patch("/api/users/me/push-token")
      .send({ token: NEW_TOKEN });
    expect(res2.status).toBe(200);
    expect(userRow.expoPushToken).toBe(NEW_TOKEN);
    // Timestamp must be refreshed (keeps the 90-day cleanup clock alive)
    expect(userRow.expoPushTokenSetAt!.getTime()).toBeGreaterThanOrEqual(
      firstSetAt.getTime(),
    );
    expect(userRow.expoPushTokenSetAt).not.toBe(firstSetAt);
  });

  it("late DeviceNotRegistered for the OLD token does not wipe the freshly registered NEW token", async () => {
    const { sendPushNotification } = await import("../lib/push.js");
    const app = await buildApp();

    // Device re-registers first…
    await request(app).patch("/api/users/me/push-token").send({ token: NEW_TOKEN });
    expect(userRow.expoPushToken).toBe(NEW_TOKEN);

    // …then a stale DeviceNotRegistered ticket arrives for the OLD token.
    globalFetch.mockReturnValueOnce(expoDeviceNotRegistered());
    await sendPushNotification(userRow.id, OLD_TOKEN, PAYLOAD, makeLog() as never);

    // The conditional WHERE (id AND token match) must protect the new token.
    expect(userRow.expoPushToken).toBe(NEW_TOKEN);
  });
});
