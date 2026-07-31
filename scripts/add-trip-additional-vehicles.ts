/**
 * Targeted, safe migration: add only the trips.additional_vehicles column that
 * the "+ Incluir Veículo" feature needs.
 *
 * Use this INSTEAD of `npm run db:push` — drizzle-kit push tries to reconcile
 * the whole schema and proposes destructive changes (dropping the session
 * table, dropping columns with data). This does exactly one thing and is
 * idempotent (safe to run more than once).
 *
 * Usage: tsx scripts/add-trip-additional-vehicles.ts
 */
import { sql } from "drizzle-orm";
import { db } from "../server/db";

async function main() {
  await db.execute(sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS additional_vehicles jsonb`);
  console.log("OK — coluna 'additional_vehicles' garantida na tabela 'trips'. O app deve voltar a carregar viagens, calendário e eventos.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Falha ao adicionar a coluna:", err);
  process.exit(1);
});
