import { IEvent, IEventRole } from "../models/Event";
import crypto from "crypto";
import { findUtcInstantFromLocal } from "../shared/time/timezoneSearch";

/**
 * Build a minimal RFC5545 VCALENDAR text for an event registration.
 * Uses proper timezone conversion to build accurate UTC times for ICS format.
 */
export function buildRegistrationICS(options: {
  event: Pick<
    IEvent,
    | "_id"
    | "title"
    | "date"
    | "endDate"
    | "time"
    | "endTime"
    | "location"
    | "purpose"
    | "timeZone"
  >;
  role?: Pick<IEventRole, "name" | "description"> | null;
  attendeeEmail?: string;
}): { filename: string; content: string } {
  const { event, role, attendeeEmail } = options;

  // Convert event's local time to proper UTC instants using timezone-aware conversion
  const startInstant = findUtcInstantFromLocal({
    date: event.date,
    time: event.time,
    timeZone: event.timeZone,
  });
  const endInstant = findUtcInstantFromLocal({
    date: event.endDate || event.date,
    time: event.endTime,
    timeZone: event.timeZone,
  });

  // Format as ICS UTC datetime (YYYYMMDDTHHMMSSZ)
  const startUtc = startInstant
    ? toICSDateTimeFromInstant(startInstant)
    : toICSDateTime(event.date, event.time); // fallback to naive conversion
  const endUtc = endInstant
    ? toICSDateTimeFromInstant(endInstant)
    : toICSDateTime(event.endDate || event.date, event.endTime); // fallback to naive conversion

  const uidSeed = `${event._id}-${attendeeEmail || "anon"}`;
  const uid = crypto
    .createHash("sha1")
    .update(uidSeed)
    .digest("hex")
    .slice(0, 24);
  const dtStamp = toICSDateTimeNow();

  // Escape commas, semicolons, and newlines per RFC
  function esc(v?: string | null): string {
    if (!v) return "";
    return v
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  const summary = role ? `${event.title} — ${role.name}` : event.title;
  const descriptionParts: string[] = [];
  if (role?.description) descriptionParts.push(role.description);
  if (event.purpose) descriptionParts.push(event.purpose);
  if (event.timeZone) descriptionParts.push(`Time Zone: ${event.timeZone}`);
  const description = descriptionParts.join("\n\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//atCloud//Public Registration//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}@atcloud`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${esc(summary)}`,
    `DESCRIPTION:${esc(description)}`,
    `LOCATION:${esc(event.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ];

  return {
    filename: `${uid}.ics`,
    content: lines.join("\r\n"),
  };
}

function toICSDateTimeFromInstant(instant: Date): string {
  // Convert UTC Date instance to ICS UTC datetime format (YYYYMMDDTHHMMSSZ)
  return (
    instant.getUTCFullYear().toString().padStart(4, "0") +
    (instant.getUTCMonth() + 1).toString().padStart(2, "0") +
    instant.getUTCDate().toString().padStart(2, "0") +
    "T" +
    instant.getUTCHours().toString().padStart(2, "0") +
    instant.getUTCMinutes().toString().padStart(2, "0") +
    instant.getUTCSeconds().toString().padStart(2, "0") +
    "Z"
  );
}

function toICSDateTime(date: string, time: string): string {
  // date in YYYY-MM-DD, time in HH:MM (24h). Naive conversion treating as UTC (fallback only).
  const [y, m, d] = date.split("-");
  const [hh, mm] = time.split(":");
  return `${y}${m}${d}T${hh}${mm}00Z`;
}

function toICSDateTimeNow(): string {
  const now = new Date();
  return (
    now.getUTCFullYear().toString().padStart(4, "0") +
    (now.getUTCMonth() + 1).toString().padStart(2, "0") +
    now.getUTCDate().toString().padStart(2, "0") +
    "T" +
    now.getUTCHours().toString().padStart(2, "0") +
    now.getUTCMinutes().toString().padStart(2, "0") +
    now.getUTCSeconds().toString().padStart(2, "0") +
    "Z"
  );
}

export default buildRegistrationICS;
