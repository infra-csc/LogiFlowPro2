/**
 * One-off cleanup: remove duplicate (user_id, role_id) rows from user_roles.
 *
 * The table had no unique constraint, so the startup seed accumulated a new row
 * for the same user/role on every boot — a user could end up with a role listed
 * hundreds of times. This keeps the earliest-assigned row per (user, role) and
 * deletes the rest.
 *
 * Run this BEFORE `npm run db:push` — the new unique constraint in
 * shared/schema.ts cannot be applied while duplicates exist.
 *
 * Usage: tsx scripts/dedupe-user-roles.ts
 */
import { sql } from "drizzle-orm";
import { db } from "../server/db";

async function main() {
  const before = await db.execute(sql`SELECT COUNT(*)::int AS c FROM user_roles`);
  const beforeCount = (before.rows?.[0] as { c: number } | undefined)?.c ?? 0;

  const result = await db.execute(sql`
    DELETE FROM user_roles
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY user_id, role_id
                 ORDER BY assigned_at ASC, id ASC
               ) AS rn
        FROM user_roles
      ) t
      WHERE t.rn > 1
    )
  `);

  const after = await db.execute(sql`SELECT COUNT(*)::int AS c FROM user_roles`);
  const afterCount = (after.rows?.[0] as { c: number } | undefined)?.c ?? 0;

  const removed = (result.rowCount ?? beforeCount - afterCount);
  console.log(`user_roles: ${beforeCount} -> ${afterCount} (removidas ${removed} duplicatas)`);
  console.log("Agora rode: npm run db:push  (para aplicar a constraint única)");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro ao deduplicar user_roles:", err);
  process.exit(1);
});
