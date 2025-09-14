// Shared timezone utilities for consistent event date/time conversion.
// This consolidates logic previously duplicated in eventStatsUtils and SystemMessages.

export interface LocalDateTimeSpec {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm (24h)
  timeZone?: string; // IANA timezone name (optional)
}

interface TargetParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
}

/**
 * Finds the UTC instant whose wall clock representation in the provided IANA timeZone
 * matches the supplied local date + time. Handles DST shifts by searching +/-24h in 15m steps.
 * If timeZone is omitted, returns a Date constructed in the viewer's local zone from parts.
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
 * Formats the UTC instant found from local spec into the viewer's local time HH:mm (24h) or fallback.
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
 * Returns viewer-local { date: YYYY-MM-DD, time: HH:mm } given original local components.
 * Prefers IANA timezone conversion; if unavailable but eventDateTimeUtc provided, uses that.
 */
export function formatViewerLocalDateTime(
  spec: LocalDateTimeSpec & { eventDateTimeUtc?: string }
): { date: string; time: string } | null {
  let instant: Date | null = null;

  // 1. Prefer authoritative UTC instant if supplied by backend.
  if (spec.eventDateTimeUtc) {
    try {
      const d = new Date(spec.eventDateTimeUtc);
      if (!isNaN(d.getTime())) {
        instant = d;
      }
    } catch {
      /* ignore */
    }
  }

  // 2. If not available, attempt timezone-based reconstruction from local components.
  if (!instant && spec.timeZone) {
    instant = findUtcInstantFromLocal(spec);
  }

  // 3. Final fallback: naive reconstruction in viewer locale.
  if (!instant) {
    instant = findUtcInstantFromLocal({ date: spec.date, time: spec.time });
  }

  if (!instant) return null;
  const y = instant.getFullYear();
  const m = String(instant.getMonth() + 1).padStart(2, "0");
  const d = String(instant.getDate()).padStart(2, "0");
  const hh = String(instant.getHours()).padStart(2, "0");
  const mm = String(instant.getMinutes()).padStart(2, "0");
  return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
}
