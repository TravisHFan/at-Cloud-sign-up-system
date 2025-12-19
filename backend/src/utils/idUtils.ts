import mongoose from "mongoose";

/**
 * Shared ID utility functions for converting MongoDB ObjectIds and other ID-like values to strings.
 */

/**
 * Safely convert various ID-like values (ObjectId, string, etc.) to string.
 * Handles MongoDB ObjectId, strings, and any object with a toString() method.
 *
 * @param val - The value to convert to string (ObjectId, string, or object with toString)
 * @returns The string representation of the ID
 */
export function toIdString(val: unknown): string {
  if (typeof val === "string") return val;
  if (
    val &&
    typeof (val as { toString?: () => string }).toString === "function"
  ) {
    try {
      return (val as { toString: () => string }).toString();
    } catch {
      // fall through to String(val)
    }
  }
  return String(val ?? "");
}

/**
 * Check if a value is a valid MongoDB ObjectId.
 *
 * @param id - The value to check
 * @returns true if the value is a valid ObjectId format
 */
export function isValidObjectId(id: unknown): boolean {
  if (typeof id !== "string" || !id) return false;
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Validate that an ID is a valid MongoDB ObjectId.
 * Returns an object with validation result and optional error message.
 *
 * @param id - The ID to validate
 * @param fieldName - Optional field name for error message (default: "ID")
 * @returns { valid: boolean, message?: string }
 */
export function validateObjectId(
  id: unknown,
  fieldName = "ID"
): { valid: boolean; message?: string } {
  if (!id) {
    return { valid: false, message: `${fieldName} is required` };
  }
  if (!isValidObjectId(id)) {
    return { valid: false, message: `Invalid ${fieldName} format` };
  }
  return { valid: true };
}
