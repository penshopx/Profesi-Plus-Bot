#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push
# Seed the marketplace catalog (idempotent — onConflictDoNothing).
# Ensures the catalog is never empty on a fresh deploy or after a DB reset.
pnpm --filter db seed
