---
name: GCS orphan cleanup
description: Why orphaned-upload cleanup runs as an in-process sweep instead of a bucket lifecycle rule
---

**Rule:** To clean up GCS objects orphaned by crashed clients (presigned PUT succeeded, registration never happened), run an in-process scheduled sweep, not a bucket lifecycle policy.

**Why:** The Replit Object Storage sidecar issues external-account credentials that can sign object URLs and do object CRUD but cannot perform bucket-level configuration (lifecycle rules). Attempting lifecycle management fails/has no supported path.

**How to apply:**
- Sweep the uploads prefix daily (startup + `setInterval(...).unref()`), following the existing push-token/rate-limit cleanup pattern in the api-server entrypoint.
- Age cutoff must be far larger than the upload-token TTL (7 days vs 30 min) so in-flight uploads and pending registrations are never deleted.
- Orphan = older than cutoff AND objectPath absent from the DB registration table; skip objects with unknown creation time.
- Log every deletion plus a run summary; swallow errors non-fatally so the next run retries.
