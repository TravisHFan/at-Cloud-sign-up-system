/**
 * Role-Based Registration Limits (Frontend)
 *
 * Calculates the maximum number of roles a user can register for per event
 * based on their role/authorization level.
 *
 * Policy Updated: 2025-10-10
 */

export type UserRole =
  | "Super Admin"
  | "Administrator"
  | "Leader"
  | "Guest Expert"
  | "Participant"
  | null
  | undefined;

/**
 * Returns the maximum number of roles a user can register for in a single event.
 *
 * @param role - The user's role level
 * @returns The maximum number of roles, or Infinity for unlimited
 */
export function getMaxRolesPerEvent(role: UserRole): number {
  if (!role) {
    // Unauthenticated guest (should not reach this in EventDetail, but fallback)
    return 1;
  }

  switch (role) {
    case "Super Admin":
    case "Administrator":
      return Infinity; // No limit

    case "Leader":
      return 5;

    case "Guest Expert":
      return 4;

    case "Participant":
      return 3;

    default:
      // Fallback for any unknown role
      return 1;
  }
}

/**
 * Returns whether the user has unlimited role registrations.
 *
 * @param role - The user's role level
 * @returns true if unlimited, false otherwise
 */
export function hasUnlimitedRoles(role: UserRole): boolean {
  return getMaxRolesPerEvent(role) === Infinity;
}
