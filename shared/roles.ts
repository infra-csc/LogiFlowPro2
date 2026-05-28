/**
 * Canonical role names and pure helpers for normalization.
 *
 * Isomorphic: this file has zero runtime dependencies and can be imported
 * by both back-end (server/*) and front-end (client/*) without pulling in
 * Node-only modules.
 *
 * Seed history (pt-BR): the admin role in the current database is named
 * "Adm". Earlier code paths assumed the literal "admin". Helpers here
 * accept BOTH spellings case-insensitively so the live seed and any
 * future install that uses the English name both resolve to admin.
 * No new role is granted — callers only honor roles already assigned via
 * `user_roles`.
 */

export const ROLES = {
  ADMIN: "admin",
  LOGISTICA: "logistica",
} as const;

/**
 * Legacy aliases recognized as equivalent to a canonical role.
 * Comparison is always case-insensitive after `normalizeRoleName`.
 *
 * Logística: the live seed names this role "Gestor Logistica" (pt-BR,
 * no accent). We canonicalize as "logistica" in code and accept the
 * accented variant and the "Gestor ..." prefix as equivalents so the
 * seed is not renamed.
 */
const ROLE_ALIASES: Record<string, readonly string[]> = {
  [ROLES.ADMIN]: ["admin", "adm"],
  [ROLES.LOGISTICA]: [
    "logistica",
    "logística",
    "gestor logistica",
    "gestor logística",
  ],
};

/**
 * Pure helper: trim + lowercase. Returns `""` for nullish input.
 * Never throws.
 */
export function normalizeRoleName(name: string | null | undefined): string {
  if (!name) return "";
  return name.trim().toLowerCase();
}

/**
 * Pure helper: decide whether a given role name represents the admin role.
 * Accepts "admin", "adm", with any casing or surrounding whitespace.
 */
export function isAdminRoleName(name: string | null | undefined): boolean {
  const n = normalizeRoleName(name);
  if (!n) return false;
  return ROLE_ALIASES[ROLES.ADMIN].includes(n);
}

/**
 * Pure helper: compare two role names using normalization + aliases.
 * Useful for `hasRole`-style checks without DB access.
 */
export function rolesMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const na = normalizeRoleName(a);
  const nb = normalizeRoleName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // If one side is a canonical key, expand its alias list.
  if (ROLE_ALIASES[na]?.includes(nb)) return true;
  if (ROLE_ALIASES[nb]?.includes(na)) return true;
  return false;
}
