import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Request, Response } from "express";
import { UserController } from "../../../src/controllers/userController";

// Mock dependencies
vi.mock("../../../src/models", () => ({
  User: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    getUserStats: vi.fn(),
  },
}));

vi.mock("../../../src/utils/roleUtils", () => ({
  RoleUtils: {
    isPromotion: vi.fn(),
  },
  ROLES: {
    PARTICIPANT: "Participant",
    LEADER: "Leader",
    ADMINISTRATOR: "Administrator",
    SUPER_ADMIN: "Super Admin",
  },
  hasPermission: vi.fn(),
  PERMISSIONS: {
    VIEW_SYSTEM_ANALYTICS: "VIEW_SYSTEM_ANALYTICS",
    MANAGE_USERS: "MANAGE_USERS",
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

vi.mock("../../../src/middleware/upload", () => ({
  getFileUrl: vi.fn(),
}));

vi.mock("../../../src/utils/avatarCleanup", () => ({
  cleanupOldAvatar: vi.fn(),
}));

vi.mock("../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    notifyAdmins: vi.fn(),
    sendToUser: vi.fn(),
  },
}));

vi.mock(
  "../../../src/services/infrastructure/autoEmailNotificationService",
  () => ({
    AutoEmailNotificationService: {
      sendRoleChangeNotification: vi.fn(),
    },
  })
);

vi.mock("../../../src/controllers/unifiedMessageController", () => ({
  UnifiedMessageController: {
    createTargetedSystemMessage: vi.fn(),
  },
}));

vi.mock("../../../src/services/UserDeletionService", () => ({
  UserDeletionService: {
    deleteUserCompletely: vi.fn(),
    getUserDeletionImpact: vi.fn(),
  },
}));

// Import mocked modules for direct access
import { User } from "../../../src/models";
import { hasPermission, ROLES } from "../../../src/utils/roleUtils";

describe("UserController", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Setup response mocks
    statusMock = vi.fn().mockReturnThis();
    jsonMock = vi.fn().mockReturnThis();

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    } as any;

    // Default request setup
    mockRequest = {
      user: {
        _id: "user123",
        id: "user123",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        role: ROLES.PARTICIPANT,
      } as any,
      params: {},
      body: {},
      query: {},
      file: undefined,
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("getProfile", () => {
    it("should return user profile successfully", async () => {
      await UserController.getProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          user: expect.objectContaining({
            id: "user123",
            email: "test@example.com",
            firstName: "Test",
            lastName: "User",
          }),
        }),
      });
    });

    it("should return 401 if user not authenticated", async () => {
      mockRequest.user = undefined;

      await UserController.getProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });
  });

  describe("getAllUsers", () => {
    it("should return paginated users successfully", async () => {
      mockRequest.query = { page: "1", limit: "10" };
      mockRequest.user!.role = ROLES.ADMINISTRATOR;
      (hasPermission as any).mockReturnValue(true);

      const mockUsers = [
        {
          _id: "user1",
          email: "user1@example.com",
          firstName: "User",
          lastName: "One",
        },
        {
          _id: "user2",
          email: "user2@example.com",
          firstName: "User",
          lastName: "Two",
        },
      ];

      const mockFind = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue(mockUsers),
      };

      (User.find as any).mockReturnValue(mockFind);
      (User.countDocuments as any).mockResolvedValue(20);

      await UserController.getAllUsers(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(User.find).toHaveBeenCalled();
      expect(User.countDocuments).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should return 403 if insufficient permissions", async () => {
      (hasPermission as any).mockReturnValue(false);

      await UserController.getAllUsers(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Insufficient permissions to view all users.",
      });
    });
  });

  // Method existence tests
  describe("Method Existence Tests", () => {
    it("should have getProfile method", () => {
      expect(typeof UserController.getProfile).toBe("function");
    });

    it("should have updateProfile method", () => {
      expect(typeof UserController.updateProfile).toBe("function");
    });

    it("should have getUserById method", () => {
      expect(typeof UserController.getUserById).toBe("function");
    });

    it("should have getAllUsers method", () => {
      expect(typeof UserController.getAllUsers).toBe("function");
    });

    it("should have updateUserRole method", () => {
      expect(typeof UserController.updateUserRole).toBe("function");
    });

    it("should have deactivateUser method", () => {
      expect(typeof UserController.deactivateUser).toBe("function");
    });

    it("should have reactivateUser method", () => {
      expect(typeof UserController.reactivateUser).toBe("function");
    });

    it("should have getUserStats method", () => {
      expect(typeof UserController.getUserStats).toBe("function");
    });

    it("should have uploadAvatar method", () => {
      expect(typeof UserController.uploadAvatar).toBe("function");
    });

    it("should have deleteUser method", () => {
      expect(typeof UserController.deleteUser).toBe("function");
    });

    it("should have getUserDeletionImpact method", () => {
      expect(typeof UserController.getUserDeletionImpact).toBe("function");
    });
  });
});
