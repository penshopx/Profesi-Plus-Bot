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
    const canBypassOwnership = userRole === "askom" || userRole === "admin";
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
