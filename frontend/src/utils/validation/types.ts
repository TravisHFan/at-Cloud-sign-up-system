/**
 * Shared validation types used across event and program validation utilities
 */

/**
 * Represents the validation state of a single form field
 */
export interface FieldValidation {
  /** Whether the field value is valid */
  isValid: boolean;
  /** Human-readable validation message */
  message: string;
  /** Tailwind color class for styling (e.g., 'text-green-600', 'text-red-600') */
  color: string;
  /** Optional: Name of the first invalid field for navigation purposes */
  firstInvalidField?: string;
}

/**
 * Default validation state for a valid field
 */
export const VALID_FIELD: FieldValidation = {
  isValid: true,
  message: "",
  color: "text-green-600",
};

/**
 * Creates an invalid field validation result
 */
export function createInvalidField(
  message: string,
  firstInvalidField?: string
): FieldValidation {
  return {
    isValid: false,
    message,
    color: "text-red-600",
    firstInvalidField,
  };
}

/**
 * Creates a valid field validation result with optional message
 */
export function createValidField(message = ""): FieldValidation {
  return {
    isValid: true,
    message,
    color: "text-green-600",
  };
}
