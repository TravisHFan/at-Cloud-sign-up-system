/**
 * Unit tests for event filter utilities
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getUpcomingEvents,
  getPassedEvents,
  categorizeEvents,
  getTodaysEvents,
  getEventsInNextDays,
} from "../eventFilters";
import type { EventData } from "../../types/event";

describe("Event Filters", () => {
  // Mock the current date to be consistent
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-11-12T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockEvent = (overrides: Partial<EventData> = {}): EventData => ({
    id: "test-id",
    title: "Test Event",
    date: "2025-11-15",
    time: "10:00",
    endDate: "2025-11-15",
    endTime: "12:00",
    timeZone: "America/Los_Angeles",
    location: "Test Location",
    type: "workshop",
    status: "upcoming",
    organizer: "org-id",
    format: "hybrid",
    roles: [],
    signedUp: 0,
    totalSlots: 100,
    createdBy: "user-id",
    createdAt: "2025-11-01T00:00:00Z",
    ...overrides,
  });

  describe("getUpcomingEvents", () => {
    it("should return events that have not passed", () => {
      const events: EventData[] = [
        createMockEvent({
          id: "1",
          date: "2025-11-20",
          endDate: "2025-11-20",
        }),
        createMockEvent({
          id: "2",
          date: "2025-11-25",
          endDate: "2025-11-25",
        }),
      ];

      const result = getUpcomingEvents(events);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("1");
      expect(result[1].id).toBe("2");
    });

    it("should exclude events that have passed", () => {
      const events: EventData[] = [
        createMockEvent({
          id: "1",
          date: "2025-11-01",
          endDate: "2025-11-01",
        }),
        createMockEvent({
          id: "2",
          date: "2025-11-25",
          endDate: "2025-11-25",
        }),
      ];

      const result = getUpcomingEvents(events);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("2");
    });

    it("should return empty array when all events have passed", () => {
      const events: EventData[] = [
        createMockEvent({
          date: "2025-11-01",
          endDate: "2025-11-01",
        }),
        createMockEvent({
          date: "2025-11-05",
          endDate: "2025-11-05",
        }),
      ];

      const result = getUpcomingEvents(events);

      expect(result).toHaveLength(0);
    });

    it("should return empty array for empty input", () => {
      const result = getUpcomingEvents([]);

      expect(result).toEqual([]);
    });
  });

  describe("getPassedEvents", () => {
    it("should return events that have passed", () => {
      const events: EventData[] = [
        createMockEvent({
          id: "1",
          date: "2025-11-01",
          endDate: "2025-11-01",
        }),
        createMockEvent({
          id: "2",
          date: "2025-11-05",
          endDate: "2025-11-05",
        }),
      ];

      const result = getPassedEvents(events);

      expect(result).toHaveLength(2);
    });

    it("should exclude upcoming events", () => {
      const events: EventData[] = [
        createMockEvent({
          id: "1",
          date: "2025-11-01",
          endDate: "2025-11-01",
        }),
        createMockEvent({
          id: "2",
          date: "2025-11-25",
          endDate: "2025-11-25",
        }),
      ];

      const result = getPassedEvents(events);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("should return empty array when no events have passed", () => {
      const events: EventData[] = [
        createMockEvent({
          date: "2025-11-20",
          endDate: "2025-11-20",
        }),
        createMockEvent({
          date: "2025-11-25",
          endDate: "2025-11-25",
        }),
      ];

      const result = getPassedEvents(events);

      expect(result).toHaveLength(0);
    });

    it("should return empty array for empty input", () => {
      const result = getPassedEvents([]);

      expect(result).toEqual([]);
    });
  });

  describe("categorizeEvents", () => {
    it("should categorize events into upcoming and passed", () => {
      const events: EventData[] = [
        createMockEvent({
          id: "1",
          date: "2025-11-01",
          endDate: "2025-11-01",
        }),
        createMockEvent({
          id: "2",
          date: "2025-11-20",
          endDate: "2025-11-20",
        }),
        createMockEvent({
          id: "3",
          date: "2025-11-05",
          endDate: "2025-11-05",
        }),
        createMockEvent({
          id: "4",
          date: "2025-11-25",
          endDate: "2025-11-25",
        }),
      ];

      const result = categorizeEvents(events);

      expect(result.passedEvents).toHaveLength(2);
      expect(result.upcomingEvents).toHaveLength(2);
      expect(result.passedEvents.map((e) => e.id)).toEqual(
        expect.arrayContaining(["1", "3"])
      );
      expect(result.upcomingEvents.map((e) => e.id)).toEqual(
        expect.arrayContaining(["2", "4"])
      );
    });

    it("should handle all upcoming events", () => {
      const events: EventData[] = [
        createMockEvent({
          date: "2025-11-20",
          endDate: "2025-11-20",
        }),
        createMockEvent({
          date: "2025-11-25",
          endDate: "2025-11-25",
        }),
      ];

      const result = categorizeEvents(events);

      expect(result.upcomingEvents).toHaveLength(2);
      expect(result.passedEvents).toHaveLength(0);
    });

    it("should handle all passed events", () => {
      const events: EventData[] = [
        createMockEvent({
          date: "2025-11-01",
          endDate: "2025-11-01",
        }),
        createMockEvent({
          date: "2025-11-05",
          endDate: "2025-11-05",
        }),
      ];

      const result = categorizeEvents(events);

      expect(result.upcomingEvents).toHaveLength(0);
      expect(result.passedEvents).toHaveLength(2);
    });

    it("should handle empty array", () => {
      const result = categorizeEvents([]);

      expect(result.upcomingEvents).toEqual([]);
      expect(result.passedEvents).toEqual([]);
    });
  });

  describe("getTodaysEvents", () => {
    it("should return events happening today", () => {
      const events: EventData[] = [
        createMockEvent({
          id: "1",
          date: "2025-11-12", // Today
        }),
        createMockEvent({
          id: "2",
          date: "2025-11-13", // Tomorrow
        }),
        createMockEvent({
          id: "3",
          date: "2025-11-12", // Today
        }),
      ];

      const result = getTodaysEvents(events);

      expect(result).toHaveLength(2);
      expect(result.map((e) => e.id)).toEqual(
        expect.arrayContaining(["1", "3"])
      );
    });

    it("should return empty array when no events today", () => {
      const events: EventData[] = [
        createMockEvent({
          date: "2025-11-13",
        }),
        createMockEvent({
          date: "2025-11-14",
        }),
      ];

      const result = getTodaysEvents(events);

      expect(result).toHaveLength(0);
    });

    it("should handle empty array", () => {
      const result = getTodaysEvents([]);

      expect(result).toEqual([]);
    });
  });

  describe("getEventsInNextDays", () => {
    it("should return events within the next N days", () => {
      const events: EventData[] = [
        createMockEvent({
          id: "1",
          date: "2025-11-13", // 1 day from now
        }),
        createMockEvent({
          id: "2",
          date: "2025-11-15", // 3 days from now
        }),
        createMockEvent({
          id: "3",
          date: "2025-11-20", // 8 days from now
        }),
      ];

      const result = getEventsInNextDays(events, 7);

      expect(result).toHaveLength(2);
      expect(result.map((e) => e.id)).toEqual(
        expect.arrayContaining(["1", "2"])
      );
    });

    it("should include events happening today", () => {
      const events: EventData[] = [
        createMockEvent({
          id: "1",
          date: "2025-11-12", // Today
        }),
        createMockEvent({
          id: "2",
          date: "2025-11-15",
        }),
      ];

      const result = getEventsInNextDays(events, 3);

      expect(result).toHaveLength(2);
    });

    it("should exclude events beyond the date range", () => {
      const events: EventData[] = [
        createMockEvent({
          id: "1",
          date: "2025-11-13",
        }),
        createMockEvent({
          id: "2",
          date: "2025-12-01", // 19 days from now
        }),
      ];

      const result = getEventsInNextDays(events, 7);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("should exclude past events", () => {
      const events: EventData[] = [
        createMockEvent({
          id: "1",
          date: "2025-11-01", // Past
        }),
        createMockEvent({
          id: "2",
          date: "2025-11-13", // Future
        }),
      ];

      const result = getEventsInNextDays(events, 7);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("2");
    });

    it("should handle empty array", () => {
      const result = getEventsInNextDays([], 7);

      expect(result).toEqual([]);
    });

    it("should handle 0 days (today only)", () => {
      const events: EventData[] = [
        createMockEvent({
          id: "1",
          date: "2025-11-12", // Today
        }),
        createMockEvent({
          id: "2",
          date: "2025-11-13", // Tomorrow
        }),
      ];

      const result = getEventsInNextDays(events, 0);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });
  });
});
