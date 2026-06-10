import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./db";
import { users, roles, userRoles } from "@shared/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
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
  try {
    await seedRoles();
    await seedUser("admin",         "Administrador", "admin@sistema.local",                 "Admin@2025",     "Adm");
    await seedUser("omar.souza",    "Omar Souza",    "omar.souza@cscdoesporte.com.br",      "Logistica@2025", "Gestor Logistica");
    await seedUser("eduardo.meira", "Eduardo Meira", "eduardo.meira@cscdoesporte.com.br",   "Logistica@2025", "Gestor Logistica");
  } catch (err) {
    log(`Startup seed error: ${err}`);
  }
}

(async () => {
  await seedStartupUsers();
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
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
