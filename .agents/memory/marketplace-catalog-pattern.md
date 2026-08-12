---
name: Marketplace catalog pattern
description: Marketplace course catalog is static frontend data (not in DB); metadata stored at watch-time for AI context.
---

## Rule
The marketplace course catalog (`COURSES` array in `artifacts/gustafta-pkb/src/pages/marketplace.tsx`) is static frontend data — there is no `marketplace_courses` DB table. The API server cannot look up course details by ID without duplicating the catalog.

**Why:** Catalog lives in the frontend to allow fast filter/search without backend latency. Duplicating to the server risks drift.

**How to apply:**
- To surface course details server-side (e.g. for AI context), store metadata **at watch-time** in `marketplace_watches` columns: `courseTitle`, `courseProvider`, `jabkerList`, `skkTagsList`.
- `POST /marketplace/:courseId/watch` accepts optional metadata body fields and stores them.
- `buildWatchedCoursesContext(userId)` in `historical-pkb.ts` queries these stored columns — only rows with non-null `courseTitle` are included.
- Same pattern for `POST /kegiatan` when `marketplaceId` is provided: client sends `courseTitle/courseProvider/courseJabkerList/courseSkkTagsList` alongside the activity fields; server auto-upserts `marketplace_watches`.
- The `marketplace_watches` table also stores `jabkerList text[]` and `skkTagsList text[]` (added via `sql\`ARRAY[]::text[]\`` defaults).
