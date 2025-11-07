/**
 * Email Helper Utilities
 *
 * Date/time formatting and normalization utilities for email content
 * Handles timezone conversions and date range formatting
 */

export class EmailHelpers {
  /**
   * Normalize time string from 12h to 24h format
   */
  static normalizeTimeTo24h(time: string): string {
    if (!time) return "00:00";
    const t = time.trim();
    const ampm = /(am|pm)$/i;
    if (!ampm.test(t)) {
      return t;
    }
    const match = t.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (!match) return t;
    const [_, hh, mm, ap] = match;
    let h = parseInt(hh, 10);
    if (/pm/i.test(ap) && h !== 12) h += 12;
    if (/am/i.test(ap) && h === 12) h = 0;
    const h2 = h.toString().padStart(2, "0");
    return `${h2}:${mm}`;
  }

  /**
   * Build a Date object from date string, time, and optional timezone
   * Handles timezone-aware date construction with DST support
   */
  static buildDate(date: string, time: string, timeZone?: string): Date {
    const t24 = this.normalizeTimeTo24h(time);
    if (!timeZone) {
      // Preserve existing behavior when no timezone is provided (assume local system tz)
      return new Date(`${date}T${t24}`);
    }

    // When a timezone is provided, interpret the provided date/time as local wall time
    // in that timezone and convert it to an absolute Date. This avoids shifting caused
    // by using the system timezone as the base.
    try {
      const [yStr, mStr, dStr] = date.split("-");
      const [hhStr, mmStr] = t24.split(":");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const d = parseInt(dStr, 10);
      const hh = parseInt(hhStr || "0", 10);
      const mm = parseInt(mmStr || "0", 10);

      // Start with the UTC timestamp for the intended wall time components
      const utcTs = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);

      const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      const parts = dtf.formatToParts(new Date(utcTs));
      const get = (type: string) =>
        parts.find((p) => p.type === type)?.value || "0";
      const zoneY = parseInt(get("year"), 10);
      const zoneM = parseInt(get("month"), 10);
      const zoneD = parseInt(get("day"), 10);
      const zoneH = parseInt(get("hour"), 10);
      const zoneMin = parseInt(get("minute"), 10);
      const zoneS = parseInt(get("second"), 10);

      // zoneTs is what the formatter says the wall time would be for the given UTC instant
      const zoneTs = Date.UTC(
        zoneY,
        (zoneM || 1) - 1,
        zoneD || 1,
        zoneH || 0,
        zoneMin || 0,
        zoneS || 0,
        0
      );
      const offset = zoneTs - utcTs; // difference between zone local time and UTC for that instant

      // Adjust the UTC timestamp by the offset to get the absolute time that corresponds
      // to the intended wall time in the given timezone (handles DST correctly)
      return new Date(utcTs - offset);
    } catch {
      // Fallback to previous behavior if anything goes wrong
      return new Date(`${date}T${t24}`);
    }
  }

  /**
   * Format date and time with timezone support
   */
  static formatDateTime(date: string, time: string, timeZone?: string): string {
    const d = this.buildDate(date, time, timeZone);
    const opts: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      ...(timeZone ? { timeZone, timeZoneName: "short" } : {}),
    };
    try {
      return new Intl.DateTimeFormat("en-US", opts).format(d);
    } catch {
      return d.toLocaleString("en-US", opts);
    }
  }

  /**
   * Format time with timezone support
   */
  static formatTime(time: string, timeZone?: string, date?: string): string {
    const t24 = this.normalizeTimeTo24h(time);
    const [hours, minutes] = t24.split(":");

    // Use the provided date if available, otherwise fall back to current date
    const temp = date ? this.buildDate(date, time, timeZone) : new Date();
    if (!date) {
      temp.setHours(parseInt(hours || "0"), parseInt(minutes || "0"), 0, 0);
    }

    const opts: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      ...(timeZone ? { timeZone, timeZoneName: "short" } : {}),
    };
    try {
      return new Intl.DateTimeFormat("en-US", opts).format(temp);
    } catch {
      return temp.toLocaleString("en-US", opts);
    }
  }

  /**
   * Format a date/time range with timezone support
   * Handles single-day and multi-day events
   */
  static formatDateTimeRange(
    date: string,
    startTime: string,
    endTime?: string,
    endDate?: string,
    timeZone?: string
  ): string {
    const multiDay = !!endDate && endDate !== date;
    const left = this.formatDateTime(date, startTime, timeZone);
    if (!endTime) return left;
    if (multiDay) {
      const right = this.formatDateTime(endDate as string, endTime, timeZone);
      return `${left} - ${right}`;
    }
    const right = this.formatTime(endTime, timeZone, date);
    return `${left} - ${right}`;
  }
}
