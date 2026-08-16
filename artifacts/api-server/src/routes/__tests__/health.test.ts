/**
 * GET /healthz
 *
 * Verifies that `emailConfigured` reflects the presence of the email
 * secrets: true only when BOTH RESEND_API_KEY and RESEND_FROM are set,
 * false when either (or both) are missing.
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import healthRouter from "../health.js";

const ORIGINAL_ENV = { ...process.env };

function makeApp() {
  const app = express();
  app.use("/", healthRouter);
  return app;
}

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("GET /healthz — emailConfigured", () => {
  it("returns emailConfigured: true when both RESEND_API_KEY and RESEND_FROM are set", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM = "Gustafta <no-reply@example.com>";

    const res = await request(makeApp()).get("/healthz");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", emailConfigured: true });
  });

  it("returns emailConfigured: false when both secrets are missing", async () => {
    const res = await request(makeApp()).get("/healthz");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", emailConfigured: false });
  });

  it("returns emailConfigured: false when only RESEND_API_KEY is set", async () => {
    process.env.RESEND_API_KEY = "re_test_key";

    const res = await request(makeApp()).get("/healthz");

    expect(res.status).toBe(200);
    expect(res.body.emailConfigured).toBe(false);
  });

  it("returns emailConfigured: false when only RESEND_FROM is set", async () => {
    process.env.RESEND_FROM = "Gustafta <no-reply@example.com>";

    const res = await request(makeApp()).get("/healthz");

    expect(res.status).toBe(200);
    expect(res.body.emailConfigured).toBe(false);
  });

  it("treats an empty-string RESEND_API_KEY as not configured", async () => {
    process.env.RESEND_API_KEY = "";
    process.env.RESEND_FROM = "Gustafta <no-reply@example.com>";

    const res = await request(makeApp()).get("/healthz");

    expect(res.body.emailConfigured).toBe(false);
  });
});
