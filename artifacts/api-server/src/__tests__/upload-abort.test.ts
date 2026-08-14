/**
 * DELETE /storage/uploads/abort — orphan-prevention endpoint
 *
 * When document registration fails terminally after all client retries are
 * exhausted, the client calls this endpoint so the server deletes the already-
 * uploaded GCS object.  Authorization is DB-based and survives restarts:
 *   - objectPath must start with /objects/uploads/{userId}/ (ownership encoded in path)
 *   - objectPath must NOT exist in pkbActivityDocs (guards live registered files)
 *
 * These tests verify:
 *  1. Valid owner + unregistered path → GCS deleted, 200 returned.
 *  2. Missing objectPath body field → 400.
 *  3. objectPath owned by another user → 403.
 *  4. objectPath already registered in DB → 409, GCS not touched.
 *  5. Real GCS deletion error → 500 propagated (not swallowed).
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mock refs ────────────────────────────────────────────────────────────

const { mockDeleteObjectEntityStrict } = vi.hoisted(() => ({
  mockDeleteObjectEntityStrict: vi.fn(),
}));

// ── ObjectStorageService mock ──────────────────────────────────────────────────

vi.mock("../lib/objectStorage.js", () => {
  class MockObjectNotFoundError extends Error {
    constructor() {
      super("Object not found");
      this.name = "ObjectNotFoundError";
      Object.setPrototypeOf(this, MockObjectNotFoundError.prototype);
    }
  }
  class MockObjectStorageService {
    getObjectEntityUploadURL   = vi.fn().mockResolvedValue("https://storage.googleapis.com/bucket/upload-url");
    normalizeObjectEntityPath  = vi.fn((u: string) => u);
    getObjectEntityFile        = vi.fn().mockResolvedValue({});
    getObjectEntityDownloadURL = vi.fn().mockResolvedValue("https://signed.example.com/file");
    downloadObject             = vi.fn();
    searchPublicObject         = vi.fn();
    deleteObjectEntity         = vi.fn().mockResolvedValue(undefined);
    deleteObjectEntityStrict   = mockDeleteObjectEntityStrict;
  }
  return {
    ObjectStorageService: MockObjectStorageService,
    ObjectNotFoundError:  MockObjectNotFoundError,
  };
});

// ── Upload token store mock ────────────────────────────────────────────────────

vi.mock("../lib/uploadTokenStore.js", () => ({
  issueUploadToken:   vi.fn(),
  consumeUploadToken: vi.fn().mockReturnValue(true),
}));

// ── DB mock — select returns configurable rows ─────────────────────────────────

let selectCallCount = 0;
const selectResponses: unknown[][] = [];

vi.mock("@workspace/db", () => {
  function chain(resolveWith: unknown) {
    const c: Record<string, unknown> = {};
    c["then"] = (r: (v: unknown) => void) => Promise.resolve(resolveWith).then(r);
    for (const m of ["from", "where", "limit", "orderBy", "innerJoin", "set", "returning", "values"]) {
      c[m] = vi.fn().mockReturnValue(c);
    }
    return c;
  }
  const dbMock = {
    select: vi.fn().mockImplementation(() => {
      const idx = selectCallCount++;
      const row = selectResponses[idx] ?? [];
      return chain(row);
    }),
    insert: vi.fn().mockReturnValue(chain([])),
    delete: vi.fn().mockReturnValue(chain([])),
    update: vi.fn().mockReturnValue(chain([])),
  };
  return {
    db: dbMock,
    pkbActivities:   { id: "id", userId: "userId", status: "status" },
    pkbActivityDocs: { activityId: "activityId", id: "id", objectPath: "objectPath" },
  };
});

vi.mock("drizzle-orm", () => ({
  eq:      vi.fn().mockReturnValue({}),
  and:     vi.fn().mockReturnValue({}),
  desc:    vi.fn().mockReturnValue({}),
  inArray: vi.fn().mockReturnValue({}),
  sql:     vi.fn().mockReturnValue({}),
}));

// ── Auth middleware ────────────────────────────────────────────────────────────

const authUser = { id: 42, role: "user" };

vi.mock("../middlewares/auth.js", () => ({
  requireAuth: vi.fn((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as any).auth   = { userId: "clerk_user_42" };
    (req as any).dbUser = authUser;
    (req as any).log    = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    next();
  }),
  requireRole: vi.fn(() => (_: express.Request, __: express.Response, n: express.NextFunction) => n()),
}));

// ── App ───────────────────────────────────────────────────────────────────────

async function buildApp() {
  const app = express();
  app.use(express.json());
  const { default: storageRouter } = await import("../routes/storage.js");
  app.use("/", storageRouter);
  return app;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** objectPath that encodes authUser.id=42 as the owner */
