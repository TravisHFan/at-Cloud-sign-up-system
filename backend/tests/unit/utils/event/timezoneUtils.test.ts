/**
 * timezoneUtils.test.ts
 *
 * Unit tests for timezone conversion utilities.
 */
import { describe, it, expect } from "vitest";
import {
  toInstantFromWallClock,
  instantToWallClock,
} from "../../../../src/utils/event/timezoneUtils";

describe("timezoneUtils", () => {
  describe("toInstantFromWallClock", () => {
    describe("without timezone (local)", () => {
      it("should convert date and time to local Date", () => {
        const result = toInstantFromWallClock("2024-06-15", "14:30");

        // Should be a valid Date
        expect(result).toBeInstanceOf(Date);
        // Should match local time
        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(5); // June is month 5 (0-indexed)
        expect(result.getDate()).toBe(15);
        expect(result.getHours()).toBe(14);
        expect(result.getMinutes()).toBe(30);
      });

      it("should handle midnight (00:00)", () => {
        const result = toInstantFromWallClock("2024-01-01", "00:00");

        expect(result.getHours()).toBe(0);
        expect(result.getMinutes()).toBe(0);
      });

      it("should handle end of day (23:59)", () => {
        const result = toInstantFromWallClock("2024-12-31", "23:59");

        expect(result.getHours()).toBe(23);
        expect(result.getMinutes()).toBe(59);
      });
    });

    describe("with timezone", () => {
      it("should convert wall-clock time in America/New_York to UTC", () => {
        // January 15, 2024 at 10:00 AM EST is UTC 15:00
        const result = toInstantFromWallClock(
          "2024-01-15",
          "10:00",
          "America/New_York"
        );

        expect(result).toBeInstanceOf(Date);
        // EST is UTC-5 in January
        expect(result.getUTCHours()).toBe(15);
        expect(result.getUTCMinutes()).toBe(0);
      });

      it("should convert wall-clock time in America/Los_Angeles to UTC", () => {
        // January 15, 2024 at 10:00 AM PST is UTC 18:00
        const result = toInstantFromWallClock(
          "2024-01-15",
          "10:00",
          "America/Los_Angeles"
        );

        expect(result).toBeInstanceOf(Date);
        // PST is UTC-8 in January
        expect(result.getUTCHours()).toBe(18);
        expect(result.getUTCMinutes()).toBe(0);
      });

      it("should convert wall-clock time in Europe/London to UTC", () => {
        // January 15, 2024 at 10:00 AM GMT is UTC 10:00
        const result = toInstantFromWallClock(
          "2024-01-15",
          "10:00",
          "Europe/London"
        );

        expect(result).toBeInstanceOf(Date);
        // GMT is UTC+0 in January
        expect(result.getUTCHours()).toBe(10);
        expect(result.getUTCMinutes()).toBe(0);
      });

      it("should handle timezone with positive offset (Asia/Tokyo)", () => {
        // January 15, 2024 at 10:00 AM JST is UTC 01:00
        const result = toInstantFromWallClock(
          "2024-01-15",
          "10:00",
          "Asia/Tokyo"
        );

        expect(result).toBeInstanceOf(Date);
        // JST is UTC+9
        expect(result.getUTCHours()).toBe(1);
        expect(result.getUTCMinutes()).toBe(0);
      });

      it("should handle DST summer time", () => {
        // July 15, 2024 at 10:00 AM PDT is UTC 17:00 (PDT is UTC-7)
        const result = toInstantFromWallClock(
          "2024-07-15",
          "10:00",
          "America/Los_Angeles"
        );

        expect(result).toBeInstanceOf(Date);
        expect(result.getUTCHours()).toBe(17);
      });

      it("should handle midnight in timezone", () => {
        const result = toInstantFromWallClock(
          "2024-01-15",
          "00:00",
          "America/New_York"
        );

        expect(result).toBeInstanceOf(Date);
        // Midnight EST is 05:00 UTC
        expect(result.getUTCHours()).toBe(5);
      });

      it("should handle single-digit hour/minute parsing", () => {
        const result = toInstantFromWallClock(
          "2024-01-01",
          "09:05",
          "Europe/London"
        );

        expect(result.getUTCHours()).toBe(9);
        expect(result.getUTCMinutes()).toBe(5);
      });
    });

    describe("edge cases", () => {
      it("should handle year boundary", () => {
        const result = toInstantFromWallClock(
          "2023-12-31",
          "23:00",
          "America/New_York"
        );

        expect(result).toBeInstanceOf(Date);
        // 23:00 EST on Dec 31 is 04:00 UTC on Jan 1
        expect(result.getUTCFullYear()).toBe(2024);
        expect(result.getUTCMonth()).toBe(0); // January
        expect(result.getUTCDate()).toBe(1);
        expect(result.getUTCHours()).toBe(4);
      });

      it("should handle leap year date", () => {
        const result = toInstantFromWallClock(
          "2024-02-29",
          "12:00",
          "Europe/London"
        );

        expect(result).toBeInstanceOf(Date);
        expect(result.getUTCMonth()).toBe(1); // February
        expect(result.getUTCDate()).toBe(29);
      });
    });
  });

  describe("instantToWallClock", () => {
    describe("without timezone (local)", () => {
      it("should convert Date to local wall-clock strings", () => {
        const date = new Date(2024, 5, 15, 14, 30, 0, 0); // June 15, 2024 14:30 local

        const result = instantToWallClock(date);

        expect(result.date).toBe("2024-06-15");
        expect(result.time).toBe("14:30");
      });

      it("should handle midnight", () => {
        const date = new Date(2024, 0, 1, 0, 0, 0, 0); // Jan 1, 2024 00:00 local

        const result = instantToWallClock(date);

        expect(result.time).toBe("00:00");
      });

      it("should handle end of day", () => {
        const date = new Date(2024, 11, 31, 23, 59, 0, 0); // Dec 31, 2024 23:59 local

        const result = instantToWallClock(date);

        expect(result.date).toBe("2024-12-31");
        expect(result.time).toBe("23:59");
      });

      it("should pad single-digit month and day", () => {
        const date = new Date(2024, 0, 5, 9, 5, 0, 0); // Jan 5, 2024 09:05 local

        const result = instantToWallClock(date);

        expect(result.date).toBe("2024-01-05");
        expect(result.time).toBe("09:05");
      });
    });

    describe("with timezone", () => {
      it("should convert UTC Date to America/New_York wall-clock", () => {
        // UTC 15:00 on Jan 15 is 10:00 EST
        const utcDate = new Date(Date.UTC(2024, 0, 15, 15, 0, 0, 0));

        const result = instantToWallClock(utcDate, "America/New_York");

        expect(result.date).toBe("2024-01-15");
        expect(result.time).toBe("10:00");
      });

      it("should convert UTC Date to America/Los_Angeles wall-clock", () => {
        // UTC 18:00 on Jan 15 is 10:00 PST
        const utcDate = new Date(Date.UTC(2024, 0, 15, 18, 0, 0, 0));

        const result = instantToWallClock(utcDate, "America/Los_Angeles");

        expect(result.date).toBe("2024-01-15");
        expect(result.time).toBe("10:00");
      });

      it("should convert UTC Date to Europe/London wall-clock", () => {
        // UTC 10:00 on Jan 15 is 10:00 GMT
        const utcDate = new Date(Date.UTC(2024, 0, 15, 10, 0, 0, 0));

        const result = instantToWallClock(utcDate, "Europe/London");

        expect(result.date).toBe("2024-01-15");
        expect(result.time).toBe("10:00");
      });

      it("should convert UTC Date to Asia/Tokyo wall-clock", () => {
        // UTC 01:00 on Jan 15 is 10:00 JST
        const utcDate = new Date(Date.UTC(2024, 0, 15, 1, 0, 0, 0));

        const result = instantToWallClock(utcDate, "Asia/Tokyo");

        expect(result.date).toBe("2024-01-15");
        expect(result.time).toBe("10:00");
      });

      it("should handle date rollover due to timezone", () => {
        // UTC 02:00 on Jan 15 is 21:00 EST on Jan 14 (previous day)
        const utcDate = new Date(Date.UTC(2024, 0, 15, 2, 0, 0, 0));

        const result = instantToWallClock(utcDate, "America/New_York");

        expect(result.date).toBe("2024-01-14");
        expect(result.time).toBe("21:00");
      });

      it("should handle DST summer time", () => {
        // UTC 17:00 on July 15 is 10:00 PDT (PDT is UTC-7)
        const utcDate = new Date(Date.UTC(2024, 6, 15, 17, 0, 0, 0));

        const result = instantToWallClock(utcDate, "America/Los_Angeles");

        expect(result.date).toBe("2024-07-15");
        expect(result.time).toBe("10:00");
      });
    });

    describe("edge cases", () => {
      it("should handle year boundary crossing", () => {
        // UTC 04:00 on Jan 1 2024 is 23:00 EST on Dec 31 2023
        const utcDate = new Date(Date.UTC(2024, 0, 1, 4, 0, 0, 0));

        const result = instantToWallClock(utcDate, "America/New_York");

        expect(result.date).toBe("2023-12-31");
        expect(result.time).toBe("23:00");
      });

      it("should handle leap year", () => {
        const utcDate = new Date(Date.UTC(2024, 1, 29, 12, 0, 0, 0)); // Feb 29, 2024

        const result = instantToWallClock(utcDate, "Europe/London");

        expect(result.date).toBe("2024-02-29");
        expect(result.time).toBe("12:00");
      });
    });
  });

  describe("round-trip consistency", () => {
    it("should maintain consistency for round-trip conversion", () => {
      const originalDate = "2024-06-15";
      const originalTime = "14:30";
      const timezone = "America/New_York";

      // Convert to instant
      const instant = toInstantFromWallClock(
        originalDate,
        originalTime,
        timezone
      );
      // Convert back to wall-clock
      const wallClock = instantToWallClock(instant, timezone);

      expect(wallClock.date).toBe(originalDate);
      expect(wallClock.time).toBe(originalTime);
    });

    it("should maintain consistency for UTC timezone", () => {
      const originalDate = "2024-12-25";
      const originalTime = "09:00";
      const timezone = "UTC";

      const instant = toInstantFromWallClock(
        originalDate,
        originalTime,
        timezone
      );
      const wallClock = instantToWallClock(instant, timezone);

      expect(wallClock.date).toBe(originalDate);
      expect(wallClock.time).toBe(originalTime);
    });
  });
});
