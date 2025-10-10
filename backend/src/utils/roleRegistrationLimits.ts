/**
 * Role-Based Registration Limits
 *
 * Defines the maximum number of roles a user can register for per event
 * based on their authorization level.
 *
 * Policy Updated: 2025-10-10
 */

export type UserAuthorization =
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
 * @param authorization - The user's authorization level
 * @returns The maximum number of roles, or Infinity for unlimited
 */
export function getMaxRolesPerEvent(authorization: UserAuthorization): number {
  if (!authorization) {
    // Unauthenticated guest (email only)
    return 1;
  }

  switch (authorization) {
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
      // Fallback for any unknown authorization
      return 1;
  }
}

/**
 * Returns a human-readable limit string for error messages.
 *
 * @param authorization - The user's authorization level
 * @returns A string describing the limit
 */
export function getMaxRolesMessage(authorization: UserAuthorization): string {
  const limit = getMaxRolesPerEvent(authorization);

  if (limit === Infinity) {
    return "unlimited";
  }

  return `${limit}`;
}

/**
 * Returns the full limit description for user display.
 *
 * @param authorization - The user's authorization level
 * @returns A descriptive string
 */
export function getMaxRolesDescription(
  authorization: UserAuthorization
): string {
  const limit = getMaxRolesPerEvent(authorization);

  if (limit === Infinity) {
    return "You have unlimited role registrations";
  }

  return `maximum is ${limit}`;
}

/**
 * Legacy constant for email-only guests (backward compatibility).
 * This represents the limit for unauthenticated guests.
 */
export const GUEST_MAX_ROLES_PER_EVENT = 1 as const;
