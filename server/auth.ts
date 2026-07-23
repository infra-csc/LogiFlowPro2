import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { User, InsertUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends Omit<import("@shared/schema").User, "password"> {}
  }
}

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  return await bcrypt.compare(supplied, stored);
}

export function setupAuth(app: Express): void {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax"
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Usuário ou senha inválidos" });
        }

        if (!user.active) {
          return done(null, false, { message: "Usuário inativo" });
        }

        if ((user as any).approvalStatus === 'pending') {
          return done(null, false, { message: "Usuário aguardando aprovação" });
        }

        if ((user as any).approvalStatus === 'rejected') {
          return done(null, false, { message: "Usuário foi rejeitado" });
        }

        const isValid = await comparePasswords(password, user.password);
        if (!isValid) {
          return done(null, false, { message: "Usuário ou senha inválidos" });
        }

        // Remove password from user object before sending to client
        const { password: _, ...userWithoutPassword } = user;
        return done(null, userWithoutPassword);
      } catch (error) {
        return done(error);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      // Remove password from user object
      const { password: _, ...userWithoutPassword } = user;
      done(null, userWithoutPassword);
    } catch (error) {
      done(error);
    }
  });

  // Register endpoint
  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, password, name, email } = req.body;

      // Validate required fields
      if (!username || !password || !name || !email) {
        return res.status(400).json({ 
          message: "Todos os campos são obrigatórios" 
        });
      }

      // Check if username already exists
      const existingUserByUsername = await storage.getUserByUsername(username);
      if (existingUserByUsername) {
        return res.status(400).json({ 
          message: "Nome de usuário já existe" 
        });
      }

      // Check if email already exists
      const existingUserByEmail = await storage.getUserByEmail(email);
      if (existingUserByEmail) {
        return res.status(400).json({ 
          message: "Email já cadastrado" 
        });
      }

      // Create user with hashed password and pending status
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        name,
        email,
        active: true
      });

      // Return success message without auto-login
      res.status(201).json({ 
        message: "Cadastro realizado com sucesso! Aguarde a aprovação de um administrador para acessar o sistema." 
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ 
        message: "Erro ao criar usuário" 
      });
    }
  });

  // Login endpoint
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ 
          message: info?.message || "Credenciais inválidas" 
        });
      }
      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        return res.status(200).json(user);
      });
    })(req, res, next);
  });

  // Logout endpoint
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // Self-service password change for the logged-in user.
  //
  // Before this, a regular user had no working way to change their password:
  // admins can reset it from the users screen, but the "forgot password" flow
  // depends on an email that is never sent (the reset link is only logged to
  // the server console). This closes that gap without touching email infra —
  // the user proves they know their current password, then sets a new one.
  app.post("/api/change-password", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Informe a senha atual e a nova senha." });
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ error: "A nova senha deve ter no mínimo 6 caracteres." });
    }

    try {
      // Need the full record (with the hash); req.user is stripped of it.
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      const ok = await comparePasswords(currentPassword, user.password);
      if (!ok) {
        return res.status(400).json({ error: "Senha atual incorreta." });
      }

      const hashed = await hashPassword(newPassword);
      await storage.updateUser(user.id, { password: hashed });

      res.json({ message: "Senha alterada com sucesso." });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ error: "Erro ao alterar a senha." });
    }
  });

  // Get current user
  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }
    
    try {
      // Get user roles
      const { db } = await import("./db");
      const { userRoles, roles } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const userRoleRecords = await db
        .select({ roleName: roles.name })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, req.user!.id))
        .execute();
      
      const roleNames = userRoleRecords.map(r => r.roleName);
      // Single source of truth — see server/ownership.ts:isAdminRoleName().
      const { isAdminRoleName } = await import("./ownership");
      const roleIsAdmin = roleNames.some(isAdminRoleName);

      // Emergency fallback: if EMERGENCY_ADMIN_USERNAME matches, treat as admin
      // even without a role in the DB. Logs a warning every time it triggers.
      const emergencyUsername = process.env.EMERGENCY_ADMIN_USERNAME;
      const isEmergencyAdmin = !!(emergencyUsername && req.user!.username === emergencyUsername);
      if (isEmergencyAdmin) {
        console.warn(
          `[authz] EMERGENCY_ADMIN_USERNAME: isAdmin=true granted to ${req.user!.username} (id=${req.user!.id}) via /api/user`
        );
      }

      const isAdminUser = roleIsAdmin || isEmergencyAdmin;

      res.json({
        ...req.user,
        roles: roleNames,
        isAdmin: isAdminUser
      });
    } catch (error) {
      console.error("Error fetching user roles:", error);
      // Return user without roles if there's an error
      res.json({
        ...req.user,
        roles: [],
        isAdmin: false
      });
    }
  });
}
