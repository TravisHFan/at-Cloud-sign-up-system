import { describe, it, expect } from "vitest";
import {
  findUtcInstantFromLocal,
  formatViewerLocalTime,
  formatViewerLocalDateTime,
  type LocalDateTimeSpec,
} from "../../../../src/shared/time/timezoneSearch";

describe("timezoneSearch", () => {
  describe("findUtcInstantFromLocal", () => {
    it("should find UTC instant for valid local date/time with timezone", () => {
      const spec: LocalDateTimeSpec = {
        date: "2025-06-15",
        time: "14:30",
        timeZone: "America/New_York",
      };

      const result = findUtcInstantFromLocal(spec);

      expect(result).toBeInstanceOf(Date);
      expect(result).not.toBeNull();
    });

    it("should handle local date/time without timezone", () => {
      const spec: LocalDateTimeSpec = {
        date: "2025-06-15",
        time: "14:30",
      };

      const result = findUtcInstantFromLocal(spec);

      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(5); // June (0-indexed)
      expect(result?.getDate()).toBe(15);
      expect(result?.getHours()).toBe(14);
      expect(result?.getMinutes()).toBe(30);
    });

    it("should handle different timezones correctly", () => {
      const specNY: LocalDateTimeSpec = {
        date: "2025-01-15",
        time: "12:00",
        timeZone: "America/New_York",
      };

      const specLA: LocalDateTimeSpec = {
        date: "2025-01-15",
        time: "12:00",
        timeZone: "America/Los_Angeles",
      };

      const resultNY = findUtcInstantFromLocal(specNY);
      const resultLA = findUtcInstantFromLocal(specLA);

      expect(resultNY).not.toBeNull();
      expect(resultLA).not.toBeNull();
      // LA is 3 hours behind NY, so LA noon should be later in UTC
      expect(resultLA!.getTime()).toBeGreaterThan(resultNY!.getTime());
    });

    it("should return null for invalid date format", () => {
      const spec: LocalDateTimeSpec = {
        date: "invalid-date",
        time: "14:30",
        timeZone: "America/New_York",
      };

      const result = findUtcInstantFromLocal(spec);

      expect(result).toBeNull();
    });

    it("should return null for invalid time format", () => {
      const spec: LocalDateTimeSpec = {
        date: "2025-06-15",
        time: "invalid:time",
        timeZone: "America/New_York",
      };

      const result = findUtcInstantFromLocal(spec);

      expect(result).toBeNull();
    });

    it("should handle edge case: midnight", () => {
      const spec: LocalDateTimeSpec = {
        date: "2025-06-15",
        time: "00:00",
        timeZone: "UTC",
      };

      const result = findUtcInstantFromLocal(spec);

      expect(result).toBeInstanceOf(Date);
      expect(result?.getUTCHours()).toBe(0);
      expect(result?.getUTCMinutes()).toBe(0);
    });

    it("should handle edge case: 23:59", () => {
      const spec: LocalDateTimeSpec = {
        date: "2025-06-15",
        time: "23:59",
        timeZone: "UTC",
      };

      const result = findUtcInstantFromLocal(spec);

      expect(result).toBeInstanceOf(Date);
      expect(result?.getUTCHours()).toBe(23);
      expect(result?.getUTCMinutes()).toBe(59);
    });

    it("should handle DST transition dates", () => {
      // March DST transition in US (spring forward)
      const spec: LocalDateTimeSpec = {
        date: "2025-03-09",
        time: "03:00",
        timeZone: "America/New_York",
      };

      const result = findUtcInstantFromLocal(spec);

      expect(result).toBeInstanceOf(Date);
    });

    it("should handle leap year date", () => {
      const spec: LocalDateTimeSpec = {
        date: "2024-02-29",
        time: "12:00",
        timeZone: "UTC",
      };

      const result = findUtcInstantFromLocal(spec);

      expect(result).toBeInstanceOf(Date);
      expect(result?.getUTCDate()).toBe(29);
      expect(result?.getUTCMonth()).toBe(1); // February
    });

    it("should handle year boundaries", () => {
      const spec: LocalDateTimeSpec = {
        date: "2024-12-31",
        time: "23:59",
        timeZone: "UTC",
      };

      const result = findUtcInstantFromLocal(spec);

      expect(result).toBeInstanceOf(Date);
      expect(result?.getUTCFullYear()).toBe(2024);
      expect(result?.getUTCMonth()).toBe(11); // December
      expect(result?.getUTCDate()).toBe(31);
    });

    it("should handle single digit time components", () => {
      const spec: LocalDateTimeSpec = {
        date: "2025-01-05",
        time: "09:05",
        timeZone: "UTC",
      };

      const result = findUtcInstantFromLocal(spec);

      expect(result).toBeInstanceOf(Date);
      expect(result?.getUTCHours()).toBe(9);
      expect(result?.getUTCMinutes()).toBe(5);
    });

    it("should handle Asia/Tokyo timezone", () => {
      const spec: LocalDateTimeSpec = {
        date: "2025-06-15",
        time: "14:30",
        timeZone: "Asia/Tokyo",
      };

      const result = findUtcInstantFromLocal(spec);

      expect(result).toBeInstanceOf(Date);
      expect(result).not.toBeNull();
    });

    it("should handle Europe/London timezone", () => {
      const spec: LocalDateTimeSpec = {
        date: "2025-06-15",
        time: "14:30",
        timeZone: "Europe/London",
      };

      const result = findUtcInstantFromLocal(spec);

      expect(result).toBeInstanceOf(Date);
      expect(result).not.toBeNull();
    });
  });

  describe("formatViewerLocalTime", () => {
    it("should format time in viewer's local timezone", () => {
      const spec: LocalDateTimeSpec = {
        date: "2025-06-15",
        time: "14:30",
        timeZone: "UTC",
      };

      const result = formatViewerLocalTime(spec);

      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it("should return null for invalid spec", () => {
      const spec: LocalDateTimeSpec = {
        date: "invalid",
        time: "14:30",
        timeZone: "UTC",
      };

      const result = formatViewerLocalTime(spec);

      expect(result).toBeNull();
    });

    it("should handle midnight", () => {
      const spec: LocalDateTimeSpec = {
        date: "2025-06-15",
        time: "00:00",
        timeZone: "UTC",
      };

      const result = formatViewerLocalTime(spec);

      expect(result).toBeTruthy();
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it("should handle late evening time", () => {
      const spec: LocalDateTimeSpec = {
        date: "2025-06-15",
        time: "23:59",
        timeZone: "UTC",
      };

      const result = formatViewerLocalTime(spec);

      expect(result).toBeTruthy();
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it("should handle spec without timezone", () => {
      const spec: LocalDateTimeSpec = {
        date: "2025-06-15",
        time: "14:30",
      };

      const result = formatViewerLocalTime(spec);

      expect(result).toBeTruthy();
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe("formatViewerLocalDateTime", () => {
    it("should format date and time in viewer's local timezone", () => {
      const spec: LocalDateTimeSpec = {
        date: "2025-06-15",
        time: "14:30",
        timeZone: "UTC",
      };

      const result = formatViewerLocalDateTime(spec);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty("date");
      expect(result).toHaveProperty("time");
      expect(result?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result?.time).toMatch(/^\d{2}:\d{2}$/);
    });

    it("should use eventDateTimeUtc when provided", () => {
      const utcDateTimeString = "2025-06-15T18:30:00.000Z";
      const spec: LocalDateTimeSpec & { eventDateTimeUtc?: string } = {
        date: "2025-06-15",
        time: "14:30",
        timeZone: "America/New_York",
        eventDateTimeUtc: utcDateTimeString,
      };

      const result = formatViewerLocalDateTime(spec);

      expect(result).not.toBeNull();
      expect(result?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result?.time).toMatch(/^\d{2}:\d{2}$/);
    });

    it("should fallback to timeZone when eventDateTimeUtc is invalid", () => {
      const spec: LocalDateTimeSpec & { eventDateTimeUtc?: string } = {
        date: "2025-06-15",
        time: "14:30",
        timeZone: "America/New_York",
        eventDateTimeUtc: "invalid-date",
      };

      const result = formatViewerLocalDateTime(spec);

      expect(result).not.toBeNull();
      expect(result?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result?.time).toMatch(/^\d{2}:\d{2}$/);
    });

    it("should fallback to local time when no timezone provided", () => {
      const spec: LocalDateTimeSpec = {
        date: "2025-06-15",
        time: "14:30",
      };

      const result = formatViewerLocalDateTime(spec);

      expect(result).not.toBeNull();
      expect(result?.date).toBe("2025-06-15");
      expect(result?.time).toBe("14:30");
    });

    it("should return null for completely invalid spec", () => {
      const spec: LocalDateTimeSpec = {
        date: "invalid",
        time: "invalid",
      };

      const result = formatViewerLocalDateTime(spec);

      expect(result).toBeNull();
    });

    it("should handle midnight in formatted output", () => {
      const spec: LocalDateTimeSpec = {
        date: "2025-06-15",
        time: "00:00",
        timeZone: "UTC",
      };

      const result = formatViewerLocalDateTime(spec);

      expect(result).not.toBeNull();
      expect(result?.time).toMatch(/^\d{2}:\d{2}$/);
    });

    it("should handle year boundary dates", () => {
      const spec: LocalDateTimeSpec = {
        date: "2024-12-31",
        time: "23:59",
        timeZone: "UTC",
      };

      const result = formatViewerLocalDateTime(spec);

      expect(result).not.toBeNull();
      expect(result?.date).toMatch(/^2024-12-31|2025-01-01$/); // Could roll over depending on viewer TZ
    });

    it("should properly pad single digit month and day", () => {
      const spec: LocalDateTimeSpec = {
        date: "2025-01-05",
        time: "09:05",
        timeZone: "UTC",
      };

      const result = formatViewerLocalDateTime(spec);

      expect(result).not.toBeNull();
      expect(result?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result?.time).toMatch(/^\d{2}:\d{2}$/);
    });

    it("should handle DST transition correctly", () => {
      const spec: LocalDateTimeSpec = {
        date: "2025-03-09",
        time: "03:00",
        timeZone: "America/New_York",
      };

      const result = formatViewerLocalDateTime(spec);

      expect(result).not.toBeNull();
      expect(result?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should handle valid ISO 8601 eventDateTimeUtc", () => {
      const spec: LocalDateTimeSpec & { eventDateTimeUtc?: string } = {
        date: "2025-06-15",
        time: "14:30",
        eventDateTimeUtc: "2025-06-15T14:30:00Z",
      };

      const result = formatViewerLocalDateTime(spec);

      expect(result).not.toBeNull();
      expect(result?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result?.time).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe("integration: cross-function behavior", () => {
    it("should handle same spec consistently across all functions", () => {
      const spec: LocalDateTimeSpec = {
        date: "2025-06-15",
        time: "14:30",
        timeZone: "America/New_York",
      };

      const instant = findUtcInstantFromLocal(spec);
      const timeStr = formatViewerLocalTime(spec);
      const dateTimeObj = formatViewerLocalDateTime(spec);

      expect(instant).not.toBeNull();
      expect(timeStr).not.toBeNull();
      expect(dateTimeObj).not.toBeNull();
    });

    it("should handle UTC timezone consistently", () => {
      const spec: LocalDateTimeSpec = {
        date: "2025-06-15",
        time: "12:00",
        timeZone: "UTC",
      };

      const instant = findUtcInstantFromLocal(spec);
      const dateTimeObj = formatViewerLocalDateTime(spec);

      expect(instant).toBeInstanceOf(Date);
      expect(dateTimeObj).not.toBeNull();
      expect(instant?.getUTCHours()).toBe(12);
      expect(instant?.getUTCMinutes()).toBe(0);
    });
  });
});
