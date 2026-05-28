/**
 * Front-end RBAC helpers.
 *
 * Mirrors server-side decisions without re-deriving them from raw payloads.
 * Always reuses the canonical role names and alias-aware matching from
 * `shared/roles.ts` so back and front stay in lockstep.
 *
 * The auth payload (`GET /api/user`) is enriched server-side with:
 *   - `roles: string[]` — raw role names as stored in the `roles` table
 *   - `isAdmin: boolean` — pre-computed admin flag (single source of truth)
 *
 * These helpers accept a permissive "user-like" shape so they can be called
 * with `useAuth().user` (which may be `null`) without extra null checks at
 * each callsite.
 */
import { ROLES, rolesMatch } from "@shared/roles";

export interface AuthUserLike {
  roles?: string[] | null;
  isAdmin?: boolean | null;
}

/**
 * True when the user holds an admin role.
 * Prefers the server-computed `isAdmin` flag and falls back to scanning the
 * raw role list with alias-aware matching.
 */
export function userIsAdmin(user: AuthUserLike | null | undefined): boolean {
  if (!user) return false;
  if (user.isAdmin === true) return true;
  const roles = user.roles ?? [];
  return roles.some((r) => rolesMatch(r, ROLES.ADMIN));
}

/**
 * True when the user holds the given role (alias-aware, case-insensitive).
 */
export function userHasRoleName(
  user: AuthUserLike | null | undefined,
  roleName: string,
): boolean {
  if (!user) return false;
  const roles = user.roles ?? [];
  return roles.some((r) => rolesMatch(r, roleName));
}

/**
 * True when the user holds any of the given roles.
 */
export function userHasAnyRoleName(
  user: AuthUserLike | null | undefined,
  roleNames: readonly string[],
): boolean {
  if (!user) return false;
  return roleNames.some((name) => userHasRoleName(user, name));
}

/**
 * True when the user holds the Logística role (any alias).
 */
export function userIsLogistica(
  user: AuthUserLike | null | undefined,
): boolean {
  return userHasRoleName(user, ROLES.LOGISTICA);
}

/**
 * Convenience: matches the back-end gate used on logistics write routes
 * (`requireAnyRole([ADMIN, LOGISTICA])`). Used by the front-end to decide
 * whether to show/enable create/edit/delete affordances on trips, drivers,
 * vehicles, docks, and loading-order ↔ trip linking.
 */
export function userCanWriteLogistics(
  user: AuthUserLike | null | undefined,
): boolean {
  return userIsAdmin(user) || userIsLogistica(user);
}
