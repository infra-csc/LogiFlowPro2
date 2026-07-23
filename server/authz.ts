import type { Request, Response, NextFunction } from "express";
import type { User } from "@shared/schema";
import { db } from "./db";
import { userRoles, roles } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ROLES, isAdminRoleName, rolesMatch } from "@shared/roles";

type AuthUser = Omit<User, "password">;

interface RoleCachedRequest extends Request {
  __roleNames?: string[];
}

/**
 * Per-request memoized lookup of the user's role names.
 *
 * Strategy: attach the resolved list to `req.__roleNames` after the first
 * call so subsequent `requireRole`/`hasRole` checks in the same request
 * don't re-query the DB. We deliberately avoid mutating the session /
 * Passport user object or introducing a global cache with TTL — both
 * carry staleness and concurrency risks we don't need to accept yet.
 *
 * When called without `req` (e.g. from `auth.ts`), the lookup runs but
 * nothing is cached. Returns `[]` on DB error to fail closed.
 */
export async function getUserRoleNames(
  user: AuthUser | undefined,
  req?: RoleCachedRequest
): Promise<string[]> {
  if (!user) return [];
  if (req?.__roleNames) return req.__roleNames;

  try {
    const records = await db
      .select({ roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id))
      .execute();

    const names = Array.from(
      new Set(
        records
          .map((r) => r.roleName)
          .filter((n): n is string => typeof n === "string")
      )
    );

    if (req) req.__roleNames = names;
    return names;
  } catch (error) {
    console.error("[authz] Failed to load user role names:", error);
    return [];
  }
}

/**
 * Optional emergency super-admin fallback.
 *
 * Off-by-default. If `EMERGENCY_ADMIN_USERNAME` is set in the environment
 * and the authenticated user's username matches it (case-sensitive), the
 * user passes admin checks even if they have no admin role in
 * `user_roles`. This is intentionally NOT added to `user.roles` or to
 * `GET /api/user`, so it cannot be discovered from a client payload.
 *
 * Use case: recovery from a misconfigured role table that locks the real
 * admin out. Logs a warning every time it triggers so the usage leaves a
 * trace in the application log.
 */
function isEmergencyAdmin(user: AuthUser | undefined): boolean {
  if (!user) return false;
  const expected = process.env.EMERGENCY_ADMIN_USERNAME;
  if (!expected) return false;
  if (user.username !== expected) return false;
  console.warn(
    `[authz] EMERGENCY_ADMIN_USERNAME fallback granted admin to user ${user.username} (id=${user.id})`
  );
  return true;
}

/**
 * Does the user hold the given role name?
 *
 * Accepts canonical names ("admin") or aliases ("adm"); comparison is
 * case-insensitive (see `shared/roles.ts:rolesMatch`). For the admin
 * role specifically, the emergency env-var fallback also grants true.
 */
export async function hasRole(
  user: AuthUser | undefined,
  roleName: string,
  req?: RoleCachedRequest
): Promise<boolean> {
  if (!user) return false;

  if (isAdminRoleName(roleName) && isEmergencyAdmin(user)) {
    return true;
  }

  const userRoleNames = await getUserRoleNames(user, req);
  return userRoleNames.some((n) => rolesMatch(n, roleName));
}

/**
 * Does the user hold ANY of the given role names? (union semantics)
 */
export async function hasAnyRole(
  user: AuthUser | undefined,
  roleNames: string[],
  req?: RoleCachedRequest
): Promise<boolean> {
  if (!user) return false;
  if (roleNames.length === 0) return false;

  if (
    roleNames.some(isAdminRoleName) &&
    isEmergencyAdmin(user)
  ) {
    return true;
  }

  const userRoleNames = await getUserRoleNames(user, req);
  return userRoleNames.some((held) =>
    roleNames.some((needed) => rolesMatch(held, needed))
  );
}

export interface RequireRoleOptions {
  /** Custom message used in the 403 response body. */
  message?: string;
}

/**
 * Express middleware factory: require the user to hold the given role.
 *
 * - Anonymous request → 401 `{ error: "Não autenticado" }`
 * - Authenticated user without role → 403 `{ error: "Acesso negado", message }`
 * - Authenticated user with role → `next()`
 */
export function requireRole(roleName: string, opts: RequireRoleOptions = {}) {
  const message =
    opts.message ?? `Acesso negado: papel "${roleName}" requerido`;

  return async function requireRoleMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    try {
      const ok = await hasRole(req.user, roleName, req as RoleCachedRequest);
      if (!ok) {
        return res
          .status(403)
          .json({ error: "Acesso negado", message });
      }
      next();
    } catch (error) {
      console.error("[authz] requireRole failure:", error);
      res.status(500).json({ error: "Erro ao verificar permissões" });
    }
  };
}

/**
 * Express middleware factory: require the user to hold AT LEAST ONE of
 * the given roles (union semantics; matches the project's RBAC decision
 * #9 of Fase 2 planning).
 */
export function requireAnyRole(
  roleNames: string[],
  opts: RequireRoleOptions = {}
) {
  const message =
    opts.message ??
    `Acesso negado: requer um dos papéis ${JSON.stringify(roleNames)}`;

  return async function requireAnyRoleMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    try {
      const ok = await hasAnyRole(req.user, roleNames, req as RoleCachedRequest);
      if (!ok) {
        return res
          .status(403)
          .json({ error: "Acesso negado", message });
      }
      next();
    } catch (error) {
      console.error("[authz] requireAnyRole failure:", error);
      res.status(500).json({ error: "Erro ao verificar permissões" });
    }
  };
}

/**
 * Shorthand for `requireRole(ROLES.ADMIN)`. Honors the emergency env-var
 * fallback through `hasRole`.
 */
export function requireAdmin(opts: RequireRoleOptions = {}) {
  return requireRole(ROLES.ADMIN, opts);
}
