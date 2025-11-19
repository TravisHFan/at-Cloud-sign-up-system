/**
 * Event Stats Utils Tests
 *
 * Tests event statistics calculation utilities:
 * - calculateUpcomingEventStats: Total events, participants, available spots
 * - calculatePassedEventStats: Completed events, attendees
 * - formatEventDate: Date formatting
 * - formatEventTime: Time formatting
 */

import { describe, it, expect } from "vitest";
import {
  calculateUpcomingEventStats,
  calculatePassedEventStats,
  formatEventDate,
  formatEventTime,
} from "../eventStatsUtils";
import type { EventData } from "../../types/event";

describe("eventStatsUtils", () => {
  describe("calculateUpcomingEventStats", () => {
    it("should calculate stats for empty array", () => {
      const result = calculateUpcomingEventStats([]);
      expect(result.totalEvents).toBe(0);
      expect(result.totalParticipants).toBe(0);
      expect(result.availableSpots).toBe(0);
    });

    it("should calculate stats for single event", () => {
      const events: Partial<EventData>[] = [
        {
          signedUp: 10,
          totalSlots: 20,
        },
      ];

      const result = calculateUpcomingEventStats(events as EventData[]);
      expect(result.totalEvents).toBe(1);
      expect(result.totalParticipants).toBe(10);
      expect(result.availableSpots).toBe(10);
    });

    it("should calculate stats for multiple events", () => {
      const events: Partial<EventData>[] = [
        { signedUp: 10, totalSlots: 20 },
        { signedUp: 15, totalSlots: 25 },
        { signedUp: 8, totalSlots: 15 },
      ];

      const result = calculateUpcomingEventStats(events as EventData[]);
      expect(result.totalEvents).toBe(3);
      expect(result.totalParticipants).toBe(33); // 10 + 15 + 8
      expect(result.availableSpots).toBe(27); // (20-10) + (25-15) + (15-8)
    });

    it("should handle fully booked events", () => {
      const events: Partial<EventData>[] = [
        { signedUp: 20, totalSlots: 20 },
        { signedUp: 25, totalSlots: 25 },
      ];

      const result = calculateUpcomingEventStats(events as EventData[]);
      expect(result.totalEvents).toBe(2);
      expect(result.totalParticipants).toBe(45);
      expect(result.availableSpots).toBe(0);
    });

    it("should handle events with zero signups", () => {
      const events: Partial<EventData>[] = [
        { signedUp: 0, totalSlots: 50 },
        { signedUp: 0, totalSlots: 30 },
      ];

      const result = calculateUpcomingEventStats(events as EventData[]);
      expect(result.totalEvents).toBe(2);
      expect(result.totalParticipants).toBe(0);
      expect(result.availableSpots).toBe(80);
    });

    it("should handle over-subscribed events", () => {
      const events: Partial<EventData>[] = [
        { signedUp: 25, totalSlots: 20 }, // 5 over capacity
      ];

      const result = calculateUpcomingEventStats(events as EventData[]);
      expect(result.totalEvents).toBe(1);
      expect(result.totalParticipants).toBe(25);
      expect(result.availableSpots).toBe(-5); // Negative spots
    });
  });

  describe("calculatePassedEventStats", () => {
    it("should calculate stats for empty array", () => {
      const result = calculatePassedEventStats([]);
      expect(result.totalEvents).toBe(0);
      expect(result.completedEvents).toBe(0);
      expect(result.totalParticipants).toBe(0);
      expect(result.totalAttendees).toBe(0);
    });

    it("should calculate stats for completed events", () => {
      const events: Partial<EventData>[] = [
        {
          status: "completed",
          signedUp: 20,
          attendees: 18,
        },
      ];

      const result = calculatePassedEventStats(events as EventData[]);
      expect(result.totalEvents).toBe(1);
      expect(result.completedEvents).toBe(1);
      expect(result.totalParticipants).toBe(20);
      expect(result.totalAttendees).toBe(18);
    });

    it("should filter out non-completed events", () => {
      const events: Partial<EventData>[] = [
        { status: "completed", signedUp: 20, attendees: 18 },
        { status: "cancelled", signedUp: 15, attendees: 0 },
        { status: "completed", signedUp: 10, attendees: 9 },
      ];

      const result = calculatePassedEventStats(events as EventData[]);
      expect(result.totalEvents).toBe(3);
      expect(result.completedEvents).toBe(2); // Only completed
      expect(result.totalParticipants).toBe(45); // All signups
      expect(result.totalAttendees).toBe(27); // 18 + 0 + 9
    });

    it("should handle events without attendees property", () => {
      const events: Partial<EventData>[] = [
        { status: "completed", signedUp: 20 }, // No attendees
        { status: "completed", signedUp: 15, attendees: 12 },
      ];

      const result = calculatePassedEventStats(events as EventData[]);
      expect(result.totalEvents).toBe(2);
      expect(result.completedEvents).toBe(2);
      expect(result.totalParticipants).toBe(35);
      expect(result.totalAttendees).toBe(12); // 0 + 12
    });

    it("should handle zero attendees", () => {
      const events: Partial<EventData>[] = [
        { status: "completed", signedUp: 20, attendees: 0 },
      ];

      const result = calculatePassedEventStats(events as EventData[]);
      expect(result.totalEvents).toBe(1);
      expect(result.completedEvents).toBe(1);
      expect(result.totalAttendees).toBe(0);
    });

    it("should calculate mixed event statuses", () => {
      const events: Partial<EventData>[] = [
        { status: "completed", signedUp: 30, attendees: 28 },
        { status: "ongoing", signedUp: 20, attendees: 15 },
        { status: "cancelled", signedUp: 10, attendees: 0 },
        { status: "completed", signedUp: 25, attendees: 23 },
      ];

      const result = calculatePassedEventStats(events as EventData[]);
      expect(result.totalEvents).toBe(4);
      expect(result.completedEvents).toBe(2);
      expect(result.totalParticipants).toBe(85);
      expect(result.totalAttendees).toBe(66);
    });
  });

  describe("formatEventDate", () => {
    it("should format ISO date string", () => {
      const result = formatEventDate("2025-06-15T10:00:00Z");
      // Result depends on locale, but should contain date parts
      expect(result).toContain("2025");
      expect(result).toContain("Jun");
    });

    it("should format YYYY-MM-DD date string", () => {
      const result = formatEventDate("2025-06-15");
      expect(result).toContain("2025");
      expect(result).toContain("Jun");
      expect(result).toContain("15");
    });

    it("should include weekday", () => {
      const result = formatEventDate("2025-06-15"); // Sunday
      expect(result).toMatch(/(Sun|Mon|Tue|Wed|Thu|Fri|Sat)/);
    });

    it("should include month abbreviation", () => {
      const result = formatEventDate("2025-01-15");
      expect(result).toContain("Jan");
    });

    it("should handle different months", () => {
      const jan = formatEventDate("2025-01-01");
      const dec = formatEventDate("2025-12-31");

      expect(jan).toContain("Jan");
      expect(dec).toContain("Dec");
    });

    it("should handle leap year dates", () => {
      const result = formatEventDate("2024-02-29");
      expect(result).toContain("Feb");
      expect(result).toContain("29");
    });

    it("should handle year boundaries", () => {
      const newYear = formatEventDate("2025-01-01");
      expect(newYear).toContain("2025");
      expect(newYear).toContain("Jan");
      expect(newYear).toContain("1");
    });

    it("should parse manually to avoid timezone shift for YYYY-MM-DD", () => {
      // When parsing "2025-06-15", it should be June 15 in local time
      const result = formatEventDate("2025-06-15");
      expect(result).toContain("Jun");
      expect(result).toContain("15");
    });
  });

  describe("formatEventTime", () => {
    it("should format morning time", () => {
      const result = formatEventTime("09:00");
      expect(result).toContain("9");
      expect(result).toContain("00");
      expect(result).toContain("AM");
    });

    it("should format afternoon time", () => {
      const result = formatEventTime("14:30");
      expect(result).toContain("2");
      expect(result).toContain("30");
      expect(result).toContain("PM");
    });

    it("should format midnight", () => {
      const result = formatEventTime("00:00");
      expect(result).toContain("12");
      expect(result).toContain("00");
      expect(result).toContain("AM");
    });

    it("should format noon", () => {
      const result = formatEventTime("12:00");
      expect(result).toContain("12");
      expect(result).toContain("00");
      expect(result).toContain("PM");
    });

    it("should format evening time", () => {
      const result = formatEventTime("18:45");
      expect(result).toContain("6");
      expect(result).toContain("45");
      expect(result).toContain("PM");
    });

    it("should format late night time", () => {
      const result = formatEventTime("23:59");
      expect(result).toContain("11");
      expect(result).toContain("59");
      expect(result).toContain("PM");
    });

    it("should handle single digit hours", () => {
      const result = formatEventTime("09:30");
      expect(result).toContain("9");
      expect(result).not.toContain("09");
    });

    it("should include colon between hour and minute", () => {
      const result = formatEventTime("10:15");
      expect(result).toContain(":");
    });

    it("should handle edge case 00:01", () => {
      const result = formatEventTime("00:01");
      expect(result).toContain("12");
      expect(result).toContain("01");
      expect(result).toContain("AM");
    });

    it("should handle edge case 12:01", () => {
      const result = formatEventTime("12:01");
      expect(result).toContain("12");
      expect(result).toContain("01");
      expect(result).toContain("PM");
    });
  });

  describe("integration: stats calculations", () => {
    it("should handle complete event lifecycle stats", () => {
      const upcomingEvents: Partial<EventData>[] = [
        { signedUp: 15, totalSlots: 20 },
        { signedUp: 10, totalSlots: 15 },
      ];

      const passedEvents: Partial<EventData>[] = [
        { status: "completed", signedUp: 20, attendees: 18 },
        { status: "completed", signedUp: 15, attendees: 14 },
      ];

      const upcomingStats = calculateUpcomingEventStats(
        upcomingEvents as EventData[]
      );
      const passedStats = calculatePassedEventStats(
        passedEvents as EventData[]
      );

      expect(upcomingStats.totalEvents).toBe(2);
      expect(upcomingStats.availableSpots).toBe(10);
      expect(passedStats.totalEvents).toBe(2);
      expect(passedStats.totalAttendees).toBe(32);
    });

    it("should format complete event date and time", () => {
      const date = "2025-06-15";
      const time = "14:30";

      const formattedDate = formatEventDate(date);
      const formattedTime = formatEventTime(time);

      expect(formattedDate).toContain("Jun");
      expect(formattedTime).toContain("2");
      expect(formattedTime).toContain("PM");
    });
  });
});
