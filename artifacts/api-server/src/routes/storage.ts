/**
 * Object storage routes — Clerk-auth adapted.
 * POST /storage/uploads/request-url  → presigned GCS PUT URL
 * GET  /storage/public-objects/*     → public assets (no auth)
 * GET  /storage/objects/*            → private objects (auth required)
 */

import { Readable } from "stream";
import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { issueUploadToken } from "../lib/uploadTokenStore";
import { db, pkbActivityDocs, pkbActivities } from "@workspace/db";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const RequestUploadUrlBody = z.object({
  name: z.string().min(1),
  size: z.number().int().positive(),
  contentType: z.string().min(1),
});

// ─── POST /storage/uploads/request-url ───────────────────────────────────────

router.post("/storage/uploads/request-url", requireAuth, async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields (name, size, contentType)" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;
    const uploadURL = await objectStorageService.getObjectEntityUploadURL(req.dbUser!.id);
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    // Bind this objectPath to the uploading user so the doc-registration endpoint
    // can verify the path was actually issued to them (not borrowed from another user).
    issueUploadToken(objectPath, req.dbUser!.id);
    res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
  } catch (error) {
    req.log?.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

// ─── GET /storage/downloads/request-url ──────────────────────────────────────
// Returns a short-lived presigned GET URL so the mobile client can open the
// file in a native viewer without streaming it through the API server.

router.get("/storage/downloads/request-url", requireAuth, async (req: Request, res: Response) => {
  const objectPath = req.query.objectPath as string | undefined;
  if (!objectPath || typeof objectPath !== "string") {
    res.status(400).json({ error: "objectPath query param is required" });
    return;
  }

  try {
    // Require a registered PKB document for this objectPath.
    // Paths not recorded in pkbActivityDocs are never served — this scopes
    // the endpoint exclusively to PKB documents and prevents leaking URLs
    // for other private objects (voice notes, etc.) that share the namespace.
    const [docRow] = await db
      .select({ ownerId: pkbActivities.userId })
      .from(pkbActivityDocs)
      .innerJoin(pkbActivities, eq(pkbActivityDocs.activityId, pkbActivities.id))
      .where(eq(pkbActivityDocs.objectPath, objectPath))
      .limit(1);

    if (!docRow) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    const userRole = req.dbUser!.role;
    const canBypassOwnership = userRole === "admin";
    if (docRow.ownerId !== req.dbUser!.id && !canBypassOwnership) {
      res.status(403).json({ error: "Akses ditolak — dokumen ini bukan milik Anda." });
      return;
    }

    // Sign via the Replit sidecar (same path as upload signing) so it works
    // with external-account credentials that lack a service-account signing key.
    const downloadURL = await objectStorageService.getObjectEntityDownloadURL(objectPath);

    res.json({ downloadURL });
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log?.error({ err: error }, "Error generating download URL");
    res.status(500).json({ error: "Gagal membuat URL unduhan" });
  }
});

// ─── GET /storage/public-objects/* ───────────────────────────────────────────

router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) { res.status(404).json({ error: "File not found" }); return; }

    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log?.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

// ─── GET /storage/objects/* ───────────────────────────────────────────────────

router.get("/storage/objects/*path", requireAuth, async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;

    // Ownership check for PKB documents: if this objectPath belongs to a
    // pkbActivityDoc, only the activity owner may download it. Other private
    // objects (e.g. voice note transcripts) are not in this table and pass
    // through to the normal auth-only gate below.
    const [docRow] = await db
      .select({ ownerId: pkbActivities.userId })
      .from(pkbActivityDocs)
      .innerJoin(pkbActivities, eq(pkbActivityDocs.activityId, pkbActivities.id))
      .where(eq(pkbActivityDocs.objectPath, objectPath))
      .limit(1);

    const userRole = req.dbUser!.role;
    const canBypassOwnership = userRole === "admin";
    if (docRow && docRow.ownerId !== req.dbUser!.id && !canBypassOwnership) {
      res.status(403).json({ error: "Akses ditolak — dokumen ini bukan milik Anda." });
      return;
    }

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log?.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
