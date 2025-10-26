/**
 * Unit tests for guestController - Guest Registration API endpoints
 * Testing all controller methods with comprehensive error handling scenarios
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { Request, Response } from "express";
import mongoose from "mongoose";
import { GuestController } from "../../../src/controllers/guestController";

// Mock dependencies with simplified approach
vi.mock("../../../src/models/GuestRegistration", () => {
  const mockConstructor = vi.fn();
  const mockStatics = {
    findOne: vi.fn(),
    findById: vi.fn(),
    findActiveByEvent: vi.fn(),
    countActiveRegistrations: vi.fn(),
    deleteOne: vi.fn(),
  };

  // Assign static methods to constructor function
  Object.assign(mockConstructor, mockStatics);

  return {
    default: mockConstructor,
  };
});

vi.mock("../../../src/models/Event", () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock("../../../src/models/User", () => ({
  default: {
    findOne: vi.fn(),
  },
}));

vi.mock("../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendGuestConfirmationEmail: vi.fn().mockResolvedValue(true),
    sendGuestRegistrationNotification: vi.fn().mockResolvedValue(true),
    sendEventRoleRemovedEmail: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitEventUpdate: vi.fn(),
  },
}));

vi.mock("../../../src/services/ResponseBuilderService", () => ({
  ResponseBuilderService: {
    buildEventWithRegistrations: vi.fn().mockResolvedValue({
      success: true,
      data: { event: { id: "mock-event" } },
    }),
  },
}));

vi.mock("../../../src/services/infrastructure/lockService", () => ({
  lockService: {
    withLock: vi
      .fn()
      .mockImplementation(async (key: string, callback: () => any) => {
        // Simply execute the callback without any actual locking
        return await callback();
      }),
  },
}));

vi.mock("../../../src/services/CapacityService", () => ({
  CapacityService: {
    getRoleOccupancy: vi.fn().mockResolvedValue({ current: 0, capacity: 30 }),
    isRoleFull: vi.fn().mockReturnValue(false),
  },
}));

vi.mock("../../../src/services", () => ({
  CachePatterns: {
    invalidateEventCache: vi.fn().mockResolvedValue(true),
    invalidateAnalyticsCache: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../../../src/middleware/guestValidation", () => ({
  guestRegistrationValidation: vi.fn((req: any, res: any, next: any) => next()),
  validateGuestUniqueness: vi.fn().mockResolvedValue({ isValid: true }),
  validateGuestRateLimit: vi.fn().mockReturnValue({ isValid: true }),
}));

vi.mock("express-validator", () => ({
  validationResult: vi.fn(() => ({
    isEmpty: () => true,
    array: () => [],
  })),
}));

// Import mocked modules after mocking
import GuestRegistration from "../../../src/models/GuestRegistration";
import Event from "../../../src/models/Event";
import User from "../../../src/models/User";
import { validateGuestUniqueness } from "../../../src/middleware/guestValidation";
import { CapacityService } from "../../../src/services/CapacityService";

// Get typed mocked modules
const mockGuestRegistration = vi.mocked(GuestRegistration);
const mockEvent = vi.mocked(Event);
const mockUser = vi.mocked(User);

describe("guestController (refactored mocking)", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: Mock;
  const mockEventId = new mongoose.Types.ObjectId().toString();
  const mockGuestId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    // Mock response object
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    // Mock next function
    mockNext = vi.fn();

    // Clear all mocks but keep implementations
    vi.clearAllMocks();

    // Reset default mock implementations for static methods
    (mockGuestRegistration as any).findOne.mockResolvedValue(null);
    (mockGuestRegistration as any).findById.mockResolvedValue(null);
    (mockGuestRegistration as any).findActiveByEvent.mockResolvedValue([]);
    (mockGuestRegistration as any).countActiveRegistrations.mockResolvedValue(
      0
    );
    (mockGuestRegistration as any).deleteOne.mockResolvedValue({
      deletedCount: 1,
      acknowledged: true,
    });

    mockEvent.findById.mockResolvedValue(null);

    // Mock User.findOne to return a query object with select method
    mockUser.findOne.mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    } as any);

    // Mock validateGuestUniqueness default
    (validateGuestUniqueness as any).mockResolvedValue({ isValid: true });
  });

  describe("registerGuest", () => {
    const validGuestData = {
      roleId: "role1",
      fullName: "John Guest",
      email: "john@example.com",
      phone: "+1234567890",
      gender: "male" as const,
    };

    beforeEach(() => {
      mockReq = {
        params: { eventId: mockEventId },
        body: validGuestData,
        ip: "127.0.0.1",
        get: vi.fn().mockReturnValue("Test User Agent"),
      };
    });

    it("should successfully register a guest with valid data", async () => {
      const mockEvent = {
        _id: mockEventId,
        title: "Test Event",
        date: new Date("2025-01-15"),
        time: "18:00",
        type: "In-person",
        location: "Main Hall",
        maxCapacity: 50,
        roles: [
          {
            id: "role1",
            name: "Participant",
            capacity: 30,
          },
        ],
        registrationDeadline: new Date("2100-01-14"),
      };
      (Event.findById as any).mockResolvedValue(mockEvent as any);

      (GuestRegistration.countActiveRegistrations as any).mockResolvedValue(5);

      // Create a mock instance that will be returned by the constructor
      const mockGuestInstance = {
        _id: mockGuestId,
        ...validGuestData,
        eventId: mockEventId,
        status: "active",
        registrationDate: new Date("2025-01-10T12:00:00Z"),
        save: vi.fn().mockResolvedValue({
          _id: mockGuestId,
          registrationDate: new Date("2025-01-10T12:00:00Z"),
        }),
      };

      // Mock the constructor to return our instance
      (GuestRegistration as any).mockImplementation(() => mockGuestInstance);

      await GuestController.registerGuest(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining("Guest registration successful"),
          data: expect.objectContaining({
            registrationId: mockGuestId,
          }),
        })
      );
    });

    it("should reject registration when email belongs to an existing user", async () => {
      const mockEvent = {
        _id: mockEventId,
        title: "Test Event",
        date: new Date("2025-01-15"),
        location: "Main Hall",
        roles: [
          {
            id: "role1",
            name: "Participant",
            capacity: 30,
          },
        ],
        registrationDeadline: new Date("2100-01-14"),
      };
      (Event.findById as any).mockResolvedValue(mockEvent as any);
      (mockUser.findOne as any).mockReturnValue({
        select: vi.fn().mockResolvedValue({ _id: "u1" }),
      });
      await GuestController.registerGuest(
        mockReq as Request,
        mockRes as Response
      );
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("email belongs to an existing user"),
        })
      );
    });

    it("should reject registration when event not found", async () => {
      (Event.findById as any).mockResolvedValue(null);

      await GuestController.registerGuest(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Event not found",
      });
    });

    it("should reject registration when role not found", async () => {
      const mockEvent = {
        _id: mockEventId,
        title: "Test Event",
        roles: [{ id: "different-role", name: "Other", capacity: 30 }],
      };
      (Event.findById as any).mockResolvedValue(mockEvent as any);

      await GuestController.registerGuest(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Event role not found",
      });
    });

    it("should reject registration when role is at capacity", async () => {
      // Ensure uniqueness check does not short-circuit this test
      (validateGuestUniqueness as any).mockResolvedValue({
        isValid: true,
      } as any);

      // Mock CapacityService to return full capacity
      (CapacityService.getRoleOccupancy as any).mockResolvedValue({
        current: 5,
        capacity: 5,
      });
      (CapacityService.isRoleFull as any).mockReturnValue(true);

      const mockEvent = {
        _id: mockEventId,
        title: "Test Event",
        roles: [
          {
            id: "role1",
            name: "Participant",
            capacity: 5, // Small capacity
          },
        ],
      };
      (Event.findById as any).mockResolvedValue(mockEvent as any);

      await GuestController.registerGuest(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("This role is at full capacity"),
        })
      );
    });

    it("should reject registration when deadline has passed", async () => {
      const mockEvent = {
        _id: mockEventId,
        title: "Test Event",
        roles: [{ id: "role1", name: "Participant", capacity: 30 }],
        registrationDeadline: new Date("2020-01-01"), // Past deadline
      };
      (Event.findById as any).mockResolvedValue(mockEvent as any);

      await GuestController.registerGuest(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("deadline has passed"),
        })
      );
    });

    it("should handle server errors gracefully", async () => {
      (Event.findById as any).mockRejectedValue(new Error("Database error"));

      await GuestController.registerGuest(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining(
            "Internal server error during guest registration"
          ),
        })
      );
    });
  });

  describe("getEventGuests", () => {
    beforeEach(() => {
      mockReq = {
        params: { eventId: mockEventId },
      };
    });

    it("should return guests for valid event", async () => {
      const mockGuests = [
        {
          _id: mockGuestId,
          fullName: "John Guest",
          email: "john@example.com",
          phone: "+1234567890",
          gender: "male",
          registrationDate: new Date(),
          status: "active",
          toAdminJSON: vi.fn().mockReturnValue({
            id: mockGuestId,
            fullName: "John Guest",
            email: "john@example.com",
            status: "active",
          }),
        },
      ];

      (GuestRegistration.findActiveByEvent as any).mockResolvedValue(
        mockGuests as any
      );

      // Updated behavior: route allows optional auth and returns admin vs public JSON
      // Mark this request as coming from an Administrator so toAdminJSON is used
      (mockReq as any).user = { _id: "admin1" };
      (mockReq as any).userRole = "Administrator";

      await GuestController.getEventGuests(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            guests: expect.arrayContaining([
              expect.objectContaining({
                id: mockGuestId,
                fullName: "John Guest",
              }),
            ]),
          }),
        })
      );
    });

    it("should handle database errors", async () => {
      (GuestRegistration.findActiveByEvent as any).mockRejectedValue(
        new Error("Database error")
      );

      await GuestController.getEventGuests(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("Failed to fetch event guests"),
        })
      );
    });
  });

  describe("cancelGuestRegistration", () => {
    beforeEach(() => {
      mockReq = {
        params: { id: mockGuestId },
        // ensure req.body exists to avoid destructuring errors in controller
        body: {},
      };
    });

    it("should successfully cancel guest registration", async () => {
      const mockGuest = {
        _id: mockGuestId,
        status: "active",
        // include fields used in websocket emit path
        eventId: new mongoose.Types.ObjectId(),
        roleId: "role1",
        fullName: "John Guest",
        save: vi.fn().mockResolvedValue(true),
      };

      (GuestRegistration.findById as any).mockResolvedValue(mockGuest as any);

      await GuestController.cancelGuestRegistration(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining("cancelled successfully"),
        })
      );
      // deletion flow: should delete the document instead of updating status
      expect((GuestRegistration as any).deleteOne).toHaveBeenCalledWith({
        _id: mockGuestId,
      });
    });

    it("should return 404 for non-existent guest", async () => {
      (GuestRegistration.findById as any).mockResolvedValue(null);

      await GuestController.cancelGuestRegistration(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Guest registration not found",
      });
    });

    it("should delete even if registration status is already 'cancelled' (idempotent)", async () => {
      const mockGuest = {
        _id: mockGuestId,
        status: "cancelled",
        eventId: new mongoose.Types.ObjectId(),
        roleId: "role1",
        fullName: "John Guest",
      };

      (GuestRegistration.findById as any).mockResolvedValue(mockGuest as any);

      await GuestController.cancelGuestRegistration(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect((GuestRegistration as any).deleteOne).toHaveBeenCalledWith({
        _id: mockGuestId,
      });
    });
  });

  describe("updateGuestRegistration", () => {
    const updateData = {
      fullName: "John Updated",
      phone: "+1987654321",
    };

    beforeEach(() => {
      mockReq = {
        params: { id: mockGuestId },
        body: updateData,
      };
    });

    it("should successfully update guest registration", async () => {
      const mockGuest = {
        _id: mockGuestId,
        eventId: new mongoose.Types.ObjectId(),
        roleId: "role1",
        fullName: "John Guest",
        email: "john@example.com",
        phone: "+1234567890",
        status: "active",
        save: vi.fn().mockResolvedValue(true),
        toPublicJSON: vi.fn().mockReturnValue({
          id: mockGuestId,
          fullName: "John Updated",
          email: "john@example.com",
          phone: "+1987654321",
          status: "active",
        }),
      };

      (GuestRegistration.findById as any).mockResolvedValue(mockGuest as any);

      await GuestController.updateGuestRegistration(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining("updated successfully"),
        })
      );
      expect(mockGuest.fullName).toBe("John Updated");
      expect(mockGuest.phone).toBe("+1987654321");
    });

    it("should return 404 for non-existent guest", async () => {
      (GuestRegistration.findById as any).mockResolvedValue(null);

      await GuestController.updateGuestRegistration(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Guest registration not found",
      });
    });

    it("should reject updates to cancelled registrations", async () => {
      const mockGuest = {
        _id: mockGuestId,
        status: "cancelled",
      };

      (GuestRegistration.findById as any).mockResolvedValue(mockGuest as any);

      await GuestController.updateGuestRegistration(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining(
            "Cannot update cancelled registration"
          ),
        })
      );
    });
  });

  describe("getGuestRegistration", () => {
    beforeEach(() => {
      mockReq = {
        params: { id: mockGuestId },
      };
    });

    it("should return guest registration details", async () => {
      const mockGuest = {
        _id: mockGuestId,
        fullName: "John Guest",
        email: "john@example.com",
        phone: "+1234567890",
        gender: "male",
        status: "active",
        registrationDate: new Date(),
        eventSnapshot: {
          title: "Test Event",
          date: new Date("2025-01-15"),
          location: "Main Hall",
          roleName: "Participant",
        },
      };

      (GuestRegistration.findById as any).mockResolvedValue({
        toPublicJSON: vi.fn().mockReturnValue(mockGuest),
      } as any);

      await GuestController.getGuestRegistration(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            guest: expect.objectContaining({
              fullName: "John Guest",
              eventSnapshot: expect.objectContaining({
                title: "Test Event",
              }),
            }),
          }),
        })
      );
    });

    it("should return 404 for non-existent guest", async () => {
      (GuestRegistration.findById as any).mockResolvedValue(null as any);

      await GuestController.getGuestRegistration(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Guest registration not found",
      });
    });

    it("should handle database errors", async () => {
      (GuestRegistration.findById as any).mockRejectedValue(
        new Error("Database error")
      );

      await GuestController.getGuestRegistration(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining(
            "Failed to fetch guest registration"
          ),
        })
      );
    });
  });
});
