import { describe, it, expect } from "vitest";
import { buildRegistrationICS } from "../../../src/services/ICSBuilder";

describe("ICSBuilder", () => {
  describe("timezone handling", () => {
    it("should convert Pacific timezone event to correct UTC time in ICS", () => {
      const mockEvent = {
        _id: "test-event-id",
        title: "Test Timezone Event",
        date: "2024-06-15",
        endDate: "2024-06-15",
        time: "14:00",
        endTime: "15:00",
        location: "San Francisco",
        purpose: "Testing timezone conversion",
        timeZone: "America/Los_Angeles",
      };

      const result = buildRegistrationICS({
        event: mockEvent,
        attendeeEmail: "test@example.com",
      });

      // June 15, 2024 2:00 PM PDT should be 9:00 PM UTC (PDT is UTC-7)
      // Expected format: YYYYMMDDTHHMMSSZ
      expect(result.content).toContain("DTSTART:20240615T210000Z");
      expect(result.content).toContain("DTEND:20240615T220000Z");
      expect(result.content).toContain("SUMMARY:Test Timezone Event");
      expect(result.content).toContain("LOCATION:San Francisco");
    });

    it("should handle Eastern timezone conversion correctly", () => {
      const mockEvent = {
        _id: "test-event-id-2",
        title: "East Coast Event",
        date: "2024-12-01",
        endDate: "2024-12-01",
        time: "10:30",
        endTime: "11:30",
        location: "New York",
        purpose: "Testing EST conversion",
        timeZone: "America/New_York",
      };

      const result = buildRegistrationICS({
        event: mockEvent,
        attendeeEmail: "test2@example.com",
      });

      // December 1, 2024 10:30 AM EST should be 3:30 PM UTC (EST is UTC-5)
      expect(result.content).toContain("DTSTART:20241201T153000Z");
      expect(result.content).toContain("DTEND:20241201T163000Z");
    });

    it("should handle cross-day timezone conversion", () => {
      const mockEvent = {
        _id: "test-event-id-3",
        title: "Late Night Event",
        date: "2024-06-15",
        endDate: "2024-06-15",
        time: "23:00",
        endTime: "23:59",
        location: "Hawaii",
        purpose: "Testing cross-day conversion",
        timeZone: "Pacific/Honolulu",
      };

      const result = buildRegistrationICS({
        event: mockEvent,
        attendeeEmail: "test3@example.com",
      });

      // June 15, 2024 11:00 PM HST should be June 16, 2024 9:00 AM UTC (HST is UTC-10)
      expect(result.content).toContain("DTSTART:20240616T090000Z");
      expect(result.content).toContain("DTEND:20240616T095900Z");
    });

    it("should use system local timezone when event timezone is missing", () => {
      const mockEvent = {
        _id: "test-event-id-4",
        title: "No Timezone Event",
        date: "2024-06-15",
        endDate: "2024-06-15",
        time: "14:00",
        endTime: "15:00",
        location: "Unknown Location",
        purpose: "Testing fallback behavior",
        // timeZone is intentionally omitted
      };

      const result = buildRegistrationICS({
        event: mockEvent,
        attendeeEmail: "test4@example.com",
      });

      // When no timezone is provided, should use system local timezone conversion
      // The exact UTC time will depend on system timezone, but should contain valid ICS format
      expect(result.content).toMatch(/DTSTART:\d{8}T\d{6}Z/);
      expect(result.content).toMatch(/DTEND:\d{8}T\d{6}Z/);
      expect(result.content).toContain("SUMMARY:No Timezone Event");
    });

    it("should handle multi-day events correctly", () => {
      const mockEvent = {
        _id: "test-event-id-5",
        title: "Multi-day Conference",
        date: "2024-06-15",
        endDate: "2024-06-16",
        time: "09:00",
        endTime: "17:00",
        location: "Convention Center",
        purpose: "Multi-day event testing",
        timeZone: "America/Los_Angeles",
      };

      const result = buildRegistrationICS({
        event: mockEvent,
        attendeeEmail: "test5@example.com",
      });

      // June 15, 2024 9:00 AM PDT should be 4:00 PM UTC
      // June 16, 2024 5:00 PM PDT should be June 17, 2024 12:00 AM UTC
      expect(result.content).toContain("DTSTART:20240615T160000Z");
      expect(result.content).toContain("DTEND:20240617T000000Z");
    });

    it("should include role information in summary when provided", () => {
      const mockEvent = {
        _id: "test-event-id-6",
        title: "Role-based Event",
        date: "2024-06-15",
        endDate: "2024-06-15",
        time: "14:00",
        endTime: "15:00",
        location: "Conference Room",
        purpose: "Testing role integration",
        timeZone: "America/Los_Angeles",
      };

      const mockRole = {
        name: "Presenter",
        description: "Lead the presentation",
      };

      const result = buildRegistrationICS({
        event: mockEvent,
        role: mockRole,
        attendeeEmail: "presenter@example.com",
      });

      expect(result.content).toContain("SUMMARY:Role-based Event — Presenter");
      expect(result.content).toContain("DESCRIPTION:Lead the presentation");
    });
  });
});
