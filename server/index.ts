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

async function seedAdminUser() {
  try {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, "admin"));
    if (existing) return;

    const [admRole] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, "Adm"));
    const hashed = await hashPassword("Admin@2025");
    const [created] = await db.insert(users).values({
      username: "admin",
      password: hashed,
      name: "Administrador",
      email: "admin@sistema.local",
      active: true,
      approvalStatus: "approved",
    }).returning({ id: users.id });

    if (admRole && created) {
      await db.insert(userRoles).values({ userId: created.id, roleId: admRole.id });
    }
    log("Admin user seeded successfully");
  } catch (err) {
    log(`Admin seed skipped: ${err}`);
  }
}

(async () => {
  await seedAdminUser();
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
