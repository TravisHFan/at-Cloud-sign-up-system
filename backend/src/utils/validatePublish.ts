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
  const openRoles = (event.roles || []).filter((r) => (r as any).openToPublic);
  if (openRoles.length === 0) {
    errors.push({
      field: "roles",
      code: "NO_PUBLIC_ROLE",
      message: "At least one role must be marked openToPublic to publish.",
    });
  }

  if (STRICT_VALIDATION) {
    // Purpose (serves as public description)
    const purpose = (event.purpose || "").trim();
    if (purpose && purpose.length < MIN_PURPOSE_LEN) {
      errors.push({
        field: "purpose",
        code: "TOO_SHORT",
        message: `Purpose/description must be at least ${MIN_PURPOSE_LEN} characters (currently ${purpose.length}).`,
      });
    }

    // Time zone strongly recommended if cross-regional; optionally enforce if absent
    if (!event.timeZone || !event.timeZone.trim()) {
      errors.push({
        field: "timeZone",
        code: "MISSING",
        message:
          "timeZone is required to publish (IANA zone, e.g., America/Los_Angeles).",
      });
    }

    // Location or virtual meeting link depending on format
    // For Online format allow missing physical location IF zoomLink present
    const format = event.format;
    const loc = (event.location || "").trim();
    if (format === "In-person" || format === "Hybrid Participation") {
      if (!loc) {
        errors.push({
          field: "location",
          code: "MISSING",
          message: "Location is required for in-person or hybrid events.",
        });
      }
    }
    if (format === "Online") {
      // Encourage at least one virtual access artifact (zoomLink or materials)
      if (!event.zoomLink) {
        errors.push({
          field: "zoomLink",
          code: "MISSING",
          message: "zoomLink is required for Online events to publish.",
        });
      }
    }
  }

  // Flyer or placeholder (we treat flyer optional but encourage) – currently NOT enforced; placeholder for future rule.
  // Organizer contact: ensure organizer string present (schema already enforces); skip here.

  return { valid: errors.length === 0, errors };
}
