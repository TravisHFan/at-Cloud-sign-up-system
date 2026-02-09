/**
 * Centralized Program Type Constants
 *
 * This file defines all valid program types for the application.
 * When adding a new program type, only update this file and the backend model.
 * All validation and dropdown logic will automatically include the new type.
 */

export const PROGRAM_TYPES = [
  "EMBA Mentor Circles",
  "Effective Communication Workshops",
  "Marketplace Church Incubator Program (MCIP)",
  "Webinar",
  "NextGen",
] as const;

export type ProgramType = (typeof PROGRAM_TYPES)[number];

/**
 * Validates if a given string is a valid program type
 * @param value - The value to validate
 * @returns true if the value is a valid program type
 */
export function isValidProgramType(value: unknown): value is ProgramType {
  if (typeof value !== "string") return false;
  return PROGRAM_TYPES.includes(value as ProgramType);
}

/**
 * Get all program types as a readonly array
 * @returns Array of all valid program types
 */
export function getProgramTypes(): readonly string[] {
  return PROGRAM_TYPES;
}
