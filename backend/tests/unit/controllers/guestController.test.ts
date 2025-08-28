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
import GuestRegistration from "../../../src/models/GuestRegistration";
import Event from "../../../src/models/Event";
import User from "../../../src/models/User";
import { GuestController } from "../../../src/controllers/guestController";
import { validateGuestUniqueness } from "../../../src/middleware/guestValidation";

// Get the mocked modules
const mockGuestRegistration = vi.mocked(GuestRegistration);
const mockEvent = vi.mocked(Event);
const mockUser = vi.mocked(User);

// Setup mocks
beforeEach(() => {
  // Mock static methods
  mockGuestRegistration.findOne = vi.fn();
  mockGuestRegistration.findById = vi.fn();
  mockGuestRegistration.findActiveByEvent = vi.fn();
  mockGuestRegistration.countActiveRegistrations = vi.fn();
  // New: mock deletion used by cancellation flow
  (mockGuestRegistration as any).deleteOne = vi
    .fn()
    .mockResolvedValue({ deletedCount: 1 });

  // Mock constructor that returns instance with save method
  const mockInstance = { save: vi.fn() };
  (mockGuestRegistration as any).mockImplementation(() => mockInstance);

  mockEvent.findById = vi.fn();
  // Reset User mocks
  (mockUser as any).findOne = vi.fn();
});

// Mock mongoose first
vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("mongoose")>();

  // Minimal Schema stub to satisfy model file when it defines indexes and hooks
  class FakeSchema {
    // Mongoose attaches these containers for method/static assignments
    public methods: Record<string, any> = {};
    public statics: Record<string, any> = {};

    constructor(..._args: any[]) {}
    index(): this {
      return this;
    }
    pre(): this {
      return this;
    }
    // Provide a minimal virtual() API used by models (e.g., User)
    virtual(_name?: any, _options?: any): any {
      // Return an object supporting .get() and .set() chaining
      const self = this;
      return {
        get(_fn: any) {
          return self;
        },
        set(_fn: any) {
          return self;
        },
      } as any;
    }
  }

  // Preserve Schema.Types (e.g., Mixed, ObjectId) from the real mongoose Schema
  const SchemaProxy: any = FakeSchema as any;
  SchemaProxy.Types = (actual.Schema as any).Types;

  return {
    ...actual,
    Schema: SchemaProxy,
    model: vi.fn(),
    connect: vi.fn(),
    connection: {
      readyState: 1,
    },
  };
});

// Mock dependencies
vi.mock("../../../src/models/GuestRegistration");
vi.mock("../../../src/models/Event");
vi.mock("../../../src/models/User");
// Also mock the aggregated models module the controller imports from
vi.mock("../../../src/models", async () => {
  const GuestRegistrationModule = await import(
    "../../../src/models/GuestRegistration"
  );
  const EventModule = await import("../../../src/models/Event");
  const UserModule = await import("../../../src/models/User");
  return {
    GuestRegistration: GuestRegistrationModule.default,
    Event: EventModule.default,
    User: UserModule.default,
  } as any;
});
vi.mock("../../../src/services/infrastructure/emailService", () => ({
  EmailService: {
    sendGuestConfirmationEmail: vi.fn().mockResolvedValue(true),
    sendGuestRegistrationNotification: vi.fn().mockResolvedValue(true),
  },
}));
vi.mock("../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitEventUpdate: vi.fn(),
  },
}));
vi.mock("../../../src/middleware/guestValidation", () => ({
  guestRegistrationValidation: vi.fn((req: any, res: any, next: any) => next()),
  validateGuestUniqueness: vi.fn().mockResolvedValue({ isValid: true }),
  validateGuestRateLimit: vi.fn().mockReturnValue({ isValid: true }),
}));

// Mock express-validator to always return no errors
vi.mock("express-validator", () => ({
  validationResult: vi.fn(() => ({
    isEmpty: () => true,
    array: () => [],
  })),
}));

describe("guestController", () => {
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

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
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
      // Mock Event.findById
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
        // Far future to avoid flakiness due to current date
        registrationDeadline: new Date("2100-01-14"),
      };
      vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);

      // Mock GuestRegistration.countActiveRegistrations
      vi.mocked(GuestRegistration.countActiveRegistrations).mockResolvedValue(
        5
      );

      // Mock GuestRegistration creation
      const mockGuest = {
        _id: mockGuestId,
        ...validGuestData,
        // save should resolve to the saved document with _id and registrationDate
        save: vi.fn().mockResolvedValue({
          _id: mockGuestId,
          registrationDate: new Date("2025-01-10T12:00:00Z"),
        }),
      };
      vi.mocked(GuestRegistration).mockImplementation(() => mockGuest as any);

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
      // Mock Event.findById with valid event and role
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
      vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);

      // Mock User.findOne to simulate existing user
      // Mock User.findOne to simulate existing user
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
      vi.mocked(Event.findById).mockResolvedValue(null);

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
      vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);

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
      vi.mocked(validateGuestUniqueness).mockResolvedValue({
        isValid: true,
      } as any);

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
      vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);

      // Mock that current count equals capacity
      vi.mocked(GuestRegistration.countActiveRegistrations).mockResolvedValue(
        5
      );

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
      vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);

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
      vi.mocked(Event.findById).mockRejectedValue(new Error("Database error"));

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

      vi.mocked(GuestRegistration.findActiveByEvent).mockResolvedValue(
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
      vi.mocked(GuestRegistration.findActiveByEvent).mockRejectedValue(
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

      vi.mocked(GuestRegistration.findById).mockResolvedValue(mockGuest as any);

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
      vi.mocked(GuestRegistration.findById).mockResolvedValue(null);

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

      vi.mocked(GuestRegistration.findById).mockResolvedValue(mockGuest as any);

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

      vi.mocked(GuestRegistration.findById).mockResolvedValue(mockGuest as any);

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
      vi.mocked(GuestRegistration.findById).mockResolvedValue(null);

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

      vi.mocked(GuestRegistration.findById).mockResolvedValue(mockGuest as any);

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

      vi.mocked(GuestRegistration.findById).mockResolvedValue({
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
      vi.mocked(GuestRegistration.findById).mockResolvedValue(null as any);

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
      vi.mocked(GuestRegistration.findById).mockRejectedValue(
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
