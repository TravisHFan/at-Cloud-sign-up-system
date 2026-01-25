import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies BEFORE importing the service
vi.mock("../../../src/models/GuestRegistration", () => ({
  default: {
    findEligibleForMigration: vi.fn(),
    deleteMany: vi.fn(),
    deleteOne: vi.fn(),
  },
}));

vi.mock("../../../src/models/User", () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock("../../../src/models/Registration", () => {
  const mockRegistrationInstance = {
    save: vi.fn().mockResolvedValue(undefined),
  };
  const MockRegistration = vi.fn(() => mockRegistrationInstance);
  (MockRegistration as any).findOne = vi.fn();
  return { default: MockRegistration };
});

vi.mock("../../../src/models/Event", () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock("../../../src/services/infrastructure/CacheService", () => ({
  CachePatterns: {
    invalidateEventCache: vi.fn().mockResolvedValue(undefined),
    invalidateAnalyticsCache: vi.fn().mockResolvedValue(undefined),
  },
}));

import GuestMigrationService from "../../../src/services/GuestMigrationService";
import GuestRegistration from "../../../src/models/GuestRegistration";
import User from "../../../src/models/User";
import Registration from "../../../src/models/Registration";
import Event from "../../../src/models/Event";
import { CachePatterns } from "../../../src/services/infrastructure/CacheService";

describe("GuestMigrationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("detectGuestRegistrationsByEmail", () => {
    it("should find guest registrations eligible for migration", async () => {
      const mockGuests = [
        { _id: "g1", email: "test@example.com" },
        { _id: "g2", email: "test@example.com" },
      ];
      (GuestRegistration.findEligibleForMigration as any).mockResolvedValue(
        mockGuests
      );

      const result =
        await GuestMigrationService.detectGuestRegistrationsByEmail(
          "test@example.com"
        );

      expect(GuestRegistration.findEligibleForMigration).toHaveBeenCalledWith(
        "test@example.com"
      );
      expect(result).toEqual(mockGuests);
    });

    it("should return empty array when no eligible guests", async () => {
      (GuestRegistration.findEligibleForMigration as any).mockResolvedValue([]);

      const result =
        await GuestMigrationService.detectGuestRegistrationsByEmail(
          "unknown@example.com"
        );

      expect(result).toEqual([]);
    });
  });

  describe("validateMigrationEligibility", () => {
    it("should return ok=false when user not found", async () => {
      (User.findById as any).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      });

      const result = await GuestMigrationService.validateMigrationEligibility(
        "user-123",
        "test@example.com"
      );

      expect(result.ok).toBe(false);
      expect((result as any).reason).toBe("User not found");
    });

    it("should return ok=true with count when user exists", async () => {
      (User.findById as any).mockReturnValue({
        select: vi
          .fn()
          .mockResolvedValue({ _id: "user-123", email: "test@example.com" }),
      });
      (GuestRegistration.findEligibleForMigration as any).mockResolvedValue([
        { _id: "g1" },
        { _id: "g2" },
      ]);

      const result = await GuestMigrationService.validateMigrationEligibility(
        "user-123",
        "test@example.com"
      );

      expect(result.ok).toBe(true);
      expect((result as any).count).toBe(2);
    });

    it("should return count 0 when no eligible registrations", async () => {
      (User.findById as any).mockReturnValue({
        select: vi
          .fn()
          .mockResolvedValue({ _id: "user-123", email: "test@example.com" }),
      });
      (GuestRegistration.findEligibleForMigration as any).mockResolvedValue([]);

      const result = await GuestMigrationService.validateMigrationEligibility(
        "user-123",
        "test@example.com"
      );

      expect(result.ok).toBe(true);
      expect((result as any).count).toBe(0);
    });
  });

  describe("performGuestToUserMigration", () => {
    const createMockUser = (overrides = {}) => ({
      _id: { toString: () => "user-123" },
      email: "test@example.com",
      username: "testuser",
      firstName: "Test",
      lastName: "User",
      role: "User",
      roleInAtCloud: "member",
      avatar: "avatar.jpg",
      gender: "male",
      ...overrides,
    });

    const createMockGuest = (overrides = {}) => ({
      _id: { toString: () => "guest-123" },
      eventId: { toString: () => "event-123" },
      roleId: "role-1",
      email: "test@example.com",
      eventSnapshot: {
        title: "Test Event",
        date: "2030-06-15",
        location: "Main Hall",
        roleName: "Participant",
      },
      ...overrides,
    });

    const createMockEvent = (overrides = {}) => ({
      _id: { toString: () => "event-123" },
      title: "Event Title",
      date: "2030-06-15",
      endDate: "2030-06-15",
      time: "10:00",
      location: "Event Hall",
      type: "Workshop",
      roles: [
        { id: "role-1", name: "Attendee", description: "Event Attendee" },
      ],
      ...overrides,
    });

    describe("when user not found", () => {
      it("should delete eligible guests and return ok=true", async () => {
        (User.findById as any).mockResolvedValue(null);
        const mockGuests = [
          createMockGuest(),
          createMockGuest({ _id: { toString: () => "guest-456" } }),
        ];
        (GuestRegistration.findEligibleForMigration as any).mockResolvedValue(
          mockGuests
        );
        (GuestRegistration.deleteMany as any).mockResolvedValue({
          deletedCount: 2,
        });

        const result = await GuestMigrationService.performGuestToUserMigration(
          "user-123",
          "test@example.com"
        );

        expect(result.ok).toBe(true);
        expect((result as any).modified).toBe(2);
        expect(GuestRegistration.deleteMany).toHaveBeenCalled();
      });

      it("should return ok=true with modified=0 when no eligible guests", async () => {
        (User.findById as any).mockResolvedValue(null);
        (GuestRegistration.findEligibleForMigration as any).mockResolvedValue(
          []
        );

        const result = await GuestMigrationService.performGuestToUserMigration(
          "user-123",
          "test@example.com"
        );

        expect(result.ok).toBe(true);
        expect((result as any).modified).toBe(0);
        expect(GuestRegistration.deleteMany).not.toHaveBeenCalled();
      });

      it("should invalidate caches when deleting guests without user", async () => {
        (User.findById as any).mockResolvedValue(null);
        const mockGuests = [createMockGuest()];
        (GuestRegistration.findEligibleForMigration as any).mockResolvedValue(
          mockGuests
        );
        (GuestRegistration.deleteMany as any).mockResolvedValue({
          deletedCount: 1,
        });

        await GuestMigrationService.performGuestToUserMigration(
          "user-123",
          "test@example.com"
        );

        expect(CachePatterns.invalidateEventCache).toHaveBeenCalledWith(
          "event-123"
        );
        expect(CachePatterns.invalidateAnalyticsCache).toHaveBeenCalled();
      });

      it("should handle cache invalidation errors gracefully", async () => {
        (User.findById as any).mockResolvedValue(null);
        const mockGuests = [createMockGuest()];
        (GuestRegistration.findEligibleForMigration as any).mockResolvedValue(
          mockGuests
        );
        (GuestRegistration.deleteMany as any).mockResolvedValue({
          deletedCount: 1,
        });
        (CachePatterns.invalidateEventCache as any).mockRejectedValue(
          new Error("Cache error")
        );

        // Should not throw
        const result = await GuestMigrationService.performGuestToUserMigration(
          "user-123",
          "test@example.com"
        );

        expect(result.ok).toBe(true);
      });
    });

    describe("when user exists", () => {
      it("should migrate guest to user registration for upcoming event", async () => {
        const mockUser = createMockUser();
        const mockGuest = createMockGuest();
        const mockEvent = createMockEvent();

        (User.findById as any).mockResolvedValue(mockUser);
        (GuestRegistration.findEligibleForMigration as any).mockResolvedValue([
          mockGuest,
        ]);
        (Event.findById as any).mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockEvent),
        });
        (Registration.findOne as any).mockResolvedValue(null);
        (GuestRegistration.deleteOne as any).mockResolvedValue({
          deletedCount: 1,
        });

        const result = await GuestMigrationService.performGuestToUserMigration(
          "user-123",
          "test@example.com"
        );

        expect(result.ok).toBe(true);
        expect((result as any).modified).toBe(1);
        expect(Registration).toHaveBeenCalled();
        expect(GuestRegistration.deleteOne).toHaveBeenCalled();
      });

      it("should skip migration if user already has registration for role", async () => {
        const mockUser = createMockUser();
        const mockGuest = createMockGuest();
        const mockEvent = createMockEvent();

        (User.findById as any).mockResolvedValue(mockUser);
        (GuestRegistration.findEligibleForMigration as any).mockResolvedValue([
          mockGuest,
        ]);
        (Event.findById as any).mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockEvent),
        });
        (Registration.findOne as any).mockResolvedValue({
          _id: "existing-reg",
        });
        (GuestRegistration.deleteOne as any).mockResolvedValue({
          deletedCount: 1,
        });

        const result = await GuestMigrationService.performGuestToUserMigration(
          "user-123",
          "test@example.com"
        );

        expect(result.ok).toBe(true);
        expect((result as any).modified).toBe(1);
        // Registration constructor should not be called when existing registration found
        expect(Registration).not.toHaveBeenCalled();
      });

      it("should skip past events during migration", async () => {
        const mockUser = createMockUser();
        const mockGuest = createMockGuest({
          eventSnapshot: {
            title: "Past Event",
            date: "2020-01-01", // Past date
            location: "Old Hall",
            roleName: "Attendee",
          },
        });
        const mockEvent = createMockEvent({
          date: "2020-01-01",
          endDate: "2020-01-01",
        });

        (User.findById as any).mockResolvedValue(mockUser);
        (GuestRegistration.findEligibleForMigration as any).mockResolvedValue([
          mockGuest,
        ]);
        (Event.findById as any).mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockEvent),
        });

        const result = await GuestMigrationService.performGuestToUserMigration(
          "user-123",
          "test@example.com"
        );

        expect(result.ok).toBe(true);
        expect((result as any).modified).toBe(0); // No migrations for past events
        expect(Registration).not.toHaveBeenCalled();
      });

      it("should use guest snapshot when event not found", async () => {
        const mockUser = createMockUser();
        const mockGuest = createMockGuest();

        (User.findById as any).mockResolvedValue(mockUser);
        (GuestRegistration.findEligibleForMigration as any).mockResolvedValue([
          mockGuest,
        ]);
        (Event.findById as any).mockReturnValue({
          lean: vi.fn().mockResolvedValue(null),
        });
        (Registration.findOne as any).mockResolvedValue(null);
        (GuestRegistration.deleteOne as any).mockResolvedValue({
          deletedCount: 1,
        });

        const result = await GuestMigrationService.performGuestToUserMigration(
          "user-123",
          "test@example.com"
        );

        expect(result.ok).toBe(true);
        expect((result as any).modified).toBe(1);
      });

      it("should handle Event.findById errors gracefully", async () => {
        const mockUser = createMockUser();
        const mockGuest = createMockGuest();

        (User.findById as any).mockResolvedValue(mockUser);
        (GuestRegistration.findEligibleForMigration as any).mockResolvedValue([
          mockGuest,
        ]);
        (Event.findById as any).mockReturnValue({
          lean: vi.fn().mockRejectedValue(new Error("DB error")),
        });
        (Registration.findOne as any).mockResolvedValue(null);
        (GuestRegistration.deleteOne as any).mockResolvedValue({
          deletedCount: 1,
        });

        // Should not throw, just proceed without event enrichment
        const result = await GuestMigrationService.performGuestToUserMigration(
          "user-123",
          "test@example.com"
        );

        expect(result.ok).toBe(true);
      });

      it("should return error when migration throws", async () => {
        (User.findById as any).mockRejectedValue(
          new Error("DB connection lost")
        );

        const result = await GuestMigrationService.performGuestToUserMigration(
          "user-123",
          "test@example.com"
        );

        expect(result.ok).toBe(false);
        expect((result as any).error).toContain("DB connection lost");
      });

      it("should invalidate caches after successful migration", async () => {
        const mockUser = createMockUser();
        const mockGuest = createMockGuest();
        const mockEvent = createMockEvent();

        (User.findById as any).mockResolvedValue(mockUser);
        (GuestRegistration.findEligibleForMigration as any).mockResolvedValue([
          mockGuest,
        ]);
        (Event.findById as any).mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockEvent),
        });
        (Registration.findOne as any).mockResolvedValue(null);
        (GuestRegistration.deleteOne as any).mockResolvedValue({
          deletedCount: 1,
        });
        // Ensure cache mocks work after clearAllMocks
        (CachePatterns.invalidateEventCache as any).mockResolvedValue(
          undefined
        );
        (CachePatterns.invalidateAnalyticsCache as any).mockResolvedValue(
          undefined
        );

        await GuestMigrationService.performGuestToUserMigration(
          "user-123",
          "test@example.com"
        );

        expect(CachePatterns.invalidateEventCache).toHaveBeenCalled();
        expect(CachePatterns.invalidateAnalyticsCache).toHaveBeenCalled();
      });

      it("should handle cache invalidation errors during migration", async () => {
        const mockUser = createMockUser();
        const mockGuest = createMockGuest();
        const mockEvent = createMockEvent();

        (User.findById as any).mockResolvedValue(mockUser);
        (GuestRegistration.findEligibleForMigration as any).mockResolvedValue([
          mockGuest,
        ]);
        (Event.findById as any).mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockEvent),
        });
        (Registration.findOne as any).mockResolvedValue(null);
        (GuestRegistration.deleteOne as any).mockResolvedValue({
          deletedCount: 1,
        });
        (CachePatterns.invalidateEventCache as any).mockRejectedValue(
          new Error("Cache error")
        );

        // Should not throw
        const result = await GuestMigrationService.performGuestToUserMigration(
          "user-123",
          "test@example.com"
        );

        expect(result.ok).toBe(true);
      });

      it("should use role from event document when available", async () => {
        const mockUser = createMockUser();
        const mockGuest = createMockGuest({ roleId: "role-1" });
        const mockEvent = createMockEvent({
          roles: [{ id: "role-1", name: "VIP", description: "VIP Access" }],
        });

        (User.findById as any).mockResolvedValue(mockUser);
        (GuestRegistration.findEligibleForMigration as any).mockResolvedValue([
          mockGuest,
        ]);
        (Event.findById as any).mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockEvent),
        });
        (Registration.findOne as any).mockResolvedValue(null);
        (GuestRegistration.deleteOne as any).mockResolvedValue({
          deletedCount: 1,
        });

        await GuestMigrationService.performGuestToUserMigration(
          "user-123",
          "test@example.com"
        );

        expect(Registration).toHaveBeenCalled();
        // Verify the Registration was created with event role name
        const regCall = (Registration as any).mock.calls[0][0];
        expect(regCall.eventSnapshot.roleName).toBe("VIP");
      });

      it("should provide default values for missing snapshot fields", async () => {
        const mockUser = createMockUser();
        const mockGuest = createMockGuest({
          eventSnapshot: {},
        });

        (User.findById as any).mockResolvedValue(mockUser);
        (GuestRegistration.findEligibleForMigration as any).mockResolvedValue([
          mockGuest,
        ]);
        (Event.findById as any).mockReturnValue({
          lean: vi.fn().mockResolvedValue(null),
        });
        (Registration.findOne as any).mockResolvedValue(null);
        (GuestRegistration.deleteOne as any).mockResolvedValue({
          deletedCount: 1,
        });

        await GuestMigrationService.performGuestToUserMigration(
          "user-123",
          "test@example.com"
        );

        const regCall = (Registration as any).mock.calls[0][0];
        expect(regCall.eventSnapshot.title).toBe("Event");
        expect(regCall.eventSnapshot.roleName).toBe("Participant");
        expect(regCall.eventSnapshot.location).toBe("");
      });

      it("should handle guest without eventId", async () => {
        const mockUser = createMockUser();
        const mockGuest = createMockGuest({ eventId: undefined });

        (User.findById as any).mockResolvedValue(mockUser);
        (GuestRegistration.findEligibleForMigration as any).mockResolvedValue([
          mockGuest,
        ]);
        (Registration.findOne as any).mockResolvedValue(null);
        (GuestRegistration.deleteOne as any).mockResolvedValue({
          deletedCount: 1,
        });

        // Should not call Event.findById when no eventId
        const result = await GuestMigrationService.performGuestToUserMigration(
          "user-123",
          "test@example.com"
        );

        expect(result.ok).toBe(true);
      });

      it("should migrate multiple guests for same user", async () => {
        const mockUser = createMockUser();
        const mockGuests = [
          createMockGuest({ _id: { toString: () => "g1" }, roleId: "role-1" }),
          createMockGuest({ _id: { toString: () => "g2" }, roleId: "role-2" }),
        ];
        const mockEvent = createMockEvent();

        (User.findById as any).mockResolvedValue(mockUser);
        (GuestRegistration.findEligibleForMigration as any).mockResolvedValue(
          mockGuests
        );
        (Event.findById as any).mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockEvent),
        });
        (Registration.findOne as any).mockResolvedValue(null);
        (GuestRegistration.deleteOne as any).mockResolvedValue({
          deletedCount: 1,
        });

        const result = await GuestMigrationService.performGuestToUserMigration(
          "user-123",
          "test@example.com"
        );

        expect(result.ok).toBe(true);
        expect((result as any).modified).toBe(2);
        expect(Registration).toHaveBeenCalledTimes(2);
        expect(GuestRegistration.deleteOne).toHaveBeenCalledTimes(2);
      });
    });
  });
});
