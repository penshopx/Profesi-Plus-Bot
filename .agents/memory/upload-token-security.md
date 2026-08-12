---
name: Upload token security (PKB docs)
description: In-memory token store prevents users registering objectPaths they did not personally upload.
---

## Rule
The PKB document upload flow uses a two-step pattern: presign (GCS PUT URL) then register metadata. Without a binding between presign and register, a user who learns another user's UUID path could register it under their own activity, then download it via the activity-ownership check.

**Why:** The storage download route (`GET /storage/objects/*`) gates access by PKB activity ownership, not by who originally uploaded the file. If user A registers user B's objectPath into their own activity, the download check passes.

**How to apply:**
- `artifacts/api-server/src/lib/uploadTokenStore.ts` exports `issueUploadToken(objectPath, userId)` and `consumeUploadToken(objectPath, userId): boolean`.
- `POST /storage/uploads/request-url` calls `issueUploadToken` after generating the presigned URL.
- `POST /kegiatan/:id/docs` calls `consumeUploadToken` before inserting the doc record — returns 403 if the token is missing, expired (30 min TTL), or belongs to a different user.
- Tokens are consumed on first use; a failed match still deletes the token to prevent retry-scanning.
- A periodic `setInterval` (every 5 min, `unref()`d) cleans up expired entries.
