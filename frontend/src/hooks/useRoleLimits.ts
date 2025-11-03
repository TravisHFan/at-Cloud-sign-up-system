import type { EventData, EventRole } from "../types/event";
import {
  getMaxRolesPerEvent,
  hasUnlimitedRoles,
  type UserRole,
} from "../utils/roleRegistrationLimits";

export interface RoleLimitsResult {
  userSignedUpRoles: EventRole[];
  maxRolesForUser: number;
  userDistinctRoleCount: number;
  hasReachedMaxRoles: boolean;
  isUserSignedUp: boolean;
}

/**
 * Custom hook for multi-role limit tracking (NEW POLICY 2025-10-10)
 * - Super Admin & Administrator: Unlimited
 * - Leader: 5 roles
 * - Guest Expert: 4 roles
 * - Participant: 3 roles
 *
 * EXTRACTED FROM: EventDetail.tsx lines 493-525
 */
export function useRoleLimits(
  event: EventData | null,
  currentUserId: string,
  currentUserRole: UserRole
): RoleLimitsResult {
  // Get all roles the user is signed up for
  const getUserSignupRoles = (): EventRole[] => {
    if (!event) return [];

    return event.roles.filter(
      (role) =>
        role.currentSignups?.some(
          (signup) => signup.userId === currentUserId
        ) ?? false
    );
  };

  // NEW POLICY (2025-10-10): Role-based registration limits per event:
  // - Super Admin & Administrator: Unlimited
  // - Leader: 5 roles
  // - Guest Expert: 4 roles
  // - Participant: 3 roles
  const userSignedUpRoles = getUserSignupRoles();
  const maxRolesForUser = getMaxRolesPerEvent(currentUserRole);
  const userDistinctRoleCount = event
    ? event.roles.reduce(
        (count, r) =>
          count +
          (r.currentSignups.some((s) => s.userId === currentUserId) ? 1 : 0),
        0
      )
    : 0;
  const hasReachedMaxRoles = hasUnlimitedRoles(currentUserRole)
    ? false
    : userDistinctRoleCount >= maxRolesForUser;
  const isUserSignedUp = userSignedUpRoles.length > 0;

  return {
    userSignedUpRoles,
    maxRolesForUser,
    userDistinctRoleCount,
    hasReachedMaxRoles,
    isUserSignedUp,
  };
}
