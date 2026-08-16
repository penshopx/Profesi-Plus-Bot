---
name: ASKOM PKB verification (role removed)
description: The askom role was REMOVED from the platform; PKB review is admin-only per regulation. Legacy notes below.
---

> **UPDATE (Aug 2026):** The "askom" role no longer exists in ROLES. PKB review is admin-only per regulation (see routes/askom.ts header comment). Startup migrates lingering askom rows to "user". Storage ownership bypasses are admin-only — never grant askom a bypass. Do not re-add the role without explicit user direction. Legacy notes below describe the old system.

## Role
- `"askom"` added to `ROLES` in `lib/db/src/schema/users.ts` alongside existing roles.
- `DashboardRedirect` in `App.tsx` routes `askom` role to `/dashboard/askom`.

## DB schema (`pkbActivities` table)
- Three new columns added via `drizzle-kit push`:
  - `askom_note text` — ASKOM's SKK alignment comment (set on both verify and reject)
  - `askom_verified_at timestamptz` — when the decision was made
  - `askom_verified_by int` — FK users.id of the ASKOM reviewer
- `KEGIATAN_STATUS` now includes `"ditolak"` (rejected by ASKOM) in addition to `"diverifikasi"`.
- `JOURNEY_EVENT` still uses `"diverifikasi"` for both verify and reject journey entries (two paths, one event type).

## API routes (`/askom/*`)
- `GET /askom/submissions` — lists all `diajukan | diverifikasi | ditolak` activities with owner + SKK
- `GET /askom/submissions/:id` — full detail including docs and journey
- `POST /askom/submissions/:id/verify` — sets status→diverifikasi, stores note
- `POST /askom/submissions/:id/reject` — sets status→ditolak, note required

**Why:** ASKOM only checks SKK alignment (jabker + jenjang), NOT content quality or user profile. Kept separate from future Asosiasi document-checklist panel.

## Re-submission after rejection
- `POST /kegiatan/:id/ajukan` now allows re-submission from `ditolak` status.
- On re-submit: resets `askomNote`, `askomVerifiedAt`, `askomVerifiedBy` to null, sets status back to `diajukan`.

## Web panel (`/dashboard/askom`)
- Two-column layout: list (filter tabs) + detail panel
- Shows SKK units, documents (with access link), activity metadata
- Textarea for ASKOM note + Setuju/Tolak buttons
- Rejection note shown to user in kegiatan detail (rose banner) with re-submit option

## Storage security (Task #47)
- `GET /storage/objects/*path` checks `pkbActivityDocs` ownership before serving.
- If objectPath matches a doc not owned by the requesting user → 403.
- Non-PKB paths pass through to the existing requireAuth gate.
- ASKOM and admin roles bypass the ownership check so they can review submitted docs.

## Admin dashboard — role management
- `ROLE_LABELS`, `ROLE_COLORS`, stats card, and the `PATCH /users/:id/role` endpoint
  all include `"askom"` so admins can assign the role from the dashboard.

## Journey event "ditolak"
- ASKOM reject entries use `event: "ditolak"` (rose icon/color in timeline) rather than
  reusing `"diverifikasi"` — keeps approval vs rejection visually distinct.
