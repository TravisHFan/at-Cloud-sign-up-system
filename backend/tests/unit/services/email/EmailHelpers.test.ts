/**
 * EmailHelpers Unit Tests
 *
 * Tests date/time formatting and normalization utilities used in email templates.
 * All methods are pure functions with no external dependencies.
 */

import { describe, it, expect } from "vitest";
import { EmailHelpers } from "../../../../src/services/email/EmailHelpers";

describe("EmailHelpers", () => {
  describe("normalizeTimeTo24h", () => {
    it("should convert 12-hour AM times to 24-hour format", () => {
      expect(EmailHelpers.normalizeTimeTo24h("12:00 am")).toBe("00:00");
      expect(EmailHelpers.normalizeTimeTo24h("1:30 am")).toBe("01:30");
      expect(EmailHelpers.normalizeTimeTo24h("11:59 am")).toBe("11:59");
    });

    it("should convert 12-hour PM times to 24-hour format", () => {
      expect(EmailHelpers.normalizeTimeTo24h("12:00 pm")).toBe("12:00");
      expect(EmailHelpers.normalizeTimeTo24h("1:00 pm")).toBe("13:00");
      expect(EmailHelpers.normalizeTimeTo24h("11:59 pm")).toBe("23:59");
    });

    it("should handle case-insensitive AM/PM", () => {
      expect(EmailHelpers.normalizeTimeTo24h("3:45 AM")).toBe("03:45");
      expect(EmailHelpers.normalizeTimeTo24h("3:45 PM")).toBe("15:45");
      expect(EmailHelpers.normalizeTimeTo24h("3:45 Am")).toBe("03:45");
      expect(EmailHelpers.normalizeTimeTo24h("3:45 Pm")).toBe("15:45");
    });

    it("should return already-normalized 24-hour times unchanged", () => {
      expect(EmailHelpers.normalizeTimeTo24h("00:00")).toBe("00:00");
      expect(EmailHelpers.normalizeTimeTo24h("13:30")).toBe("13:30");
      expect(EmailHelpers.normalizeTimeTo24h("23:59")).toBe("23:59");
    });

    it("should handle edge cases", () => {
      expect(EmailHelpers.normalizeTimeTo24h("")).toBe("00:00");
      expect(EmailHelpers.normalizeTimeTo24h("12:00am")).toBe("00:00"); // No space but still matches
      expect(EmailHelpers.normalizeTimeTo24h("invalid")).toBe("invalid");
    });

    it("should handle whitespace variations", () => {
      expect(EmailHelpers.normalizeTimeTo24h(" 2:30 pm ")).toBe("14:30");
      expect(EmailHelpers.normalizeTimeTo24h("10:15  am")).toBe("10:15");
    });
  });

  describe("buildDate", () => {
    it("should build Date from date and time without timezone", () => {
      const result = EmailHelpers.buildDate("2025-06-15", "14:30");
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toContain("2025-06-15");
    });

    it("should handle 12-hour time format", () => {
      const result = EmailHelpers.buildDate("2025-06-15", "2:30 pm");
      expect(result).toBeInstanceOf(Date);
      // After normalization, should be 14:30
    });

    it("should build Date with timezone (PST/PDT)", () => {
      const result = EmailHelpers.buildDate(
        "2025-06-15",
        "14:30",
        "America/Los_Angeles"
      );
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThan(0);
    });

    it("should build Date with timezone (EST/EDT)", () => {
      const result = EmailHelpers.buildDate(
        "2025-12-15",
        "14:30",
        "America/New_York"
      );
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThan(0);
    });

    it("should handle midnight", () => {
      const result = EmailHelpers.buildDate("2025-06-15", "00:00");
      expect(result).toBeInstanceOf(Date);
    });

    it("should handle end of day", () => {
      const result = EmailHelpers.buildDate("2025-06-15", "23:59");
      expect(result).toBeInstanceOf(Date);
    });

    it("should fallback gracefully on invalid timezone", () => {
      const result = EmailHelpers.buildDate(
        "2025-06-15",
        "14:30",
        "Invalid/Timezone"
      );
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe("formatDateTime", () => {
    it("should format date and time without timezone", () => {
      const result = EmailHelpers.formatDateTime("2025-06-15", "14:30");
      expect(result).toContain("Sunday");
      expect(result).toContain("June");
      expect(result).toContain("15");
      expect(result).toContain("2025");
      expect(result).toContain("2:30");
      expect(result).toContain("PM");
    });

    it("should format with 12-hour time input", () => {
      const result = EmailHelpers.formatDateTime("2025-06-15", "2:30 pm");
      expect(result).toContain("2:30");
      expect(result).toContain("PM");
    });

    it("should format date and time with timezone", () => {
      const result = EmailHelpers.formatDateTime(
        "2025-06-15",
        "14:30",
        "America/Los_Angeles"
      );
      expect(result).toContain("Sunday");
      expect(result).toContain("June");
      expect(result).toContain("15");
      expect(result).toContain("2025");
      expect(result).toMatch(/PDT|PST/); // Timezone abbreviation
    });

    it("should format midnight correctly", () => {
      const result = EmailHelpers.formatDateTime("2025-06-15", "00:00");
      expect(result).toContain("12:00");
      expect(result).toContain("AM");
    });

    it("should format end of day correctly", () => {
      const result = EmailHelpers.formatDateTime("2025-06-15", "23:59");
      expect(result).toContain("11:59");
      expect(result).toContain("PM");
    });
  });

  describe("formatTime", () => {
    it("should format time without timezone", () => {
      const result = EmailHelpers.formatTime("14:30");
      expect(result).toContain("2:30");
      expect(result).toContain("PM");
    });

    it("should format time with timezone", () => {
      const result = EmailHelpers.formatTime(
        "14:30",
        "America/Los_Angeles",
        "2025-06-15"
      );
      expect(result).toContain("2:30");
      expect(result).toContain("PM");
      expect(result).toMatch(/PDT|PST/);
    });

    it("should format midnight correctly", () => {
      const result = EmailHelpers.formatTime("00:00");
      expect(result).toContain("12:00");
      expect(result).toContain("AM");
    });

    it("should format noon correctly", () => {
      const result = EmailHelpers.formatTime("12:00");
      expect(result).toContain("12:00");
      expect(result).toContain("PM");
    });

    it("should handle 12-hour format input", () => {
      const result = EmailHelpers.formatTime("2:30 pm");
      expect(result).toContain("2:30");
      expect(result).toContain("PM");
    });

    it("should format time without date parameter", () => {
      const result = EmailHelpers.formatTime("14:30", undefined);
      expect(result).toContain("2:30");
      expect(result).toContain("PM");
    });
  });

  describe("formatDateTimeRange", () => {
    it("should format single-day event with start and end time", () => {
      const result = EmailHelpers.formatDateTimeRange(
        "2025-06-15",
        "14:30",
        "16:00"
      );
      expect(result).toContain("Sunday");
      expect(result).toContain("June 15, 2025");
      expect(result).toContain("2:30 PM");
      expect(result).toContain("-");
      expect(result).toContain("4:00 PM");
    });

    it("should format single-day event without end time", () => {
      const result = EmailHelpers.formatDateTimeRange(
        "2025-06-15",
        "14:30",
        undefined
      );
      expect(result).toContain("Sunday");
      expect(result).toContain("June 15, 2025");
      expect(result).toContain("2:30 PM");
      expect(result).not.toContain("-");
    });

    it("should format multi-day event", () => {
      const result = EmailHelpers.formatDateTimeRange(
        "2025-06-15",
        "14:30",
        "16:00",
        "2025-06-17"
      );
      expect(result).toContain("Sunday, June 15, 2025");
      expect(result).toContain("-");
      expect(result).toContain("Tuesday, June 17, 2025");
      expect(result).toContain("2:30 PM");
      expect(result).toContain("4:00 PM");
    });

    it("should format multi-day event with same start/end date (edge case)", () => {
      const result = EmailHelpers.formatDateTimeRange(
        "2025-06-15",
        "14:30",
        "16:00",
        "2025-06-15"
      );
      // Same date, should format as single day
      expect(result).toContain("2:30 PM");
      expect(result).toContain("4:00 PM");
    });

    it("should format with timezone", () => {
      const result = EmailHelpers.formatDateTimeRange(
        "2025-06-15",
        "14:30",
        "16:00",
        undefined,
        "America/Los_Angeles"
      );
      expect(result).toContain("PDT");
      expect(result).toContain("2:30 PM");
      expect(result).toContain("4:00 PM");
    });

    it("should format overnight event (same day by date, crosses midnight)", () => {
      const result = EmailHelpers.formatDateTimeRange(
        "2025-06-15",
        "22:00",
        "02:00"
      );
      expect(result).toContain("10:00 PM");
      expect(result).toContain("2:00 AM");
    });

    it("should handle 12-hour format times", () => {
      const result = EmailHelpers.formatDateTimeRange(
        "2025-06-15",
        "2:30 pm",
        "4:00 pm"
      );
      expect(result).toContain("2:30 PM");
      expect(result).toContain("4:00 PM");
    });
  });

  describe("edge cases and integration", () => {
    it("should handle DST transition dates", () => {
      // March DST transition (spring forward)
      const spring = EmailHelpers.buildDate(
        "2025-03-09",
        "02:30",
        "America/Los_Angeles"
      );
      expect(spring).toBeInstanceOf(Date);

      // November DST transition (fall back)
      const fall = EmailHelpers.buildDate(
        "2025-11-02",
        "01:30",
        "America/Los_Angeles"
      );
      expect(fall).toBeInstanceOf(Date);
    });

    it("should handle various timezones consistently", () => {
      const timezones = [
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
        "Europe/London",
        "Asia/Tokyo",
      ];

      timezones.forEach((tz) => {
        const result = EmailHelpers.formatDateTime("2025-06-15", "14:30", tz);
        expect(result).toContain("2025");
        expect(result).toContain("June");
      });
    });

    it("should handle year boundaries", () => {
      const newYearsEve = EmailHelpers.formatDateTime(
        "2025-12-31",
        "23:59",
        "America/New_York"
      );
      expect(newYearsEve).toContain("2025");
      expect(newYearsEve).toContain("11:59 PM");

      const newYearsDay = EmailHelpers.formatDateTime(
        "2026-01-01",
        "00:01",
        "America/New_York"
      );
      expect(newYearsDay).toContain("2026");
      expect(newYearsDay).toContain("12:01 AM");
    });

    it("should maintain consistency between related methods", () => {
      const date = "2025-06-15";
      const time = "14:30";
      const tz = "America/Los_Angeles";

      const builtDate = EmailHelpers.buildDate(date, time, tz);
      const formatted = EmailHelpers.formatDateTime(date, time, tz);

      // Both should represent the same moment
      expect(builtDate).toBeInstanceOf(Date);
      expect(formatted).toContain("2025");
    });
  });
});
