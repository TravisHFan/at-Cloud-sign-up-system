import { describe, it, expect } from "vitest";
import {
  ROLES,
  RoleUtils,
  PERMISSIONS,
  hasPermission,
  getRolePermissions,
} from "../../../src/utils/roleUtils";

describe("roleUtils", () => {
  it("hasRole and hasAnyRole work", () => {
    expect(RoleUtils.hasRole(ROLES.ADMINISTRATOR, ROLES.ADMINISTRATOR)).toBe(
      true
    );
    expect(RoleUtils.hasRole(ROLES.LEADER, ROLES.ADMINISTRATOR)).toBe(false);
    expect(
      RoleUtils.hasAnyRole(ROLES.LEADER, [ROLES.PARTICIPANT, ROLES.LEADER])
    ).toBe(true);
    expect(
      RoleUtils.hasAnyRole(ROLES.PARTICIPANT, [
        ROLES.LEADER,
        ROLES.ADMINISTRATOR,
      ])
    ).toBe(false);
  });

  it("hasMinimumRole handles hierarchy and unknowns", () => {
    expect(RoleUtils.hasMinimumRole(ROLES.LEADER, ROLES.PARTICIPANT)).toBe(
      true
    );
    expect(RoleUtils.hasMinimumRole(ROLES.PARTICIPANT, ROLES.LEADER)).toBe(
      false
    );
    expect(RoleUtils.hasMinimumRole("Unknown" as any, ROLES.LEADER)).toBe(
      false
    );
  });

  it("admin/superadmin helpers", () => {
    expect(RoleUtils.isAdmin(ROLES.SUPER_ADMIN)).toBe(true);
    expect(RoleUtils.isAdmin(ROLES.ADMINISTRATOR)).toBe(true);
    expect(RoleUtils.isAdmin(ROLES.LEADER)).toBe(false);
    expect(RoleUtils.isSuperAdmin(ROLES.SUPER_ADMIN)).toBe(true);
    expect(RoleUtils.isSuperAdmin(ROLES.ADMINISTRATOR)).toBe(false);
  });

  it("capability helpers", () => {
    expect(RoleUtils.isLeaderOrHigher(ROLES.LEADER)).toBe(true);
    expect(RoleUtils.isLeaderOrHigher(ROLES.PARTICIPANT)).toBe(false);
    expect(RoleUtils.canManageEvents(ROLES.LEADER)).toBe(true);
    expect(RoleUtils.canManageEvents(ROLES.PARTICIPANT)).toBe(false);
    expect(RoleUtils.canManageUsers(ROLES.ADMINISTRATOR)).toBe(true);
    expect(RoleUtils.canManageUsers(ROLES.LEADER)).toBe(false);
    expect(RoleUtils.canManageSystem(ROLES.SUPER_ADMIN)).toBe(true);
    expect(RoleUtils.canManageSystem(ROLES.ADMINISTRATOR)).toBe(false);
  });

  it("roles above/below and display name", () => {
    expect(RoleUtils.getRolesAtOrBelow(ROLES.LEADER)).toEqual([
      ROLES.PARTICIPANT,
      ROLES.LEADER,
    ]);
    expect(RoleUtils.getRolesAbove(ROLES.LEADER)).toEqual([
      ROLES.ADMINISTRATOR,
      ROLES.SUPER_ADMIN,
    ]);
    expect(RoleUtils.getRolesAtOrBelow("Unknown" as any)).toEqual([]);
    expect(RoleUtils.getRolesAbove("Unknown" as any)).toEqual([]);
    expect(RoleUtils.getRoleDisplayName("Unknown" as any)).toBe("Unknown Role");
  });

  it("promotion/demotion with invalid and valid roles", () => {
    expect(RoleUtils.isPromotion(ROLES.LEADER, ROLES.SUPER_ADMIN)).toBe(true);
    expect(RoleUtils.isPromotion(ROLES.SUPER_ADMIN, ROLES.LEADER)).toBe(false);
    expect(RoleUtils.isPromotion("Unknown" as any, ROLES.LEADER)).toBe(false);
    expect(RoleUtils.isDemotion(ROLES.SUPER_ADMIN, ROLES.LEADER)).toBe(true);
    expect(RoleUtils.isDemotion(ROLES.LEADER, ROLES.SUPER_ADMIN)).toBe(false);
    expect(RoleUtils.isDemotion(ROLES.LEADER, "Unknown" as any)).toBe(false);
  });

  it("permissions map and unknown fallback", () => {
    expect(getRolePermissions(ROLES.ADMINISTRATOR).length).toBeGreaterThan(0);
    expect(getRolePermissions("Unknown" as any)).toEqual([]);
    expect(hasPermission(ROLES.ADMINISTRATOR, PERMISSIONS.EDIT_ANY_EVENT)).toBe(
      true
    );
    expect(hasPermission("Unknown" as any, PERMISSIONS.EDIT_ANY_EVENT)).toBe(
      false
    );
  });

  it("promotion rights and profile access rules", () => {
    // Super Admin can promote anyone
    expect(
      RoleUtils.canPromoteUser(
        ROLES.SUPER_ADMIN,
        ROLES.LEADER,
        ROLES.SUPER_ADMIN
      )
    ).toBe(true);
    // Admin can promote only to Leader/Participant
    expect(
      RoleUtils.canPromoteUser(
        ROLES.ADMINISTRATOR,
        ROLES.PARTICIPANT,
        ROLES.LEADER
      )
    ).toBe(true);
    expect(
      RoleUtils.canPromoteUser(
        ROLES.ADMINISTRATOR,
        ROLES.PARTICIPANT,
        ROLES.SUPER_ADMIN
      )
    ).toBe(false);
    // Leaders cannot promote
    expect(
      RoleUtils.canPromoteUser(ROLES.LEADER, ROLES.PARTICIPANT, ROLES.LEADER)
    ).toBe(false);

    const me = "u1";
    const other = "u2";
    // Self access
    expect(
      RoleUtils.canAccessUserProfile(ROLES.PARTICIPANT, me, me, ROLES.LEADER)
    ).toBe(true);
    // Super Admin access
    expect(
      RoleUtils.canAccessUserProfile(
        ROLES.SUPER_ADMIN,
        me,
        other,
        ROLES.ADMINISTRATOR
      )
    ).toBe(true);
    // Admin cannot access Super Admin
    expect(
      RoleUtils.canAccessUserProfile(
        ROLES.ADMINISTRATOR,
        me,
        other,
        ROLES.SUPER_ADMIN
      )
    ).toBe(false);
    // Leader can access anyone
    expect(
      RoleUtils.canAccessUserProfile(ROLES.LEADER, me, other, ROLES.SUPER_ADMIN)
    ).toBe(true);
    // Participant cannot access others
    expect(
      RoleUtils.canAccessUserProfile(
        ROLES.PARTICIPANT,
        me,
        other,
        ROLES.PARTICIPANT
      )
    ).toBe(false);
  });

  it("default role and validation", () => {
    expect(RoleUtils.getDefaultRole()).toBe(ROLES.PARTICIPANT);
    expect(RoleUtils.isValidRole(ROLES.LEADER)).toBe(true);
    expect(RoleUtils.isValidRole("Unknown" as any)).toBe(false);
  });
});
