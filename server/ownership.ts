import type { Request, Response, NextFunction } from "express";
import type { User } from "@shared/schema";
import { db } from "./db";
import { userRoles, roles } from "@shared/schema";
import { eq } from "drizzle-orm";

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
export async function canEditResource(user: User | undefined, resourceCreatorId: string | null): Promise<boolean> {
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
export async function canDeleteResource(user: User | undefined, resourceCreatorId: string | null): Promise<boolean> {
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
 * Check if user has admin role
 */
export async function isAdmin(user: User | undefined): Promise<boolean> {
  if (!user) return false;
  
  try {
    // Query user roles from database
    const userRoleRecords = await db
      .select({ roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id))
      .execute();
    
    // Check if any of the user's roles is 'admin'
    return userRoleRecords.some(record => record.roleName === 'admin');
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

/**
 * Get user info to include in responses (for frontend ownership checks)
 */
export function getUserInfo(user: User | undefined) {
  if (!user) return null;
  
  return {
    id: user.id,
    name: user.name,
    username: user.username
  };
}
