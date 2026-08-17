---
name: Drizzle push TTY prompt workaround
description: What to do when `pnpm run push` (drizzle-kit push) dies with "Interactive prompts require a TTY terminal"
---
Rule: when a new table added to lib/db schema makes `drizzle-kit push` hit `promptNamedWithSchemasConflict` (create-vs-rename question) in a non-interactive shell, do NOT try to fake a TTY (`script -qec` hangs/times out). Instead create the table manually with `CREATE TABLE IF NOT EXISTS ...` SQL matching the schema, then re-run `pnpm run push` — it then applies remaining changes without prompting.

**Why:** drizzle-kit's rename-resolution prompt cannot be auto-answered non-interactively and `--force` does not cover it; piping input via `script` deadlocked in this environment.

**How to apply:** after any task merge touching `lib/db/src/schema/*` that adds a table, if push fails with the TTY error, read the schema diff, issue the equivalent CREATE TABLE via executeSql, re-push to confirm "Changes applied".
