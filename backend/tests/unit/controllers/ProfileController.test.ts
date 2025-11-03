import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Request, Response } from "express";
import { ProfileController } from "../../../src/controllers/ProfileController";
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
  Program: {
    updateMany: vi.fn(),
  },
  Message: {
    updateMany: vi.fn(),
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
    GUEST_EXPERT: "Guest Expert",
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
  cleanupOldAvatar: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    notifyAdmins: vi.fn(),
    sendToUser: vi.fn(),
    emitUserUpdate: vi.fn(),
  },
}));

vi.mock("../../../src/services/LoggerService", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock("../../../src/models/Program", () => ({
  default: {
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
  },
}));

vi.mock("../../../src/models/Message", () => ({
  default: {
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
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

vi.mock("../../../src/services", () => ({
  CachePatterns: {
    invalidateUserCache: vi.fn(),
    getUserListing: vi.fn(),
  },
}));

// Import mocked modules for direct access
import { User, Program, Message } from "../../../src/models";
import { ROLES } from "../../../src/utils/roleUtils";
import { AutoEmailNotificationService } from "../../../src/services/infrastructure/autoEmailNotificationService";
import { CachePatterns } from "../../../src/services";
import { getFileUrl } from "../../../src/middleware/upload";
import { cleanupOldAvatar } from "../../../src/utils/avatarCleanup";

describe("ProfileController", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Ensure cleanupOldAvatar returns a Promise
    vi.mocked(cleanupOldAvatar).mockReturnValue(Promise.resolve(true));

    // Setup mock response
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    mockResponse = {
      status: statusMock as any,
      json: jsonMock as any,
    };

    // Setup mock request with user
    mockRequest = {
      user: {
        _id: "507f1f77bcf86cd799439011",
        id: "507f1f77bcf86cd799439011",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        username: "testuser",
        role: ROLES.PARTICIPANT,
        isAtCloudLeader: false,
        roleInAtCloud: "",
      } as any,
      body: {},
      params: {},
      query: {},
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("getProfile", () => {
    it("should return user profile successfully", async () => {
      await ProfileController.getProfile(
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

      await ProfileController.getProfile(
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

      await ProfileController.getProfile(
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

      await ProfileController.updateProfile(
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

      await ProfileController.updateProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "@Cloud co-worker must have a role specified.",
      });
    });

    it("should clear roleInAtCloud when isAtCloudLeader is false", async () => {
      mockRequest.body = {
        isAtCloudLeader: false,
        roleInAtCloud: "Leader", // Should be cleared
      };

      await ProfileController.updateProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        {
          $set: {
            isAtCloudLeader: false,
            roleInAtCloud: undefined,
          },
        },
        { new: true, runValidators: true, select: "-password" }
      );
    });

    it("should update avatar when gender changes", async () => {
      mockRequest.body = { gender: "female" };

      const mockUser = {
        _id: "507f1f77bcf86cd799439011",
        avatar: "/old-avatar.jpg",
        gender: "male",
      };

      vi.mocked(User.findById).mockResolvedValue(mockUser as any);

      await ProfileController.updateProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      // Check that findByIdAndUpdate was called with the new avatar URL
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        expect.objectContaining({
          $set: expect.objectContaining({
            gender: "female",
            avatar: "https://i.pravatar.cc/300?img=47",
          }),
        }),
        expect.objectContaining({ new: true, runValidators: true })
      );

      // Check that cleanup was called for the old avatar
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

      const oldUser = {
        _id: "507f1f77bcf86cd799439011",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        isAtCloudLeader: false,
        roleInAtCloud: "",
        gender: "male",
        avatar: "https://i.pravatar.cc/300?img=12",
      };

      const updatedUser = {
        _id: "507f1f77bcf86cd799439011",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        isAtCloudLeader: true,
        roleInAtCloud: "Leader",
      };

      vi.mocked(User.findById).mockResolvedValue(oldUser as any);
      vi.mocked(User.findByIdAndUpdate).mockResolvedValue(updatedUser as any);

      await ProfileController.updateProfile(
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
          systemUser: {
            _id: "system",
            firstName: "System",
            lastName: "",
            email: "",
            role: "system",
            avatar: "",
          },
        })
      );
    });

    it("should send @Cloud role removal notification", async () => {
      mockRequest.user!.isAtCloudLeader = true;
      mockRequest.user!.roleInAtCloud = "Leader";
      mockRequest.body = {
        isAtCloudLeader: false,
      };

      const oldUser = {
        _id: "507f1f77bcf86cd799439011",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        isAtCloudLeader: true,
        roleInAtCloud: "Leader",
        gender: "male",
        avatar: "https://i.pravatar.cc/300?img=12",
      };

      const updatedUser = {
        _id: "507f1f77bcf86cd799439011",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        isAtCloudLeader: false,
        roleInAtCloud: undefined,
      };

      vi.mocked(User.findById).mockResolvedValue(oldUser as any);
      vi.mocked(User.findByIdAndUpdate).mockResolvedValue(updatedUser as any);

      await ProfileController.updateProfile(
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
          systemUser: {
            _id: "system",
            firstName: "System",
            lastName: "",
            email: "",
            role: "system",
            avatar: "",
          },
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

      const oldUser = {
        _id: "507f1f77bcf86cd799439011",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        isAtCloudLeader: true,
        roleInAtCloud: "Leader",
        gender: "male",
        avatar: "https://i.pravatar.cc/300?img=12",
      };

      const updatedUser = {
        _id: "507f1f77bcf86cd799439011",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        isAtCloudLeader: true,
        roleInAtCloud: "Co-Leader",
      };

      vi.mocked(User.findById).mockResolvedValue(oldUser as any);
      vi.mocked(User.findByIdAndUpdate).mockResolvedValue(updatedUser as any);

      await ProfileController.updateProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(
        AutoEmailNotificationService.sendAtCloudRoleChangeNotification
      ).not.toHaveBeenCalled();
    });

    it("should handle user not found", async () => {
      vi.mocked(User.findByIdAndUpdate).mockResolvedValue(null);

      await ProfileController.updateProfile(
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

      await ProfileController.updateProfile(
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

      await ProfileController.updateProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      // Should still succeed despite notification failure
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Profile updated successfully.",
        })
      );
    });

    it("should handle unexpected errors", async () => {
      vi.mocked(User.findByIdAndUpdate).mockRejectedValue(
        new Error("Database error")
      );

      await ProfileController.updateProfile(
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

  describe("uploadAvatar", () => {
    beforeEach(() => {
      mockRequest.file = {
        filename: "avatar.jpg",
        path: "/uploads/avatars/avatar.jpg",
      } as any;

      vi.mocked(getFileUrl).mockReturnValue("/api/uploads/avatars/avatar.jpg");

      // Mock Program and Message updateMany to resolve immediately
      vi.mocked(Program.updateMany).mockResolvedValue({
        modifiedCount: 0,
      } as any);
      vi.mocked(Message.updateMany).mockResolvedValue({
        modifiedCount: 0,
      } as any);
    });

    it("should require authentication", async () => {
      mockRequest.user = undefined;

      await ProfileController.uploadAvatar(
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

      await ProfileController.uploadAvatar(
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

      await ProfileController.uploadAvatar(
        mockRequest as Request,
        mockResponse as Response
      );

      // Check that avatar URL includes cache-busting timestamp
      expect(User.findByIdAndUpdate).toHaveBeenCalled();
      const updateCalls = vi.mocked(User.findByIdAndUpdate).mock.calls[0];
      expect(updateCalls[0]).toBe("507f1f77bcf86cd799439011");
      expect(updateCalls[1]).toMatchObject({
        avatar: expect.stringMatching(
          /^\/api\/uploads\/avatars\/avatar\.jpg\?t=\d+$/
        ),
      });

      expect(cleanupOldAvatar).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        "/old-avatar.jpg"
      );
      expect(statusMock).toHaveBeenCalledWith(200);

      // Check the response includes cache-busting timestamp
      expect(jsonMock).toHaveBeenCalled();
      const responseData = jsonMock.mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe("Avatar uploaded successfully.");
      expect(responseData.data.avatarUrl).toMatch(
        /^\/api\/uploads\/avatars\/avatar\.jpg\?t=\d+$/
      );
      expect(responseData.data.user).toMatchObject({
        id: "507f1f77bcf86cd799439011",
        email: "test@example.com",
        avatar: "/api/uploads/avatars/avatar.jpg",
      });
    });

    it("should handle user not found", async () => {
      vi.mocked(User.findById).mockResolvedValue(null);

      await ProfileController.uploadAvatar(
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

      await ProfileController.uploadAvatar(
        mockRequest as Request,
        mockResponse as Response
      );

      // Should still succeed despite cleanup failure
      expect(statusMock).toHaveBeenCalledWith(200);

      // Check the response includes cache-busting timestamp
      expect(jsonMock).toHaveBeenCalled();
      const responseData = jsonMock.mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe("Avatar uploaded successfully.");
      expect(responseData.data.avatarUrl).toMatch(
        /^\/api\/uploads\/avatars\/avatar\.jpg\?t=\d+$/
      );
      expect(responseData.data.user).toMatchObject({
        id: "507f1f77bcf86cd799439011",
        email: "test@example.com",
        avatar: "/api/uploads/avatars/avatar.jpg",
      });
    });

    it("should handle unexpected errors", async () => {
      vi.mocked(User.findById).mockRejectedValue(new Error("Database error"));

      await ProfileController.uploadAvatar(
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

      await ProfileController.changePassword(
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

      await ProfileController.changePassword(
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

      await ProfileController.changePassword(
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

      await ProfileController.changePassword(
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

      await ProfileController.changePassword(
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

      await ProfileController.changePassword(
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

      await ProfileController.changePassword(
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

      await ProfileController.changePassword(
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

      await ProfileController.changePassword(
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

      await ProfileController.changePassword(
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

      await ProfileController.changePassword(
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

      await ProfileController.changePassword(
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
