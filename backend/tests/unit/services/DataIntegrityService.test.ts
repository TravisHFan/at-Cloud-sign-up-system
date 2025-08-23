import { describe, it, expect, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { DataIntegrityService } from "../../../src/services/DataIntegrityService";
import { Event, Registration, GuestRegistration } from "../../../src/models";

// Mock the models
vi.mock("../../../src/models", () => ({
  Event: {
    findById: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    exists: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
    deleteOne: vi.fn(),
  },
  Registration: {
    findById: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
    deleteOne: vi.fn(),
  },
  User: {
    findById: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
    deleteOne: vi.fn(),
  },
  GuestRegistration: {
    findById: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
    deleteOne: vi.fn(),
  },
}));

describe("DataIntegrityService", () => {
  const mockEventId = new mongoose.Types.ObjectId();
  const mockRegistrationId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
    console.error = vi.fn(); // Mock console.error to avoid noise in tests
    console.log = vi.fn(); // Mock console.log to avoid noise in tests
    vi.mocked((GuestRegistration as any).countDocuments).mockResolvedValue(
      0 as any
    );
  });

  describe("checkIntegrity", () => {
    it("should perform comprehensive integrity check successfully", async () => {
      // Mock basic statistics
      vi.mocked(Event.countDocuments).mockResolvedValue(5);
      vi.mocked(Registration.countDocuments).mockResolvedValue(15);

      // Mock events for capacity check
      const mockEvents = [
        {
          _id: mockEventId,
          title: "Test Event",
          status: "upcoming",
          roles: [
            {
              id: "leader",
              name: "Leader",
              maxParticipants: 2,
            },
          ],
        },
      ];
      vi.mocked(Event.find).mockResolvedValue(mockEvents as any);

      // Mock registration count for capacity check
      vi.mocked(Registration.countDocuments)
        .mockResolvedValueOnce(15) // Total registrations first call
        .mockResolvedValue(1); // Role-specific registrations

      // Mock orphaned registrations check
      const mockRegistrations = [
        {
          _id: mockRegistrationId,
          eventId: mockEventId,
        },
      ];
      const mockRegistrationQuery = {
        select: vi.fn().mockResolvedValue(mockRegistrations),
      };
      vi.mocked(Registration.find).mockReturnValue(
        mockRegistrationQuery as any
      );
      vi.mocked(Event.exists).mockResolvedValue({ _id: mockEventId } as any);

      // Mock events for statistics check
      const mockEventsWithStats = [
        {
          _id: mockEventId,
          title: "Test Event",
          signedUp: 1,
        },
      ];
      vi.mocked(Event.find)
        .mockResolvedValueOnce(mockEvents as any) // First call for capacity check
        .mockResolvedValue(mockEventsWithStats as any); // Second call for statistics check

      const result = await DataIntegrityService.checkIntegrity();

      expect(result).toEqual({
        isConsistent: true,
        issues: [],
        statistics: {
          totalEvents: 5,
          totalRegistrations: 15,
          checkedAt: expect.any(Date),
        },
      });
    });

    it("should detect capacity consistency issues", async () => {
      // Mock basic statistics
      vi.mocked(Event.countDocuments).mockResolvedValue(2);
      vi.mocked(Registration.countDocuments).mockResolvedValue(10);

      // Mock events with over-capacity registrations
      const mockEvents = [
        {
          _id: mockEventId,
          title: "Overcrowded Event",
          status: "upcoming",
          roles: [
            {
              id: "leader",
              name: "Leader",
              maxParticipants: 2,
            },
          ],
        },
      ];
      vi.mocked(Event.find).mockResolvedValue(mockEvents as any);

      // Mock over-capacity registration count
      vi.mocked(Registration.countDocuments)
        .mockResolvedValueOnce(10) // Total registrations first call
        .mockResolvedValue(5); // Over capacity for leader role

      // Mock empty orphaned registrations
      const mockRegistrationQuery = {
        select: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Registration.find).mockReturnValue(
        mockRegistrationQuery as any
      );

      // Mock events for statistics check (consistent)
      const mockEventsWithStats = [
        {
          _id: mockEventId,
          title: "Overcrowded Event",
          signedUp: 5,
        },
      ];
      vi.mocked(Event.find)
        .mockResolvedValueOnce(mockEvents as any) // First call for capacity check
        .mockResolvedValue(mockEventsWithStats as any); // Second call for statistics check

      const result = await DataIntegrityService.checkIntegrity();

      expect(result.isConsistent).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toEqual({
        type: "capacity_mismatch",
        description: `Event "Overcrowded Event" role "Leader" has 5 registrations but max is 2`,
        eventId: mockEventId.toString(),
        suggested_action:
          "Review registrations and consider increasing capacity or moving excess users to waitlist",
      });
    });

    it("should detect orphaned registrations", async () => {
      // Mock basic statistics
      vi.mocked(Event.countDocuments).mockResolvedValue(2);
      vi.mocked(Registration.countDocuments).mockResolvedValue(5);

      // Mock events for capacity check (no issues)
      vi.mocked(Event.find)
        .mockResolvedValueOnce([]) // First call for capacity check
        .mockResolvedValue([]); // Second call for statistics check

      // Mock orphaned registrations
      const orphanedEventId = new mongoose.Types.ObjectId();
      const mockRegistrations = [
        {
          _id: mockRegistrationId,
          eventId: orphanedEventId,
        },
      ];
      const mockRegistrationQuery = {
        select: vi.fn().mockResolvedValue(mockRegistrations),
      };
      vi.mocked(Registration.find).mockReturnValue(
        mockRegistrationQuery as any
      );
      vi.mocked(Event.exists).mockResolvedValue(null); // Event doesn't exist!

      const result = await DataIntegrityService.checkIntegrity();

      expect(result.isConsistent).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toEqual({
        type: "orphaned_registration",
        description: `Registration ${mockRegistrationId.toString()} points to non-existent event ${orphanedEventId}`,
        registrationId: mockRegistrationId.toString(),
        suggested_action:
          "Delete orphaned registration or restore missing event",
      });
    });

    it("should detect statistics inconsistencies", async () => {
      // Mock basic statistics
      vi.mocked(Event.countDocuments).mockResolvedValue(1);
      vi.mocked(Registration.countDocuments).mockResolvedValue(3);

      // Mock events for capacity check (no issues)
      vi.mocked(Event.find)
        .mockResolvedValueOnce([]) // First call for capacity check
        .mockResolvedValue([
          {
            _id: mockEventId,
            title: "Inconsistent Event",
            signedUp: 5, // Says 5 but actually has 3
          },
        ] as any); // Second call for statistics check

      // Mock empty orphaned registrations
      const mockRegistrationQuery = {
        select: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Registration.find).mockReturnValue(
        mockRegistrationQuery as any
      );

      // Mock actual registration count for statistics check
      vi.mocked(Registration.countDocuments)
        .mockResolvedValueOnce(3) // Total registrations first call
        .mockResolvedValue(3); // Actual count for this event

      const result = await DataIntegrityService.checkIntegrity();

      expect(result.isConsistent).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toEqual({
        type: "capacity_mismatch",
        description: `Event "Inconsistent Event" shows 5 signups but actual count is 3`,
        eventId: mockEventId.toString(),
        suggested_action: "Trigger event.save() to recalculate statistics",
      });
    });

    it("should handle database errors gracefully", async () => {
      vi.mocked(Event.countDocuments).mockRejectedValue(
        new Error("Database connection failed")
      );

      const result = await DataIntegrityService.checkIntegrity();

      expect(result.isConsistent).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toEqual({
        type: "capacity_mismatch",
        description: "Integrity check failed: Database connection failed",
        suggested_action: "Review system logs and retry",
      });
      expect(console.error).toHaveBeenCalledWith(
        "Integrity check failed:",
        expect.any(Error)
      );
    });
  });

  describe("autoRepair", () => {
    it("should successfully repair statistics mismatches", async () => {
      const mockEvent1 = {
        _id: mockEventId,
        title: "Event 1",
        signedUp: 5,
        save: vi.fn().mockResolvedValue(true),
      };
      const mockEvent2 = {
        _id: new mongoose.Types.ObjectId(),
        title: "Event 2",
        signedUp: 2,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(Event.find).mockResolvedValue([mockEvent1, mockEvent2] as any);

      // Mock actual registration counts
      vi.mocked(Registration.countDocuments)
        .mockResolvedValueOnce(3) // Event 1 actual count
        .mockResolvedValue(2); // Event 2 actual count

      const result = await DataIntegrityService.autoRepair();

      expect(result).toEqual({
        repaired: 1,
        skipped: 0,
      });
      expect(mockEvent1.save).toHaveBeenCalledOnce();
      expect(mockEvent2.save).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        `Repairing event ${mockEventId}: 5 -> 3`
      );
    });

    it("should handle repair errors gracefully", async () => {
      vi.mocked(Event.find).mockRejectedValue(new Error("Database error"));

      const result = await DataIntegrityService.autoRepair();

      expect(result).toEqual({
        repaired: 0,
        skipped: 1,
      });
      expect(console.error).toHaveBeenCalledWith(
        "Auto-repair failed:",
        expect.any(Error)
      );
    });

    it("should handle save errors during repair", async () => {
      const mockEvent = {
        _id: mockEventId,
        title: "Failing Event",
        signedUp: 5,
        save: vi.fn().mockRejectedValue(new Error("Save failed")),
      };

      vi.mocked(Event.find).mockResolvedValue([mockEvent] as any);
      vi.mocked(Registration.countDocuments).mockResolvedValue(3);

      const result = await DataIntegrityService.autoRepair();

      expect(result).toEqual({
        repaired: 0,
        skipped: 1,
      });
      expect(console.error).toHaveBeenCalledWith(
        "Auto-repair failed:",
        expect.any(Error)
      );
    });
  });

  describe("getLockStatistics", () => {
    it("should return lock service statistics placeholder", () => {
      const result = DataIntegrityService.getLockStatistics();

      expect(result).toEqual({
        message: "Import lockService to get real statistics",
        suggestion: "Add: import { lockService } from './LockService'",
      });
    });
  });
});
