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

/**
 * Validates event pricing structure.
 *
 * Rules:
 * - If pricing.isFree is false, pricing.price is required and must be >= 1
 * - If pricing.isFree is true, pricing.price must be undefined/null
 * - Price must be in USD (whole dollars, converted to cents for storage)
 *
 * @param pricing - Pricing object to validate
 * @returns Validation result with success flag and optional error message
 */
export function validatePricing(pricing?: {
  isFree?: boolean;
  price?: number;
}): { valid: true } | { valid: false; error: string } {
  // If pricing is undefined or null, default to free (backward compatibility)
  if (!pricing) {
    return { valid: true };
  }

  const isFree = pricing.isFree !== false; // Default to true if undefined

  // Paid event validation
  if (!isFree) {
    if (pricing.price === undefined || pricing.price === null) {
      return {
        valid: false,
        error: "Price is required for paid events",
      };
    }

    if (typeof pricing.price !== "number" || Number.isNaN(pricing.price)) {
      return {
        valid: false,
        error: "Price must be a valid number",
      };
    }

    if (pricing.price < 1) {
      return {
        valid: false,
        error: "Minimum price is $1 for paid events",
      };
    }

    // Optional: add maximum price validation if needed
    if (pricing.price > 10000) {
      return {
        valid: false,
        error: "Maximum price is $10,000",
      };
    }
  } else {
    // Free event validation - price should not be set
    if (pricing.price !== undefined && pricing.price !== null) {
      return {
        valid: false,
        error: "Free events should not have a price",
      };
    }
  }

  return { valid: true };
}
