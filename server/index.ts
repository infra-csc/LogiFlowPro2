import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./db";
import { users, roles, userRoles } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { hashPassword } from "./auth";

/**
 * Self-healing schema patches applied on every boot.
 *
 * These are additive, idempotent DDL statements (ADD COLUMN / CREATE INDEX IF
 * NOT EXISTS) so a deploy carrying a new column no longer needs a manual
 * migration — the app brings the database up to date itself. Deliberately
 * NOT `drizzle-kit push`, which on this database proposes destructive changes
 * (dropping the session table, dropping populated columns). Each statement is
 * wrapped so one failure can't stop the boot.
 */
async function ensureSchemaPatches() {
  const statements = [
    // Secondary vehicles list — added by the "+ Incluir Veículo" feature.
    `ALTER TABLE trips ADD COLUMN IF NOT EXISTS additional_vehicles jsonb`,
    // Performance indexes on foreign keys / event filters.
    `CREATE INDEX IF NOT EXISTS idx_material_requests_event_id ON material_requests (event_id)`,
    `CREATE INDEX IF NOT EXISTS idx_trips_event_id ON trips (event_id)`,
    `CREATE INDEX IF NOT EXISTS idx_loading_orders_event_id ON loading_orders (event_id)`,
    `CREATE INDEX IF NOT EXISTS idx_movements_event_id ON movements (event_id)`,
    `CREATE INDEX IF NOT EXISTS idx_movement_events_event_id ON movement_events (event_id)`,
    `CREATE INDEX IF NOT EXISTS idx_movement_events_movement_id ON movement_events (movement_id)`,
    `CREATE INDEX IF NOT EXISTS idx_movement_requests_request_id ON movement_requests (request_id)`,
    `CREATE INDEX IF NOT EXISTS idx_movement_requests_movement_id ON movement_requests (movement_id)`,
    `CREATE INDEX IF NOT EXISTS idx_loading_order_requests_request_id ON loading_order_requests (request_id)`,
    `CREATE INDEX IF NOT EXISTS idx_request_items_request_id ON request_items (request_id)`,
    `CREATE INDEX IF NOT EXISTS idx_movement_items_movement_id ON movement_items (movement_id)`,
    `CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles (user_id)`,
  ];
  for (const stmt of statements) {
    try {
      await db.execute(sql.raw(stmt));
    } catch (err) {
      log(`schema patch skipped: ${(err as Error).message}`);
    }
  }
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging. Deliberately records only metadata — serializing the
// response body here wrote user records and other sensitive payloads into the
// application log.
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    if (path.startsWith("/api")) {
      const duration = Date.now() - start;
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

const CANONICAL_ROLES = [
  { name: "Adm",               description: "Administrador do sistema" },
  { name: "Gestor Logistica",  description: "Operações logísticas: viagens, veículos, carregamentos" },
  { name: "Usuario Requisitor",description: "Cria e acompanha requisições de materiais" },
  { name: "Almoxarifado",      description: "Operação de almoxarifado: itens, separação e prontidão" },
  { name: "Supervisor",        description: "Aprova ordens de carregamento e movimentações sensíveis" },
];

async function seedRoles() {
  for (const role of CANONICAL_ROLES) {
    await db.insert(roles).values(role).onConflictDoNothing({ target: roles.name });
  }
}

async function seedUser(
  username: string,
  name: string,
  email: string,
  password: string,
  roleName: string,
) {
  const [role] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, roleName));

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username));
  if (existing) {
    if (role) {
      await db.insert(userRoles).values({ userId: existing.id, roleId: role.id }).onConflictDoNothing();
    }
    return;
  }

  const hashed = await hashPassword(password);
  const [created] = await db.insert(users).values({
    username,
    password: hashed,
    name,
    email,
    active: true,
    approvalStatus: "approved",
  }).returning({ id: users.id });

  if (role && created) {
    await db.insert(userRoles).values({ userId: created.id, roleId: role.id }).onConflictDoNothing();
  }
  log(`Seeded user: ${username}`);
}

async function seedStartupUsers() {
  // Roles are safe to seed anywhere — they carry no credentials.
  try {
    await seedRoles();
  } catch (err) {
    log(`Startup role seed error: ${err}`);
    return;
  }

  // User seeding is development-only and requires an explicit password from
  // the environment. Hardcoding credentials here put a working admin login in
  // the source tree and re-applied it on every production boot.
  if (process.env.NODE_ENV === "production") return;

  const seedPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!seedPassword) {
    log("Skipping user seed: SEED_ADMIN_PASSWORD is not set");
    return;
  }

  try {
    await seedUser("admin",         "Administrador", "admin@sistema.local",               seedPassword, "Adm");
    await seedUser("omar.souza",    "Omar Souza",    "omar.souza@cscdoesporte.com.br",    seedPassword, "Gestor Logistica");
    await seedUser("eduardo.meira", "Eduardo Meira", "eduardo.meira@cscdoesporte.com.br", seedPassword, "Gestor Logistica");
  } catch (err) {
    log(`Startup seed error: ${err}`);
  }
}

(async () => {
  await ensureSchemaPatches();
  await seedStartupUsers();
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    // Do not rethrow: this handler runs synchronously, so a throw here becomes
    // an uncaught exception that kills the process on every 500.
    console.error("[error]", err);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
