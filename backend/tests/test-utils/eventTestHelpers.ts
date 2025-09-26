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

// Creates and persists a published Event document with at least one role.
// Ensures required fields like createdBy, publicSlug, and publishedAt are set.
// Accepts optional overrides which can include roles, publish flag, etc.
// This is intentionally placed in test-utils to avoid repeating boilerplate in multiple integration tests.
import Event from "../../src/models/Event";
import User from "../../src/models/User";
import mongoose from "mongoose";

export async function ensureCreatorUser() {
  const existing = await User.findOne({ username: "creatoradmin" });
  if (existing) return (existing as any)._id;
  const user = await User.create({
    username: "creatoradmin",
    email: `creatoradmin-${Date.now()}@example.com`,
    password: "Password123!",
    firstName: "Creator",
    lastName: "Admin",
    role: "Administrator",
    isVerified: true,
    gender: "male",
    isAtCloudLeader: false,
  } as any);
  return (user as any)._id;
}

export async function createPublishedEvent(overrides: Partial<any> = {}) {
  const creatorId = await ensureCreatorUser();
  const base = buildValidEventPayload();
  (base as any).publish = true;
  if (!overrides.roles) {
    base.roles = [
      {
        name: "Attendee",
        description: "General attendee",
        maxParticipants: 5,
        openToPublic: true,
        id: new mongoose.Types.ObjectId().toString(),
      },
    ];
  }
  const evt = await Event.create({
    ...base,
    createdBy: creatorId,
    ...overrides,
  });
  if (!evt.publicSlug) {
    evt.publicSlug = `test-event-${evt._id.toString().slice(-6)}`;
  }
  if (!evt.publishedAt) {
    evt.publishedAt = new Date();
  }
  await evt.save();
  return evt;
}
