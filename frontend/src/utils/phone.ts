// Lightweight, non-country-specific phone helpers that align with backend validation
// Allowed characters: digits, spaces, hyphens, plus signs, parentheses, and periods

/**
 * Sanitize phone input as the user types by stripping disallowed characters.
 * Preserves user intent and allowed punctuation without forcing a strict mask.
 */
export function formatPhoneInput(value: string): string {
  if (typeof value !== "string") return "";
  // Remove anything not allowed by backend regex: digits, whitespace, +, (), ., -
  // Avoid unnecessary escapes in character class
  const sanitized = value.replace(/[^\d\s()+.-]/g, "");
  // Normalize any whitespace (space, tab, newline) to single spaces and trim
  return sanitized.replace(/\s+/g, " ").trim();
}

/**
 * Normalize phone value on submit: trim and collapse spaces.
 * Avoid aggressive formatting to keep international numbers intact.
 */
export function normalizePhoneForSubmit(value: string): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s{2,}/g, " ");
}
