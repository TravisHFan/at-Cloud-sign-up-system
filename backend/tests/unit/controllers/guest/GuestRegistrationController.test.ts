import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import { GuestRegistrationController } from "../../../../src/controllers/guest/GuestRegistrationController";
import { validationResult } from "express-validator";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  Event: {
    findById: vi.fn(),
  },
  GuestRegistration: {
    findOne: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
  },
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
        roles: [{ id: "other-role", name: "Other Role" }],
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
        roles: [{ id: "role-123", name: "Test Role" }],
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
        roles: [{ id: "role-123", name: "Test Role" }],
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
        roles: [{ id: "role-123", name: "Test Role" }],
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
        roles: [{ id: "role-123", name: "Test Role" }],
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
});
