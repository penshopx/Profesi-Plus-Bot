#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Rekonsiliasi ASKOM reviews duplikat (pertahankan yang terlama) SEBELUM push,
# karena push membuat unique index marketplace_askom_reviews_course_uidx yang
# akan gagal bila masih ada duplikat dari data lama. Idempotent.
pnpm --filter db dedupe:askom
pnpm --filter db push
# Seed the marketplace catalog (idempotent — onConflictDoNothing).
# Ensures the catalog is never empty on a fresh deploy or after a DB reset.
pnpm --filter db seed
# Backfill watch tables from PKB activities already linked to a marketplace
# course (idempotent — onConflictDoNothing on the unique user+course indexes).
pnpm --filter db backfill:watches
