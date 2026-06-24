---
name: GitHub-import restore (pnpm-workspace)
description: Steps to revive a Replit pnpm-workspace monorepo imported from GitHub that looks "empty"/blank in preview
---

# Reviving a GitHub-imported pnpm-workspace project

A monorepo imported from GitHub has all files but renders blank because nothing is registered/provisioned. The fix is environment setup, not code changes.

**Why:** `.replit-artifact/artifact.toml` files exist on disk but `listArtifacts()` returns `[]`; secrets/integrations and DB schema do not travel with the repo.

**How to apply (in order):**
1. `pnpm install`.
2. Re-register each artifact: copy its `.replit-artifact/artifact.toml` to a sibling `artifact.edit.toml`, then call `verifyAndReplaceArtifactToml({tempFilePath, artifactTomlPath})`. This recreates the per-artifact workflows automatically. Remove the temp files after.
3. Provision missing integrations/secrets: e.g. Replit-managed Clerk via `setupClerkWhitelabelAuth()`; AI via `setupReplitAIIntegrations(...)` or request the user's own key with `requestEnvVar`.
4. If a DB is attached (DATABASE_URL/PG* present) but queries fail with "relation does not exist", push schema: `pnpm --filter @workspace/db run push`.
5. Restart all artifact workflows and verify each is `running`.

Clerk "loaded with development keys" warning in dev is expected — do not try to fix it.
