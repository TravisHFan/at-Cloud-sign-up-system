/**
 * Utility functions for formatting system messages
 * Implements the requirement to show [System Authorization Level] [Full Name] instead of email addresses
 */

/**
 * Format actor display for system messages
 * Instead of showing email address, show [System Authorization Level] [Full Name]
 *
 * @param actor - The user performing the action
 * @returns Formatted string like "Super Admin John Doe"
 */
export function formatActorDisplay(actor: {
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
}): string {
  // Get full name, fallback to email if no name available
  const fullName =
    [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;

  // Return format: [System Authorization Level] [Full Name]
  return `${actor.role} ${fullName}`;
}

/**
 * Format target user display for system messages
 * Shows the user's full name and username/email information
 *
 * @param user - The target user
 * @returns Formatted string like "John Doe (@johndoe, john@example.com)"
 */
export function formatTargetUserDisplay(user: {
  firstName?: string;
  lastName?: string;
  username?: string;
  email: string;
}): string {
  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    user.email;

  const username = user.username ? `@${user.username}` : user.email;

  return `${fullName} (${username}, ${user.email})`;
}
