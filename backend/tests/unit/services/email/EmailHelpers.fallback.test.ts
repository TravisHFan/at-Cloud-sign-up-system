// EmailHelpers.fallback.test.ts - Tests for EmailHelpers catch block fallbacks
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailHelpers } from "../../../../src/services/email/EmailHelpers";

describe("EmailHelpers - Fallback Paths", () => {
  describe("formatDateTime catch block", () => {
    let originalIntl: typeof Intl;

    beforeEach(() => {
      // Save original Intl
      originalIntl = globalThis.Intl;
    });

    afterEach(() => {
      // Restore Intl
      globalThis.Intl = originalIntl;
    });

    it("falls back to toLocaleString when Intl.DateTimeFormat throws", () => {
      // Mock Intl.DateTimeFormat to throw
      const mockDateTimeFormat = vi.fn().mockImplementation(() => {
        throw new Error("Intl.DateTimeFormat failed");
      });

      globalThis.Intl = {
        ...originalIntl,
        DateTimeFormat: mockDateTimeFormat as any,
      } as typeof Intl;

      // This should trigger the catch block and use toLocaleString
      const result = EmailHelpers.formatDateTime("2025-06-15", "14:30");

      // Should still return a string (from toLocaleString fallback)
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("formatDateTime with Intl failure still formats using toLocaleString", () => {
      // First call fails (Intl.DateTimeFormat), fallback to toLocaleString works
      let callCount = 0;
      const mockDateTimeFormat = vi
        .fn()
        .mockImplementation((...args: any[]) => {
          callCount++;
          // Only throw on first call (Intl.DateTimeFormat constructor)
          if (callCount === 1) {
            throw new RangeError("Mocked Intl failure");
          }
          return new originalIntl.DateTimeFormat(...args);
        });

      globalThis.Intl = {
        ...originalIntl,
        DateTimeFormat: mockDateTimeFormat as any,
      } as typeof Intl;

      const result = EmailHelpers.formatDateTime("2025-06-15", "14:30");

      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("formatTime catch block", () => {
    let originalIntl: typeof Intl;

    beforeEach(() => {
      originalIntl = globalThis.Intl;
    });

    afterEach(() => {
      globalThis.Intl = originalIntl;
    });

    it("falls back to toLocaleString when Intl.DateTimeFormat throws in formatTime", () => {
      const mockDateTimeFormat = vi.fn().mockImplementation(() => {
        throw new Error("Intl.DateTimeFormat failed");
      });

      globalThis.Intl = {
        ...originalIntl,
        DateTimeFormat: mockDateTimeFormat as any,
      } as typeof Intl;

      const result = EmailHelpers.formatTime("14:30");

      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("formatTime with date provided falls back correctly", () => {
      const mockDateTimeFormat = vi.fn().mockImplementation(() => {
        throw new Error("Intl.DateTimeFormat failed");
      });

      globalThis.Intl = {
        ...originalIntl,
        DateTimeFormat: mockDateTimeFormat as any,
      } as typeof Intl;

      const result = EmailHelpers.formatTime(
        "14:30",
        "America/New_York",
        "2025-06-15",
      );

      expect(typeof result).toBe("string");
    });
  });

  describe("formatTime without date (branch coverage)", () => {
    it("uses current date when date is not provided", () => {
      // This should hit the !date branch where it uses new Date()
      const result = EmailHelpers.formatTime("14:30", "America/New_York");

      expect(typeof result).toBe("string");
      expect(result).toMatch(/PM|AM/i); // Should format as 12-hour time
    });

    it("formats time without timezone", () => {
      const result = EmailHelpers.formatTime("09:15");

      expect(typeof result).toBe("string");
      expect(result).toMatch(/AM/i);
    });
  });
});
