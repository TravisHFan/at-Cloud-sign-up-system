/**
 * Event Validation Utilities
 *
 * Contains validation logic for event data structures and constraints.
 * Extracted from eventController.ts to improve maintainability and reusability.
 */

/**
 * Validates roles for an event.
 *
 * Rules:
 * - Role names must be non-empty
 * - Role names must be unique (no duplicates)
 * - maxParticipants must be a positive integer >= 1
 * - maxParticipants cannot exceed 500 (reasonable upper bound)
 *
 * @param roles - Array of role objects to validate
 * @returns Validation result with success flag and optional error messages
 */
export function validateRoles(
  roles: Array<{ name: string; maxParticipants: number }>
): { valid: true } | { valid: false; errors: string[] } {
  const errors: string[] = [];
  const seenNames = new Set<string>();

  for (const role of roles) {
    const roleName = (role?.name || "").trim();
    const max = role?.maxParticipants;

    if (!roleName) {
      errors.push("Role name is required");
      continue;
    }

    if (seenNames.has(roleName)) {
      errors.push(`Duplicate role not allowed: ${roleName}`);
    } else {
      seenNames.add(roleName);
    }

    if (typeof max !== "number" || Number.isNaN(max) || max < 1) {
      errors.push(
        `Role "${roleName}": maxParticipants must be a positive integer`
      );
      continue;
    }

    // Maximum capacity per role: 500 (reasonable upper bound)
    if (max > 500) {
      errors.push(`Role "${roleName}" exceeds maximum allowed capacity (500).`);
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}
