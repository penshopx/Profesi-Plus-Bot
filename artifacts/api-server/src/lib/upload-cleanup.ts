/**
 * Orphaned-upload cleanup.
 *
 * The client uploads directly to GCS via a presigned PUT URL and then registers
 * the file in `pkbActivityDocs`.  If the app crashes or is force-closed between
 * the PUT and registration, the object sits in GCS forever with no DB record
 * and no upload token left to re-issue.  The abort endpoint can't help because
 * the client never got a chance to call it.
 *
 * This job closes that gap: it lists every object under the private
 * `uploads/` prefix, keeps only those older than ORPHAN_MAX_AGE_DAYS (so
 * in-flight uploads and pending registrations are never touched — the upload
 * token TTL is 30 minutes, far below this threshold), checks each against
 * `pkbActivityDocs.objectPath`, and deletes the ones that were never
 * registered.  Every deletion is logged so the cleanup is observable.
 *
 * A bucket lifecycle rule would be simpler, but the Replit sidecar
 * external-account credentials do not allow bucket-level configuration, so the
 * sweep runs in-process (once at startup, then daily).
 *
 * Safe to run repeatedly — it is a no-op when no orphans exist.
 */

import { inArray } from "drizzle-orm";
import { db, pkbActivityDocs } from "@workspace/db";
import type { Logger } from "pino";
import { objectStorageClient, ObjectStorageService } from "./objectStorage";

/** Objects younger than this are never considered orphans. */
export const ORPHAN_MAX_AGE_DAYS = 7;

/** How often the sweep runs after the initial startup pass. */
export const UPLOAD_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily

interface CandidateObject {
  /** GCS object name, e.g. ".private/uploads/12/uuid" */
  name: string;
  /** Normalized app-level path, e.g. "/objects/uploads/12/uuid" */
  objectPath: string;
  timeCreated: Date;
}

/**
 * Pure selection logic, extracted for testability: given candidate objects,
 * the set of registered objectPaths, and the age cutoff, return the orphans.
 */
export function selectOrphans(
  candidates: CandidateObject[],
  registeredPaths: Set<string>,
  cutoff: Date,
): CandidateObject[] {
  return candidates.filter(
    (c) => c.timeCreated < cutoff && !registeredPaths.has(c.objectPath),
  );
}

/**
 * List objects under `<PRIVATE_OBJECT_DIR>/uploads/`, find the ones older than
 * ORPHAN_MAX_AGE_DAYS with no `pkbActivityDocs` row, and delete them.
 *
 * Non-fatal: any error is logged and swallowed so a transient GCS/DB failure
 * never takes down the server — the next scheduled run retries naturally.
 */
export async function cleanupOrphanedUploads(log: Logger): Promise<void> {
  try {
    const service = new ObjectStorageService();
    const privateDir = service.getPrivateObjectDir(); // "/<bucket>/<dir>"

    const normalized = privateDir.startsWith("/") ? privateDir : `/${privateDir}`;
    const parts = normalized.split("/").filter((p) => p.length > 0);
    if (parts.length < 1) {
      log.warn({ privateDir }, "Upload cleanup skipped — cannot parse PRIVATE_OBJECT_DIR");
      return;
    }
    const bucketName = parts[0];
    const dirPrefix = parts.slice(1).join("/"); // may be "" if bucket root
    const uploadsPrefix = dirPrefix ? `${dirPrefix}/uploads/` : "uploads/";

    const [files] = await objectStorageClient
      .bucket(bucketName)
      .getFiles({ prefix: uploadsPrefix });

    if (files.length === 0) return;

    const candidates: CandidateObject[] = [];
    for (const file of files) {
      const created = file.metadata.timeCreated
        ? new Date(file.metadata.timeCreated as string)
        : null;
      if (!created || Number.isNaN(created.getTime())) continue; // unknown age — never delete
      // Map ".../uploads/<rest>" → "/objects/uploads/<rest>" (the app-level path
      // stored in pkbActivityDocs.objectPath).
      const rest = file.name.slice(uploadsPrefix.length);
      candidates.push({
        name: file.name,
        objectPath: `/objects/uploads/${rest}`,
        timeCreated: created,
      });
    }

    const cutoff = new Date(Date.now() - ORPHAN_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
    const oldEnough = candidates.filter((c) => c.timeCreated < cutoff);
    if (oldEnough.length === 0) return;

    // Fetch registration status only for the objects old enough to matter.
    const rows = await db
      .select({ objectPath: pkbActivityDocs.objectPath })
      .from(pkbActivityDocs)
      .where(inArray(pkbActivityDocs.objectPath, oldEnough.map((c) => c.objectPath)));
    const registered = new Set(rows.map((r) => r.objectPath));

    const orphans = selectOrphans(oldEnough, registered, cutoff);
    if (orphans.length === 0) return;

    let deleted = 0;
    for (const orphan of orphans) {
      try {
        await objectStorageClient
          .bucket(bucketName)
          .file(orphan.name)
          .delete({ ignoreNotFound: true });
        deleted++;
        log.info(
          { objectPath: orphan.objectPath, ageDays: Math.floor((Date.now() - orphan.timeCreated.getTime()) / 86_400_000) },
          "Deleted orphaned upload from object storage",
        );
      } catch (err) {
        log.warn({ err, objectPath: orphan.objectPath }, "Failed to delete orphaned upload (will retry next run)");
      }
    }

    log.info(
      { scanned: files.length, orphans: orphans.length, deleted, maxAgeDays: ORPHAN_MAX_AGE_DAYS },
      "Orphaned-upload cleanup finished",
    );
  } catch (err) {
    log.warn({ err }, "Orphaned-upload cleanup failed (non-fatal)");
  }
}
