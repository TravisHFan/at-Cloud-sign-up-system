import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import { GuestRegistrationController } from "../../../../src/controllers/guest/GuestRegistrationController";
import { validationResult } from "express-validator";
import mongoose from "mongoose";

// Use vi.hoisted to create mock that can be referenced in vi.mock factories
// Note: Cannot use mongoose inside vi.hoisted since it's not available yet
const { mockGuestRegistrationInstance, MockGuestRegistrationConstructor } =
  vi.hoisted(() => {
    const mockGuestRegistrationInstance = {
      _id: { toString: () => "507f1f77bcf86cd799439011" },
      registrationDate: new Date("2025-02-01T10:00:00Z"),
      status: "active",
      save: vi.fn().mockResolvedValue({
        _id: { toString: () => "507f1f77bcf86cd799439011" },
        registrationDate: new Date("2025-02-01T10:00:00Z"),
        status: "active",
      }),
      generateManageToken: vi.fn().mockReturnValue("mock-manage-token"),
    };

    const MockGuestRegistrationConstructor = vi.fn(
      () => mockGuestRegistrationInstance,
    );

    return {
      mockGuestRegistrationInstance,
      MockGuestRegistrationConstructor,
    };
  });

// Create actual ObjectId instances after mongoose is imported
const mockRegistrationId = new mongoose.Types.ObjectId(
  "507f1f77bcf86cd799439011",
);
const mockRegistrationDate = new Date("2025-02-01T10:00:00Z");

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  Event: {
    findById: vi.fn(),
  },
  GuestRegistration: Object.assign(MockGuestRegistrationConstructor, {
    findOne: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
  }),
  User: {
    findOne: vi.fn(),
  },
  IEventRole: {},
}));

vi.mock("express-validator", () => ({
  validationResult: vi.fn(() => ({
    isEmpty: () => true,
    array: () => [],
  })),
}));

vi.mock("../../../../src/middleware/guestValidation", () => ({
  validateGuestUniqueness: vi.fn(),
  validateGuestRateLimit: vi.fn(),
}));

vi.mock("../../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendGuestRegistrationConfirmation: vi.fn(),
    sendGuestConfirmationEmail: vi.fn(),
    sendGuestRegistrationNotification: vi.fn(),
  },
}));

vi.mock("../../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitEventUpdate: vi.fn(),
  },
}));

vi.mock("../../../../src/services", () => ({
  CachePatterns: {
    invalidateEventCache: vi.fn(),
    invalidateAnalyticsCache: vi.fn(),
  },
}));

