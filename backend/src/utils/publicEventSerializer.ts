import { IEvent } from "../models/Event";
import { ValidationUtils } from "./validationUtils";
import Registration from "../models/Registration";

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
export async function serializePublicEvent(
  event: IEvent
): Promise<PublicEventPayload> {
  const openRoles = (event.roles || []).filter((r) => r.openToPublic);
  const roleIds = openRoles.map((r) => r.id);
  let counts: Record<string, number> = {};
  if (roleIds.length) {
    const agg = await Registration.aggregate<{
      _id: string;
      count: number;
    }>([
      {
        $match: {
          eventId: event._id,
          roleId: { $in: roleIds },
          status: "active",
        },
      },
      { $group: { _id: "$roleId", count: { $sum: 1 } } },
    ]);
    counts = agg.reduce<Record<string, number>>((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {});
  }

  const roles = openRoles.map((r) => {
    const used = counts[r.id] || 0;
    const remaining = Math.max(0, r.maxParticipants - used);
    return {
      roleId: r.id,
      name: ValidationUtils.sanitizeString(r.name).slice(0, 100),
      description: sanitizeText(r.description) || "",
      maxParticipants: r.maxParticipants,
      capacityRemaining: remaining,
    };
  });

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
