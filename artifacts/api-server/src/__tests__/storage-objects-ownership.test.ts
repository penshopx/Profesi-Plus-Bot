/**
 * GET /storage/objects/*
 *
 * Verifies the ownership gate that was added in task #47:
 * - User B receives 403 when requesting a PKB document registered to User A.
 * - User A (owner) can download their own document.
 * - An admin can bypass the ownership check and download any document.
 * - Objects not registered in pkbActivityDocs (e.g. voice notes) are served
 *   to any authenticated user (ownership gate does not apply).
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mock refs ────────────────────────────────────────────────────────────

const { mockGetObjectEntityFile, mockDownloadObject } = vi.hoisted(() => ({
  mockGetObjectEntityFile: vi.fn(),
  mockDownloadObject:      vi.fn(),
}));

// ── DB mock ────────────────────────────────────────────────────────────────────

let selectCallCount = 0;
const selectResponses: unknown[][] = [];

vi.mock("@workspace/db", () => {
  function chainFor(resolveWith: unknown) {
    const c: Record<string, unknown> = {};
    c["then"] = (res: (v: unknown) => void) => Promise.resolve(resolveWith).then(res);
    for (const m of ["from", "where", "limit", "orderBy", "innerJoin", "set", "returning", "values"]) {
      c[m] = vi.fn().mockReturnValue(c);
    }
    return c;
  }

  const dbMock = {
    select: vi.fn().mockImplementation(() => {
      const idx = selectCallCount++;
      const row = selectResponses[idx] ?? [];
      return chainFor(row);
    }),
    insert: vi.fn().mockReturnValue(chainFor([])),
    delete: vi.fn().mockReturnValue(chainFor([])),
    update: vi.fn().mockReturnValue(chainFor([])),
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
    getObjectEntityFile        = mockGetObjectEntityFile;
    getObjectEntityDownloadURL = vi.fn();
    downloadObject             = mockDownloadObject;
    searchPublicObject         = vi.fn();
  }

  return {
    ObjectStorageService:  MockObjectStorageService,
    ObjectNotFoundError:   MockObjectNotFoundError,
  };
});

vi.mock("../lib/uploadTokenStore.js", () => ({
  issueUploadToken:   vi.fn(),
  consumeUploadToken: vi.fn().mockReturnValue(true),
}));

// ── Auth middleware ────────────────────────────────────────────────────────────

let authUser: { id: number; role: string } = { id: 42, role: "user" };

vi.mock("../middlewares/auth.js", () => ({
  requireAuth: vi.fn((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as any).auth   = { userId: `clerk_user_${authUser.id}` };
    (req as any).dbUser = authUser;
    (req as any).log    = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    next();
  }),
  requireRole: vi.fn(() => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
}));

// ── App ───────────────────────────────────────────────────────────────────────

async function buildApp() {
  const app = express();
  app.use(express.json());
  const { default: storageRouter } = await import("../routes/storage.js");
  app.use("/", storageRouter);
  return app;
}

/** Stub a successful object download (empty body, 200). */
function stubSuccessfulDownload() {
  mockGetObjectEntityFile.mockResolvedValue({ path: "/objects/uploads/42/myfile.pdf" });
  mockDownloadObject.mockResolvedValue({
    status: 200,
    headers: new Headers({ "content-type": "application/pdf" }),
    body: null,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /storage/objects/* — ownership gate", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    selectCallCount = 0;
    selectResponses.length = 0;
    authUser = { id: 42, role: "user" };
    app = await buildApp();
  });

  // ── Cross-user access ────────────────────────────────────────────────────────

  it("returns 403 when user B requests a document owned by user A", async () => {
    // User A (owner) is 99; authenticated user B is 42.
    selectResponses.push([{ ownerId: 99 }]);

    const res = await request(app).get("/storage/objects/uploads/99/userA-document.pdf");

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/ditolak/i);
    // Storage must never be probed for a forbidden document.
    expect(mockGetObjectEntityFile).not.toHaveBeenCalled();
    expect(mockDownloadObject).not.toHaveBeenCalled();
  });

  // ── Owner access ─────────────────────────────────────────────────────────────

  it("returns 200 when the document owner (user A) requests their own file", async () => {
    // authUser is 42, doc also owned by 42.
    selectResponses.push([{ ownerId: 42 }]);
    stubSuccessfulDownload();

    const res = await request(app).get("/storage/objects/uploads/42/myfile.pdf");

    expect(res.status).toBe(200);
    expect(mockGetObjectEntityFile).toHaveBeenCalledWith("/objects/uploads/42/myfile.pdf");
    expect(mockDownloadObject).toHaveBeenCalled();
  });

  // ── Admin bypass ─────────────────────────────────────────────────────────────

  it("returns 200 when an admin requests a document owned by another user", async () => {
    authUser = { id: 1, role: "admin" };
    // Doc owned by user 99; admin (id=1) is requesting it.
    selectResponses.push([{ ownerId: 99 }]);
    stubSuccessfulDownload();

    const res = await request(app).get("/storage/objects/uploads/99/secret.pdf");

    expect(res.status).toBe(200);
    expect(mockGetObjectEntityFile).toHaveBeenCalled();
    expect(mockDownloadObject).toHaveBeenCalled();
  });

  // ── Non-PKB objects pass through ──────────────────────────────────────────────

  it("serves authenticated requests for objects not registered in pkbActivityDocs", async () => {
    // Empty DB result — object is not a PKB document (e.g. a voice note).
    selectResponses.push([]);
    stubSuccessfulDownload();

    const res = await request(app).get("/storage/objects/voicenotes/42/note.m4a");

    // No ownership gate applies; the request is served to any authenticated user.
    expect(res.status).toBe(200);
    expect(mockGetObjectEntityFile).toHaveBeenCalledWith("/objects/voicenotes/42/note.m4a");
    expect(mockDownloadObject).toHaveBeenCalled();
  });

  // ── Object not found ─────────────────────────────────────────────────────────

  it("returns 404 when the object does not exist in storage", async () => {
    // Doc registered (ownership passes), but storage throws ObjectNotFoundError.
    selectResponses.push([{ ownerId: 42 }]);
    const { ObjectNotFoundError } = await import("../lib/objectStorage.js");
    mockGetObjectEntityFile.mockRejectedValue(new ObjectNotFoundError());

    const res = await request(app).get("/storage/objects/uploads/42/missing.pdf");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});
