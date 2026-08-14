/**
 * GET /storage/downloads/request-url
 *
 * Verifies ownership enforcement and successful URL generation for the
 * presigned document download endpoint.
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mock refs so they're available inside vi.mock factories ──────────────

const {
  mockGetObjectEntityFile,
  mockGetObjectEntityDownloadURL,
} = vi.hoisted(() => ({
  mockGetObjectEntityFile:        vi.fn(),
  mockGetObjectEntityDownloadURL: vi.fn(),
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
    getObjectEntityUploadURL  = vi.fn().mockResolvedValue("https://storage.googleapis.com/bucket/upload-url");
    normalizeObjectEntityPath = vi.fn((u: string) => u);
    getObjectEntityFile       = mockGetObjectEntityFile;
    getObjectEntityDownloadURL = mockGetObjectEntityDownloadURL;
    downloadObject            = vi.fn();
    searchPublicObject        = vi.fn();
  }

  return {
    ObjectStorageService: MockObjectStorageService,
    ObjectNotFoundError: MockObjectNotFoundError,
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
    (req as any).auth   = { userId: "clerk_user_42" };
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /storage/downloads/request-url", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    selectCallCount = 0;
    selectResponses.length = 0;
    authUser = { id: 42, role: "user" };
    app = await buildApp();
  });

  it("returns 400 when objectPath query param is missing", async () => {
    const res = await request(app).get("/storage/downloads/request-url");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/objectPath/i);
  });

  it("returns 403 when a non-owner requests another user's document", async () => {
    // Ownership check: doc belongs to user 99, but auth user is 42
    selectResponses.push([{ ownerId: 99 }]);

    const res = await request(app)
      .get("/storage/downloads/request-url")
      .query({ objectPath: "/objects/uploads/99/some-file" });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/ditolak/i);
    expect(mockGetObjectEntityFile).not.toHaveBeenCalled();
  });

  it("allows an admin to download any user's document", async () => {
    authUser = { id: 1, role: "admin" };
    // Ownership check: doc owned by user 99
    selectResponses.push([{ ownerId: 99 }]);
    mockGetObjectEntityFile.mockResolvedValue({});
    mockGetObjectEntityDownloadURL.mockResolvedValue("https://signed.example.com/admin-file");

    const res = await request(app)
      .get("/storage/downloads/request-url")
      .query({ objectPath: "/objects/uploads/99/some-file" });

    expect(res.status).toBe(200);
    expect(res.body.downloadURL).toBe("https://signed.example.com/admin-file");
  });

  it("returns 200 with downloadURL when the document owner requests it", async () => {
    // Ownership check: doc owned by user 42 (same as authUser)
    selectResponses.push([{ ownerId: 42 }]);
    mockGetObjectEntityDownloadURL.mockResolvedValue("https://signed.example.com/myfile");

    const res = await request(app)
      .get("/storage/downloads/request-url")
      .query({ objectPath: "/objects/uploads/42/myfile" });

    expect(res.status).toBe(200);
    expect(res.body.downloadURL).toBe("https://signed.example.com/myfile");
    expect(mockGetObjectEntityDownloadURL).toHaveBeenCalledWith("/objects/uploads/42/myfile");
    // getObjectEntityFile is no longer called by this endpoint (doc row in DB is sufficient)
    expect(mockGetObjectEntityFile).not.toHaveBeenCalled();
  });

  it("returns 404 for an objectPath with no matching pkbActivityDocs row (no storage probing)", async () => {
    // DB returns no doc row for this objectPath — covers both non-existent files
    // and non-document private objects (e.g. voice notes) that share the namespace.
    selectResponses.push([]);

    const res = await request(app)
      .get("/storage/downloads/request-url")
      .query({ objectPath: "/objects/uploads/99/voice-note-private" });

    expect(res.status).toBe(404);
    // Storage must never be probed for unregistered paths
    expect(mockGetObjectEntityFile).not.toHaveBeenCalled();
    expect(mockGetObjectEntityDownloadURL).not.toHaveBeenCalled();
  });
});
