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
