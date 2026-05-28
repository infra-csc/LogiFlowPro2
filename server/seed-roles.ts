/**
 * Idempotent seed for canonical functional roles.
 *
 * Creates the "Almoxarifado" and "Supervisor" roles if they don't already
 * exist. Uses INSERT ... ON CONFLICT (name) DO NOTHING (the `roles.name`
 * column has a UNIQUE constraint), so running this script multiple times
 * is safe and a second run is a no-op.
 *
 * This script does NOT:
 *  - rename or modify existing roles ("Adm", "Gestor Logistica", "Usuario Requisitor")
 *  - create entries in `user_roles` (no role is assigned to any user)
 *  - touch `permissions` or `role_permissions`
 *  - apply RBAC anywhere — middlewares are unchanged.
 *
 * Manual usage (not wired into npm scripts or boot):
 *   tsx server/seed-roles.ts
 */

import { db, pool } from "./db";
import { roles } from "@shared/schema";
import { sql } from "drizzle-orm";

interface CanonicalRole {
  name: string;
  description: string;
}

const CANONICAL_ROLES: CanonicalRole[] = [
  {
    name: "Almoxarifado",
    description:
      "Operação de almoxarifado: itens, separação, preparação e prontidão de ordens",
  },
  {
    name: "Supervisor",
    description:
      "Aprova e desaprova ordens de carregamento e movimentações sensíveis",
  },
];

async function seedRoles(): Promise<void> {
  console.log("🌱 Seeding canonical roles (idempotent)...");

  const before = await db
    .select({ name: roles.name })
    .from(roles)
    .where(sql`${roles.name} IN ('Almoxarifado', 'Supervisor')`);
  const existingNames = new Set(before.map((r) => r.name));

  for (const role of CANONICAL_ROLES) {
    const result = await db
      .insert(roles)
      .values(role)
      .onConflictDoNothing({ target: roles.name })
      .returning({ id: roles.id, name: roles.name });

    if (result.length > 0) {
      console.log(`  ✅ Created role: ${role.name} (id=${result[0].id})`);
    } else if (existingNames.has(role.name)) {
      console.log(`  ⏭️  Already exists, skipped: ${role.name}`);
    } else {
      console.log(`  ⏭️  Skipped (conflict): ${role.name}`);
    }
  }

  const after = await db
    .select({ name: roles.name, description: roles.description })
    .from(roles)
    .orderBy(roles.name);
  console.log("\n📋 All roles after seed:");
  for (const r of after) {
    console.log(`  - ${r.name}${r.description ? ` — ${r.description}` : ""}`);
  }

  console.log("\n✨ Done. No user_roles created; no endpoint affected.");
}

seedRoles()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
