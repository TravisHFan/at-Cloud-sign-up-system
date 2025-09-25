import { IEvent } from "../models/Event";
import { ValidationUtils } from "./validationUtils";

export interface PublicEventRole {
  roleId: string;
  name: string;
  description: string;
  capacityRemaining: number;
  maxParticipants: number;
}

export interface PublicEventPayload {
  title: string;
  purpose?: string;
  agenda?: string;
  start: string; // ISO start datetime derived from event date/time (UTC formatting left for controller)
  end: string; // ISO end datetime
  location: string;
  flyerUrl?: string;
  roles: PublicEventRole[];
  slug: string;
}

// Basic sanitization of free-text fields (reuse ValidationUtils sanitizeString)
function sanitizeText(v?: string) {
  if (!v) return undefined;
  return ValidationUtils.sanitizeString(v).slice(0, 2000);
}

/**
 * Create a sanitized public representation of an event.
 * Assumes caller has already verified event.publish === true.
 */
export function serializePublicEvent(event: IEvent): PublicEventPayload {
  const roles = (event.roles || [])
    .filter((r) => r.openToPublic)
    .map((r) => ({
      roleId: r.id,
      name: ValidationUtils.sanitizeString(r.name).slice(0, 100),
      description: sanitizeText(r.description) || "",
      maxParticipants: r.maxParticipants,
      capacityRemaining: Math.max(
        0,
        r.maxParticipants // Remaining will require registration counts per role (future enhancement)
      ),
    }));

  // Combine date + time into ISO naive (keep as string – later we may apply TZ)
  const startISO = `${event.date}T${event.time}:00Z`;
  const endISO = `${event.endDate || event.date}T${event.endTime}:00Z`;

  return {
    title: ValidationUtils.sanitizeString(event.title).slice(0, 200),
    purpose: sanitizeText(event.purpose),
    agenda: sanitizeText(event.agenda),
    start: startISO,
    end: endISO,
    location: ValidationUtils.sanitizeString(event.location || "Online"),
    flyerUrl: event.flyerUrl,
    roles,
    slug: event.publicSlug || "",
  };
}
