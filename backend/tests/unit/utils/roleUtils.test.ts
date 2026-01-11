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
      ROLES.GUEST_EXPERT,
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
    // Admin can assign Guest Expert as well
    expect(
      RoleUtils.canPromoteUser(
        ROLES.ADMINISTRATOR,
        ROLES.PARTICIPANT,
        ROLES.GUEST_EXPERT
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
    // Admin CAN now access Super Admin (new rule)
    expect(
      RoleUtils.canAccessUserProfile(
        ROLES.ADMINISTRATOR,
        me,
        other,
        ROLES.SUPER_ADMIN
      )
    ).toBe(true);
    // Leader can access anyone
    expect(
      RoleUtils.canAccessUserProfile(ROLES.LEADER, me, other, ROLES.SUPER_ADMIN)
    ).toBe(true);
    // Participant cannot access others (only restriction)
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

  it("getRoleHierarchyIndex returns correct indices", () => {
    expect(RoleUtils.getRoleHierarchyIndex(ROLES.PARTICIPANT)).toBe(0);
    expect(RoleUtils.getRoleHierarchyIndex(ROLES.GUEST_EXPERT)).toBe(1);
    expect(RoleUtils.getRoleHierarchyIndex(ROLES.LEADER)).toBe(2);
    expect(RoleUtils.getRoleHierarchyIndex(ROLES.ADMINISTRATOR)).toBe(3);
    expect(RoleUtils.getRoleHierarchyIndex(ROLES.SUPER_ADMIN)).toBe(4);
    // Unknown role returns 0 (not -1)
    expect(RoleUtils.getRoleHierarchyIndex("Unknown" as any)).toBe(0);
  });

  it("getRolePermissions returns permissions for all standard roles", () => {
    const superAdminPerms = RoleUtils.getRolePermissions(ROLES.SUPER_ADMIN);
    expect(superAdminPerms).toContain("Full system access");
    expect(superAdminPerms.length).toBeGreaterThan(0);

    const adminPerms = RoleUtils.getRolePermissions(ROLES.ADMINISTRATOR);
    expect(adminPerms).toContain("Manage users (except Super Admins)");
    expect(adminPerms.length).toBeGreaterThan(0);

    const leaderPerms = RoleUtils.getRolePermissions(ROLES.LEADER);
    expect(leaderPerms).toContain("Create and manage own events");
    expect(leaderPerms.length).toBeGreaterThan(0);

    const guestExpertPerms = RoleUtils.getRolePermissions(ROLES.GUEST_EXPERT);
    expect(guestExpertPerms).toContain("Register for events");
    expect(guestExpertPerms.length).toBeGreaterThan(0);

    const participantPerms = RoleUtils.getRolePermissions(ROLES.PARTICIPANT);
    expect(participantPerms).toContain("Register for events");
    expect(participantPerms.length).toBeGreaterThan(0);

    // Unknown role returns fallback message
    const unknownPerms = RoleUtils.getRolePermissions("Unknown" as any);
    expect(unknownPerms).toEqual(["No permissions defined"]);
  });

  it("getRoleDisplayName returns correct display names", () => {
    expect(RoleUtils.getRoleDisplayName(ROLES.SUPER_ADMIN)).toBe("Super Admin");
    expect(RoleUtils.getRoleDisplayName(ROLES.ADMINISTRATOR)).toBe(
      "Administrator"
    );
    expect(RoleUtils.getRoleDisplayName(ROLES.LEADER)).toBe("Leader");
    expect(RoleUtils.getRoleDisplayName(ROLES.GUEST_EXPERT)).toBe(
      "Guest Expert"
    );
    expect(RoleUtils.getRoleDisplayName(ROLES.PARTICIPANT)).toBe("Participant");
  });

  it("canPromoteUser returns false when Admin tries to promote to Admin", () => {
    expect(
      RoleUtils.canPromoteUser(
        ROLES.ADMINISTRATOR,
        ROLES.PARTICIPANT,
        ROLES.ADMINISTRATOR
      )
    ).toBe(false);
  });
});
