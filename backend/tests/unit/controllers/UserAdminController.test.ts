import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Request, Response } from "express";
import { UserAdminController } from "../../../src/controllers/UserAdminController";
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
  cleanupOldAvatar: vi.fn(),
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
      sendRoleChangeNotification: vi.fn().mockResolvedValue({
        emailsSent: 1,
        messagesCreated: 0,
        success: true,
      }),
      sendAtCloudRoleChangeNotification: vi.fn().mockResolvedValue({
        emailsSent: 1,
        messagesCreated: 0,
        success: true,
      }),
      // New: mock admin notifications for account status changes
      sendAccountStatusChangeAdminNotifications: vi
        .fn()
        .mockImplementation(
          async ({ action, targetUser, actor, createSystemMessage = true }) => {
            // In a real test environment, we would verify these calls separately
            // The actual service implementation will handle the emails and messages
            // For now, just return success
            return {
              emailsSent: 1,
              messagesCreated:
                createSystemMessage && action !== "deleted" ? 1 : 0,
              success: true,
            };
          }
        ),
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
import { User, Program, Message } from "../../../src/models";
import { hasPermission, ROLES, RoleUtils } from "../../../src/utils/roleUtils";
import { AutoEmailNotificationService } from "../../../src/services/infrastructure/autoEmailNotificationService";
import { UnifiedMessageController } from "../../../src/controllers/unifiedMessageController";
import { UserDeletionService } from "../../../src/services/UserDeletionService";
import { CachePatterns } from "../../../src/services";
import { getFileUrl } from "../../../src/middleware/upload";
import { cleanupOldAvatar } from "../../../src/utils/avatarCleanup";
import { AuthEmailService } from "../../../src/services/email/domains/AuthEmailService";
import { UserEmailService } from "../../../src/services/email/domains/UserEmailService";
import { socketService } from "../../../src/services/infrastructure/SocketService";

