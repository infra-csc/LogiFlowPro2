import type { Request, Response, NextFunction } from "express";
import type { User } from "@shared/schema";

/**
 * Check if user has ownership or admin rights over a resource
 */
export function canEditResource(user: User | undefined, resourceCreatorId: string | null): boolean {
  if (!user) return false;
  
  // Admin can edit everything
  // TODO: Implement proper role checking when roles are fully integrated
  // For now, check if user has admin-like permissions
  
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
export function canDeleteResource(user: User | undefined, resourceCreatorId: string | null): boolean {
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
      
      if (!canEditResource(req.user, creatorId)) {
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
 * TODO: Integrate with actual role system
 */
export async function isAdmin(user: User | undefined): Promise<boolean> {
  if (!user) return false;
  
  // TODO: Query user roles from database
  // For now, return false - ownership will be the primary check
  return false;
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
