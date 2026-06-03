---
name: db:push interactive drift
description: Why db:push hangs on a prompt and how to apply additive schema changes safely
---

Running `npm run db:push` (drizzle-kit push) against this project's dev DB stops on an
interactive prompt about adding `suppliers_name_unique` and asks whether to **truncate
the suppliers table**. This is pre-existing schema drift, unrelated to most changes.

**Why:** drizzle-kit detects the unique constraint isn't applied yet and treats it as a
potentially data-losing change, so it blocks waiting for a TUI arrow-key choice. Driving
that prompt blindly (or `--force`) risks truncating real data.

**How to apply:** For purely additive changes (e.g. new indexes), skip db:push and run
the DDL directly and idempotently against `$DATABASE_URL`:
`psql "$DATABASE_URL" -c "CREATE INDEX IF NOT EXISTS ... ;"`. Keep the matching
declarations in `shared/schema.ts` so the Publish/prod migration stays consistent.
The correct answer to the suppliers prompt, if you ever must run push, is
"No, add the constraint without truncating the table".
