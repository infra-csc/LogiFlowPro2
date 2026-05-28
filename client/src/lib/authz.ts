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

/**
 * True when the user holds the Almoxarifado role (any alias).
 */
export function userIsAlmoxarifado(
  user: AuthUserLike | null | undefined,
): boolean {
  return userHasRoleName(user, ROLES.ALMOXARIFADO);
}

/**
 * True when the user holds the Supervisor role (any alias).
 */
export function userIsSupervisor(
  user: AuthUserLike | null | undefined,
): boolean {
  return userHasRoleName(user, ROLES.SUPERVISOR);
}

/**
 * Mirrors back-end gate `requireAnyRole([ADMIN, LOGISTICA, ALMOXARIFADO])`
 * applied on `POST /api/loading-orders/:id/items` and
 * `POST /api/loading-orders/:id/mark-ready`. Used by the front to show
 * affordances for adding/removing items and marking the order as ready.
 */
export function userCanHandleLoadingOrderItems(
  user: AuthUserLike | null | undefined,
): boolean {
  return (
    userIsAdmin(user) || userIsLogistica(user) || userIsAlmoxarifado(user)
  );
}

/**
 * Alias of {@link userCanHandleLoadingOrderItems} — kept for callsite
 * readability where the action is specifically "mark as ready".
 */
export function userCanMarkLoadingOrderReady(
  user: AuthUserLike | null | undefined,
): boolean {
  return userCanHandleLoadingOrderItems(user);
}

/**
 * Mirrors back-end gate `requireAnyRole([ADMIN, SUPERVISOR])` applied on
 * `POST /api/loading-orders/:id/approve` and
 * `POST /api/loading-orders/:id/disapprove`. Used to show approve/disapprove
 * affordances in loading-order details.
 */
export function userCanApproveLoadingOrder(
  user: AuthUserLike | null | undefined,
): boolean {
  return userIsAdmin(user) || userIsSupervisor(user);
}
