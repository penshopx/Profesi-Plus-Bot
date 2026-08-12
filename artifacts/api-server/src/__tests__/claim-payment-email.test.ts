/**
 * Unit tests: credit-claim email behaviour
 *
 * Verifies that:
 * - sendEmail dispatches a Resend API call when RESEND_API_KEY + RESEND_FROM are set
 * - sendEmail is skipped (no fetch) when RESEND_API_KEY is absent in dev
 * - sendEmail logs WARN when RESEND_API_KEY is absent in production
 * - sendEmail logs WARN and skips when RESEND_FROM is absent (prevents sandbox delivery)
 * - A non-2xx Resend response is logged as a warning (not thrown)
 * - A network error is logged as a warning (not thrown)
 * - sendCreditClaimEmail passes orderId / creditsGranted / newBalance through
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Logger mock (hoisted) ─────────────────────────────────────────────────────
// vi.mock factories are hoisted to the top of the file. Any variables they
// reference must also be hoisted via vi.hoisted() so they exist at that point.
const mockLogger = vi.hoisted(() => ({
  info:  vi.fn(),
  debug: vi.fn(),
  warn:  vi.fn(),
  error: vi.fn(),
}));

vi.mock("../lib/logger.js", () => ({ logger: mockLogger }));

// ── Import the module under test once (process.env is read at call time) ──────
import { sendEmail, sendCreditClaimEmail } from "../lib/email.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFetchMock(status = 200, body = '{"id":"abc"}') {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
  });
}

/** Flush micro-task queue so fire-and-forget promises resolve. */
const flush = () => new Promise<void>((r) => setTimeout(r, 20));

const SENDER = "Gustafta <no-reply@gustafta.app>";

describe("sendEmail", () => {
  let originalFetch: typeof global.fetch;
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalFetch = global.fetch;
    savedEnv = {
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      RESEND_FROM:    process.env.RESEND_FROM,
      NODE_ENV:       process.env.NODE_ENV,
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Object.entries(savedEnv).forEach(([k, v]) => {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    });
  });

  it("calls the Resend API with correct headers when RESEND_API_KEY and RESEND_FROM are both set", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM    = SENDER;

    const fetchMock = makeFetchMock(200);
    global.fetch = fetchMock;

    sendEmail({ to: "user@example.com", subject: "Test", text: "Hello" });
    await flush();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const payload = JSON.parse(init.body as string);
    expect(payload.from).toBe(SENDER);
    expect(payload.to).toContain("user@example.com");
    expect(payload.subject).toBe("Test");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer re_test_key");
  });

  it("does NOT call fetch when RESEND_API_KEY is absent in development", async () => {
    delete process.env.RESEND_API_KEY;
    process.env.NODE_ENV = "development";

    const fetchMock = makeFetchMock();
    global.fetch = fetchMock;

    sendEmail({ to: "user@example.com", subject: "Test", text: "Hello" });
    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs WARN (not debug) when RESEND_API_KEY is absent in production", async () => {
    delete process.env.RESEND_API_KEY;
    process.env.NODE_ENV = "production";

    const fetchMock = makeFetchMock();
    global.fetch = fetchMock;

    sendEmail({ to: "user@example.com", subject: "Test", text: "Hello" });
    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledOnce();
    expect(mockLogger.debug).not.toHaveBeenCalled();
  });

  it("logs WARN and skips fetch when RESEND_FROM is absent (prevents sandbox delivery)", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    delete process.env.RESEND_FROM;

    const fetchMock = makeFetchMock();
    global.fetch = fetchMock;

    sendEmail({ to: "user@example.com", subject: "Test", text: "Hello" });
    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledOnce();
  });

  it("logs a warning when the Resend API returns a non-2xx status", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM    = SENDER;
    process.env.NODE_ENV       = "development";

    global.fetch = makeFetchMock(422, '{"message":"Invalid email"}');

    sendEmail({ to: "bad-address", subject: "Test", text: "Hello" });
    await flush();

    expect(mockLogger.warn).toHaveBeenCalledOnce();
  });

  it("logs a warning when fetch throws (network error)", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM    = SENDER;
    process.env.NODE_ENV       = "development";

    global.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));

    sendEmail({ to: "user@example.com", subject: "Test", text: "Hello" });
    await flush();

    expect(mockLogger.warn).toHaveBeenCalledOnce();
  });
});

describe("sendCreditClaimEmail", () => {
  let originalFetch: typeof global.fetch;
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalFetch = global.fetch;
    savedEnv = {
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      RESEND_FROM:    process.env.RESEND_FROM,
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Object.entries(savedEnv).forEach(([k, v]) => {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    });
  });

  it("includes orderId, creditsGranted and newBalance in both text and HTML parts", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM    = SENDER;

    const fetchMock = makeFetchMock(200);
    global.fetch = fetchMock;

    sendCreditClaimEmail({
      to:             "budi@example.com",
      orderId:        "ORD-999",
      creditsGranted: 5,
      newBalance:     12,
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledOnce();
    const payload = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(payload.text).toContain("ORD-999");
    expect(payload.text).toContain("5 kredit");
    expect(payload.text).toContain("12 kredit");
    expect(payload.html).toContain("ORD-999");
    expect(payload.html).toContain("+5 kredit");
    expect(payload.html).toContain("12 kredit");
    expect(payload.to).toContain("budi@example.com");
  });
});
