import type { Request, Response, NextFunction } from "express";
import type { User } from "@shared/schema";
import { db } from "./db";
import { userRoles, roles } from "@shared/schema";
import { eq } from "drizzle-orm";

// Passport stores users in the session without the password field, so any
// utility that receives `req.user` must accept that variant. Defining a local
// alias keeps the signatures explicit without using `any`.
type AuthUser = Omit<User, "password">;

/**
 * Express middleware that blocks anonymous requests with 401.
 * Pass-through for authenticated users (no behavior change).
 * Usage: app.post("/api/x", requireAuth, handler)
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  next();
}

/**
 * Check if user has ownership or admin rights over a resource
 */
export async function canEditResource(user: AuthUser | undefined, resourceCreatorId: string | null): Promise<boolean> {
  if (!user) return false;
  
  // Check if user is admin - admins can edit everything
  const isUserAdmin = await isAdmin(user);
  if (isUserAdmin) return true;
  
  // Owner can edit their own resources
  if (resourceCreatorId && user.id === resourceCreatorId) {
    return true;
  }
  
  return false;
}

/**
 * Check if user can delete a resource
 * Currently same logic as edit, but kept separate for future flexibility
 */
export async function canDeleteResource(user: AuthUser | undefined, resourceCreatorId: string | null): Promise<boolean> {
  return canEditResource(user, resourceCreatorId);
}

/**
 * Middleware to check ownership before allowing edit/delete operations
 * Usage: app.patch("/api/resource/:id", checkOwnership(getResourceCreator), handler)
 */
export function checkOwnership(
  getResourceCreator: (req: Request) => Promise<string | null>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const creatorId = await getResourceCreator(req);
      
      const canEdit = await canEditResource(req.user, creatorId);
      if (!canEdit) {
        return res.status(403).json({ 
          error: "Acesso negado",
          message: "Você não tem permissão para editar este recurso. Apenas o criador ou administradores podem realizar esta ação."
        });
      }

      next();
    } catch (error) {
      console.error("Error checking ownership:", error);
      res.status(500).json({ error: "Erro ao verificar permissões" });
    }
  };
}

/**
 * Pure helper: decide whether a given role name represents the admin role.
 *
 * The seeded admin role in this database is named "Adm" (pt-BR), while
 * earlier code paths assumed the literal "admin". Accept both spellings
 * case-insensitively so the existing seed and any future installs that
 * use the English name both resolve to admin. No new role is granted —
 * callers only honor roles already assigned via `user_roles`.
 *
 * Single source of truth — used by `isAdmin()` here and by `GET /api/user`
 * in `server/auth.ts`.
 */
export function isAdminRoleName(name: string | null | undefined): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return lower === 'admin' || lower === 'adm';
}

/**
 * Check if user has admin role
 */
export async function isAdmin(user: AuthUser | undefined): Promise<boolean> {
  if (!user) return false;
  
  try {
    // Query user roles from database
    const userRoleRecords = await db
      .select({ roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id))
      .execute();
    
    return userRoleRecords.some(record => isAdminRoleName(record.roleName));
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

/**
 * Get user info to include in responses (for frontend ownership checks)
 */
export function getUserInfo(user: AuthUser | undefined) {
  if (!user) return null;
  
  return {
    id: user.id,
    name: user.name,
    username: user.username
  };
}
