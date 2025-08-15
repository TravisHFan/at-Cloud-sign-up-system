import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Request, Response } from "express";
import { UserController } from "../../../src/controllers/userController";
import bcrypt from "bcryptjs";

// Mock dependencies
vi.mock("../../../src/models", () => ({
  User: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
  },
}));

vi.mock("../../../src/utils/roleUtils", () => ({
  RoleUtils: {
    isPromotion: vi.fn(),
    isDemotion: vi.fn(),
    canAccessUserProfile: vi.fn(),
    isValidRole: vi.fn(),
    canPromoteUser: vi.fn(),
    isSuperAdmin: vi.fn(),
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
    EDIT_USER_ROLES: "EDIT_USER_ROLES",
    DEACTIVATE_USERS: "DEACTIVATE_USERS",
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
  hash: vi.fn(),
  compare: vi.fn(),
}));

// Mock upload helper used by controller
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
      sendAtCloudRoleChangeNotification: vi.fn(),
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

vi.mock("../../../src/services", () => ({
  CachePatterns: {
    invalidateUserCache: vi.fn(),
    getUserListing: vi.fn(),
  },
}));

// Import mocked modules for direct access
import { User } from "../../../src/models";
import { hasPermission, ROLES, RoleUtils } from "../../../src/utils/roleUtils";
import { AutoEmailNotificationService } from "../../../src/services/infrastructure/autoEmailNotificationService";
import { UnifiedMessageController } from "../../../src/controllers/unifiedMessageController";
import { UserDeletionService } from "../../../src/services/UserDeletionService";
import { CachePatterns } from "../../../src/services";
import { getFileUrl } from "../../../src/middleware/upload";
import { cleanupOldAvatar } from "../../../src/utils/avatarCleanup";

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

    // Setup console mocks to avoid test output clutter
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    // Default request setup
    mockRequest = {
      user: {
        _id: "507f1f77bcf86cd799439011",
        id: "507f1f77bcf86cd799439011",
        email: "test@example.com",
        username: "testuser",
        firstName: "Test",
        lastName: "User",
        role: ROLES.PARTICIPANT,
        gender: "male",
        avatar: "/default-avatar-male.jpg",
        isAtCloudLeader: false,
        roleInAtCloud: "",
        lastLogin: new Date(),
        createdAt: new Date(),
        isVerified: true,
        isActive: true,
      } as any,
      params: {},
      body: {},
      query: {},
      file: undefined,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
        data: {
          user: expect.objectContaining({
            id: "507f1f77bcf86cd799439011",
            email: "test@example.com",
            firstName: "Test",
            lastName: "User",
            username: "testuser",
            role: ROLES.PARTICIPANT,
          }),
        },
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

    it("should handle server errors gracefully", async () => {
      // Force an error by making req.user throw
      Object.defineProperty(mockRequest, "user", {
        get: () => {
          throw new Error("Test error");
        },
      });

      await UserController.getProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error.",
      });
    });
  });

  describe("updateProfile", () => {
    beforeEach(() => {
      vi.mocked(User.findById).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        save: vi.fn(),
        avatar: "/old-avatar.jpg",
      } as any);

      vi.mocked(User.findByIdAndUpdate).mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        username: "testuser",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        gender: "male",
        avatar: "/default-avatar-male.jpg",
        role: ROLES.PARTICIPANT,
        isAtCloudLeader: false,
        roleInAtCloud: "",
      } as any);

      vi.mocked(CachePatterns.invalidateUserCache).mockResolvedValue(undefined);
    });

    it("should require authentication", async () => {
      mockRequest.user = undefined;

      await UserController.updateProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should require roleInAtCloud when isAtCloudLeader is true", async () => {
      mockRequest.body = {
        isAtCloudLeader: true,
        // Missing roleInAtCloud
      };

      await UserController.updateProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Role in @Cloud is required for @Cloud co-workers.",
      });
    });

    it("should clear roleInAtCloud when isAtCloudLeader is false", async () => {
      mockRequest.body = {
        isAtCloudLeader: false,
        roleInAtCloud: "Leader", // Should be cleared
      };

      await UserController.updateProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        {
          $set: expect.objectContaining({
            isAtCloudLeader: false,
            roleInAtCloud: undefined,
          }),
        },
        { new: true, runValidators: true }
      );
    });

    it("should update avatar when gender changes", async () => {
      mockRequest.body = { gender: "female" };

      const mockUser = {
        _id: "507f1f77bcf86cd799439011",
        avatar: "/old-avatar.jpg",
        save: vi.fn(),
      };

      vi.mocked(User.findById).mockResolvedValue(mockUser as any);

      await UserController.updateProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockUser.avatar).toBe("/default-avatar-female.jpg");
      expect(mockUser.save).toHaveBeenCalled();
      expect(cleanupOldAvatar).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        "/old-avatar.jpg"
      );
    });

    it("should send @Cloud role assignment notification", async () => {
      mockRequest.user!.isAtCloudLeader = false;
      mockRequest.body = {
        isAtCloudLeader: true,
        roleInAtCloud: "Leader",
      };

      const updatedUser = {
        _id: "507f1f77bcf86cd799439011",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        isAtCloudLeader: true,
        roleInAtCloud: "Leader",
      };

      vi.mocked(User.findByIdAndUpdate).mockResolvedValue(updatedUser as any);

      await UserController.updateProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(
        AutoEmailNotificationService.sendAtCloudRoleChangeNotification
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          userData: {
            _id: "507f1f77bcf86cd799439011",
            firstName: "Test",
            lastName: "User",
            email: "test@example.com",
            roleInAtCloud: "Leader",
          },
          changeType: "assigned",
          systemUser: expect.objectContaining({
            _id: "507f1f77bcf86cd799439011",
            firstName: "Test",
            lastName: "User",
            email: "test@example.com",
          }),
        })
      );
    });

    it("should send @Cloud role removal notification", async () => {
      mockRequest.user!.isAtCloudLeader = true;
      mockRequest.user!.roleInAtCloud = "Leader";
      mockRequest.body = {
        isAtCloudLeader: false,
      };

      const updatedUser = {
        _id: "507f1f77bcf86cd799439011",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        isAtCloudLeader: false,
        roleInAtCloud: undefined,
      };

      vi.mocked(User.findByIdAndUpdate).mockResolvedValue(updatedUser as any);

      await UserController.updateProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(
        AutoEmailNotificationService.sendAtCloudRoleChangeNotification
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          userData: {
            _id: "507f1f77bcf86cd799439011",
            firstName: "Test",
            lastName: "User",
            email: "test@example.com",
            previousRoleInAtCloud: "Leader",
          },
          changeType: "removed",
          systemUser: expect.objectContaining({
            _id: "507f1f77bcf86cd799439011",
            firstName: "Test",
            lastName: "User",
            email: "test@example.com",
          }),
        })
      );
    });

    it("should not send notifications for @Cloud role changes within leadership", async () => {
      mockRequest.user!.isAtCloudLeader = true;
      mockRequest.user!.roleInAtCloud = "Leader";
      mockRequest.body = {
        isAtCloudLeader: true,
        roleInAtCloud: "Co-Leader",
      };

      const updatedUser = {
        _id: "507f1f77bcf86cd799439011",
        isAtCloudLeader: true,
        roleInAtCloud: "Co-Leader",
      };

      vi.mocked(User.findByIdAndUpdate).mockResolvedValue(updatedUser as any);

      await UserController.updateProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(
        AutoEmailNotificationService.sendAtCloudRoleChangeNotification
      ).not.toHaveBeenCalled();
    });

    it("should handle user not found", async () => {
      vi.mocked(User.findByIdAndUpdate).mockResolvedValue(null);

      await UserController.updateProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "User not found.",
      });
    });

    it("should handle validation errors", async () => {
      const validationError = {
        name: "ValidationError",
        errors: {
          email: { message: "Invalid email format" },
          username: { message: "Username already exists" },
        },
      };

      vi.mocked(User.findByIdAndUpdate).mockRejectedValue(validationError);

      await UserController.updateProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Validation failed.",
        errors: ["Invalid email format", "Username already exists"],
      });
    });

    it("should handle notification errors gracefully", async () => {
      mockRequest.body = {
        isAtCloudLeader: true,
        roleInAtCloud: "Leader",
      };

      const updatedUser = {
        _id: "507f1f77bcf86cd799439011",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        role: undefined,
        gender: undefined,
        avatar: undefined,
        isAtCloudLeader: true,
        roleInAtCloud: "Leader",
      };

      vi.mocked(User.findByIdAndUpdate).mockResolvedValue(updatedUser as any);
      vi.mocked(
        AutoEmailNotificationService.sendAtCloudRoleChangeNotification
      ).mockRejectedValue(new Error("Notification failed"));

      await UserController.updateProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      // Should still succeed despite notification failure
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Profile updated successfully!",
        })
      );
    });

    it("should handle unexpected errors", async () => {
      vi.mocked(User.findByIdAndUpdate).mockRejectedValue(
        new Error("Database error")
      );

      await UserController.updateProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to update profile.",
      });
    });
  });

  describe("getUserById", () => {
    beforeEach(() => {
      mockRequest.params = { id: "507f1f77bcf86cd799439012" };
      vi.mocked(RoleUtils.canAccessUserProfile).mockReturnValue(true);
    });

    it("should require authentication", async () => {
      mockRequest.user = undefined;

      await UserController.getUserById(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should return user successfully with proper permissions", async () => {
      const targetUser = {
        _id: "507f1f77bcf86cd799439012",
        username: "targetuser",
        email: "target@example.com",
        firstName: "Target",
        lastName: "User",
        role: ROLES.PARTICIPANT,
      };

      vi.mocked(User.findById).mockResolvedValue(targetUser as any);

      await UserController.getUserById(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(RoleUtils.canAccessUserProfile).toHaveBeenCalledTimes(2); // Initial and final check
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          user: expect.objectContaining({
            id: "507f1f77bcf86cd799439012",
            email: "target@example.com",
            firstName: "Target",
            lastName: "User",
          }),
        },
      });
    });

    it("should return 404 if user not found", async () => {
      vi.mocked(User.findById).mockResolvedValue(null);

      await UserController.getUserById(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "User not found.",
      });
    });

    it("should return 403 if insufficient permissions", async () => {
      const targetUser = {
        _id: "507f1f77bcf86cd799439012",
        role: ROLES.ADMINISTRATOR,
      };

      vi.mocked(User.findById).mockResolvedValue(targetUser as any);
      vi.mocked(RoleUtils.canAccessUserProfile)
        .mockReturnValueOnce(true) // Initial check
        .mockReturnValueOnce(false); // Final check

      await UserController.getUserById(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Insufficient permissions to access this profile.",
      });
    });

    it("should handle database errors", async () => {
      vi.mocked(User.findById).mockRejectedValue(new Error("Database error"));

      await UserController.getUserById(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to retrieve user.",
      });
    });
  });

  describe("getAllUsers", () => {
    beforeEach(() => {
      vi.mocked(hasPermission).mockReturnValue(true);
      mockRequest.user!.role = ROLES.ADMINISTRATOR;
    });

    it("should require authentication", async () => {
      mockRequest.user = undefined;

      await UserController.getAllUsers(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Authentication required. Invalid or missing token.",
      });
    });

    it("should return paginated users successfully", async () => {
      mockRequest.query = { page: "1", limit: "10" };

      const mockUsers = [
        {
          _id: "507f1f77bcf86cd799439012",
          email: "user1@example.com",
          firstName: "User",
          lastName: "One",
          role: ROLES.PARTICIPANT,
          isActive: true,
          createdAt: new Date(),
        },
        {
          _id: "507f1f77bcf86cd799439013",
          email: "user2@example.com",
          firstName: "User",
          lastName: "Two",
          role: ROLES.LEADER,
          isActive: true,
          createdAt: new Date(),
        },
      ];

      const mockFind = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue(mockUsers),
      };

      vi.mocked(User.find).mockReturnValue(mockFind as any);
      vi.mocked(User.countDocuments).mockResolvedValue(2);

      // Mock CachePatterns.getUserListing to simulate cache miss and execute callback
      vi.mocked(CachePatterns.getUserListing).mockImplementation(
        async (key, fetchFunction) => {
          return await fetchFunction();
        }
      );

      await UserController.getAllUsers(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          users: mockUsers,
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalUsers: 2,
            hasNext: false,
            hasPrev: false,
          },
        },
      });
    });

    it("should handle filtering by role", async () => {
      mockRequest.query = { role: ROLES.ADMINISTRATOR };

      const mockFind = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(User.find).mockReturnValue(mockFind as any);
      vi.mocked(User.countDocuments).mockResolvedValue(0);
      vi.mocked(CachePatterns.getUserListing).mockImplementation(
        async (key, fetchFunction) => {
          return await fetchFunction();
        }
      );

      await UserController.getAllUsers(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(User.find).toHaveBeenCalledWith(
        expect.objectContaining({ role: ROLES.ADMINISTRATOR })
      );
    });

    it("should handle filtering by status", async () => {
      mockRequest.query = { isActive: "false" };

      const mockFind = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(User.find).mockReturnValue(mockFind as any);
      vi.mocked(User.countDocuments).mockResolvedValue(0);
      vi.mocked(CachePatterns.getUserListing).mockImplementation(
        async (key, fetchFunction) => {
          return await fetchFunction();
        }
      );

      await UserController.getAllUsers(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(User.find).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false })
      );
    });

    it("should handle search queries", async () => {
      mockRequest.query = { search: "john" };

      const mockFind = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(User.find).mockReturnValue(mockFind as any);
      vi.mocked(User.countDocuments).mockResolvedValue(0);
      vi.mocked(CachePatterns.getUserListing).mockImplementation(
        async (key, fetchFunction) => {
          return await fetchFunction();
        }
      );

      await UserController.getAllUsers(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(User.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $text: { $search: "john" },
        })
      );
    });

    it("should return 403 if insufficient permissions", async () => {
      vi.mocked(hasPermission).mockReturnValue(false);

      await UserController.getAllUsers(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Insufficient permissions to view user profiles.",
      });
    });

    it("should use cached data when available", async () => {
      const cachedData = { users: [], pagination: {} };
      vi.mocked(CachePatterns.getUserListing).mockResolvedValue(cachedData);

      await UserController.getAllUsers(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: cachedData,
      });
      expect(User.find).not.toHaveBeenCalled();
    });

    it("should handle database errors", async () => {
      vi.mocked(CachePatterns.getUserListing).mockImplementation(
        async (key, fetchFunction) => {
          await fetchFunction(); // This will throw because User.find will throw
        }
      );
      vi.mocked(User.find).mockImplementation(() => {
        throw new Error("Database error");
      });

      await UserController.getAllUsers(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to retrieve users.",
      });
    });
  });

  describe("updateUserRole", () => {
    beforeEach(() => {
      mockRequest.params = { id: "507f1f77bcf86cd799439012" };
      mockRequest.body = { role: ROLES.LEADER };
      mockRequest.user!.role = ROLES.ADMINISTRATOR;

      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(RoleUtils.isValidRole).mockReturnValue(true);
      vi.mocked(RoleUtils.canPromoteUser).mockReturnValue(true);
      vi.mocked(RoleUtils.isPromotion).mockReturnValue(true);
      vi.mocked(RoleUtils.isDemotion).mockReturnValue(false);
    });

    it("should require authentication", async () => {
      mockRequest.user = undefined;

      await UserController.updateUserRole(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should require valid role", async () => {
      vi.mocked(RoleUtils.isValidRole).mockReturnValue(false);

      await UserController.updateUserRole(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Valid role is required.",
      });
    });

    it("should require permission to edit roles", async () => {
      vi.mocked(hasPermission).mockReturnValue(false);

      await UserController.updateUserRole(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Insufficient permissions to edit user roles.",
      });
    });

    it("should validate user can promote to target role", async () => {
      vi.mocked(RoleUtils.canPromoteUser).mockReturnValue(false);

      const targetUser = {
        _id: "507f1f77bcf86cd799439012",
        role: ROLES.PARTICIPANT,
      };

      vi.mocked(User.findById).mockResolvedValue(targetUser as any);

      await UserController.updateUserRole(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "You cannot promote this user to the specified role.",
      });
    });

    it("should successfully update user role with promotion", async () => {
      const targetUser = {
        _id: "507f1f77bcf86cd799439012",
        firstName: "Target",
        lastName: "User",
        email: "target@example.com",
        role: ROLES.PARTICIPANT,
        save: vi.fn(),
      };

      vi.mocked(User.findById)
        .mockResolvedValueOnce(targetUser as any) // First call for target user
        .mockResolvedValueOnce(mockRequest.user as any); // Second call for changed by user

      await UserController.updateUserRole(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(targetUser.role).toBe(ROLES.LEADER);
      expect(targetUser.save).toHaveBeenCalled();
      expect(
        AutoEmailNotificationService.sendRoleChangeNotification
      ).toHaveBeenCalledWith({
        userData: {
          _id: "507f1f77bcf86cd799439012",
          firstName: "Target",
          lastName: "User",
          email: "target@example.com",
          oldRole: ROLES.PARTICIPANT,
          newRole: ROLES.LEADER,
        },
        changedBy: expect.objectContaining({
          _id: expect.any(String),
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
        }),
        reason: expect.stringContaining("Role changed by"),
        isPromotion: true,
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message:
          "User role updated to Leader successfully! Notifications sent.",
        data: expect.objectContaining({
          user: expect.objectContaining({
            role: ROLES.LEADER,
          }),
        }),
      });
    });

    it("should successfully update user role with demotion", async () => {
      mockRequest.body = { role: ROLES.PARTICIPANT };

      vi.mocked(RoleUtils.isPromotion).mockReturnValue(false);
      vi.mocked(RoleUtils.isDemotion).mockReturnValue(true);

      const targetUser = {
        _id: "507f1f77bcf86cd799439012",
        firstName: "Target",
        lastName: "User",
        email: "target@example.com",
        role: ROLES.LEADER,
        save: vi.fn(),
      };

      vi.mocked(User.findById)
        .mockResolvedValueOnce(targetUser as any) // First call for target user
        .mockResolvedValueOnce(mockRequest.user as any); // Second call for changed by user

      await UserController.updateUserRole(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(targetUser.role).toBe(ROLES.PARTICIPANT);
      expect(targetUser.save).toHaveBeenCalled();
      expect(
        AutoEmailNotificationService.sendRoleChangeNotification
      ).toHaveBeenCalledWith({
        userData: {
          _id: "507f1f77bcf86cd799439012",
          firstName: "Target",
          lastName: "User",
          email: "target@example.com",
          oldRole: ROLES.LEADER,
          newRole: ROLES.PARTICIPANT,
        },
        changedBy: expect.objectContaining({
          _id: expect.any(String),
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
        }),
        reason: expect.stringContaining("Role changed by"),
        isPromotion: false,
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message:
          "User role updated to Participant successfully! Notifications sent.",
        data: expect.objectContaining({
          user: expect.objectContaining({
            role: ROLES.PARTICIPANT,
          }),
        }),
      });
    });

    it("should handle user not found", async () => {
      vi.mocked(User.findById).mockResolvedValue(null);

      await UserController.updateUserRole(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "User not found.",
      });
    });

    it("should allow self-role changes if user has permissions", async () => {
      // Set the target user ID to be the same as the requesting user
      mockRequest.params!.id = mockRequest.user!._id as string;

      const targetUser = {
        _id: mockRequest.user!._id,
        firstName: "Self",
        lastName: "User",
        email: "self@example.com",
        role: ROLES.LEADER,
        save: vi.fn(),
      };

      vi.mocked(User.findById)
        .mockResolvedValueOnce(targetUser as any) // First call for target user
        .mockResolvedValueOnce(mockRequest.user as any); // Second call for changed by user

      await UserController.updateUserRole(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(targetUser.role).toBe(ROLES.LEADER);
      expect(targetUser.save).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle notification errors gracefully", async () => {
      const targetUser = {
        _id: "507f1f77bcf86cd799439012",
        role: ROLES.PARTICIPANT,
        save: vi.fn(),
      };

      vi.mocked(User.findById)
        .mockResolvedValueOnce(targetUser as any) // First call for target user
        .mockResolvedValueOnce(mockRequest.user as any); // Second call for changed by user
      vi.mocked(
        AutoEmailNotificationService.sendRoleChangeNotification
      ).mockRejectedValue(new Error("Notification failed"));

      await UserController.updateUserRole(
        mockRequest as Request,
        mockResponse as Response
      );

      // Should still succeed despite notification failure
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message:
            "User role updated to Leader successfully! Notifications sent.",
        })
      );
    });

    it("should handle unexpected errors", async () => {
      vi.mocked(User.findById).mockRejectedValue(new Error("Database error"));

      await UserController.updateUserRole(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to update user role.",
      });
    });
  });

  describe("deactivateUser", () => {
    beforeEach(() => {
      mockRequest.params = { id: "507f1f77bcf86cd799439012" };
      mockRequest.user!.role = ROLES.ADMINISTRATOR;
      vi.mocked(hasPermission).mockReturnValue(true);
    });

    it("should require authentication", async () => {
      mockRequest.user = undefined;

      await UserController.deactivateUser(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should require proper permissions", async () => {
      vi.mocked(hasPermission).mockReturnValue(false);

      await UserController.deactivateUser(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Insufficient permissions to deactivate users.",
      });
    });

    it("should successfully deactivate user", async () => {
      const targetUser = {
        _id: "507f1f77bcf86cd799439012",
        firstName: "Target",
        lastName: "User",
        email: "target@example.com",
        isActive: true,
        save: vi.fn(),
      };

      vi.mocked(User.findById).mockResolvedValue(targetUser as any);

      await UserController.deactivateUser(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(targetUser.isActive).toBe(false);
      expect(targetUser.save).toHaveBeenCalled();
      expect(CachePatterns.invalidateUserCache).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439012"
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "User deactivated successfully!",
      });
    });

    it("should handle user not found", async () => {
      vi.mocked(User.findById).mockResolvedValue(null);

      await UserController.deactivateUser(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "User not found.",
      });
    });

    it("should handle user already inactive", async () => {
      const targetUser = {
        _id: "507f1f77bcf86cd799439012",
        isActive: false,
        save: vi.fn(),
      };

      vi.mocked(User.findById).mockResolvedValue(targetUser as any);

      await UserController.deactivateUser(
        mockRequest as Request,
        mockResponse as Response
      );

      // Should still succeed - production code doesn't check if already inactive
      expect(targetUser.isActive).toBe(false);
      expect(targetUser.save).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "User deactivated successfully!",
      });
    });

    it("should prevent self-deactivation", async () => {
      mockRequest.params!.id = mockRequest.user!._id as string;

      // Mock User.findById to return the same user (self-deactivation scenario)
      const targetUser = {
        _id: mockRequest.user!._id,
        isActive: true,
      };

      vi.mocked(User.findById).mockResolvedValue(targetUser as any);

      await UserController.deactivateUser(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "You cannot deactivate your own account.",
      });
    });

    it("should handle unexpected errors", async () => {
      vi.mocked(User.findById).mockRejectedValue(new Error("Database error"));

      await UserController.deactivateUser(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to deactivate user.",
      });
    });
  });

  describe("reactivateUser", () => {
    beforeEach(() => {
      mockRequest.params = { id: "507f1f77bcf86cd799439012" };
      mockRequest.user!.role = ROLES.ADMINISTRATOR;
      vi.mocked(hasPermission).mockReturnValue(true);
    });

    it("should require authentication", async () => {
      mockRequest.user = undefined;

      await UserController.reactivateUser(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should require proper permissions", async () => {
      vi.mocked(hasPermission).mockReturnValue(false);

      await UserController.reactivateUser(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Insufficient permissions to reactivate users.",
      });
    });

    it("should successfully reactivate user", async () => {
      const targetUser = {
        _id: "507f1f77bcf86cd799439012",
        firstName: "Target",
        lastName: "User",
        email: "target@example.com",
        isActive: false,
        save: vi.fn(),
      };

      vi.mocked(User.findById).mockResolvedValue(targetUser as any);

      await UserController.reactivateUser(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(targetUser.isActive).toBe(true);
      expect(targetUser.save).toHaveBeenCalled();
      expect(CachePatterns.invalidateUserCache).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439012"
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "User reactivated successfully!",
      });
    });

    it("should handle user not found", async () => {
      vi.mocked(User.findById).mockResolvedValue(null);

      await UserController.reactivateUser(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "User not found.",
      });
    });

    it("should handle user already active", async () => {
      const targetUser = {
        _id: "507f1f77bcf86cd799439012",
        isActive: true,
        save: vi.fn(),
      };

      vi.mocked(User.findById).mockResolvedValue(targetUser as any);

      await UserController.reactivateUser(
        mockRequest as Request,
        mockResponse as Response
      );

      // Should still succeed - production code doesn't check if already active
      expect(targetUser.isActive).toBe(true);
      expect(targetUser.save).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "User reactivated successfully!",
      });
    });

    it("should handle unexpected errors", async () => {
      vi.mocked(User.findById).mockRejectedValue(new Error("Database error"));

      await UserController.reactivateUser(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to reactivate user.",
      });
    });
  });

  describe("getUserStats", () => {
    beforeEach(() => {
      mockRequest.user!.role = ROLES.ADMINISTRATOR;
      vi.mocked(hasPermission).mockReturnValue(true);
    });

    it("should require authentication", async () => {
      mockRequest.user = undefined;

      await UserController.getUserStats(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should require proper permissions", async () => {
      vi.mocked(hasPermission).mockReturnValue(false);

      await UserController.getUserStats(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Insufficient permissions to view user statistics.",
      });
    });

    it("should return user statistics successfully", async () => {
      const mockStats = {
        totalUsers: 100,
        activeUsers: 85,
        inactiveUsers: 15,
        roleDistribution: {
          [ROLES.PARTICIPANT]: 60,
          [ROLES.LEADER]: 25,
          [ROLES.ADMINISTRATOR]: 10,
          [ROLES.SUPER_ADMIN]: 5,
        },
        recentRegistrations: 12,
        atCloudLeaders: 8,
      };

      // Mock User.getUserStats static method
      vi.mocked(User as any).getUserStats = vi
        .fn()
        .mockResolvedValue(mockStats);

      await UserController.getUserStats(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: { stats: mockStats },
      });
    });

    it("should handle database errors", async () => {
      vi.mocked(User as any).getUserStats = vi
        .fn()
        .mockRejectedValue(new Error("Database error"));

      await UserController.getUserStats(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to retrieve user statistics.",
      });
    });
  });

  describe("uploadAvatar", () => {
    beforeEach(() => {
      mockRequest.file = {
        filename: "avatar.jpg",
        path: "/uploads/avatars/avatar.jpg",
      } as any;

      vi.mocked(getFileUrl).mockReturnValue("/api/uploads/avatars/avatar.jpg");
    });

    it("should require authentication", async () => {
      mockRequest.user = undefined;

      await UserController.uploadAvatar(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should require file upload", async () => {
      mockRequest.file = undefined;

      await UserController.uploadAvatar(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "No file uploaded.",
      });
    });

    it("should successfully upload avatar", async () => {
      const mockUser = {
        _id: "507f1f77bcf86cd799439011",
        avatar: "/old-avatar.jpg",
        save: vi.fn(),
      };

      const updatedUser = {
        _id: "507f1f77bcf86cd799439011",
        email: "test@example.com",
        avatar: "/api/uploads/avatars/avatar.jpg",
        // Ensure we have all the properties that might be accessed
        id: "507f1f77bcf86cd799439011",
      };

      vi.mocked(User.findById).mockResolvedValue(mockUser as any);
      vi.mocked(User.findByIdAndUpdate).mockResolvedValue(updatedUser as any);
      vi.mocked(cleanupOldAvatar).mockResolvedValue(true);

      await UserController.uploadAvatar(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        { avatar: "/api/uploads/avatars/avatar.jpg" },
        { new: true, select: "-password" }
      );
      expect(cleanupOldAvatar).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        "/old-avatar.jpg"
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "Avatar uploaded successfully.",
        data: {
          avatarUrl: "/api/uploads/avatars/avatar.jpg",
          user: {
            id: "507f1f77bcf86cd799439011",
            email: "test@example.com",
            avatar: "/api/uploads/avatars/avatar.jpg",
          },
        },
      });
    });

    it("should handle user not found", async () => {
      vi.mocked(User.findById).mockResolvedValue(null);

      await UserController.uploadAvatar(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "User not found.",
      });
    });

    it("should handle cleanup errors gracefully", async () => {
      const mockUser = {
        _id: "507f1f77bcf86cd799439011",
        avatar: "/old-avatar.jpg",
        save: vi.fn(),
      };

      const updatedUser = {
        _id: "507f1f77bcf86cd799439011",
        email: "test@example.com",
        avatar: "/api/uploads/avatars/avatar.jpg",
      };

      vi.mocked(User.findById).mockResolvedValue(mockUser as any);
      vi.mocked(User.findByIdAndUpdate).mockResolvedValue(updatedUser as any);
      vi.mocked(cleanupOldAvatar).mockRejectedValue(
        new Error("Cleanup failed")
      );

      await UserController.uploadAvatar(
        mockRequest as Request,
        mockResponse as Response
      );

      // Should still succeed despite cleanup failure
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "Avatar uploaded successfully.",
        data: {
          avatarUrl: "/api/uploads/avatars/avatar.jpg",
          user: {
            id: "507f1f77bcf86cd799439011",
            email: "test@example.com",
            avatar: "/api/uploads/avatars/avatar.jpg",
          },
        },
      });
    });

    it("should handle unexpected errors", async () => {
      vi.mocked(User.findById).mockRejectedValue(new Error("Database error"));

      await UserController.uploadAvatar(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to upload avatar.",
      });
    });
  });

  describe("deleteUser", () => {
    beforeEach(() => {
      mockRequest.params = { id: "507f1f77bcf86cd799439012" };
      mockRequest.user!.role = ROLES.SUPER_ADMIN;
      vi.mocked(RoleUtils.isSuperAdmin).mockReturnValue(true);
    });

    it("should require authentication", async () => {
      mockRequest.user = undefined;

      await UserController.deleteUser(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should require Super Admin role", async () => {
      // Change the user's role to not be Super Admin
      mockRequest.user!.role = ROLES.ADMINISTRATOR;

      await UserController.deleteUser(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Only Super Admin can delete users.",
      });
    });

    it("should successfully delete user", async () => {
      const targetUser = {
        _id: "507f1f77bcf86cd799439012",
        firstName: "Target",
        lastName: "User",
        email: "target@example.com",
      };

      const mockDeletionReport = {
        userId: "507f1f77bcf86cd799439012",
        deletedRecords: {
          user: 1,
          registrations: 3,
          messages: 5,
          notifications: 2,
        },
        totalDeleted: 11,
      };

      vi.mocked(User.findById).mockResolvedValue(targetUser as any);
      vi.mocked(UserDeletionService.deleteUserCompletely).mockResolvedValue(
        mockDeletionReport as any
      );

      await UserController.deleteUser(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(UserDeletionService.deleteUserCompletely).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439012",
        mockRequest.user
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          deletionReport: mockDeletionReport,
          summary:
            "Successfully deleted user Target User and all associated data.",
        },
        message:
          "User Target User has been permanently deleted along with all associated data.",
      });
    });

    it("should handle user not found", async () => {
      vi.mocked(User.findById).mockResolvedValue(null);

      await UserController.deleteUser(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "User not found.",
      });
    });

    it("should prevent self-deletion", async () => {
      mockRequest.params!.id = mockRequest.user!._id as string;

      // Mock User.findById to return the current user but with a different role to pass Super Admin check
      const currentUserForDeletion = {
        ...mockRequest.user,
        role: ROLES.ADMINISTRATOR, // Not Super Admin so it passes that check
        id: mockRequest.user!._id,
      };
      vi.mocked(User.findById).mockResolvedValue(currentUserForDeletion as any);

      await UserController.deleteUser(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Cannot delete your own account.",
      });
    });

    it("should handle deletion service errors", async () => {
      const targetUser = {
        _id: "507f1f77bcf86cd799439012",
        firstName: "Target",
        lastName: "User",
      };

      vi.mocked(User.findById).mockResolvedValue(targetUser as any);
      vi.mocked(UserDeletionService.deleteUserCompletely).mockRejectedValue(
        new Error("Deletion failed")
      );

      await UserController.deleteUser(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error.",
      });
    });

    it("should handle unexpected errors", async () => {
      vi.mocked(User.findById).mockRejectedValue(new Error("Database error"));

      await UserController.deleteUser(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error.",
      });
    });
  });

  describe("getUserDeletionImpact", () => {
    beforeEach(() => {
      mockRequest.params = { id: "507f1f77bcf86cd799439012" };
      mockRequest.user!.role = ROLES.SUPER_ADMIN;
      vi.mocked(RoleUtils.isSuperAdmin).mockReturnValue(true);
    });

    it("should require authentication", async () => {
      mockRequest.user = undefined;

      await UserController.getUserDeletionImpact(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should require Super Admin role", async () => {
      // Change the user's role to not be Super Admin
      mockRequest.user!.role = ROLES.ADMINISTRATOR;

      await UserController.getUserDeletionImpact(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Only Super Admin can view deletion impact.",
      });
    });

    it("should return deletion impact successfully", async () => {
      const mockImpact = {
        userId: "507f1f77bcf86cd799439012",
        registrations: 5,
        messages: 12,
        events: 3,
        notifications: 8,
        totalImpact: 28,
        details: {
          registrations: ["Event 1", "Event 2"],
          ownedEvents: ["Workshop A"],
        },
      };

      vi.mocked(UserDeletionService.getUserDeletionImpact).mockResolvedValue(
        mockImpact as any
      );

      await UserController.getUserDeletionImpact(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(UserDeletionService.getUserDeletionImpact).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439012"
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockImpact,
        message: "Deletion impact analysis completed.",
      });
    });

    it("should handle service errors", async () => {
      vi.mocked(UserDeletionService.getUserDeletionImpact).mockRejectedValue(
        new Error("Service error")
      );

      await UserController.getUserDeletionImpact(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error.",
      });
    });
  });

  describe("changePassword", () => {
    beforeEach(() => {
      mockRequest.params = { id: "507f1f77bcf86cd799439011" };
      mockRequest.body = {
        currentPassword: "oldPassword123",
        newPassword: "newPassword456",
        confirmPassword: "newPassword456",
      };

      // Mock user with comparePassword method
      const mockUser = {
        _id: "507f1f77bcf86cd799439011",
        password: "hashedOldPassword",
        comparePassword: vi.fn().mockResolvedValue(true),
        save: vi.fn(),
      };

      vi.mocked(User.findById).mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      } as any);
    });

    it("should require authentication", async () => {
      mockRequest.user = undefined;

      await UserController.changePassword(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "You can only change your own password",
      });
    });

    it("should require current password", async () => {
      mockRequest.body = {
        newPassword: "newPassword456",
        confirmPassword: "newPassword456",
      };

      await UserController.changePassword(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Current password, new password, and confirmation are required",
      });
    });

    it("should require new password", async () => {
      mockRequest.body = {
        currentPassword: "oldPassword123",
        confirmPassword: "newPassword456",
      };

      await UserController.changePassword(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Current password, new password, and confirmation are required",
      });
    });

    it("should require password confirmation", async () => {
      mockRequest.body = {
        currentPassword: "oldPassword123",
        newPassword: "newPassword456",
      };

      await UserController.changePassword(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Current password, new password, and confirmation are required",
      });
    });

    it("should require matching password confirmation", async () => {
      mockRequest.body = {
        currentPassword: "oldPassword123",
        newPassword: "newPassword456",
        confirmPassword: "differentPassword",
      };

      await UserController.changePassword(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "New password and confirmation do not match",
      });
    });

    it("should enforce minimum password length", async () => {
      mockRequest.body = {
        currentPassword: "oldPassword123",
        newPassword: "short",
        confirmPassword: "short",
      };

      await UserController.changePassword(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "New password must be at least 8 characters long",
      });
    });

    it("should only allow users to change their own password", async () => {
      mockRequest.params!.id = "507f1f77bcf86cd799439999"; // Different user ID

      await UserController.changePassword(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "You can only change your own password",
      });
    });

    it("should successfully change password", async () => {
      const mockUser = {
        _id: "507f1f77bcf86cd799439011",
        password: "hashedOldPassword",
        comparePassword: vi.fn().mockResolvedValue(true),
        save: vi.fn(),
      };

      vi.mocked(User.findById).mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      } as any);

      await UserController.changePassword(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockUser.password).toBe("newPassword456");
      expect(mockUser.save).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "Password changed successfully",
      });
    });

    it("should handle incorrect current password", async () => {
      const mockUser = {
        _id: "507f1f77bcf86cd799439011",
        password: "hashedOldPassword",
        comparePassword: vi.fn().mockResolvedValue(false),
        save: vi.fn(),
      };

      vi.mocked(User.findById).mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      } as any);

      await UserController.changePassword(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Current password is incorrect",
      });
    });

    it("should handle user not found", async () => {
      vi.mocked(User.findById).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as any);

      await UserController.changePassword(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "User not found",
      });
    });

    it("should handle password comparison errors", async () => {
      const mockUser = {
        _id: "507f1f77bcf86cd799439011",
        comparePassword: vi
          .fn()
          .mockRejectedValue(new Error("Comparison failed")),
      };

      vi.mocked(User.findById).mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      } as any);

      await UserController.changePassword(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Password verification failed",
      });
    });

    it("should handle unexpected errors", async () => {
      vi.mocked(User.findById).mockImplementation(() => {
        throw new Error("Database error");
      });

      await UserController.changePassword(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Failed to change password",
      });
    });
  });
});
