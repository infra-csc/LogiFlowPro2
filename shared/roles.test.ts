import { describe, it, expect } from "vitest";
import { ROLES, normalizeRoleName, isAdminRoleName, rolesMatch } from "./roles";

/**
 * These helpers decide who passes `requireRole` / `requireAdmin`, so the cases
 * that matter most are the ones tying the literal role names in the database
 * seed to the canonical constants used in route guards.
 */

describe("normalizeRoleName", () => {
  it("trims and lowercases", () => {
    expect(normalizeRoleName("  Gestor Logistica ")).toBe("gestor logistica");
  });

  it("returns empty string for nullish input instead of throwing", () => {
    expect(normalizeRoleName(null)).toBe("");
    expect(normalizeRoleName(undefined)).toBe("");
    expect(normalizeRoleName("")).toBe("");
  });
});

describe("isAdminRoleName", () => {
  it("accepts the name actually used by the seed", () => {
    // server/index.ts seeds the admin role as "Adm", not "admin".
    expect(isAdminRoleName("Adm")).toBe(true);
  });

  it("accepts the English spelling and ignores casing/whitespace", () => {
    expect(isAdminRoleName("admin")).toBe(true);
    expect(isAdminRoleName("ADMIN")).toBe(true);
    expect(isAdminRoleName("  adm  ")).toBe(true);
  });

  it("rejects non-admin roles and nullish input", () => {
    expect(isAdminRoleName("supervisor")).toBe(false);
    expect(isAdminRoleName("administrador")).toBe(false);
    expect(isAdminRoleName(null)).toBe(false);
  });
});

describe("rolesMatch", () => {
  // Each entry is a role name as seeded in server/index.ts (CANONICAL_ROLES)
  // paired with the constant that route guards check against. If someone
  // renames a seeded role without updating the aliases, these break — which is
  // the point: the mismatch would otherwise show up as a silent 403.
  const seededToCanonical: Array<[string, string]> = [
    ["Adm", ROLES.ADMIN],
    ["Gestor Logistica", ROLES.LOGISTICA],
    ["Almoxarifado", ROLES.ALMOXARIFADO],
    ["Supervisor", ROLES.SUPERVISOR],
  ];

  it.each(seededToCanonical)("matches seeded %s to %s", (seeded, canonical) => {
    expect(rolesMatch(seeded, canonical)).toBe(true);
  });

  it("is symmetric for canonical/alias pairs", () => {
    expect(rolesMatch("Adm", ROLES.ADMIN)).toBe(true);
    expect(rolesMatch(ROLES.ADMIN, "Adm")).toBe(true);
  });

  it("accepts the accented spelling of logistica", () => {
    expect(rolesMatch("Gestor Logística", ROLES.LOGISTICA)).toBe(true);
  });

  it("does not match unrelated roles", () => {
    expect(rolesMatch("Supervisor", ROLES.ADMIN)).toBe(false);
    expect(rolesMatch("Usuario Requisitor", ROLES.ADMIN)).toBe(false);
    expect(rolesMatch(null, ROLES.ADMIN)).toBe(false);
    expect(rolesMatch(ROLES.ADMIN, "")).toBe(false);
  });

  it("does not relate two aliases of the same role to each other", () => {
    // Known limitation, asserted so it is a decision rather than a surprise:
    // alias expansion only happens when one side is a canonical key, so two
    // aliases of the same role do not match. Safe today because every caller
    // passes a ROLES.* constant as one side; it would bite anyone comparing
    // two raw names from the database.
    expect(rolesMatch("almox", "estoque")).toBe(false);
    expect(rolesMatch("aprovador", "supervisor")).toBe(true); // canonical key
  });
});
