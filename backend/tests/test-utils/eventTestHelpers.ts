// Helper utilities for building consistent, valid event request payloads in integration tests.
// Centralizing this reduces duplication and avoids subtle validation failures (e.g. purpose length).

interface RoleInput {
  id?: string;
  name?: string;
  description?: string;
  maxParticipants?: number;
  openToPublic?: boolean;
}

export interface BuildEventPayloadOptions {
  title?: string;
  type?: string; // e.g. Webinar, Workshop, Seminar
  date?: string; // YYYY-MM-DD
  endDate?: string; // optional in some routes but we set by default for consistency
  time?: string; // HH:mm
  endTime?: string; // HH:mm
  location?: string;
  format?: string; // Online, In-Person, Hybrid, etc.
  organizer?: string;
  roles?: RoleInput[];
  purpose?: string;
  suppressNotifications?: boolean;
  overrides?: Record<string, any>; // escape hatch for any additional ad-hoc fields
}

/**
 * Builds a valid base event creation payload with sensible defaults.
 * Consumers can pass partial overrides. Roles array can be overridden but must
 * still satisfy validation (name, description, maxParticipants etc.).
 */
export function buildValidEventPayload(opts: BuildEventPayloadOptions = {}) {
  const {
    title = "Test Event",
    type = "Webinar",
    date = "2030-01-01",
    endDate = date,
    time = "10:00",
    endTime = "11:00",
    location = "Online",
    format = "Online",
    organizer = "Automation",
    roles = [
      {
        name: "Participant",
        description: "General participation",
        maxParticipants: 10,
      },
    ],
    purpose = "Automated test event purpose ensuring minimum length requirement is satisfied.",
    suppressNotifications = true,
    overrides = {},
  } = opts;

  return {
    title,
    type,
    date,
    endDate,
    time,
    endTime,
    location,
    format,
    organizer,
    roles: roles.map((r, idx) => ({
      id: r.id, // allow explicit id override (API may ignore on create; some tests rely on deterministic ids)
      name: r.name ?? `Role_${idx + 1}`,
      description: r.description ?? "Role for integration test",
      maxParticipants: r.maxParticipants ?? 5,
      ...(typeof r.openToPublic === "boolean"
        ? { openToPublic: r.openToPublic }
        : {}),
    })),
    purpose,
    suppressNotifications,
    ...overrides,
  };
}