const OWNED_PATH    = "/objects/uploads/42/some-uuid.pdf";
/** objectPath that encodes a different user (99) */
const OTHER_PATH    = "/objects/uploads/99/their-file.pdf";

function primeSelectsForUnregistered() {
  selectCallCount = 0;
  selectResponses.length = 0;
  // DB returns no doc row → path is not yet registered
  selectResponses.push([]);
}

function primeSelectsForRegistered() {
  selectCallCount = 0;
  selectResponses.length = 0;
  // DB returns a doc row → path is already registered
  selectResponses.push([{ id: 7 }]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DELETE /storage/uploads/abort", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    selectCallCount = 0;
    selectResponses.length = 0;
    mockDeleteObjectEntityStrict.mockResolvedValue(undefined);
    app = await buildApp();
  });

  it("returns 400 when objectPath body field is missing", async () => {
    const res = await request(app).delete("/storage/uploads/abort").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/objectPath/i);
    expect(mockDeleteObjectEntityStrict).not.toHaveBeenCalled();
  });

  it("returns 403 when objectPath belongs to a different user", async () => {
    const res = await request(app)
      .delete("/storage/uploads/abort")
      .send({ objectPath: OTHER_PATH });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/tidak diizinkan/i);
    expect(mockDeleteObjectEntityStrict).not.toHaveBeenCalled();
  });

  it("returns 409 when objectPath is already registered in pkbActivityDocs", async () => {
    primeSelectsForRegistered();

    const res = await request(app)
      .delete("/storage/uploads/abort")
      .send({ objectPath: OWNED_PATH });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/sudah terdaftar/i);
    // GCS must not be touched when the file is registered
    expect(mockDeleteObjectEntityStrict).not.toHaveBeenCalled();
  });

  it("deletes the GCS object and returns 200 for a valid unregistered upload", async () => {
    primeSelectsForUnregistered();

    const res = await request(app)
      .delete("/storage/uploads/abort")
      .send({ objectPath: OWNED_PATH });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockDeleteObjectEntityStrict).toHaveBeenCalledWith(OWNED_PATH);
  });

  it("returns 500 when the GCS deletion throws (errors are observable, not swallowed)", async () => {
    primeSelectsForUnregistered();
    mockDeleteObjectEntityStrict.mockRejectedValueOnce(new Error("GCS network error"));

    const res = await request(app)
      .delete("/storage/uploads/abort")
      .send({ objectPath: OWNED_PATH });

    // The endpoint MUST surface the GCS error so ops can investigate — not return
    // 200 and pretend the orphan was cleaned up.
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/gagal menghapus/i);
  });

  it("returns 200 when the objectPath no longer exists in GCS (already deleted elsewhere)", async () => {
    primeSelectsForUnregistered();
    // ObjectNotFoundError from deleteObjectEntityStrict = file already gone = success
    mockDeleteObjectEntityStrict.mockResolvedValueOnce(undefined); // strict treats NotFound as success

    const res = await request(app)
      .delete("/storage/uploads/abort")
      .send({ objectPath: OWNED_PATH });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
