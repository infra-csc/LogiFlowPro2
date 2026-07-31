/**
 * Ensure the performance indexes declared in shared/schema.ts actually exist in
 * the database. These speed up the foreign-key JOINs and event filters used all
 * over the app (calendar, event overview, movements, trips).
 *
 * Safe to run any time: every statement is CREATE INDEX IF NOT EXISTS, so it
 * only creates what's missing and never drops or changes data. Use this instead
 * of `npm run db:push`, which also proposes destructive changes on this DB.
 *
 * Usage: tsx scripts/ensure-indexes.ts
 */
import { sql } from "drizzle-orm";
import { db } from "../server/db";

const INDEXES: Array<[string, string, string]> = [
  ["idx_material_requests_event_id", "material_requests", "event_id"],
  ["idx_trips_event_id", "trips", "event_id"],
  ["idx_loading_orders_event_id", "loading_orders", "event_id"],
  ["idx_loading_order_items_loading_order_id", "loading_order_items", "loading_order_id"],
  ["idx_movements_loading_order_id", "movements", "loading_order_id"],
  ["idx_movements_request_id", "movements", "request_id"],
  ["idx_movements_event_id", "movements", "event_id"],
  ["idx_movement_events_movement_id", "movement_events", "movement_id"],
  ["idx_movement_events_event_id", "movement_events", "event_id"],
  ["idx_movement_trips_movement_id", "movement_trips", "movement_id"],
  ["idx_movement_trips_trip_id", "movement_trips", "trip_id"],
  ["idx_movement_requests_movement_id", "movement_requests", "movement_id"],
  ["idx_movement_requests_request_id", "movement_requests", "request_id"],
  // Junction tables joined by the request/loading-order lookups but not yet
  // indexed — cheap wins for those paths.
  ["idx_loading_order_requests_request_id", "loading_order_requests", "request_id"],
  ["idx_loading_order_requests_loading_order_id", "loading_order_requests", "loading_order_id"],
  ["idx_loading_order_trips_loading_order_id", "loading_order_trips", "loading_order_id"],
  ["idx_request_items_request_id", "request_items", "request_id"],
  ["idx_movement_items_movement_id", "movement_items", "movement_id"],
  ["idx_user_roles_user_id", "user_roles", "user_id"],
];

async function main() {
  let created = 0;
  for (const [name, table, column] of INDEXES) {
    try {
      await db.execute(
        sql.raw(`CREATE INDEX IF NOT EXISTS ${name} ON ${table} (${column})`)
      );
      created++;
    } catch (err) {
      // A missing table/column shouldn't abort the rest.
      console.warn(`Ignorando ${name} (${table}.${column}): ${(err as Error).message}`);
    }
  }
  console.log(`OK — ${created}/${INDEXES.length} índices garantidos.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Falha ao criar índices:", err);
  process.exit(1);
});
