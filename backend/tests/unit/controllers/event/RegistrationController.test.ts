import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import { RegistrationController } from "../../../../src/controllers/event/RegistrationController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  Event: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
  Registration: {
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    deleteOne: vi.fn(),
    findOneAndDelete: vi.fn(),
    countDocuments: vi.fn(),
  },
  User: {
    findById: vi.fn(),
  },
  IEventRole: {},
}));

vi.mock("../../../../src/utils/roleUtils", () => ({
  hasPermission: vi.fn(),
  PERMISSIONS: {
    REGISTER_OTHERS: "register_others",
    REMOVE_REGISTRATION: "remove_registration",
  },
  ROLES: {
    SUPER_ADMIN: "super-admin",
    ADMIN: "admin",
    LEADER: "leader",
    MEMBER: "member",
    PARTICIPANT: "participant",
  },
}));

vi.mock("../../../../src/services/CorrelatedLogger", () => ({
  CorrelatedLogger: {
    fromRequest: vi.fn(() => ({
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

vi.mock("../../../../src/services/LockService", () => ({
  lockService: {
    acquireLock: vi.fn(),
    releaseLock: vi.fn(),
    withLock: vi.fn(),
  },
}));

vi.mock("../../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitEventUpdate: vi.fn(),
  },
}));

vi.mock("../../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendRegistrationConfirmation: vi.fn(),
  },
}));

vi.mock(
  "../../../../src/services/notifications/TrioNotificationService",
  () => ({
    TrioNotificationService: {
      notifyEventRegistration: vi.fn(),
      createEventRoleRemovedTrio: vi.fn(),
      createEventRoleMovedTrio: vi.fn(),
      createEventRoleAssignedTrio: vi.fn(),
    },
  }),
);

vi.mock("../../../../src/services/ResponseBuilderService", () => ({
  ResponseBuilderService: {
    buildEventWithRegistrations: vi.fn(),
  },
}));

vi.mock("../../../../src/services", () => ({
  CachePatterns: {
    invalidateEvent: vi.fn(),
    invalidateEventCache: vi.fn(),
    invalidateAnalyticsCache: vi.fn(),
  },
}));

vi.mock("../../../../src/utils/roleAssignmentRejectionToken", () => ({
  createRoleAssignmentRejectionToken: vi.fn(),
}));

vi.mock("../../../../src/controllers/eventController", () => ({
  EventController: {
    toIdString: vi.fn((id) => id?.toString()),
  },
}));

vi.mock("../../../../src/utils/roleRegistrationLimits", () => ({
  getMaxRolesPerEvent: vi.fn(() => 3),
  getMaxRolesDescription: vi.fn(() => "3 roles"),
}));

vi.mock("../../../../src/models/AuditLog", () => ({
  default: {
    create: vi.fn(),
  },
}));

import { Event, User } from "../../../../src/models";

describe("RegistrationController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn(() => ({ json: jsonMock })) as ReturnType<typeof vi.fn>;

    req = {
      params: { id: "507f1f77bcf86cd799439011" },
      body: { roleId: "role-123" },
      user: {
        _id: "user-id-123",
        role: "Participant" as const,
      },
    } as unknown as Partial<Request>;

    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Partial<Response>;
  });

  describe("signUpForEvent - validation", () => {
    it("should return 400 for invalid event ID", async () => {
      req.params = { id: "invalid-id" };

      await RegistrationController.signUpForEvent(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid event ID.",
      });
    });

    it("should return 401 if user is not authenticated", async () => {
      req.user = undefined;

      await RegistrationController.signUpForEvent(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should return 400 if roleId is not provided", async () => {
      req.body = {};

      await RegistrationController.signUpForEvent(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Role ID is required.",
      });
    });

    it("should return 404 if event is not found", async () => {
      vi.mocked(Event.findById).mockResolvedValue(null);

      await RegistrationController.signUpForEvent(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Event not found.",
      });
    });

    it("should return 400 if event status is not upcoming", async () => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        status: "completed",
        roles: [],
      });

      await RegistrationController.signUpForEvent(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Cannot sign up for this event.",
      });
    });

    it("should return 400 if role is not found in event", async () => {
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        status: "upcoming",
        roles: [{ id: "other-role", name: "Other Role" }],
      });

      await RegistrationController.signUpForEvent(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Role not found in this event.",
      });
    });
  });

  describe("cancelSignup - validation", () => {
    it("should return 400 for invalid event ID", async () => {
      req.params = { id: "invalid-id" };
      req.body = { roleId: "role-123" };

      await RegistrationController.cancelSignup(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid event ID.",
      });
    });

    it("should return 401 if user is not authenticated", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = { roleId: "role-123" };
      req.user = undefined;

      await RegistrationController.cancelSignup(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should return 404 if event is not found", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = { roleId: "role-123" };
      vi.mocked(Event.findById).mockResolvedValue(null);

      await RegistrationController.cancelSignup(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Event not found.",
      });
    });

    it("should return 404 if role is not found in event", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = { roleId: "nonexistent-role" };
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        status: "upcoming",
        roles: [{ id: "other-role", name: "Other Role" }],
      });

      await RegistrationController.cancelSignup(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Role not found.",
      });
    });
  });

  describe("removeUserFromRole - validation", () => {
    it("should return 404 if event is not found", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = { userId: "507f1f77bcf86cd799439012", roleId: "role-123" };
      vi.mocked(Event.findById).mockResolvedValue(null);

      await RegistrationController.removeUserFromRole(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Event not found",
      });
    });

    it("should return 404 if role is not found in event", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = {
        userId: "507f1f77bcf86cd799439012",
        roleId: "nonexistent-role",
      };
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        roles: [{ id: "other-role", name: "Other Role" }],
      });

      await RegistrationController.removeUserFromRole(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Role not found",
      });
    });
  });

  describe("moveUserBetweenRoles - validation", () => {
    it("should return 404 if event is not found", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = {
        userId: "507f1f77bcf86cd799439012",
        fromRoleId: "role-1",
        toRoleId: "role-2",
      };
      vi.mocked(Event.findById).mockResolvedValue(null);

      await RegistrationController.moveUserBetweenRoles(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Event not found",
      });
    });

    it("should return 404 if source or target role is not found", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = {
        userId: "507f1f77bcf86cd799439012",
        fromRoleId: "role-1",
        toRoleId: "nonexistent-role",
      };
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        roles: [{ id: "role-1", name: "Role 1" }],
      });

      await RegistrationController.moveUserBetweenRoles(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Source or target role not found",
      });
    });
  });

  describe("assignUserToRole - validation", () => {
    it("should return 400 for invalid event ID", async () => {
      req.params = { id: "invalid-id" };
      req.body = { userId: "507f1f77bcf86cd799439012", roleId: "role-123" };

      await RegistrationController.assignUserToRole(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid event ID.",
      });
    });

    it("should return 400 for invalid user ID", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = { userId: "invalid-user-id", roleId: "role-123" };

      await RegistrationController.assignUserToRole(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid user ID.",
      });
    });

    it("should return 400 if roleId is not provided", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = { userId: "507f1f77bcf86cd799439012" };

      await RegistrationController.assignUserToRole(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Role ID is required.",
      });
    });

    it("should return 404 if event is not found", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = { userId: "507f1f77bcf86cd799439012", roleId: "role-123" };
      vi.mocked(Event.findById).mockResolvedValue(null);

      await RegistrationController.assignUserToRole(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Event not found",
      });
    });

    it("should return 404 if role is not found in event", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = {
        userId: "507f1f77bcf86cd799439012",
        roleId: "nonexistent-role",
      };
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        status: "upcoming",
        roles: [{ id: "other-role", name: "Other Role" }],
      });

      await RegistrationController.assignUserToRole(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Role not found",
      });
    });

    it("should return 400 if event status is not upcoming", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = { userId: "507f1f77bcf86cd799439012", roleId: "role-123" };
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        status: "completed",
        roles: [{ id: "role-123", name: "Test Role" }],
      });

      await RegistrationController.assignUserToRole(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Cannot assign users to a non-upcoming event.",
      });
    });

    it("should return 404 if user is not found", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = { userId: "507f1f77bcf86cd799439012", roleId: "role-123" };
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        status: "upcoming",
        roles: [{ id: "role-123", name: "Test Role" }],
      });
      vi.mocked(User.findById).mockResolvedValue(null);

      await RegistrationController.assignUserToRole(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "User not found",
      });
    });

    it("should return 400 if user is inactive or not verified", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = { userId: "507f1f77bcf86cd799439012", roleId: "role-123" };
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        status: "upcoming",
        roles: [{ id: "role-123", name: "Test Role" }],
      });
      vi.mocked(User.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439012",
        isActive: false,
        isVerified: true,
      });

      await RegistrationController.assignUserToRole(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "User is inactive or not verified.",
      });
    });
  });

  describe("updateWorkshopGroupTopic - validation", () => {
    it("should return 400 for invalid event ID", async () => {
      req.params = { id: "invalid-id", group: "A" };
      req.body = { topic: "Test topic" };

      await RegistrationController.updateWorkshopGroupTopic(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid event ID.",
      });
    });

    it("should return 400 for invalid group key", async () => {
      req.params = { id: "507f1f77bcf86cd799439011", group: "Z" };
      req.body = { topic: "Test topic" };

      await RegistrationController.updateWorkshopGroupTopic(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid group key. Must be A-F.",
      });
    });

    it("should return 404 if event is not found", async () => {
      req.params = { id: "507f1f77bcf86cd799439011", group: "A" };
      req.body = { topic: "Test topic" };
      vi.mocked(Event.findById).mockResolvedValue(null);

      await RegistrationController.updateWorkshopGroupTopic(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Event not found.",
      });
    });

    it("should return 400 if event is not a workshop type", async () => {
      req.params = { id: "507f1f77bcf86cd799439011", group: "A" };
      req.body = { topic: "Test topic" };
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        type: "Webinar",
        roles: [],
      });

      await RegistrationController.updateWorkshopGroupTopic(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message:
          "Group topics are only for Effective Communication Workshop events.",
      });
    });

    it("should return 401 if user is not authenticated", async () => {
      req.params = { id: "507f1f77bcf86cd799439011", group: "A" };
      req.body = { topic: "Test topic" };
      req.user = undefined;
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        type: "Effective Communication Workshop",
        roles: [],
      });

      await RegistrationController.updateWorkshopGroupTopic(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });
  });

  // =====================================================
  // ADDITIONAL COMPREHENSIVE TESTS FOR COVERAGE IMPROVEMENT
  // =====================================================

  describe("signUpForEvent - role limit enforcement", () => {
    it("should return 400 when user has reached role limit for event", async () => {
      const { Registration } = await import("../../../../src/models");
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        status: "upcoming",
        roles: [{ id: "role-123", name: "Test Role", maxParticipants: 10 }],
        save: vi.fn(),
      });
      // User already has 3 roles (the limit for member)
      vi.mocked(Registration.countDocuments).mockResolvedValue(3);

      await RegistrationController.signUpForEvent(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("Role limit reached"),
        }),
      );
    });
  });

  describe("signUpForEvent - capacity check", () => {
    it("should return 400 when role is at full capacity (pre-lock)", async () => {
      const { Registration } = await import("../../../../src/models");
      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        status: "upcoming",
        roles: [{ id: "role-123", name: "Test Role", maxParticipants: 5 }],
        save: vi.fn(),
      });
      // User has no existing roles
      vi.mocked(Registration.countDocuments)
        .mockResolvedValueOnce(0) // userExistingRoleCount
        .mockResolvedValueOnce(5); // preLockCount (full capacity)

      await RegistrationController.signUpForEvent(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("full capacity"),
        }),
      );
    });
  });

  describe("signUpForEvent - successful registration flow", () => {
    it("should acquire lock with correct key and timeout", async () => {
      const { Registration } = await import("../../../../src/models");
      const { lockService } =
        await import("../../../../src/services/LockService");

      const mockEvent = {
        _id: "507f1f77bcf86cd799439011",
        status: "upcoming",
        roles: [{ id: "role-123", name: "Test Role", maxParticipants: 10 }],
        save: vi.fn().mockResolvedValue({}),
      };
      vi.mocked(Event.findById).mockResolvedValue(mockEvent);
      // User has no existing roles
      vi.mocked(Registration.countDocuments)
        .mockResolvedValueOnce(0) // userExistingRoleCount
        .mockResolvedValueOnce(3); // preLockCount (has capacity)

      // Mock lockService.withLock to simulate error so we don't need constructor
      vi.mocked(lockService).withLock = vi
        .fn()
        .mockRejectedValue(new Error("Simulated for test"));

      req.user = {
        _id: "user-id-123",
        role: "Participant" as const,
        username: "testuser",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
      } as any;

      await RegistrationController.signUpForEvent(
        req as Request,
        res as Response,
      );

      // Verify lock was acquired with correct key and timeout
      expect(lockService.withLock).toHaveBeenCalledWith(
        "signup:507f1f77bcf86cd799439011:role-123",
        expect.any(Function),
        10000,
      );
    });

    it("should pass capacity checks before acquiring lock", async () => {
      const { Registration } = await import("../../../../src/models");
      const { lockService } =
        await import("../../../../src/services/LockService");

      const mockEvent = {
        _id: "507f1f77bcf86cd799439011",
        status: "upcoming",
        roles: [{ id: "role-123", name: "Test Role", maxParticipants: 10 }],
        save: vi.fn().mockResolvedValue({}),
      };
      vi.mocked(Event.findById).mockResolvedValue(mockEvent);
      vi.mocked(Registration.countDocuments)
        .mockResolvedValueOnce(0) // userExistingRoleCount
        .mockResolvedValueOnce(5); // preLockCount (has capacity)

      // Mock withLock to throw immediately
      vi.mocked(lockService).withLock = vi
        .fn()
        .mockRejectedValue(new Error("Test"));

      req.user = {
        _id: "user-id-123",
        role: "Participant" as const,
      } as any;

      await RegistrationController.signUpForEvent(
        req as Request,
        res as Response,
      );

      // Verify countDocuments was called twice for capacity checks
      expect(Registration.countDocuments).toHaveBeenCalledTimes(2);
    });
  });

  describe("signUpForEvent - lock service error handling", () => {
    it("should return 503 on lock timeout", async () => {
      const { Registration } = await import("../../../../src/models");
      const { lockService } =
        await import("../../../../src/services/LockService");

      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        status: "upcoming",
        roles: [{ id: "role-123", name: "Test Role", maxParticipants: 10 }],
        save: vi.fn(),
      });
      vi.mocked(Registration.countDocuments)
        .mockResolvedValueOnce(0) // userExistingRoleCount
        .mockResolvedValueOnce(3); // preLockCount

      // Mock lock timeout
      vi.mocked(lockService).withLock = vi
        .fn()
        .mockRejectedValue(new Error("Lock timeout waiting for resource"));

      await RegistrationController.signUpForEvent(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message:
          "Service temporarily unavailable due to high load. Please try again.",
      });
    });

    it("should return 400 for already signed up error inside lock", async () => {
      const { Registration } = await import("../../../../src/models");
      const { lockService } =
        await import("../../../../src/services/LockService");

      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        status: "upcoming",
        roles: [{ id: "role-123", name: "Test Role", maxParticipants: 10 }],
        save: vi.fn(),
      });
      vi.mocked(Registration.countDocuments)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(3);

      vi.mocked(lockService).withLock = vi
        .fn()
        .mockRejectedValue(
          new Error("You are already signed up for this role."),
        );

      await RegistrationController.signUpForEvent(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "You are already signed up for this role.",
      });
    });

    it("should return 400 for full capacity error inside lock", async () => {
      const { Registration } = await import("../../../../src/models");
      const { lockService } =
        await import("../../../../src/services/LockService");

      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        status: "upcoming",
        roles: [{ id: "role-123", name: "Test Role", maxParticipants: 5 }],
        save: vi.fn(),
      });
      vi.mocked(Registration.countDocuments)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(3);

      vi.mocked(lockService).withLock = vi
        .fn()
        .mockRejectedValue(
          new Error(
            "This role is at full capacity (5/5). Please try another role.",
          ),
        );

      await RegistrationController.signUpForEvent(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message:
          "This role is at full capacity (5/5). Please try another role.",
      });
    });

    it("should return 500 for unexpected lock errors", async () => {
      const { Registration } = await import("../../../../src/models");
      const { lockService } =
        await import("../../../../src/services/LockService");

      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        status: "upcoming",
        roles: [{ id: "role-123", name: "Test Role", maxParticipants: 10 }],
        save: vi.fn(),
      });
      vi.mocked(Registration.countDocuments)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(3);

      vi.mocked(lockService).withLock = vi
        .fn()
        .mockRejectedValue(new Error("Unexpected database error"));

      await RegistrationController.signUpForEvent(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to sign up for event.",
      });
    });
  });

  describe("cancelSignup - successful cancellation", () => {
    it("should successfully cancel a user's signup", async () => {
      const { Registration } = await import("../../../../src/models");
      const { socketService } =
        await import("../../../../src/services/infrastructure/SocketService");
      const { ResponseBuilderService } =
        await import("../../../../src/services/ResponseBuilderService");
      const { CachePatterns } = await import("../../../../src/services");

      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = { roleId: "role-123" };

      const mockEvent = {
        _id: "507f1f77bcf86cd799439011",
        status: "upcoming",
        roles: [{ id: "role-123", name: "Test Role" }],
        save: vi.fn().mockResolvedValue({}),
      };
      vi.mocked(Event.findById).mockResolvedValue(mockEvent);

      // Mock successful deletion
      vi.mocked(Registration.findOneAndDelete).mockResolvedValue({
        _id: "reg-123",
        eventId: "507f1f77bcf86cd799439011",
        userId: "user-id-123",
        roleId: "role-123",
      });

      vi.mocked(CachePatterns.invalidateEventCache).mockResolvedValue(
        undefined,
      );
      vi.mocked(CachePatterns.invalidateAnalyticsCache).mockResolvedValue(
        undefined,
      );

      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations,
      ).mockResolvedValue({
        id: "507f1f77bcf86cd799439011",
        roles: [{ id: "role-123", name: "Test Role", registrations: [] }],
      } as unknown as Awaited<
        ReturnType<typeof ResponseBuilderService.buildEventWithRegistrations>
      >);

      vi.mocked(socketService.emitEventUpdate).mockReturnValue(undefined);

      await RegistrationController.cancelSignup(
        req as Request,
        res as Response,
      );

      expect(Registration.findOneAndDelete).toHaveBeenCalledWith({
        eventId: "507f1f77bcf86cd799439011",
        userId: "user-id-123",
        roleId: "role-123",
      });

      expect(socketService.emitEventUpdate).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        "user_cancelled",
        expect.objectContaining({
          userId: "user-id-123",
          roleId: "role-123",
          roleName: "Test Role",
        }),
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining("Successfully cancelled signup"),
        }),
      );
    });

    it("should return 400 if user is not signed up for the role", async () => {
      const { Registration } = await import("../../../../src/models");

      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = { roleId: "role-123" };

      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        status: "upcoming",
        roles: [{ id: "role-123", name: "Test Role" }],
        save: vi.fn(),
      });

      // No registration found
      vi.mocked(Registration.findOneAndDelete).mockResolvedValue(null);

      await RegistrationController.cancelSignup(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "You are not signed up for this role.",
      });
    });

    it("should return 500 on unexpected error during cancellation", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = { roleId: "role-123" };

      vi.mocked(Event.findById).mockRejectedValue(new Error("Database error"));

      await RegistrationController.cancelSignup(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to cancel signup.",
      });
    });
  });

  describe("removeUserFromRole - successful removal", () => {
    it("should successfully remove user from role", async () => {
      const { Registration } = await import("../../../../src/models");
      const { socketService } =
        await import("../../../../src/services/infrastructure/SocketService");
      const { ResponseBuilderService } =
        await import("../../../../src/services/ResponseBuilderService");
      const { CachePatterns } = await import("../../../../src/services");
      const { TrioNotificationService } =
        await import("../../../../src/services/notifications/TrioNotificationService");

      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = { userId: "507f1f77bcf86cd799439012", roleId: "role-123" };
      req.user = {
        _id: "admin-id",
        role: "Administrator",
        firstName: "Admin",
        lastName: "User",
        username: "admin",
      } as any;

      const mockEvent = {
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        roles: [{ id: "role-123", name: "Test Role" }],
        save: vi.fn().mockResolvedValue({}),
      };
      vi.mocked(Event.findById).mockResolvedValue(mockEvent);

      vi.mocked(Registration.findOneAndDelete).mockResolvedValue({
        _id: "reg-123",
        eventId: "507f1f77bcf86cd799439011",
        userId: "507f1f77bcf86cd799439012",
        roleId: "role-123",
      });

      vi.mocked(CachePatterns.invalidateEventCache).mockResolvedValue(
        undefined,
      );
      vi.mocked(CachePatterns.invalidateAnalyticsCache).mockResolvedValue(
        undefined,
      );

      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations,
      ).mockResolvedValue({
        id: "507f1f77bcf86cd799439011",
        roles: [{ id: "role-123", name: "Test Role", registrations: [] }],
      } as unknown as Awaited<
        ReturnType<typeof ResponseBuilderService.buildEventWithRegistrations>
      >);

      vi.mocked(socketService.emitEventUpdate).mockReturnValue(undefined);

      // Mock User.findById for trio notification
      vi.mocked(User.findById).mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: "507f1f77bcf86cd799439012",
          email: "removed@example.com",
          firstName: "Removed",
          lastName: "User",
        }),
      } as any);

      vi.mocked(
        TrioNotificationService.createEventRoleRemovedTrio,
      ).mockResolvedValue(undefined as any);

      await RegistrationController.removeUserFromRole(
        req as Request,
        res as Response,
      );

      expect(socketService.emitEventUpdate).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        "user_removed",
        expect.objectContaining({
          userId: "507f1f77bcf86cd799439012",
          roleId: "role-123",
          roleName: "Test Role",
        }),
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining("User removed from"),
        }),
      );
    });

    it("should return 404 if registration not found", async () => {
      const { Registration } = await import("../../../../src/models");

      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = { userId: "507f1f77bcf86cd799439012", roleId: "role-123" };

      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        roles: [{ id: "role-123", name: "Test Role" }],
      });

      vi.mocked(Registration.findOneAndDelete).mockResolvedValue(null);

      await RegistrationController.removeUserFromRole(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Registration not found",
      });
    });

    it("should return 500 on unexpected error", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = { userId: "507f1f77bcf86cd799439012", roleId: "role-123" };

      vi.mocked(Event.findById).mockRejectedValue(new Error("Database error"));

      await RegistrationController.removeUserFromRole(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        }),
      );
    });
  });

  describe("moveUserBetweenRoles - successful move", () => {
    it("should successfully move user between roles", async () => {
      const { Registration } = await import("../../../../src/models");
      const { socketService } =
        await import("../../../../src/services/infrastructure/SocketService");
      const { ResponseBuilderService } =
        await import("../../../../src/services/ResponseBuilderService");
      const { CachePatterns } = await import("../../../../src/services");
      const { TrioNotificationService } =
        await import("../../../../src/services/notifications/TrioNotificationService");

      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = {
        userId: "507f1f77bcf86cd799439012",
        fromRoleId: "role-1",
        toRoleId: "role-2",
      };
      req.user = {
        _id: "admin-id",
        role: "Administrator",
        firstName: "Admin",
        lastName: "User",
        username: "admin",
      } as any;

      const mockEvent = {
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        date: new Date(),
        time: "10:00",
        timeZone: "America/New_York",
        location: "Test Location",
        roles: [
          { id: "role-1", name: "Source Role", maxParticipants: 10 },
          { id: "role-2", name: "Target Role", maxParticipants: 10 },
        ],
        save: vi.fn().mockResolvedValue({}),
      };
      vi.mocked(Event.findById).mockResolvedValue(mockEvent);

      // Mock existing registration
      const mockRegistration = {
        roleId: "role-1",
        eventSnapshot: {
          roleName: "Source Role",
          roleDescription: "Source description",
        },
        save: vi.fn().mockResolvedValue({}),
      };
      vi.mocked(Registration.findOne).mockResolvedValue(mockRegistration);

      // Target role has capacity
      vi.mocked(Registration.countDocuments).mockResolvedValue(5);

      vi.mocked(CachePatterns.invalidateEventCache).mockResolvedValue(
        undefined,
      );
      vi.mocked(CachePatterns.invalidateAnalyticsCache).mockResolvedValue(
        undefined,
      );

      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations,
      ).mockResolvedValue({
        id: "507f1f77bcf86cd799439011",
        roles: [],
      } as unknown as Awaited<
        ReturnType<typeof ResponseBuilderService.buildEventWithRegistrations>
      >);

      vi.mocked(socketService.emitEventUpdate).mockReturnValue(undefined);

      vi.mocked(User.findById).mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: "507f1f77bcf86cd799439012",
          email: "moved@example.com",
          firstName: "Moved",
          lastName: "User",
        }),
      } as any);

      vi.mocked(
        TrioNotificationService.createEventRoleMovedTrio,
      ).mockResolvedValue(undefined as any);

      await RegistrationController.moveUserBetweenRoles(
        req as Request,
        res as Response,
      );

      expect(mockRegistration.roleId).toBe("role-2");
      expect(mockRegistration.eventSnapshot.roleName).toBe("Target Role");

      expect(socketService.emitEventUpdate).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        "user_moved",
        expect.objectContaining({
          userId: "507f1f77bcf86cd799439012",
          fromRoleId: "role-1",
          toRoleId: "role-2",
        }),
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "User moved between roles successfully",
        }),
      );
    });

    it("should return 404 if user not in source role", async () => {
      const { Registration } = await import("../../../../src/models");

      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = {
        userId: "507f1f77bcf86cd799439012",
        fromRoleId: "role-1",
        toRoleId: "role-2",
      };

      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        roles: [
          { id: "role-1", name: "Role 1" },
          { id: "role-2", name: "Role 2", maxParticipants: 10 },
        ],
      });

      vi.mocked(Registration.findOne).mockResolvedValue(null);

      await RegistrationController.moveUserBetweenRoles(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "User not found in source role",
      });
    });

    it("should return 400 if target role is at full capacity", async () => {
      const { Registration } = await import("../../../../src/models");

      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = {
        userId: "507f1f77bcf86cd799439012",
        fromRoleId: "role-1",
        toRoleId: "role-2",
      };

      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        roles: [
          { id: "role-1", name: "Role 1" },
          { id: "role-2", name: "Role 2", maxParticipants: 5 },
        ],
      });

      vi.mocked(Registration.findOne).mockResolvedValue({
        roleId: "role-1",
        eventSnapshot: {},
      });

      // Target role is full
      vi.mocked(Registration.countDocuments).mockResolvedValue(5);

      await RegistrationController.moveUserBetweenRoles(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Target role is at full capacity (5/5)",
      });
    });

    it("should return 500 on unexpected error", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = {
        userId: "507f1f77bcf86cd799439012",
        fromRoleId: "role-1",
        toRoleId: "role-2",
      };

      vi.mocked(Event.findById).mockRejectedValue(new Error("Database error"));

      await RegistrationController.moveUserBetweenRoles(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        }),
      );
    });
  });

  describe("assignUserToRole - successful assignment", () => {
    it("should verify user is active and verified before assignment", async () => {
      const { Registration } = await import("../../../../src/models");

      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = {
        userId: "507f1f77bcf86cd799439012",
        roleId: "role-123",
      };
      req.user = {
        _id: "admin-id",
        role: "Administrator",
      } as any;

      vi.mocked(Event.findById).mockResolvedValue({
        _id: { toString: () => "507f1f77bcf86cd799439011" },
        title: "Test Event",
        status: "upcoming",
        roles: [{ id: "role-123", name: "Test Role", maxParticipants: 10 }],
        save: vi.fn().mockResolvedValue({}),
      });

      // User is not verified
      vi.mocked(User.findById).mockResolvedValue({
        _id: { toString: () => "507f1f77bcf86cd799439012" },
        username: "targetuser",
        isActive: true,
        isVerified: false,
      });

      await RegistrationController.assignUserToRole(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "User is inactive or not verified.",
      });
    });

    it("should check capacity before attempting assignment", async () => {
      const { Registration } = await import("../../../../src/models");

      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = { userId: "507f1f77bcf86cd799439012", roleId: "role-123" };
      req.user = { _id: "admin-id", role: "Administrator" } as any;

      vi.mocked(Event.findById).mockResolvedValue({
        _id: { toString: () => "507f1f77bcf86cd799439011" },
        status: "upcoming",
        roles: [{ id: "role-123", name: "Test Role", maxParticipants: 5 }],
      });

      vi.mocked(User.findById).mockResolvedValue({
        _id: { toString: () => "507f1f77bcf86cd799439012" },
        username: "targetuser",
        isActive: true,
        isVerified: true,
      });

      vi.mocked(Registration.findOne).mockResolvedValue(null);

      // Verify countDocuments is called for capacity check
      vi.mocked(Registration.countDocuments).mockResolvedValue(5);

      await RegistrationController.assignUserToRole(
        req as Request,
        res as Response,
      );

      expect(Registration.countDocuments).toHaveBeenCalledWith({
        eventId: expect.anything(),
        roleId: "role-123",
      });
    });

    it("should return success if user is already assigned (idempotent)", async () => {
      const { Registration } = await import("../../../../src/models");
      const { ResponseBuilderService } =
        await import("../../../../src/services/ResponseBuilderService");

      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = { userId: "507f1f77bcf86cd799439012", roleId: "role-123" };
      req.user = { _id: "admin-id", role: "Administrator" } as any;

      vi.mocked(Event.findById).mockResolvedValue({
        _id: { toString: () => "507f1f77bcf86cd799439011" },
        status: "upcoming",
        roles: [{ id: "role-123", name: "Test Role", maxParticipants: 10 }],
      });

      vi.mocked(User.findById).mockResolvedValue({
        _id: { toString: () => "507f1f77bcf86cd799439012" },
        username: "targetuser",
        isActive: true,
        isVerified: true,
        getDisplayName: vi.fn().mockReturnValue("Target User"),
      });

      // User already registered
      vi.mocked(Registration.findOne).mockResolvedValue({
        _id: "existing-reg",
        roleId: "role-123",
      });

      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations,
      ).mockResolvedValue({
        id: "507f1f77bcf86cd799439011",
        roles: [],
      } as unknown as Awaited<
        ReturnType<typeof ResponseBuilderService.buildEventWithRegistrations>
      >);

      await RegistrationController.assignUserToRole(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining("already assigned"),
        }),
      );
    });

    it("should return 400 if role is at full capacity", async () => {
      const { Registration } = await import("../../../../src/models");

      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = { userId: "507f1f77bcf86cd799439012", roleId: "role-123" };
      req.user = { _id: "admin-id", role: "Administrator" } as any;

      vi.mocked(Event.findById).mockResolvedValue({
        _id: { toString: () => "507f1f77bcf86cd799439011" },
        status: "upcoming",
        roles: [{ id: "role-123", name: "Test Role", maxParticipants: 5 }],
      });

      vi.mocked(User.findById).mockResolvedValue({
        _id: { toString: () => "507f1f77bcf86cd799439012" },
        username: "targetuser",
        isActive: true,
        isVerified: true,
      });

      vi.mocked(Registration.findOne).mockResolvedValue(null);

      // Role is full
      vi.mocked(Registration.countDocuments).mockResolvedValue(5);

      await RegistrationController.assignUserToRole(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "This role is at full capacity (5/5).",
      });
    });

    it("should return 500 on unexpected error", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = { userId: "507f1f77bcf86cd799439012", roleId: "role-123" };

      vi.mocked(Event.findById).mockRejectedValue(new Error("Database error"));

      await RegistrationController.assignUserToRole(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        }),
      );
    });
  });

  describe("updateWorkshopGroupTopic - successful update", () => {
    it("should successfully update group topic for Super Admin", async () => {
      const { socketService } =
        await import("../../../../src/services/infrastructure/SocketService");
      const { ResponseBuilderService } =
        await import("../../../../src/services/ResponseBuilderService");
      const { CachePatterns } = await import("../../../../src/services");

      req.params = { id: "507f1f77bcf86cd799439011", group: "A" };
      req.body = { topic: "New Topic for Group A" };
      req.user = {
        _id: "admin-id",
        role: "Super Admin",
        firstName: "Super",
        lastName: "Admin",
      } as any;

      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        type: "Effective Communication Workshop",
        roles: [],
        createdBy: "other-user-id",
      });

      vi.mocked(Event.findByIdAndUpdate).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        workshopGroupTopics: { A: "New Topic for Group A" },
      });

      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations,
      ).mockResolvedValue({
        id: "507f1f77bcf86cd799439011",
        workshopGroupTopics: { A: "New Topic for Group A" },
      } as unknown as Awaited<
        ReturnType<typeof ResponseBuilderService.buildEventWithRegistrations>
      >);

      vi.mocked(CachePatterns.invalidateEventCache).mockResolvedValue(
        undefined,
      );
      vi.mocked(socketService.emitEventUpdate).mockReturnValue(undefined);

      await RegistrationController.updateWorkshopGroupTopic(
        req as Request,
        res as Response,
      );

      expect(Event.findByIdAndUpdate).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        { $set: { "workshopGroupTopics.A": "New Topic for Group A" } },
        { new: true, runValidators: true, context: "query" },
      );

      expect(socketService.emitEventUpdate).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        "workshop_topic_updated",
        expect.objectContaining({
          group: "A",
          topic: "New Topic for Group A",
        }),
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Group topic updated",
        }),
      );
    });

    it("should allow event creator to update group topic", async () => {
      const { ResponseBuilderService } =
        await import("../../../../src/services/ResponseBuilderService");
      const { CachePatterns } = await import("../../../../src/services");
      const { socketService } =
        await import("../../../../src/services/infrastructure/SocketService");

      req.params = { id: "507f1f77bcf86cd799439011", group: "B" };
      req.body = { topic: "Creator's Topic" };
      req.user = {
        _id: "creator-id",
        role: "Participant" as const,
      } as any;

      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        type: "Effective Communication Workshop",
        roles: [],
        createdBy: { toString: () => "creator-id" },
      });

      vi.mocked(Event.findByIdAndUpdate).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        workshopGroupTopics: { B: "Creator's Topic" },
      });

      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations,
      ).mockResolvedValue({
        id: "507f1f77bcf86cd799439011",
      } as unknown as Awaited<
        ReturnType<typeof ResponseBuilderService.buildEventWithRegistrations>
      >);

      vi.mocked(CachePatterns.invalidateEventCache).mockResolvedValue(
        undefined,
      );
      vi.mocked(socketService.emitEventUpdate).mockReturnValue(undefined);

      await RegistrationController.updateWorkshopGroupTopic(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should return 403 if user is not authorized", async () => {
      const { Registration } = await import("../../../../src/models");

      req.params = { id: "507f1f77bcf86cd799439011", group: "C" };
      req.body = { topic: "Unauthorized Topic" };
      req.user = {
        _id: "random-user-id",
        role: "Participant" as const,
      } as any;

      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        type: "Effective Communication Workshop",
        roles: [{ id: "role-leader-c", name: "Group C Leader" }],
        createdBy: { toString: () => "other-creator-id" },
        organizerDetails: [],
      });

      // User is not a group leader
      vi.mocked(Registration.countDocuments).mockResolvedValue(0);

      await RegistrationController.updateWorkshopGroupTopic(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "You do not have permission to edit this group topic.",
      });
    });

    it("should allow group leader to update their group topic", async () => {
      const { Registration } = await import("../../../../src/models");
      const { ResponseBuilderService } =
        await import("../../../../src/services/ResponseBuilderService");
      const { CachePatterns } = await import("../../../../src/services");
      const { socketService } =
        await import("../../../../src/services/infrastructure/SocketService");

      req.params = { id: "507f1f77bcf86cd799439011", group: "D" };
      req.body = { topic: "Leader's Topic" };
      req.user = {
        _id: "leader-id",
        role: "Participant" as const,
      } as any;

      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        type: "Effective Communication Workshop",
        roles: [{ id: "role-leader-d", name: "Group D Leader" }],
        createdBy: { toString: () => "other-creator-id" },
        organizerDetails: [],
      });

      // User is the group D leader
      vi.mocked(Registration.countDocuments).mockResolvedValue(1);

      vi.mocked(Event.findByIdAndUpdate).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        workshopGroupTopics: { D: "Leader's Topic" },
      });

      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations,
      ).mockResolvedValue({
        id: "507f1f77bcf86cd799439011",
      } as unknown as Awaited<
        ReturnType<typeof ResponseBuilderService.buildEventWithRegistrations>
      >);

      vi.mocked(CachePatterns.invalidateEventCache).mockResolvedValue(
        undefined,
      );
      vi.mocked(socketService.emitEventUpdate).mockReturnValue(undefined);

      await RegistrationController.updateWorkshopGroupTopic(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Group topic updated",
        }),
      );
    });

    it("should return 500 on unexpected error", async () => {
      req.params = { id: "507f1f77bcf86cd799439011", group: "E" };
      req.body = { topic: "Test" };
      req.user = { _id: "admin-id", role: "Super Admin" } as any;

      vi.mocked(Event.findById).mockRejectedValue(new Error("Database error"));

      await RegistrationController.updateWorkshopGroupTopic(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to update group topic.",
      });
    });

    it("should return 400 on validation error", async () => {
      req.params = { id: "507f1f77bcf86cd799439011", group: "F" };
      req.body = { topic: "" };
      req.user = { _id: "admin-id", role: "Super Admin" } as any;

      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        type: "Effective Communication Workshop",
        roles: [],
      });

      const validationError = new Error("Validation failed");
      (validationError as unknown as { name: string }).name = "ValidationError";
      (
        validationError as unknown as {
          errors: Record<string, { message: string }>;
        }
      ).errors = {
        topic: { message: "Topic is required" },
      };

      vi.mocked(Event.findByIdAndUpdate).mockRejectedValue(validationError);

      await RegistrationController.updateWorkshopGroupTopic(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Invalid topic",
        }),
      );
    });
  });

  describe("moveUserBetweenRoles - race condition handling", () => {
    it("should handle write conflict during move", async () => {
      const { Registration } = await import("../../../../src/models");

      req.params = { id: "507f1f77bcf86cd799439011" };
      req.body = {
        userId: "507f1f77bcf86cd799439012",
        fromRoleId: "role-1",
        toRoleId: "role-2",
      };

      vi.mocked(Event.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        roles: [
          { id: "role-1", name: "Role 1" },
          { id: "role-2", name: "Role 2", maxParticipants: 10 },
        ],
        save: vi.fn(),
      });

      const mockRegistration = {
        roleId: "role-1",
        eventSnapshot: {},
        save: vi.fn().mockRejectedValue(new Error("Write conflict detected")),
      };
      vi.mocked(Registration.findOne).mockResolvedValue(mockRegistration);

      // Pre-check shows capacity available
      vi.mocked(Registration.countDocuments)
        .mockResolvedValueOnce(5) // pre-check
        .mockResolvedValueOnce(10); // post-error check shows full

      await RegistrationController.moveUserBetweenRoles(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("became full while processing"),
        }),
      );
    });
  });
});