describe("UserAdminController", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Set up spies for AuthEmailService methods
    vi.spyOn(
      AuthEmailService,
      "sendAccountDeactivationEmail"
    ).mockResolvedValue(true);
    vi.spyOn(
      AuthEmailService,
      "sendAccountReactivationEmail"
    ).mockResolvedValue(true);

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

  describe("getUserById", () => {
    beforeEach(() => {
      mockRequest.params = { id: "507f1f77bcf86cd799439012" };
      vi.mocked(RoleUtils.canAccessUserProfile).mockReturnValue(true);
    });

    it("should require authentication", async () => {
      mockRequest.user = undefined;

      await UserAdminController.getUserById(
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

      await UserAdminController.getUserById(
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

      await UserAdminController.getUserById(
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

      await UserAdminController.getUserById(
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

      await UserAdminController.getUserById(
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

      await UserAdminController.getAllUsers(
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

      await UserAdminController.getAllUsers(
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

      await UserAdminController.getAllUsers(
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

      await UserAdminController.getAllUsers(
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

      await UserAdminController.getAllUsers(
        mockRequest as Request,
        mockResponse as Response
      );
      // Updated expectation: controller now builds a $or array of regex matches instead of $text search
      expect(User.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.any(Array),
        })
      );

      // Access the first call argument (the filter) in a TS-safe way
      const userFindMock = (User.find as any).mock;
      expect(userFindMock.calls.length).toBeGreaterThan(0);
      const calledFilter = userFindMock.calls[0][0];
      const hasJohn = calledFilter.$or.some((cond: any) => {
        const value = Object.values(cond)[0];
        return (
          value && typeof value === "object" && (value as any).$regex === "john"
        );
      });
      expect(hasJohn).toBe(true);
    });

    it("should provide stable pagination when sorting by gender (no duplicate users across pages)", async () => {
      // Page 1
      mockRequest.query = {
        page: "1",
        limit: "2",
        sortBy: "gender",
        sortOrder: "asc",
      };

      const allUsers = [
        {
          _id: "507f1f77bcf86cd799439110",
          email: "userA@example.com",
          firstName: "User",
          lastName: "A",
          role: ROLES.PARTICIPANT,
          isActive: true,
          gender: "Male",
          createdAt: new Date(),
        },
        {
          _id: "507f1f77bcf86cd799439111",
          email: "userB@example.com",
          firstName: "User",
          lastName: "B",
          role: ROLES.PARTICIPANT,
          isActive: true,
          gender: "Male",
          createdAt: new Date(),
        },
        {
          _id: "507f1f77bcf86cd799439112",
          email: "userC@example.com",
          firstName: "User",
          lastName: "C",
          role: ROLES.PARTICIPANT,
          isActive: true,
          gender: "Male",
          createdAt: new Date(),
        },
        {
          _id: "507f1f77bcf86cd799439113",
          email: "userD@example.com",
          firstName: "User",
          lastName: "D",
          role: ROLES.PARTICIPANT,
          isActive: true,
          gender: "Male",
          createdAt: new Date(),
        },
      ];

      // Provide two separate mocked find chains for page 1 and page 2
      const mockFindPage1 = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue(allUsers.slice(0, 2)),
      };
      const mockFindPage2 = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue(allUsers.slice(2, 4)),
      };

      vi.mocked(User.find)
        .mockReturnValueOnce(mockFindPage1 as any)
        .mockReturnValueOnce(mockFindPage2 as any);
      vi.mocked(User.countDocuments).mockResolvedValue(4);
      vi.mocked(CachePatterns.getUserListing).mockImplementation(
        async (_key, fetchFunction) => fetchFunction()
      );

      // First page
      const resPage1 = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      await UserAdminController.getAllUsers(
        mockRequest as Request,
        resPage1 as Response
      );

      // Second page request
      mockRequest.query = {
        page: "2",
        limit: "2",
        sortBy: "gender",
        sortOrder: "asc",
      };
      const resPage2 = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      await UserAdminController.getAllUsers(
        mockRequest as Request,
        resPage2 as Response
      );

      const usersPage1 = (resPage1.json as any).mock.calls[0][0].data.users;
      const usersPage2 = (resPage2.json as any).mock.calls[0][0].data.users;

      const idsPage1 = usersPage1.map((u: any) => u._id);
      const idsPage2 = usersPage2.map((u: any) => u._id);

      // Assert no duplicates between pages
      idsPage1.forEach((id: string) => {
        expect(idsPage2).not.toContain(id);
      });

      // Combined should equal total documents
      expect(new Set([...idsPage1, ...idsPage2]).size).toBe(4);
    });

    it("should return 403 if insufficient permissions", async () => {
      vi.mocked(hasPermission).mockReturnValue(false);

      await UserAdminController.getAllUsers(
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

      await UserAdminController.getAllUsers(
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

      await UserAdminController.getAllUsers(
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

      await UserAdminController.updateUserRole(
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

      await UserAdminController.updateUserRole(
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

      await UserAdminController.updateUserRole(
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

      await UserAdminController.updateUserRole(
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

      await UserAdminController.updateUserRole(
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

    it("should allow Administrator to promote Participant to Guest Expert", async () => {
      mockRequest.body = { role: ROLES.GUEST_EXPERT };
      vi.mocked(RoleUtils.isPromotion).mockReturnValue(true);
      vi.mocked(RoleUtils.isDemotion).mockReturnValue(false);

      const targetUser = {
        _id: "507f1f77bcf86cd799439012",
        firstName: "Target",
        lastName: "User",
        email: "target@example.com",
        role: ROLES.PARTICIPANT,
        save: vi.fn(),
      };

      vi.mocked(User.findById)
        .mockResolvedValueOnce(targetUser as any)
        .mockResolvedValueOnce(mockRequest.user as any);

      await UserAdminController.updateUserRole(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(targetUser.role).toBe(ROLES.GUEST_EXPERT);
      expect(targetUser.save).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message:
            "User role updated to Guest Expert successfully! Notifications sent.",
        })
      );
    });

    it("should allow demotion to Guest Expert when permitted (Super Admin demotes Leader)", async () => {
      // Act as Super Admin
      mockRequest.user!.role = ROLES.SUPER_ADMIN;
      mockRequest.body = { role: ROLES.GUEST_EXPERT };
      vi.mocked(RoleUtils.isPromotion).mockReturnValue(false);
      vi.mocked(RoleUtils.isDemotion).mockReturnValue(true);

      const targetUser = {
        _id: "507f1f77bcf86cd799439013",
        firstName: "Leader",
        lastName: "User",
        email: "leader@example.com",
        role: ROLES.LEADER,
        save: vi.fn(),
      };

      vi.mocked(User.findById)
        .mockResolvedValueOnce(targetUser as any)
        .mockResolvedValueOnce(mockRequest.user as any);

      await UserAdminController.updateUserRole(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(targetUser.role).toBe(ROLES.GUEST_EXPERT);
      expect(targetUser.save).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message:
            "User role updated to Guest Expert successfully! Notifications sent.",
        })
      );
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

      await UserAdminController.updateUserRole(
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

      await UserAdminController.updateUserRole(
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

      await UserAdminController.updateUserRole(
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

      await UserAdminController.updateUserRole(
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

      await UserAdminController.updateUserRole(
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

      await UserAdminController.deactivateUser(
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

      await UserAdminController.deactivateUser(
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

      await UserAdminController.deactivateUser(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(targetUser.isActive).toBe(false);
      expect(targetUser.save).toHaveBeenCalled();
      expect(CachePatterns.invalidateUserCache).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439012"
      );
      // Email sent to the deactivated user
      expect(
        AuthEmailService.sendAccountDeactivationEmail
      ).toHaveBeenCalledWith(
        "target@example.com",
        "Target User",
        expect.objectContaining({
          role: ROLES.ADMINISTRATOR,
          firstName: expect.any(String),
          lastName: expect.any(String),
        })
      );
      // Admin notifications sent via unified service
      expect(
        AutoEmailNotificationService.sendAccountStatusChangeAdminNotifications
      ).toHaveBeenCalledWith({
        action: "deactivated",
        targetUser: expect.objectContaining({
          email: "target@example.com",
        }),
        actor: expect.objectContaining({
          role: ROLES.ADMINISTRATOR,
        }),
        createSystemMessage: true,
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "User deactivated successfully!",
      });
    });

    it("should handle user not found", async () => {
      vi.mocked(User.findById).mockResolvedValue(null);

      await UserAdminController.deactivateUser(
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

      await UserAdminController.deactivateUser(
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

      await UserAdminController.deactivateUser(
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

      await UserAdminController.deactivateUser(
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

      await UserAdminController.reactivateUser(
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

      await UserAdminController.reactivateUser(
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

      await UserAdminController.reactivateUser(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(targetUser.isActive).toBe(true);
      expect(targetUser.save).toHaveBeenCalled();
      expect(CachePatterns.invalidateUserCache).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439012"
      );
      // Email sent to the reactivated user
      expect(
        AuthEmailService.sendAccountReactivationEmail
      ).toHaveBeenCalledWith(
        "target@example.com",
        "Target User",
        expect.objectContaining({
          role: ROLES.ADMINISTRATOR,
          firstName: expect.any(String),
          lastName: expect.any(String),
        })
      );
      // Admin notifications sent via unified service
      expect(
        AutoEmailNotificationService.sendAccountStatusChangeAdminNotifications
      ).toHaveBeenCalledWith({
        action: "reactivated",
        targetUser: expect.objectContaining({
          email: "target@example.com",
        }),
        actor: expect.objectContaining({
          role: ROLES.ADMINISTRATOR,
        }),
        createSystemMessage: true,
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "User reactivated successfully!",
      });
    });

    it("should handle user not found", async () => {
      vi.mocked(User.findById).mockResolvedValue(null);

      await UserAdminController.reactivateUser(
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

      await UserAdminController.reactivateUser(
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

      await UserAdminController.reactivateUser(
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

  describe("deleteUser", () => {
    beforeEach(() => {
      mockRequest.params = { id: "507f1f77bcf86cd799439012" };
      mockRequest.user!.role = ROLES.SUPER_ADMIN;
      vi.mocked(RoleUtils.isSuperAdmin).mockReturnValue(true);
    });

    it("should require authentication", async () => {
      mockRequest.user = undefined;

      await UserAdminController.deleteUser(
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

      await UserAdminController.deleteUser(
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
        userEmail: "target@example.com",
        deletedData: {
          userRecord: true,
          registrations: 3,
          eventsCreated: 1,
          eventOrganizations: 0,
          messageStates: 2,
          messagesCreated: 5,
        },
        updatedStatistics: {
          events: [],
          affectedUsers: 0,
        },
        errors: [],
      };

      // Mock User.find for admin query with chainable select
      vi.mocked(User.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([{ _id: "admin-id-1" }]),
      } as any);

      vi.mocked(User.findById).mockResolvedValue(targetUser as any);
      vi.mocked(UserDeletionService.deleteUserCompletely).mockResolvedValue(
        mockDeletionReport as any
      );

      await UserAdminController.deleteUser(
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

      // Admin notifications sent via unified service
      expect(
        AutoEmailNotificationService.sendAccountStatusChangeAdminNotifications
      ).toHaveBeenCalledWith({
        action: "deleted",
        targetUser: expect.objectContaining({
          email: "target@example.com",
        }),
        actor: expect.objectContaining({
          role: ROLES.SUPER_ADMIN,
        }),
        createSystemMessage: false, // controller already creates message
      });
    });

    it("should handle user not found", async () => {
      vi.mocked(User.findById).mockResolvedValue(null);

      await UserAdminController.deleteUser(
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

      await UserAdminController.deleteUser(
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

      await UserAdminController.deleteUser(
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

      await UserAdminController.deleteUser(
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

      await UserAdminController.getUserDeletionImpact(
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

      await UserAdminController.getUserDeletionImpact(
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

      await UserAdminController.getUserDeletionImpact(
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

      await UserAdminController.getUserDeletionImpact(
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

  describe("adminEditProfile", () => {
    let mockRequest: any;
    let mockResponse: Partial<Response>;
    let statusMock: ReturnType<typeof vi.fn>;
    let jsonMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      statusMock = vi.fn().mockReturnThis();
      jsonMock = vi.fn();

      mockRequest = {
        user: {
          _id: "admin123",
          role: "Super Admin",
          email: "admin@example.com",
        } as any,
        params: {
          id: "user123",
        },
        body: {},
        ip: "127.0.0.1",
        get: vi.fn().mockReturnValue("test-agent"),
      };

      mockResponse = {
        status: statusMock,
        json: jsonMock,
      } as any;
    });

    it("should require authentication", async () => {
      mockRequest.user = undefined;

      await UserAdminController.adminEditProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should require Super Admin or Administrator role", async () => {
      mockRequest.user = {
        _id: "leader123",
        role: "Leader",
        email: "leader@example.com",
      } as any;

      await UserAdminController.adminEditProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message:
          "Only Super Admin and Administrator can edit other users' profiles.",
      });
    });

    it("should return 404 if target user not found", async () => {
      vi.mocked(User.findById).mockResolvedValue(null);

      await UserAdminController.adminEditProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "User not found.",
      });
    });

    it("should successfully update profile with new avatar and cleanup old avatar", async () => {
      const oldAvatarUrl = "/uploads/avatars/old-avatar.jpg";
      const newAvatarUrl = "/uploads/avatars/new-avatar.jpg?t=1234567890";

      const targetUser = {
        _id: "user123",
        username: "testuser",
        email: "user@example.com",
        firstName: "Test",
        lastName: "User",
        role: "Participant",
        avatar: oldAvatarUrl,
        phone: "1234567890",
        isAtCloudLeader: false,
        roleInAtCloud: null,
        isActive: true,
      };

      const updatedUser = {
        ...targetUser,
        avatar: newAvatarUrl,
        phone: "9876543210",
      };

      mockRequest.body = {
        avatar: newAvatarUrl,
        phone: "9876543210",
      };

      vi.mocked(User.findById).mockResolvedValue(targetUser as any);
      vi.mocked(User.findByIdAndUpdate).mockResolvedValue(updatedUser as any);
      vi.mocked(cleanupOldAvatar).mockResolvedValue(true);
      vi.mocked(CachePatterns.invalidateUserCache).mockResolvedValue(undefined);

      await UserAdminController.adminEditProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify cleanup was called with old avatar
      expect(cleanupOldAvatar).toHaveBeenCalledWith("user123", oldAvatarUrl);

      // Verify cache invalidation
      expect(CachePatterns.invalidateUserCache).toHaveBeenCalledWith("user123");

      // Verify WebSocket emission
      expect(socketService.emitUserUpdate).toHaveBeenCalledWith(
        "user123",
        expect.objectContaining({
          type: "profile_edited",
          user: expect.objectContaining({
            id: "user123",
            avatar: newAvatarUrl,
            phone: "9876543210",
          }),
          changes: expect.objectContaining({
            avatar: true,
            phone: true,
          }),
        })
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "Profile updated successfully by admin.",
        data: expect.objectContaining({
          avatar: newAvatarUrl,
          phone: "9876543210",
        }),
      });
    });

    it("should NOT cleanup old avatar when avatar is not changed", async () => {
      const avatarUrl = "/uploads/avatars/avatar.jpg";

      const targetUser = {
        _id: "user123",
        username: "testuser",
        email: "user@example.com",
        firstName: "Test",
        lastName: "User",
        role: "Participant",
        avatar: avatarUrl,
        phone: "1234567890",
        isAtCloudLeader: false,
        roleInAtCloud: null,
        isActive: true,
      };

      const updatedUser = {
        ...targetUser,
        phone: "9876543210",
      };

      mockRequest.body = {
        phone: "9876543210",
        // No avatar in body - not being changed
      };

      vi.mocked(User.findById).mockResolvedValue(targetUser as any);
      vi.mocked(User.findByIdAndUpdate).mockResolvedValue(updatedUser as any);
      vi.mocked(CachePatterns.invalidateUserCache).mockResolvedValue(undefined);

      await UserAdminController.adminEditProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify cleanup was NOT called
      expect(cleanupOldAvatar).not.toHaveBeenCalled();

      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should NOT cleanup when old avatar is null", async () => {
      const newAvatarUrl = "/uploads/avatars/new-avatar.jpg";

      const targetUser = {
        _id: "user123",
        username: "testuser",
        email: "user@example.com",
        firstName: "Test",
        lastName: "User",
        role: "Participant",
        avatar: null, // No old avatar
        phone: "1234567890",
        isAtCloudLeader: false,
        roleInAtCloud: null,
        isActive: true,
      };

      const updatedUser = {
        ...targetUser,
        avatar: newAvatarUrl,
      };

      mockRequest.body = {
        avatar: newAvatarUrl,
      };

      vi.mocked(User.findById).mockResolvedValue(targetUser as any);
      vi.mocked(User.findByIdAndUpdate).mockResolvedValue(updatedUser as any);
      vi.mocked(CachePatterns.invalidateUserCache).mockResolvedValue(undefined);

      await UserAdminController.adminEditProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify cleanup was NOT called because old avatar was null
      expect(cleanupOldAvatar).not.toHaveBeenCalled();

      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should NOT cleanup default avatars", async () => {
      const oldDefaultAvatar = "/default-avatar-male.jpg";
      const newAvatarUrl = "/uploads/avatars/new-avatar.jpg";

      const targetUser = {
        _id: "user123",
        username: "testuser",
        email: "user@example.com",
        firstName: "Test",
        lastName: "User",
        role: "Participant",
        avatar: oldDefaultAvatar, // Default avatar
        phone: "1234567890",
        isAtCloudLeader: false,
        roleInAtCloud: null,
        isActive: true,
      };

      const updatedUser = {
        ...targetUser,
        avatar: newAvatarUrl,
      };

      mockRequest.body = {
        avatar: newAvatarUrl,
      };

      vi.mocked(User.findById).mockResolvedValue(targetUser as any);
      vi.mocked(User.findByIdAndUpdate).mockResolvedValue(updatedUser as any);
      vi.mocked(cleanupOldAvatar).mockResolvedValue(false); // Returns false for default avatars
      vi.mocked(CachePatterns.invalidateUserCache).mockResolvedValue(undefined);

      await UserAdminController.adminEditProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify cleanup WAS called (it will internally skip default avatars)
      expect(cleanupOldAvatar).toHaveBeenCalledWith(
        "user123",
        oldDefaultAvatar
      );

      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle cleanup errors gracefully without failing the update", async () => {
      const oldAvatarUrl = "/uploads/avatars/old-avatar.jpg";
      const newAvatarUrl = "/uploads/avatars/new-avatar.jpg";

      const targetUser = {
        _id: "user123",
        username: "testuser",
        email: "user@example.com",
        firstName: "Test",
        lastName: "User",
        role: "Participant",
        avatar: oldAvatarUrl,
        phone: "1234567890",
        isAtCloudLeader: false,
        roleInAtCloud: null,
        isActive: true,
      };

      const updatedUser = {
        ...targetUser,
        avatar: newAvatarUrl,
      };

      mockRequest.body = {
        avatar: newAvatarUrl,
      };

      vi.mocked(User.findById).mockResolvedValue(targetUser as any);
      vi.mocked(User.findByIdAndUpdate).mockResolvedValue(updatedUser as any);
      vi.mocked(cleanupOldAvatar).mockRejectedValue(
        new Error("Cleanup failed")
      );
      vi.mocked(CachePatterns.invalidateUserCache).mockResolvedValue(undefined);

      await UserAdminController.adminEditProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify cleanup was attempted
      expect(cleanupOldAvatar).toHaveBeenCalledWith("user123", oldAvatarUrl);

      // Update should still succeed despite cleanup failure
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "Profile updated successfully by admin.",
        data: expect.objectContaining({
          avatar: newAvatarUrl,
        }),
      });
    });

    it("should validate @Cloud leader requirements", async () => {
      mockRequest.body = {
        isAtCloudLeader: true,
        // Missing roleInAtCloud
      };

      const targetUser = {
        _id: "user123",
        isActive: true,
      };

      vi.mocked(User.findById).mockResolvedValue(targetUser as any);

      await UserAdminController.adminEditProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Role in @Cloud is required for @Cloud co-workers.",
      });
    });

    it("should handle database update failures", async () => {
      const targetUser = {
        _id: "user123",
        avatar: "/old-avatar.jpg",
      };

      mockRequest.body = {
        phone: "1234567890",
      };

      vi.mocked(User.findById).mockResolvedValue(targetUser as any);
      vi.mocked(User.findByIdAndUpdate).mockResolvedValue(null);

      await UserAdminController.adminEditProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to update user.",
      });
    });

    it("should handle unexpected errors", async () => {
      vi.mocked(User.findById).mockRejectedValue(new Error("Database error"));

      await UserAdminController.adminEditProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Failed to update user profile",
      });
    });
  });
});
