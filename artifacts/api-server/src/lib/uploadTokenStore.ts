/**
 * Short-lived in-memory store that pairs a presigned upload path with the user
 * who requested it.  A token is created when the server issues a presigned PUT
 * URL and consumed (deleted) when the client registers the uploaded document.
 * This prevents a malicious user from registering an objectPath they did not
 * personally upload — even if they somehow learned the UUID path of another
 * user's file.
 *
 * Tokens expire after UPLOAD_TOKEN_TTL_MS regardless of whether they are
 * consumed.  A periodic sweep removes stale entries so memory doesn't grow
 * unboundedly.
 */

const UPLOAD_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const SWEEP_INTERVAL_MS   = 5 * 60 * 1000;  // sweep every 5 minutes

interface UploadToken {
  userId: number;
  expiresAt: number;
}

const store = new Map<string, UploadToken>();

/** Register a newly-issued presigned upload path for the given user. */
export function issueUploadToken(objectPath: string, userId: number): void {
  store.set(objectPath, { userId, expiresAt: Date.now() + UPLOAD_TOKEN_TTL_MS });
}

/**
 * Validate and consume the token for `objectPath`.
 * Returns `true` and removes the token if it exists, belongs to `userId`, and
 * has not expired.  Returns `false` otherwise.
 */
export function consumeUploadToken(objectPath: string, userId: number): boolean {
  const token = store.get(objectPath);
  if (!token) return false;
  // Always delete — even on mismatch — so a bad actor cannot retry with a
  // different userId after learning the path.
  store.delete(objectPath);
  if (token.expiresAt < Date.now()) return false;
  if (token.userId !== userId) return false;
  return true;
}

// Periodic cleanup so stale tokens never accumulate.
const sweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [path, token] of store.entries()) {
    if (token.expiresAt < now) store.delete(path);
  }
}, SWEEP_INTERVAL_MS);

// Allow Node.js to exit cleanly even if this module is imported.
sweepTimer.unref();
