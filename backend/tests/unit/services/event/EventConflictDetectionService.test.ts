/**
 * EventConflictDetectionService.test.ts
 * Tests for conflict detection service branch coverage
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the eventController before importing the service
vi.mock("../../../../src/controllers/eventController", () => ({
  EventController: {
    findConflictingEvents: vi.fn(),
  },
}));

import { EventConflictDetectionService } from "../../../../src/services/event/EventConflictDetectionService";
import { EventController } from "../../../../src/controllers/eventController";

describe("EventConflictDetectionService", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe("checkConflicts", () => {
    it("should return no conflict when in test environment with suppressNotifications=true", async () => {
      process.env.NODE_ENV = "test";

      const result = await EventConflictDetectionService.checkConflicts(
        "2024-01-15",
        "10:00",
        "2024-01-15",
        "12:00",
        undefined,
        "America/New_York",
        true // suppressNotifications
      );

      expect(result).toEqual({ hasConflict: false });
      // Should not have called findConflictingEvents
      expect(EventController.findConflictingEvents).not.toHaveBeenCalled();
    });

    it("should check conflicts in test environment without suppressNotifications", async () => {
      process.env.NODE_ENV = "test";
      vi.mocked(EventController.findConflictingEvents).mockResolvedValue([]);

      const result = await EventConflictDetectionService.checkConflicts(
        "2024-01-15",
        "10:00",
        "2024-01-15",
        "12:00",
        undefined,
        "America/New_York",
        false
      );

      expect(result).toEqual({ hasConflict: false });
      expect(EventController.findConflictingEvents).toHaveBeenCalled();
    });

    it("should return hasConflict=true when conflicts are found", async () => {
      process.env.NODE_ENV = "development";
      const mockConflicts = [{ id: "event1", title: "Conflicting Event" }];
      vi.mocked(EventController.findConflictingEvents).mockResolvedValue(
        mockConflicts
      );

      const result = await EventConflictDetectionService.checkConflicts(
        "2024-01-15",
        "10:00",
        "2024-01-15",
        "12:00"
      );

      expect(result).toEqual({
        hasConflict: true,
        conflicts: mockConflicts,
      });
    });

    it("should return hasConflict=false when no conflicts found", async () => {
      process.env.NODE_ENV = "development";
      vi.mocked(EventController.findConflictingEvents).mockResolvedValue([]);

      const result = await EventConflictDetectionService.checkConflicts(
        "2024-01-15",
        "10:00",
        "2024-01-15",
        "12:00"
      );

      expect(result).toEqual({ hasConflict: false });
    });

    it("should return hasConflict=false on error and log it", async () => {
      process.env.NODE_ENV = "development";
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.mocked(EventController.findConflictingEvents).mockRejectedValue(
        new Error("Database error")
      );

      const result = await EventConflictDetectionService.checkConflicts(
        "2024-01-15",
        "10:00",
        "2024-01-15",
        "12:00"
      );

      expect(result).toEqual({ hasConflict: false });
      expect(consoleSpy).toHaveBeenCalledWith(
        "Conflict detection failed:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should pass excludeEventId to findConflictingEvents", async () => {
      process.env.NODE_ENV = "development";
      vi.mocked(EventController.findConflictingEvents).mockResolvedValue([]);

      await EventConflictDetectionService.checkConflicts(
        "2024-01-15",
        "10:00",
        "2024-01-15",
        "12:00",
        "existingEventId123",
        "UTC"
      );

      expect(EventController.findConflictingEvents).toHaveBeenCalledWith(
        "2024-01-15",
        "10:00",
        "2024-01-15",
        "12:00",
        "existingEventId123",
        "UTC"
      );
    });
  });
});
