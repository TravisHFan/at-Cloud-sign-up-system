import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import { RegistrationController } from "../../../../src/controllers/event/RegistrationController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  Event: {
    findById: vi.fn(),
  },
  Registration: {
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    deleteOne: vi.fn(),
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
        role: "member",
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
});
