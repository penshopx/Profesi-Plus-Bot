#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push
# Seed the marketplace catalog (idempotent — onConflictDoNothing).
# Ensures the catalog is never empty on a fresh deploy or after a DB reset.
pnpm --filter db seed
# Backfill watch tables from PKB activities already linked to a marketplace
# course (idempotent — onConflictDoNothing on the unique user+course indexes).
pnpm --filter db backfill:watches
