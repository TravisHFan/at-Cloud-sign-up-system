import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CacheHelper } from "../../../../src/controllers/publicEvent/CacheHelper";
import { socketService } from "../../../../src/services/infrastructure/SocketService";
import { ResponseBuilderService } from "../../../../src/services/ResponseBuilderService";
import { CachePatterns } from "../../../../src/services";
import { CorrelatedLogger } from "../../../../src/services/CorrelatedLogger";

// Mock all dependencies
vi.mock("../../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitEventUpdate: vi.fn(),
  },
}));

vi.mock("../../../../src/services/ResponseBuilderService", () => ({
  ResponseBuilderService: {
    buildEventWithRegistrations: vi.fn(),
  },
}));

vi.mock("../../../../src/services", () => ({
  CachePatterns: {
    invalidateEventCache: vi.fn(),
    invalidateAnalyticsCache: vi.fn(),
  },
}));

describe("CacheHelper", () => {
  const mockEvent = {
    _id: { toString: () => "event123" },
    roles: [
      {
        id: "role1",
        name: "Speaker",
        description: "Event speaker",
        openToPublic: true,
        capacity: 10,
      },
      {
        id: "role2",
        name: "Attendee",
        openToPublic: false,
        capacity: 50,
      },
    ],
  };

  const mockUpdatedEvent = {
    _id: "event123",
    name: "Test Event",
    roles: mockEvent.roles,
  };

  const mockLogger = {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  } as unknown as CorrelatedLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(
      ResponseBuilderService.buildEventWithRegistrations
    ).mockResolvedValue(mockUpdatedEvent as any);
    vi.mocked(CachePatterns.invalidateEventCache).mockResolvedValue(undefined);
    vi.mocked(CachePatterns.invalidateAnalyticsCache).mockResolvedValue(
      undefined
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("emitRegistrationUpdate", () => {
    describe("guest registration flow", () => {
      it("should emit guest_registration event with correct payload", async () => {
        await CacheHelper.emitRegistrationUpdate(
          mockEvent as any,
          "role1",
          "guest",
          "guest123",
          "John Doe",
          mockLogger
        );

        expect(socketService.emitEventUpdate).toHaveBeenCalledOnce();
        expect(socketService.emitEventUpdate).toHaveBeenCalledWith(
          "event123",
          "guest_registration",
          expect.objectContaining({
            eventId: "event123",
            roleId: "role1",
            guestName: "John Doe",
            event: mockUpdatedEvent,
            timestamp: expect.any(Date),
          })
        );
      });

      it("should handle guest registration without attendee name", async () => {
        await CacheHelper.emitRegistrationUpdate(
          mockEvent as any,
          "role1",
          "guest",
          "guest123",
          undefined,
          mockLogger
        );

        expect(socketService.emitEventUpdate).toHaveBeenCalledWith(
          "event123",
          "guest_registration",
          expect.objectContaining({
            eventId: "event123",
            roleId: "role1",
            guestName: undefined,
            event: mockUpdatedEvent,
          })
        );
      });

      it("should handle guest registration without logger", async () => {
        await expect(
          CacheHelper.emitRegistrationUpdate(
            mockEvent as any,
            "role1",
            "guest",
            "guest123",
            "Jane Smith"
          )
        ).resolves.not.toThrow();

        expect(socketService.emitEventUpdate).toHaveBeenCalledOnce();
      });
    });

    describe("user registration flow", () => {
      it("should emit user_signed_up event with correct payload", async () => {
        await CacheHelper.emitRegistrationUpdate(
          mockEvent as any,
          "role1",
          "user",
          "user123",
          "John Doe",
          mockLogger
        );

        expect(socketService.emitEventUpdate).toHaveBeenCalledOnce();
        expect(socketService.emitEventUpdate).toHaveBeenCalledWith(
          "event123",
          "user_signed_up",
          expect.objectContaining({
            userId: "user123",
            roleId: "role1",
            roleName: "Speaker",
            event: mockUpdatedEvent,
          })
        );
      });

      it("should handle user registration when role is not found", async () => {
        await CacheHelper.emitRegistrationUpdate(
          mockEvent as any,
          "nonexistent-role",
          "user",
          "user123",
          "John Doe",
          mockLogger
        );

        expect(socketService.emitEventUpdate).toHaveBeenCalledWith(
          "event123",
          "user_signed_up",
          expect.objectContaining({
            userId: "user123",
            roleId: "nonexistent-role",
            roleName: undefined,
            event: mockUpdatedEvent,
          })
        );
      });

      it("should find correct role by ID", async () => {
        await CacheHelper.emitRegistrationUpdate(
          mockEvent as any,
          "role2",
          "user",
          "user456",
          undefined,
          mockLogger
        );

        const emitCall = vi.mocked(socketService.emitEventUpdate).mock.calls[0];
        expect(emitCall[2]).toEqual(
          expect.objectContaining({
            userId: "user456",
            roleId: "role2",
            roleName: "Attendee",
          })
        );
      });
    });

    describe("null registration type", () => {
      it("should not emit socket event for null registration type", async () => {
        await CacheHelper.emitRegistrationUpdate(
          mockEvent as any,
          "role1",
          null,
          "reg123",
          undefined,
          mockLogger
        );

        expect(socketService.emitEventUpdate).not.toHaveBeenCalled();
      });

      it("should still build event and invalidate caches for null type", async () => {
        await CacheHelper.emitRegistrationUpdate(
          mockEvent as any,
          "role1",
          null,
          "reg123",
          undefined,
          mockLogger
        );

        expect(
          ResponseBuilderService.buildEventWithRegistrations
        ).toHaveBeenCalledWith("event123");
        expect(CachePatterns.invalidateEventCache).toHaveBeenCalledWith(
          "event123"
        );
        expect(CachePatterns.invalidateAnalyticsCache).toHaveBeenCalledOnce();
      });
    });

    describe("cache invalidation", () => {
      it("should always build updated event with registrations", async () => {
        await CacheHelper.emitRegistrationUpdate(
          mockEvent as any,
          "role1",
          "guest",
          "guest123",
          "Test User",
          mockLogger
        );

        expect(
          ResponseBuilderService.buildEventWithRegistrations
        ).toHaveBeenCalledWith("event123");
        expect(
          ResponseBuilderService.buildEventWithRegistrations
        ).toHaveBeenCalledOnce();
      });

      it("should always invalidate event cache", async () => {
        await CacheHelper.emitRegistrationUpdate(
          mockEvent as any,
          "role1",
          "user",
          "user123",
          undefined,
          mockLogger
        );

        expect(CachePatterns.invalidateEventCache).toHaveBeenCalledWith(
          "event123"
        );
        expect(CachePatterns.invalidateEventCache).toHaveBeenCalledOnce();
      });

      it("should always invalidate analytics cache", async () => {
        await CacheHelper.emitRegistrationUpdate(
          mockEvent as any,
          "role1",
          "guest",
          "guest123",
          undefined,
          mockLogger
        );

        expect(CachePatterns.invalidateAnalyticsCache).toHaveBeenCalledOnce();
      });

      it("should catch all errors and stop execution", async () => {
        vi.mocked(socketService.emitEventUpdate).mockImplementation(() => {
          throw new Error("Socket error");
        });

        await CacheHelper.emitRegistrationUpdate(
          mockEvent as any,
          "role1",
          "guest",
          "guest123",
          "Test User",
          mockLogger
        );

        // Socket emission runs synchronously, error stops cache invalidation
        expect(CachePatterns.invalidateEventCache).not.toHaveBeenCalled();
        expect(CachePatterns.invalidateAnalyticsCache).not.toHaveBeenCalled();
      });
    });

    describe("error handling", () => {
      it("should log warning when socket emission fails", async () => {
        vi.mocked(socketService.emitEventUpdate).mockImplementation(() => {
          throw new Error("Socket connection failed");
        });

        await CacheHelper.emitRegistrationUpdate(
          mockEvent as any,
          "role1",
          "guest",
          "guest123",
          "Test User",
          mockLogger
        );

        expect(mockLogger.warn).toHaveBeenCalledWith(
          "Failed to emit realtime update for public registration",
          undefined,
          expect.objectContaining({
            error: "Socket connection failed",
            eventId: "event123",
            roleId: "role1",
          })
        );
      });

      it("should not throw when socket emission fails", async () => {
        vi.mocked(socketService.emitEventUpdate).mockImplementation(() => {
          throw new Error("Network error");
        });

        await expect(
          CacheHelper.emitRegistrationUpdate(
            mockEvent as any,
            "role1",
            "user",
            "user123",
            undefined,
            mockLogger
          )
        ).resolves.not.toThrow();
      });

      it("should catch error when buildEventWithRegistrations fails", async () => {
        vi.mocked(
          ResponseBuilderService.buildEventWithRegistrations
        ).mockRejectedValue(new Error("Build failed"));

        await CacheHelper.emitRegistrationUpdate(
          mockEvent as any,
          "role1",
          "guest",
          "guest123",
          "Test User",
          mockLogger
        );

        expect(mockLogger.warn).toHaveBeenCalledWith(
          "Failed to emit realtime update for public registration",
          undefined,
          expect.objectContaining({
            error: "Build failed",
            eventId: "event123",
            roleId: "role1",
          })
        );
      });

      it("should not call socket emission if build fails", async () => {
        vi.mocked(
          ResponseBuilderService.buildEventWithRegistrations
        ).mockRejectedValue(new Error("Build error"));

        try {
          await CacheHelper.emitRegistrationUpdate(
            mockEvent as any,
            "role1",
            "guest",
            "guest123",
            undefined,
            mockLogger
          );
        } catch {
          // Expected to throw
        }

        expect(socketService.emitEventUpdate).not.toHaveBeenCalled();
      });

      it("should handle error gracefully without logger", async () => {
        vi.mocked(socketService.emitEventUpdate).mockImplementation(() => {
          throw new Error("Socket error");
        });

        await expect(
          CacheHelper.emitRegistrationUpdate(
            mockEvent as any,
            "role1",
            "guest",
            "guest123",
            "Test User"
          )
        ).resolves.not.toThrow();

        // Error is caught but no logger to record it
        expect(CachePatterns.invalidateEventCache).not.toHaveBeenCalled();
      });
    });

    describe("edge cases", () => {
      it("should handle event with empty roles array", async () => {
        const eventWithNoRoles = {
          _id: { toString: () => "event456" },
          roles: [],
        };

        await CacheHelper.emitRegistrationUpdate(
          eventWithNoRoles as any,
          "role1",
          "user",
          "user123",
          undefined,
          mockLogger
        );

        expect(socketService.emitEventUpdate).toHaveBeenCalledWith(
          "event456",
          "user_signed_up",
          expect.objectContaining({
            userId: "user123",
            roleId: "role1",
            roleName: undefined,
          })
        );
      });

      it("should handle role with minimal fields", async () => {
        const eventWithMinimalRole = {
          _id: { toString: () => "event789" },
          roles: [{ id: "role1", name: "Minimal Role" }],
        };

        await CacheHelper.emitRegistrationUpdate(
          eventWithMinimalRole as any,
          "role1",
          "user",
          "user123",
          undefined,
          mockLogger
        );

        expect(socketService.emitEventUpdate).toHaveBeenCalledWith(
          "event789",
          "user_signed_up",
          expect.objectContaining({
            roleName: "Minimal Role",
          })
        );
      });

      it("should handle complex event ID conversion", async () => {
        const eventWithComplexId = {
          _id: {
            toString: () => "507f1f77bcf86cd799439011", // MongoDB ObjectId format
          },
          roles: [],
        };

        await CacheHelper.emitRegistrationUpdate(
          eventWithComplexId as any,
          "role1",
          "guest",
          "guest123",
          "Test User",
          mockLogger
        );

        expect(socketService.emitEventUpdate).toHaveBeenCalledWith(
          "507f1f77bcf86cd799439011",
          "guest_registration",
          expect.objectContaining({
            eventId: "507f1f77bcf86cd799439011",
          })
        );
        expect(CachePatterns.invalidateEventCache).toHaveBeenCalledWith(
          "507f1f77bcf86cd799439011"
        );
      });
    });
  });
});
