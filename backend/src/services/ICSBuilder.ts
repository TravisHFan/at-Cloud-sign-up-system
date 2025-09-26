import { IEvent, IEventRole } from "../models/Event";
import crypto from "crypto";

/**
 * Build a minimal RFC5545 VCALENDAR text for an event registration.
 * We intentionally keep this dependency-free; times are treated as UTC by appending Z.
 * If a timeZone is supplied on the event, future enhancement can localize correctly.
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

  const startUtc = toICSDateTime(event.date, event.time);
  const endUtc = toICSDateTime(event.endDate || event.date, event.endTime);
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

function toICSDateTime(date: string, time: string): string {
  // date in YYYY-MM-DD, time in HH:MM (24h). Treat as UTC for now.
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