vi.mock("../../../../src/services/LoggerService", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock("../../../../src/services/ResponseBuilderService", () => ({
  ResponseBuilderService: {
    buildEventWithRegistrations: vi.fn(),
  },
}));

vi.mock("../../../../src/services/LockService", () => ({
  lockService: {
    withLock: vi.fn(),
    acquireLock: vi.fn(),
    releaseLock: vi.fn(),
  },
}));

vi.mock("../../../../src/services/CapacityService", () => ({
  CapacityService: {
    checkCapacity: vi.fn(),
    getRoleOccupancy: vi.fn(),
    isRoleFull: vi.fn(),
  },
}));

vi.mock("../../../../src/services/CorrelatedLogger", () => ({
  CorrelatedLogger: {
    fromRequest: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

vi.mock("../../../../src/utils/guestInvitationDeclineToken", () => ({
  createGuestInvitationDeclineToken: vi.fn(() => "mock-decline-token"),
}));

vi.mock("../../../../src/services/EventSnapshotBuilder", () => ({
  EventSnapshotBuilder: {
    buildGuestSnapshot: vi.fn(() => ({
      title: "Test Event",
      date: new Date(),
    })),
  },
}));

import { Event, User, GuestRegistration } from "../../../../src/models";
import { lockService } from "../../../../src/services/LockService";
import { CapacityService } from "../../../../src/services/CapacityService";
import {
  validateGuestUniqueness,
  validateGuestRateLimit,
} from "../../../../src/middleware/guestValidation";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";
import { socketService } from "../../../../src/services/infrastructure/SocketService";
import { CachePatterns } from "../../../../src/services";
import { ResponseBuilderService } from "../../../../src/services/ResponseBuilderService";

describe("GuestRegistrationController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn(() => ({ json: jsonMock })) as ReturnType<typeof vi.fn>;

    req = {
      params: { eventId: "507f1f77bcf86cd799439011" },
      body: {
        roleId: "role-123",
        fullName: "John Doe",
        gender: "male",
        email: "john@example.com",
        phone: "123-456-7890",
        notes: "Test notes",
      },
      ip: "127.0.0.1",
      socket: { remoteAddress: "127.0.0.1" },
      connection: { remoteAddress: "127.0.0.1" },
      get: vi.fn(() => "Mozilla/5.0"),
      headers: { "user-agent": "Mozilla/5.0" },
    } as unknown as Partial<Request>;

    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Partial<Response>;

    // Default: validation passes
    vi.mocked(validationResult).mockReturnValue({
      isEmpty: () => true,
      array: () => [],
    } as unknown as ReturnType<typeof validationResult>);
  });

  describe("registerGuest - validation", () => {
    it("should return 400 if validation fails", async () => {
      vi.mocked(validationResult).mockReturnValue({
        isEmpty: () => false,
        array: () => [{ msg: "Invalid email", path: "email" }],
      } as unknown as ReturnType<typeof validationResult>);

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Validation failed",
        errors: [{ msg: "Invalid email", path: "email" }],
      });
    });

    it("should return 404 if event is not found", async () => {
      vi.mocked(Event.findById).mockResolvedValue(null);

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Event not found",
      });
    });

    it("should return 404 if event role is not found", async () => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "other-role", name: "Other Role" }] as any,
      });

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Event role not found",
      });
    });

    it("should return 400 if email belongs to existing user", async () => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
      });
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue({ _id: "existing-user-id" }),
      } as unknown as ReturnType<typeof User.findOne>);

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message:
          "This email belongs to an existing user account. Please sign in or use a different email to register as a guest.",
      });
    });

    it("should return 400 if registration deadline has passed", async () => {
      const pastDeadline = new Date();
      pastDeadline.setDate(pastDeadline.getDate() - 1); // Yesterday

      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
        registrationDeadline: pastDeadline,
      });
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof User.findOne>);

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Registration deadline has passed",
      });
    });
  });

  describe("registerGuest - lock protected paths", () => {
    beforeEach(() => {
      // Set up event that passes validation
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
        registrationDeadline: null,
      });
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof User.findOne>);
    });

    it("should return 400 if role is at full capacity", async () => {
      vi.mocked(lockService.withLock).mockImplementation(async (key, fn) => {
        return fn();
      });
      vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
        current: 10,
        limit: 10,
      } as any);
      vi.mocked(CapacityService.isRoleFull).mockReturnValue(true);

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "This role is at full capacity",
      });
    });

    it("should return 429 if rate limit exceeded", async () => {
      vi.mocked(lockService.withLock).mockImplementation(async (key, fn) => {
        return fn();
      });
      vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
        current: 5,
        limit: 10,
      } as any);
      vi.mocked(CapacityService.isRoleFull).mockReturnValue(false);
      vi.mocked(validateGuestRateLimit).mockReturnValue({
        isValid: false,
        message: "Too many registration attempts. Please try again later.",
      } as any);

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(429);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Too many registration attempts. Please try again later.",
      });
    });

    it("should return 400 if already registered for this role", async () => {
      vi.mocked(lockService.withLock).mockImplementation(async (key, fn) => {
        return fn();
      });
      vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
        current: 5,
        limit: 10,
      } as any);
      vi.mocked(CapacityService.isRoleFull).mockReturnValue(false);
      vi.mocked(validateGuestRateLimit).mockReturnValue({
        isValid: true,
      } as any);
      vi.mocked(GuestRegistration.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue({ _id: "existing-reg-id" }),
      } as any);

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Already registered for this role",
      });
    });

    it("should return 400 if uniqueness check fails (role limit exceeded)", async () => {
      vi.mocked(lockService.withLock).mockImplementation(async (key, fn) => {
        return fn();
      });
      vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
        current: 5,
        limit: 10,
      } as any);
      vi.mocked(CapacityService.isRoleFull).mockReturnValue(false);
      vi.mocked(validateGuestRateLimit).mockReturnValue({
        isValid: true,
      } as any);
      vi.mocked(GuestRegistration.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as any);
      vi.mocked(validateGuestUniqueness).mockResolvedValue({
        isValid: false,
        message: "This guest has reached the 1-role limit for this event.",
      } as any);

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "This guest has reached the 1-role limit for this event.",
      });
    });
  });

  describe("registerGuest - error handling", () => {
    beforeEach(() => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
        registrationDeadline: null,
      });
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof User.findOne>);
    });

    it("should return 400 on duplicate key error (code 11000)", async () => {
      const duplicateError = new Error("Duplicate key") as any;
      duplicateError.code = 11000;

      vi.mocked(lockService.withLock).mockRejectedValue(duplicateError);

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "This guest has reached the 3-role limit for this event.",
      });
    });

    it("should return 500 on generic error", async () => {
      vi.mocked(lockService.withLock).mockRejectedValue(
        new Error("Database connection failed"),
      );

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error during guest registration",
      });
    });

    it("should handle rate limit bypass when validateGuestRateLimit throws", async () => {
      vi.mocked(lockService.withLock).mockImplementation(async (key, fn) => {
        return fn();
      });
      vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
        current: 5,
        limit: 10,
      } as any);
      vi.mocked(CapacityService.isRoleFull).mockReturnValue(false);
      // Rate limit throws unexpectedly
      vi.mocked(validateGuestRateLimit).mockImplementation(() => {
        throw new Error("Rate limit service unavailable");
      });
      // Duplicate check returns null
      vi.mocked(GuestRegistration.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as any);
      // Uniqueness passes
      vi.mocked(validateGuestUniqueness).mockResolvedValue({
        isValid: true,
      } as any);

      // Mock successful registration
      const savedReg = {
        _id: "new-reg-id",
        registrationDate: new Date(),
        save: vi.fn().mockResolvedValue(true),
        generateManageToken: vi.fn().mockReturnValue("token123"),
      };
      vi.mocked(lockService.withLock).mockImplementation(async () => {
        return { type: "ok" };
      });

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      // Should succeed despite rate limit error (bypassed)
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should handle undefined rate limit message gracefully", async () => {
      vi.mocked(lockService.withLock).mockImplementation(async (key, fn) => {
        return fn();
      });
      vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
        current: 5,
        limit: 10,
      } as any);
      vi.mocked(CapacityService.isRoleFull).mockReturnValue(false);
      vi.mocked(validateGuestRateLimit).mockReturnValue({
        isValid: false,
        message: undefined, // No message
      } as any);

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(429);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Rate limit exceeded",
      });
    });

    it("should handle undefined uniqueness message gracefully", async () => {
      vi.mocked(lockService.withLock).mockImplementation(async (key, fn) => {
        return fn();
      });
      vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
        current: 5,
        limit: 10,
      } as any);
      vi.mocked(CapacityService.isRoleFull).mockReturnValue(false);
      vi.mocked(validateGuestRateLimit).mockReturnValue({
        isValid: true,
      } as any);
      vi.mocked(GuestRegistration.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as any);
      vi.mocked(validateGuestUniqueness).mockResolvedValue({
        isValid: false,
        message: undefined, // No message
      } as any);

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "This guest has reached the 1-role limit for this event.",
      });
    });
  });

  describe("registerGuest - successful registration flow", () => {
    beforeEach(() => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        date: new Date("2025-03-15"),
        location: "Test Location",
        time: "10:00",
        endTime: "12:00",
        timeZone: "America/New_York",
        format: "in-person",
        roles: [
          {
            id: "role-123",
            name: "Test Role",
            description: "Role description",
          },
        ],
        registrationDeadline: null,
        organizerDetails: [
          { name: "Organizer 1", email: "org1@example.com", role: "Host" },
        ],
        createdBy: {
          firstName: "Creator",
          lastName: "User",
          email: "creator@example.com",
        },
      });
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof User.findOne>);
      // Set up mocks for successful flow
      vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
        current: 5,
        limit: 10,
      } as any);
      vi.mocked(CapacityService.isRoleFull).mockReturnValue(false);
      vi.mocked(validateGuestRateLimit).mockReturnValue({
        isValid: true,
      } as any);
      vi.mocked(GuestRegistration.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as any);
      vi.mocked(validateGuestUniqueness).mockResolvedValue({
        isValid: true,
      } as any);
      // Execute the callback to properly set savedRegistration
      vi.mocked(lockService.withLock).mockImplementation(
        async (_key, fn) => await fn(),
      );
    });

    it("should return 201 on successful registration with all data", async () => {
      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Guest registration successful",
          data: expect.objectContaining({
            eventId: "507f1f77bcf86cd799439011",
            eventTitle: "Test Event",
            roleName: "Test Role",
            confirmationEmailSent: true,
          }),
        }),
      );
    });

    it("should include registrationId and registrationDate in response", async () => {
      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            registrationId: expect.anything(),
            registrationDate: expect.any(Date),
            confirmationEmailSent: true,
          }),
        }),
      );
    });

    it("should include manageToken in response when generated", async () => {
      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            manageToken: "mock-manage-token",
          }),
        }),
      );
    });

    it("should include organizerDetails in response", async () => {
      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            organizerDetails: [
              { name: "Organizer 1", email: "org1@example.com", role: "Host" },
            ],
          }),
        }),
      );
    });
  });

  describe("registerGuest - email sending", () => {
    beforeEach(() => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        date: new Date("2025-03-15"),
        location: "Test Location",
        time: "10:00",
        endTime: "12:00",
        roles: [
          {
            id: "role-123",
            name: "Test Role",
            description: "Role description",
          },
        ],
        registrationDeadline: null,
        organizerDetails: [{ email: "org@example.com" }],
      });
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof User.findOne>);
      // Set up mocks for successful flow
      vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
        current: 5,
        limit: 10,
      } as any);
      vi.mocked(CapacityService.isRoleFull).mockReturnValue(false);
      vi.mocked(validateGuestRateLimit).mockReturnValue({
        isValid: true,
      } as any);
      vi.mocked(GuestRegistration.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as any);
      vi.mocked(validateGuestUniqueness).mockResolvedValue({
        isValid: true,
      } as any);
      // Execute the callback to properly set savedRegistration
      vi.mocked(lockService.withLock).mockImplementation(
        async (_key, fn) => await fn(),
      );
    });

    it("should call sendGuestConfirmationEmail on successful registration", async () => {
      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(EmailService.sendGuestConfirmationEmail).toHaveBeenCalled();
    });

    it("should call sendGuestRegistrationNotification to notify organizers", async () => {
      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(EmailService.sendGuestRegistrationNotification).toHaveBeenCalled();
    });

    it("should not fail registration if sendGuestConfirmationEmail throws", async () => {
      vi.mocked(EmailService.sendGuestConfirmationEmail).mockRejectedValue(
        new Error("Email service down"),
      );

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      // Registration should still succeed
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        }),
      );
    });

    it("should not fail registration if sendGuestRegistrationNotification throws", async () => {
      vi.mocked(
        EmailService.sendGuestRegistrationNotification,
      ).mockRejectedValue(new Error("Notification service down"));

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        }),
      );
    });

    it("should include decline token in email payload", async () => {
      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(EmailService.sendGuestConfirmationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          declineToken: "mock-decline-token",
        }),
      );
    });
  });

  describe("registerGuest - socket event emission", () => {
    beforeEach(() => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
        registrationDeadline: null,
      });
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof User.findOne>);
      // Set up mocks for successful flow
      vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
        current: 5,
        limit: 10,
      } as any);
      vi.mocked(CapacityService.isRoleFull).mockReturnValue(false);
      vi.mocked(validateGuestRateLimit).mockReturnValue({
        isValid: true,
      } as any);
      vi.mocked(GuestRegistration.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as any);
      vi.mocked(validateGuestUniqueness).mockResolvedValue({
        isValid: true,
      } as any);
      // Execute the callback to properly set savedRegistration
      vi.mocked(lockService.withLock).mockImplementation(
        async (_key, fn) => await fn(),
      );
      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations,
      ).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
      } as any);
    });

    it("should emit socket event on successful registration", async () => {
      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(socketService.emitEventUpdate).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        "guest_registration",
        expect.objectContaining({
          eventId: "507f1f77bcf86cd799439011",
          roleId: "role-123",
          guestName: "John Doe",
          timestamp: expect.any(Date),
        }),
      );
    });

    it("should not fail registration if socket emission throws", async () => {
      vi.mocked(socketService.emitEventUpdate).mockImplementation(() => {
        throw new Error("Socket connection error");
      });

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        }),
      );
    });
  });

  describe("registerGuest - cache invalidation", () => {
    beforeEach(() => {
      // Reset mock implementations that may have been modified by previous tests
      vi.mocked(socketService.emitEventUpdate).mockImplementation(() => {});
      vi.mocked(CachePatterns.invalidateEventCache).mockResolvedValue(
        undefined,
      );
      vi.mocked(CachePatterns.invalidateAnalyticsCache).mockResolvedValue(
        undefined,
      );

      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
        registrationDeadline: null,
      });
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof User.findOne>);
      // Set up mocks for successful flow
      vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
        current: 5,
        limit: 10,
      } as any);
      vi.mocked(CapacityService.isRoleFull).mockReturnValue(false);
      vi.mocked(validateGuestRateLimit).mockReturnValue({
        isValid: true,
      } as any);
      vi.mocked(GuestRegistration.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as any);
      vi.mocked(validateGuestUniqueness).mockResolvedValue({
        isValid: true,
      } as any);
      // Execute the callback to properly set savedRegistration
      vi.mocked(lockService.withLock).mockImplementation(
        async (_key, fn) => await fn(),
      );
      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations,
      ).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
      } as any);
    });

    it("should invalidate event cache on successful registration", async () => {
      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(CachePatterns.invalidateEventCache).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
      );
    });

    it("should invalidate analytics cache on successful registration", async () => {
      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(CachePatterns.invalidateAnalyticsCache).toHaveBeenCalled();
    });

    it("should not fail registration if cache invalidation throws", async () => {
      vi.mocked(CachePatterns.invalidateEventCache).mockRejectedValue(
        new Error("Cache service down"),
      );

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });

  describe("registerGuest - edge cases", () => {
    beforeEach(() => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
        registrationDeadline: null,
      });
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof User.findOne>);
      // Set up mocks for successful flow
      vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
        current: 5,
        limit: 10,
      } as any);
      vi.mocked(CapacityService.isRoleFull).mockReturnValue(false);
      vi.mocked(validateGuestRateLimit).mockReturnValue({
        isValid: true,
      } as any);
      vi.mocked(GuestRegistration.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as any);
      vi.mocked(validateGuestUniqueness).mockResolvedValue({
        isValid: true,
      } as any);
      // Execute the callback to properly set savedRegistration
      vi.mocked(lockService.withLock).mockImplementation(
        async (_key, fn) => await fn(),
      );
    });

    it("should handle missing req.body gracefully", async () => {
      const reqWithoutBody = {
        ...req,
        body: undefined,
      } as unknown as Request;

      await GuestRegistrationController.registerGuest(
        reqWithoutBody,
        res as Response,
      );

      // Should handle gracefully (likely 404 for role not found since roleId is undefined)
      expect(statusMock).toHaveBeenCalled();
    });

    it("should handle missing req.ip gracefully", async () => {
      const reqWithoutIp = {
        ...req,
        ip: undefined,
        socket: {},
        connection: {},
      } as unknown as Request;

      await GuestRegistrationController.registerGuest(
        reqWithoutIp,
        res as Response,
      );

      // Should still process the request
      expect(statusMock).toHaveBeenCalled();
    });

    it("should handle string registrationDeadline", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
        registrationDeadline: futureDate.toISOString(), // String format
      });

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      // Should succeed since deadline is in future
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should handle phone as undefined (optional field)", async () => {
      req.body = {
        ...req.body,
        phone: undefined,
      };

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should handle phone as null (optional field)", async () => {
      req.body = {
        ...req.body,
        phone: null,
      };

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should handle notes as undefined", async () => {
      req.body = {
        ...req.body,
        notes: undefined,
      };

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should handle event with empty roles array", async () => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [],
        registrationDeadline: null,
      });

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Event role not found",
      });
    });

    it("should handle event with undefined roles", async () => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: undefined,
        registrationDeadline: null,
      });

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Event role not found",
      });
    });

    it("should handle User.findOne returning thenable directly (no select)", async () => {
      vi.mocked(User.findOne).mockResolvedValue(null);

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });

  describe("registerGuest - authenticated user invitation", () => {
    beforeEach(() => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
        registrationDeadline: null,
      });
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof User.findOne>);
      // Set up mocks for successful flow
      vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
        current: 5,
        limit: 10,
      } as any);
      vi.mocked(CapacityService.isRoleFull).mockReturnValue(false);
      vi.mocked(validateGuestRateLimit).mockReturnValue({
        isValid: true,
      } as any);
      vi.mocked(GuestRegistration.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as any);
      vi.mocked(validateGuestUniqueness).mockResolvedValue({
        isValid: true,
      } as any);
      // Execute the callback to properly set savedRegistration
      vi.mocked(lockService.withLock).mockImplementation(
        async (_key, fn) => await fn(),
      );
      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations,
      ).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
      } as any);
    });

    it("should set invitedBy when req.user is present", async () => {
      const reqWithUser = {
        ...req,
        user: { id: "507f1f77bcf86cd799439012" }, // Valid ObjectId format
      } as unknown as Request;

      await GuestRegistrationController.registerGuest(
        reqWithUser,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should not set invitedBy when req.user is undefined (public self-registration)", async () => {
      const reqWithoutUser = {
        ...req,
        user: undefined,
      } as unknown as Request;

      await GuestRegistrationController.registerGuest(
        reqWithoutUser,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });

  describe("registerGuest - ResponseBuilderService interactions", () => {
    beforeEach(() => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
        registrationDeadline: null,
        organizerDetails: [{ email: "org@example.com" }],
      });
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof User.findOne>);
      // Set up mocks for successful flow
      vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
        current: 5,
        limit: 10,
      } as any);
      vi.mocked(CapacityService.isRoleFull).mockReturnValue(false);
      vi.mocked(validateGuestRateLimit).mockReturnValue({
        isValid: true,
      } as any);
      vi.mocked(GuestRegistration.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as any);
      vi.mocked(validateGuestUniqueness).mockResolvedValue({
        isValid: true,
      } as any);
      // Execute the callback to properly set savedRegistration
      vi.mocked(lockService.withLock).mockImplementation(
        async (_key, fn) => await fn(),
      );
    });

    it("should call buildEventWithRegistrations for enriched event data", async () => {
      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations,
      ).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Enriched Test Event",
        organizerDetails: [
          { name: "Enriched Org", email: "enriched@example.com" },
        ] as any,
      } as any);

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(
        ResponseBuilderService.buildEventWithRegistrations,
      ).toHaveBeenCalledWith("507f1f77bcf86cd799439011");
    });

    it("should fall back to original event if buildEventWithRegistrations fails", async () => {
      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations,
      ).mockRejectedValue(new Error("Failed to build event"));

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      // Should still succeed
      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });

  describe("registerGuest - validation edge cases", () => {
    it("should handle validationResult throwing an error", async () => {
      vi.mocked(validationResult).mockImplementation(() => {
        throw new Error("Validation error");
      });

      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
        registrationDeadline: null,
      });
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof User.findOne>);
      // Set up mocks for successful flow
      vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
        current: 5,
        limit: 10,
      } as any);
      vi.mocked(CapacityService.isRoleFull).mockReturnValue(false);
      vi.mocked(validateGuestRateLimit).mockReturnValue({
        isValid: true,
      } as any);
      vi.mocked(GuestRegistration.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as any);
      vi.mocked(validateGuestUniqueness).mockResolvedValue({
        isValid: true,
      } as any);
      // Execute the callback to properly set savedRegistration
      vi.mocked(lockService.withLock).mockImplementation(
        async (_key, fn) => await fn(),
      );

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      // Should proceed with empty validation (fallback behavior)
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should handle validationResult returning object without isEmpty method", async () => {
      vi.mocked(validationResult).mockReturnValue({} as any);

      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
        registrationDeadline: null,
      });
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof User.findOne>);
      // Set up mocks for successful flow
      vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
        current: 5,
        limit: 10,
      } as any);
      vi.mocked(CapacityService.isRoleFull).mockReturnValue(false);
      vi.mocked(validateGuestRateLimit).mockReturnValue({
        isValid: true,
      } as any);
      vi.mocked(GuestRegistration.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as any);
      vi.mocked(validateGuestUniqueness).mockResolvedValue({
        isValid: true,
      } as any);
      // Execute the callback to properly set savedRegistration
      vi.mocked(lockService.withLock).mockImplementation(
        async (_key, fn) => await fn(),
      );

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      // Should proceed with fallback empty validation
      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });

  describe("registerGuest - duplicate role check edge cases", () => {
    beforeEach(() => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
        registrationDeadline: null,
      });
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof User.findOne>);
    });

    it("should handle GuestRegistration.findOne throwing error (swallow and continue)", async () => {
      // Set up successful flow mocks
      vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
        current: 5,
        limit: 10,
      } as any);
      vi.mocked(CapacityService.isRoleFull).mockReturnValue(false);
      vi.mocked(validateGuestRateLimit).mockReturnValue({
        isValid: true,
      } as any);

      // Duplicate check throws (should be swallowed)
      vi.mocked(GuestRegistration.findOne).mockReturnValue({
        select: vi.fn().mockRejectedValue(new Error("DB error")),
      } as any);

      // Uniqueness passes
      vi.mocked(validateGuestUniqueness).mockResolvedValue({
        isValid: true,
      } as any);

      // Execute the callback to properly set savedRegistration
      vi.mocked(lockService.withLock).mockImplementation(
        async (_key, fn) => await fn(),
      );

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });

  describe("registerGuest - uniqueness check edge cases", () => {
    beforeEach(() => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
        registrationDeadline: null,
      });
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof User.findOne>);
    });

    it("should proceed if validateGuestUniqueness throws (swallow error)", async () => {
      vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
        current: 5,
        limit: 10,
      } as any);
      vi.mocked(CapacityService.isRoleFull).mockReturnValue(false);
      vi.mocked(validateGuestRateLimit).mockReturnValue({
        isValid: true,
      } as any);
      vi.mocked(GuestRegistration.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as any);

      // Uniqueness check throws (should be swallowed)
      vi.mocked(validateGuestUniqueness).mockRejectedValue(
        new Error("Uniqueness service down"),
      );

      // Execute the callback to properly set savedRegistration
      vi.mocked(lockService.withLock).mockImplementation(
        async (_key, fn) => await fn(),
      );

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });

  describe("registerGuest - IP address extraction", () => {
    beforeEach(() => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
        registrationDeadline: null,
      });
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof User.findOne>);
      // Set up mocks for successful flow
      vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
        current: 5,
        limit: 10,
      } as any);
      vi.mocked(CapacityService.isRoleFull).mockReturnValue(false);
      vi.mocked(validateGuestRateLimit).mockReturnValue({
        isValid: true,
      } as any);
      vi.mocked(GuestRegistration.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as any);
      vi.mocked(validateGuestUniqueness).mockResolvedValue({
        isValid: true,
      } as any);
      // Execute the callback to properly set savedRegistration
      vi.mocked(lockService.withLock).mockImplementation(
        async (_key, fn) => await fn(),
      );
    });

    it("should extract IP from socket.remoteAddress when req.ip is missing", async () => {
      const reqWithSocketIp = {
        ...req,
        ip: undefined,
        socket: { remoteAddress: "192.168.1.1" },
        connection: {},
      } as unknown as Request;

      await GuestRegistrationController.registerGuest(
        reqWithSocketIp,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should extract IP from connection.remoteAddress as fallback", async () => {
      const reqWithConnectionIp = {
        ...req,
        ip: undefined,
        socket: {},
        connection: { remoteAddress: "10.0.0.1" },
      } as unknown as Request;

      await GuestRegistrationController.registerGuest(
        reqWithConnectionIp,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });

  describe("registerGuest - User-Agent extraction", () => {
    beforeEach(() => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
        registrationDeadline: null,
      });
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof User.findOne>);
      // Set up mocks for successful flow
      vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
        current: 5,
        limit: 10,
      } as any);
      vi.mocked(CapacityService.isRoleFull).mockReturnValue(false);
      vi.mocked(validateGuestRateLimit).mockReturnValue({
        isValid: true,
      } as any);
      vi.mocked(GuestRegistration.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as any);
      vi.mocked(validateGuestUniqueness).mockResolvedValue({
        isValid: true,
      } as any);
      vi.mocked(lockService.withLock).mockImplementation(
        async (_key, fn) => await fn(),
      );
      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations,
      ).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
      } as any);
    });

    it("should extract user-agent from headers when req.get is unavailable", async () => {
      const reqWithHeadersUA = {
        ...req,
        get: undefined,
        headers: { "user-agent": "TestBot/1.0" },
      } as unknown as Request;

      await GuestRegistrationController.registerGuest(
        reqWithHeadersUA,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should handle missing user-agent gracefully", async () => {
      const reqNoUA = {
        ...req,
        get: vi.fn(() => undefined),
        headers: {},
      } as unknown as Request;

      await GuestRegistrationController.registerGuest(reqNoUA, res as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });

  describe("registerGuest - createdBy payload handling", () => {
    beforeEach(() => {
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof User.findOne>);
      // Set up mocks for successful flow
      vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
        current: 5,
        limit: 10,
      } as any);
      vi.mocked(CapacityService.isRoleFull).mockReturnValue(false);
      vi.mocked(validateGuestRateLimit).mockReturnValue({
        isValid: true,
      } as any);
      vi.mocked(GuestRegistration.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as any);
      vi.mocked(validateGuestUniqueness).mockResolvedValue({
        isValid: true,
      } as any);
      vi.mocked(lockService.withLock).mockImplementation(
        async (_key, fn) => await fn(),
      );
      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations,
      ).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
      } as any);
    });

    it("should include createdBy details in email payload when available", async () => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
        registrationDeadline: null,
        createdBy: {
          firstName: "John",
          lastName: "Creator",
          username: "johncreator",
          email: "john.creator@example.com",
          phone: "555-1234",
          avatar: "https://example.com/avatar.jpg",
          gender: "male",
        },
      });

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(EmailService.sendGuestConfirmationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({
            createdBy: expect.objectContaining({
              firstName: "John",
              lastName: "Creator",
            }),
          }),
        }),
      );
    });

    it("should handle undefined createdBy gracefully", async () => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
        registrationDeadline: null,
        createdBy: undefined,
      });

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should handle non-object createdBy gracefully", async () => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
        registrationDeadline: null,
        createdBy: "some-string-id", // Not an object
      });

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });

  describe("registerGuest - event format fields", () => {
    beforeEach(() => {
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof User.findOne>);
      // Set up mocks for successful flow
      vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
        current: 5,
        limit: 10,
      } as any);
      vi.mocked(CapacityService.isRoleFull).mockReturnValue(false);
      vi.mocked(validateGuestRateLimit).mockReturnValue({
        isValid: true,
      } as any);
      vi.mocked(GuestRegistration.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as any);
      vi.mocked(validateGuestUniqueness).mockResolvedValue({
        isValid: true,
      } as any);
      vi.mocked(lockService.withLock).mockImplementation(
        async (_key, fn) => await fn(),
      );
      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations,
      ).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
      } as any);
    });

    it("should pass hybrid event fields (zoomLink, meetingId, passcode) to email", async () => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Hybrid Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
        registrationDeadline: null,
        format: "virtual",
        isHybrid: true,
        zoomLink: "https://zoom.us/j/123456789",
        meetingId: "123-456-789",
        passcode: "secret123",
      });

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(EmailService.sendGuestConfirmationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({
            format: "virtual",
            isHybrid: true,
            zoomLink: "https://zoom.us/j/123456789",
            meetingId: "123-456-789",
            passcode: "secret123",
          }),
        }),
      );
    });

    it("should pass agenda and purpose to email", async () => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
        registrationDeadline: null,
        agenda: "1. Welcome\n2. Presentation\n3. Q&A",
        purpose: "Annual planning meeting",
      });

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(EmailService.sendGuestConfirmationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({
            agenda: "1. Welcome\n2. Presentation\n3. Q&A",
            purpose: "Annual planning meeting",
          }),
        }),
      );
    });

    it("should pass endDate and timeZone to email", async () => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Multi-day Event",
        date: new Date("2025-03-15"),
        endDate: new Date("2025-03-17"),
        timeZone: "Europe/London",
        roles: [{ id: "role-123", name: "Test Role" }] as any,
        registrationDeadline: null,
      });

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(EmailService.sendGuestConfirmationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({
            timeZone: "Europe/London",
          }),
        }),
      );
    });
  });

  describe("registerGuest - organizer notification payload", () => {
    beforeEach(() => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        date: new Date("2025-03-15"),
        roles: [{ id: "role-123", name: "Test Role" }] as any,
        registrationDeadline: null,
        organizerDetails: [
          { email: "org1@example.com" },
          { email: "org2@example.com" },
        ],
      });
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof User.findOne>);
      // Set up mocks for successful flow - need all these for notifications to be sent
      vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
        current: 5,
        limit: 10,
      } as any);
      vi.mocked(CapacityService.isRoleFull).mockReturnValue(false);
      vi.mocked(validateGuestRateLimit).mockReturnValue({
        isValid: true,
      } as any);
      vi.mocked(GuestRegistration.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as any);
      vi.mocked(validateGuestUniqueness).mockResolvedValue({
        isValid: true,
      } as any);
      // Execute the callback to properly run the registration flow
      vi.mocked(lockService.withLock).mockImplementation(
        async (_key, fn) => await fn(),
      );
      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations,
      ).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        date: "2025-03-15",
        organizerDetails: [
          { email: "org1@example.com" },
          { email: "org2@example.com" },
        ] as any,
      } as any);
    });

    it("should send notification to all organizer emails", async () => {
      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(
        EmailService.sendGuestRegistrationNotification,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          organizerEmails: ["org1@example.com", "org2@example.com"],
        }),
      );
    });

    it("should include guest details in organizer notification", async () => {
      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(
        EmailService.sendGuestRegistrationNotification,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          guest: {
            name: "John Doe",
            email: "john@example.com",
            phone: "123-456-7890",
          },
          role: { name: "Test Role" },
        }),
      );
    });

    it("should filter out empty organizer emails", async () => {
      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations,
      ).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        organizerDetails: [
          { email: "valid@example.com" },
          { email: "" },
          { email: undefined },
          { name: "No Email Org" },
        ] as any,
      } as any);

      await GuestRegistrationController.registerGuest(
        req as Request,
        res as Response,
      );

      expect(
        EmailService.sendGuestRegistrationNotification,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          organizerEmails: ["valid@example.com"],
        }),
      );
    });
  });
});
