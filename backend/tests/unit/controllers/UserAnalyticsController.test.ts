import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Request, Response } from "express";
import { UserAnalyticsController } from "../../../src/controllers/UserAnalyticsController";

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

vi.mock("../../../src/services/LoggerService", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Import mocked modules for direct access
import { User } from "../../../src/models";
import { hasPermission, ROLES } from "../../../src/utils/roleUtils";

describe("UserAnalyticsController", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

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

  describe("getUserStats", () => {
    beforeEach(() => {
      mockRequest.user!.role = ROLES.ADMINISTRATOR;
      vi.mocked(hasPermission).mockReturnValue(true);
    });

    it("should require authentication", async () => {
      mockRequest.user = undefined;

      await UserAnalyticsController.getUserStats(
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

      await UserAnalyticsController.getUserStats(
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

      await UserAnalyticsController.getUserStats(
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

      await UserAnalyticsController.getUserStats(
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
});
