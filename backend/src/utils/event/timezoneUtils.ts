/**
 * Timezone Utilities for Event Management
 *
 * Handles conversion between wall-clock times (local to event timezone)
 * and UTC instants. Supports IANA timezone strings and handles edge cases
 * like DST transitions.
 *
 * Extracted from eventController.ts as part of Phase 3.4 refactoring.
 */

/**
 * Convert a wall-clock date+time (YYYY-MM-DD, HH:mm) in a given IANA timeZone to a UTC instant.
 *
 * @param date - Date string in YYYY-MM-DD format
 * @param time - Time string in HH:mm format
 * @param timeZone - Optional IANA timezone string (e.g., 'America/Los_Angeles')
 *                   If not provided, uses local system timezone
 * @returns Date object representing the UTC instant
 *
 * Edge cases handled:
 * - DST spring-forward: If the requested wall-clock time doesn't exist,
 *   rounds FORWARD to the next representable wall-clock instant
 *   (e.g., 02:30 -> 03:00 on spring-forward day)
 * - DST fall-back: Returns the first occurrence (pre-DST transition)
 */
export function toInstantFromWallClock(
  date: string,
  time: string,
  timeZone?: string
): Date {
  const [y, mo, d] = date.split("-").map((v) => parseInt(v, 10));
  const [hh, mi] = time.split(":").map((v) => parseInt(v, 10));
  if (!timeZone) {
    const local = new Date();
    local.setFullYear(y, mo - 1, d);
    local.setHours(hh, mi, 0, 0);
    return local;
  }
  const target = {
    year: String(y).padStart(4, "0"),
    month: String(mo).padStart(2, "0"),
    day: String(d).padStart(2, "0"),
    hour: String(hh).padStart(2, "0"),
    minute: String(mi).padStart(2, "0"),
  } as const;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const base = Date.UTC(y, mo - 1, d, hh, mi, 0, 0);
  const matches = (ts: number) => {
    const parts = fmt
      .formatToParts(ts)
      .reduce<Record<string, string>>((acc, p) => {
        if (p.type !== "literal") acc[p.type] = p.value;
        return acc;
      }, {});
    return (
      parts.year === target.year &&
      parts.month === target.month &&
      parts.day === target.day &&
      parts.hour === target.hour &&
      parts.minute === target.minute
    );
  };
  let found: Date | null = null;
  const stepMs = 15 * 60 * 1000;
  const rangeMs = 24 * 60 * 60 * 1000;
  for (let offset = -rangeMs; offset <= rangeMs; offset += stepMs) {
    const ts = base + offset;
    if (matches(ts)) {
      found = new Date(ts);
      break;
    }
  }
  if (found) return found;

  // Fallback: If no exact wall-clock match (e.g., during DST spring-forward when
  // the local time doesn't exist), round FORWARD to the next representable
  // wall-clock instant in the given time zone. This maps e.g. 02:30 -> 03:00
  // on the spring-forward day in America/Los_Angeles.
  const wallParts = (ts: number) => {
    const parts = fmt
      .formatToParts(ts)
      .reduce<Record<string, string>>((acc, p) => {
        if (p.type !== "literal") acc[p.type] = p.value;
        return acc;
      }, {});
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}`,
    };
  };

  const cmp = (
    a: { date: string; time: string },
    b: { date: string; time: string }
  ) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.time.localeCompare(b.time);

  const targetWall = {
    date: `${target.year}-${target.month}-${target.day}`,
    time: `${target.hour}:${target.minute}`,
  };

  // Search forward minute-by-minute up to 24 hours to find the first representable wall time >= target
  const minute = 60 * 1000;
  for (let ts = base; ts <= base + 24 * 60 * minute; ts += minute) {
    const wp = wallParts(ts);
    if (cmp(wp, targetWall) >= 0) {
      return new Date(ts);
    }
  }

  // As a last resort, return the base UTC time (best-effort)
  return new Date(base);
}

/**
 * Format a UTC instant into wall-clock strings in a given IANA timeZone.
 *
 * @param instant - UTC Date object to convert
 * @param timeZone - Optional IANA timezone string
 *                   If not provided, uses local system timezone
 * @returns Object with { date: 'YYYY-MM-DD', time: 'HH:mm' }
 */
export function instantToWallClock(
  instant: Date,
  timeZone?: string
): { date: string; time: string } {
  if (!timeZone) {
    const yyyy = instant.getFullYear();
    const mm = String(instant.getMonth() + 1).padStart(2, "0");
    const dd = String(instant.getDate()).padStart(2, "0");
    const hh = String(instant.getHours()).padStart(2, "0");
    const mi = String(instant.getMinutes()).padStart(2, "0");
    return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}` };
  }
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt
    .formatToParts(instant)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}
