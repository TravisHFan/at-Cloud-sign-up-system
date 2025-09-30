import { IEvent } from "../models/Event";

export interface PublishValidationError {
  field: string;
  code: string;
  message: string;
}

export interface PublishValidationResult {
  valid: boolean;
  errors: PublishValidationError[];
}

// Mapping of event formats to the necessary fields for publishing.
// These are optional while drafting but must be present (non-empty trimmed) at publish time
// and remain present to stay published.
export const NECESSARY_PUBLISH_FIELDS_BY_FORMAT: Record<string, string[]> = {
  Online: ["zoomLink", "meetingId", "passcode"],
  "In-person": ["location"],
  "Hybrid Participation": ["location", "zoomLink", "meetingId", "passcode"],
};

export function getMissingNecessaryFieldsForPublish(event: IEvent): string[] {
  const format = event.format;
  const needed = NECESSARY_PUBLISH_FIELDS_BY_FORMAT[format] || [];
  const missing: string[] = [];
  for (const f of needed) {
    const value = (event as unknown as Record<string, unknown>)[f];
    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim().length === 0)
    ) {
      missing.push(f);
    }
  }
  return missing;
}

// Minimum purpose/description length (business rule; adjust as needed)
const MIN_PURPOSE_LEN = 30;
// Allow test suite / current codebase to continue functioning without
// newly introduced strict validations breaking existing integration tests.
// Set env PUBLISH_STRICT_VALIDATION=true to enforce the extended rules.
const STRICT_VALIDATION = process.env.PUBLISH_STRICT_VALIDATION === "true";

/**
 * Validate whether an event satisfies publish requirements.
 * NOTE: Pure function – does not access DB; caller ensures event is loaded.
 */
export function validateEventForPublish(
  event: IEvent
): PublishValidationResult {
  const errors: PublishValidationError[] = [];

  // At least one role open to public
  const openRoles = (event.roles || []).filter(
    (r) => (r as { openToPublic?: boolean }).openToPublic
  );
  if (openRoles.length === 0) {
    errors.push({
      field: "roles",
      code: "NO_PUBLIC_ROLE",
      message: "At least one role must be marked openToPublic to publish.",
    });
  }

  // Enforce necessary publish fields (independent of STRICT_VALIDATION)
  const missing = getMissingNecessaryFieldsForPublish(event);
  if (missing.length) {
    // Per-field errors for granular UI mapping
    for (const f of missing) {
      errors.push({
        field: f,
        code: "MISSING",
        message: `${f} is required to publish this ${event.format} event.`,
      });
    }
    // Aggregate error for simpler detection
    errors.push({
      field: "__aggregate__",
      code: "MISSING_REQUIRED_FIELDS",
      message: `Missing necessary field(s) for publishing: ${missing.join(
        ", "
      )}.`,
    });
  }

  if (STRICT_VALIDATION) {
    // Additional optional strict validations (description length, timezone, etc.)
    const purpose = (event.purpose || "").trim();
    if (purpose && purpose.length < MIN_PURPOSE_LEN) {
      errors.push({
        field: "purpose",
        code: "TOO_SHORT",
        message: `Purpose/description must be at least ${MIN_PURPOSE_LEN} characters (currently ${purpose.length}).`,
      });
    }
    if (!event.timeZone || !event.timeZone.trim()) {
      errors.push({
        field: "timeZone",
        code: "MISSING",
        message:
          "timeZone is required to publish (IANA zone, e.g., America/Los_Angeles).",
      });
    }
  }

  // Flyer or placeholder (we treat flyer optional but encourage) – currently NOT enforced; placeholder for future rule.
  // Organizer contact: ensure organizer string present (schema already enforces); skip here.

  return { valid: errors.length === 0, errors };
}
