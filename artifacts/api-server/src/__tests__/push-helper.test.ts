/**
 * Tests for the shared sendPushNotification helper (src/lib/push.ts).
 *
 * Covers:
 *  - Happy path: successful Expo ticket leaves token untouched in DB
 *  - DeviceNotRegistered: clears token only for the matching (userId, token) pair
 *  - Race protection: does NOT clear when the stored token has changed
 *  - Log redaction: raw token never appears in warning logs
 *  - HTTP error from Expo: logs a warning, does not throw, does not touch DB
 *  - Network failure (fetch throws): logs a warning, does not throw
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── DB mock ──────────────────────────────────────────────────────────────────

const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();

vi.mock("@workspace/db", () => {
  const chain = {
    set:   (...args: unknown[]) => { mockSet(...args); return chain; },
    where: (...args: unknown[]) => { mockWhere(...args); return chain; },
    then:  (resolve: (v: unknown) => void) => Promise.resolve(undefined).then(resolve),
    catch: (cb: (e: unknown) => void) => Promise.resolve(undefined).catch(cb),
  };
  return {
    db: {
      update: (...args: unknown[]) => { mockUpdate(...args); return chain; },
    },
    users: {
      id:            "id",
      expoPushToken: "expoPushToken",
    },
  };
});

vi.mock("drizzle-orm", () => ({
  eq:  vi.fn((_col, val) => ({ col: _col, val })),
  and: vi.fn((...args) => ({ and: args })),
}));

// ─── fetch mock ───────────────────────────────────────────────────────────────

const globalFetch = vi.fn();
vi.stubGlobal("fetch", globalFetch);

// ─── Logger mock ──────────────────────────────────────────────────────────────

function makeLog() {
  return {
    warn:  vi.fn(),
    info:  vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function expoResponse(tickets: unknown[]) {
  return Promise.resolve({
    ok:   true,
    json: () => Promise.resolve({ data: tickets }),
  });
}

function expoHttpError(status: number) {
  return Promise.resolve({ ok: false, status });
}

const TOKEN = "ExponentPushToken[abcdefghijklmnop]";
const USER_ID = 42;
const PAYLOAD = { title: "Test", body: "Hello", channelId: "default" };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("sendPushNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not touch the DB on a successful ticket", async () => {
    globalFetch.mockReturnValueOnce(expoResponse([{ status: "ok" }]));

    const { sendPushNotification } = await import("../lib/push.js");
    const log = makeLog();
    await sendPushNotification(USER_ID, TOKEN, PAYLOAD, log as never);

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("clears the token in the DB on DeviceNotRegistered", async () => {
    globalFetch.mockReturnValueOnce(
      expoResponse([{ status: "error", details: { error: "DeviceNotRegistered" } }]),
    );

    const { sendPushNotification } = await import("../lib/push.js");
    const log = makeLog();
    await sendPushNotification(USER_ID, TOKEN, PAYLOAD, log as never);

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    // set({ expoPushToken: null })
    expect(mockSet).toHaveBeenCalledWith({ expoPushToken: null });
    // where includes both userId and token guards
    expect(mockWhere).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledTimes(1);
  });

  it("logs only a suffix of the token, not the full bearer credential", async () => {
    globalFetch.mockReturnValueOnce(
      expoResponse([{ status: "error", details: { error: "DeviceNotRegistered" } }]),
    );

    const { sendPushNotification } = await import("../lib/push.js");
    const log = makeLog();
    await sendPushNotification(USER_ID, TOKEN, PAYLOAD, log as never);

    const [logArg] = log.warn.mock.calls[0] as [Record<string, unknown>];
    // Full token must NOT appear in the logged object
    expect(JSON.stringify(logArg)).not.toContain(TOKEN);
    // A suffix fingerprint must be present instead
    expect(logArg).toHaveProperty("pushTokenSuffix");
    expect(logArg.pushTokenSuffix).toBe(TOKEN.slice(-8));
  });

  it("does not clear the DB when the ticket is a different error type", async () => {
    globalFetch.mockReturnValueOnce(
      expoResponse([{ status: "error", details: { error: "MessageRateExceeded" } }]),
    );

    const { sendPushNotification } = await import("../lib/push.js");
    const log = makeLog();
    await sendPushNotification(USER_ID, TOKEN, PAYLOAD, log as never);

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("WHERE clause includes both userId and token — race protection", async () => {
    globalFetch.mockReturnValueOnce(
      expoResponse([{ status: "error", details: { error: "DeviceNotRegistered" } }]),
    );
    const { eq, and } = await import("drizzle-orm");

    const { sendPushNotification } = await import("../lib/push.js");
    const log = makeLog();
    await sendPushNotification(USER_ID, TOKEN, PAYLOAD, log as never);

    // eq should have been called with the token value (race-protection guard)
    const eqCalls = (eq as ReturnType<typeof vi.fn>).mock.calls as [string, unknown][];
    const tokenEqCall = eqCalls.find(([, val]) => val === TOKEN);
    expect(tokenEqCall).toBeDefined();

    // eq should have been called with the userId value
    const userIdEqCall = eqCalls.find(([, val]) => val === USER_ID);
    expect(userIdEqCall).toBeDefined();

    // and() must combine both conditions
    expect(and).toHaveBeenCalled();
  });

  it("logs an HTTP error from Expo and does not touch DB", async () => {
    globalFetch.mockReturnValueOnce(expoHttpError(429));

    const { sendPushNotification } = await import("../lib/push.js");
    const log = makeLog();
    await sendPushNotification(USER_ID, TOKEN, PAYLOAD, log as never);

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 429 }),
      expect.any(String),
    );
  });

  it("does not throw and does not leak the token when fetch itself throws", async () => {
    globalFetch.mockRejectedValueOnce(new Error("Network failure"));

    const { sendPushNotification } = await import("../lib/push.js");
    const log = makeLog();
    await expect(
      sendPushNotification(USER_ID, TOKEN, PAYLOAD, log as never),
    ).resolves.toBeUndefined();

    expect(log.warn).toHaveBeenCalledTimes(1);
    // The raw token must not appear in the catch-block log either
    const warnArgs = log.warn.mock.calls[0] as unknown[];
    expect(JSON.stringify(warnArgs)).not.toContain(TOKEN);
  });
});
