/**
 * Shared timezone utilities for deriving an authoritative UTC instant
 * from a local date/time in a specific IANA time zone, resilient to DST gaps/ambiguities.
 *
 * Algorithm:
 * 1. Build a base UTC timestamp using Date.UTC(y, m, d, h, m).
 * 2. Walk a +/-24h window in 15 minute increments.
 * 3. Format each candidate in the target timeZone with Intl.DateTimeFormat.
 * 4. Return first candidate whose formatted parts exactly match requested wall-clock parts.
 * 5. Fallback: if none match (extremely rare), return Date constructed from base UTC timestamp.
 *
 * This mirrors logic previously implemented separately in backend and frontend; now centralized.
 */

export interface LocalDateTimeSpec {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm 24h
  timeZone?: string; // Optional IANA zone; if omitted viewer local reconstruction is used
}

interface TargetParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
}

/**
 * Finds a UTC Date whose wall-clock representation in `spec.timeZone` equals the provided date+time.
 * Returns null if input parts are invalid. If no timeZone provided, constructs a Date in the
town's (runtime) local zone from the parts.
 */
export function findUtcInstantFromLocal(spec: LocalDateTimeSpec): Date | null {
  try {
    const { date, time, timeZone } = spec;
    const [h, m] = time.split(":").map((v) => parseInt(v, 10));
    const [y, mo, d] = date.split("-").map((v) => parseInt(v, 10));
    if ([h, m, y, mo, d].some((n) => isNaN(n))) return null;

    if (!timeZone) {
      const local = new Date();
      local.setFullYear(y, mo - 1, d);
      local.setHours(h, m, 0, 0);
      return local;
    }

    const target: TargetParts = {
      year: String(y).padStart(4, "0"),
      month: String(mo).padStart(2, "0"),
      day: String(d).padStart(2, "0"),
      hour: String(h).padStart(2, "0"),
      minute: String(m).padStart(2, "0"),
    };

    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const base = Date.UTC(y, mo - 1, d, h, m, 0, 0);

    const matchesTarget = (ts: number) => {
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
      if (matchesTarget(ts)) {
        found = new Date(ts);
        break;
      }
    }

    return found || new Date(base);
  } catch {
    return null;
  }
}

/**
 * Helper: format viewer-local HH:mm for a given spec.
 */
export function formatViewerLocalTime(spec: LocalDateTimeSpec): string | null {
  const instant = findUtcInstantFromLocal(spec);
  if (!instant) return null;
  return instant.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Returns viewer-local { date, time } for display, given local components + optional authoritative UTC.
 */
export function formatViewerLocalDateTime(
  spec: LocalDateTimeSpec & { eventDateTimeUtc?: string }
): { date: string; time: string } | null {
  let instant: Date | null = null;

  if (spec.eventDateTimeUtc) {
    try {
      const d = new Date(spec.eventDateTimeUtc);
      if (!isNaN(d.getTime())) instant = d;
    } catch {
      /* ignore */
    }
  }
  if (!instant && spec.timeZone) instant = findUtcInstantFromLocal(spec);
  if (!instant)
    instant = findUtcInstantFromLocal({ date: spec.date, time: spec.time });
  if (!instant) return null;

  const y = instant.getFullYear();
  const m = String(instant.getMonth() + 1).padStart(2, "0");
  const d = String(instant.getDate()).padStart(2, "0");
  const hh = String(instant.getHours()).padStart(2, "0");
  const mm = String(instant.getMinutes()).padStart(2, "0");
  return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
}
