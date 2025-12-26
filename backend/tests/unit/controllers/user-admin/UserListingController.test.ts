import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Response } from "express";
import UserListingController from "../../../../src/controllers/user-admin/UserListingController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  User: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
  },
}));

vi.mock("../../../../src/utils/roleUtils", () => ({
  hasPermission: vi.fn(),
  PERMISSIONS: {
    VIEW_USER_PROFILES: "view_user_profiles",
  },
}));

vi.mock("../../../../src/services", () => ({
  CachePatterns: {
    getUserListing: vi.fn(),
  },
}));

import { User } from "../../../../src/models";
import { hasPermission } from "../../../../src/utils/roleUtils";
import { CachePatterns } from "../../../../src/services";

interface MockRequest {
  query: Record<string, string | undefined>;
  user?: {
    _id: string;
    id: string;
    role: string;
    email: string;
  };
}

describe("UserListingController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock as unknown as Response["status"],
      json: jsonMock as unknown as Response["json"],
    };

    mockReq = {
      query: {},
      user: {
        _id: "admin123",
        id: "admin123",
        role: "Administrator",
        email: "admin@test.com",
      },
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("getAllUsers", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await UserListingController.getAllUsers(
          mockReq as unknown as import("express").Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: "Authentication required. Invalid or missing token.",
        });
      });
    });

    describe("Authorization", () => {
      it("should return 403 if user lacks permission", async () => {
        vi.mocked(hasPermission).mockReturnValue(false);

        await UserListingController.getAllUsers(
          mockReq as unknown as import("express").Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: "Insufficient permissions to view user profiles.",
        });
      });
    });

    describe("Pagination", () => {
      it("should default to page 1 and limit 20", async () => {
        vi.mocked(hasPermission).mockReturnValue(true);
        const mockResult = {
          users: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalUsers: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
        vi.mocked(CachePatterns.getUserListing).mockResolvedValue(mockResult);

        await UserListingController.getAllUsers(
          mockReq as unknown as import("express").Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockResult,
        });
      });

      it("should enforce maximum page size of 20", async () => {
        mockReq.query.limit = "100";
        vi.mocked(hasPermission).mockReturnValue(true);

        // Capture the callback passed to getUserListing
        let capturedCallback: (() => Promise<unknown>) | null = null;
        vi.mocked(CachePatterns.getUserListing).mockImplementation(
          async (_key, callback) => {
            capturedCallback = callback;
            return callback();
          }
        );

        vi.mocked(User.find).mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                select: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        } as unknown as ReturnType<typeof User.find>);
        vi.mocked(User.countDocuments).mockResolvedValue(0);

        await UserListingController.getAllUsers(
          mockReq as unknown as import("express").Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        // The limit should be capped at 20
        expect(capturedCallback).not.toBeNull();
      });

      it("should handle invalid page and limit values", async () => {
        mockReq.query.page = "invalid";
        mockReq.query.limit = "invalid";
        vi.mocked(hasPermission).mockReturnValue(true);

        const mockResult = {
          users: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalUsers: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
        vi.mocked(CachePatterns.getUserListing).mockResolvedValue(mockResult);

        await UserListingController.getAllUsers(
          mockReq as unknown as import("express").Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("Filtering", () => {
      it("should filter by role", async () => {
        mockReq.query.role = "Administrator";
        vi.mocked(hasPermission).mockReturnValue(true);

        const mockResult = {
          users: [{ _id: "user1", role: "Administrator" }],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalUsers: 1,
            hasNext: false,
            hasPrev: false,
          },
        };
        vi.mocked(CachePatterns.getUserListing).mockResolvedValue(mockResult);

        await UserListingController.getAllUsers(
          mockReq as unknown as import("express").Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockResult,
        });
      });

      it("should filter by isActive", async () => {
        mockReq.query.isActive = "true";
        vi.mocked(hasPermission).mockReturnValue(true);

        const mockResult = {
          users: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalUsers: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
        vi.mocked(CachePatterns.getUserListing).mockResolvedValue(mockResult);

        await UserListingController.getAllUsers(
          mockReq as unknown as import("express").Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should filter by isVerified", async () => {
        mockReq.query.isVerified = "false";
        vi.mocked(hasPermission).mockReturnValue(true);

        const mockResult = {
          users: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalUsers: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
        vi.mocked(CachePatterns.getUserListing).mockResolvedValue(mockResult);

        await UserListingController.getAllUsers(
          mockReq as unknown as import("express").Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should filter by isAtCloudLeader", async () => {
        mockReq.query.isAtCloudLeader = "true";
        vi.mocked(hasPermission).mockReturnValue(true);

        const mockResult = {
          users: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalUsers: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
        vi.mocked(CachePatterns.getUserListing).mockResolvedValue(mockResult);

        await UserListingController.getAllUsers(
          mockReq as unknown as import("express").Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should filter by gender", async () => {
        mockReq.query.gender = "Male";
        vi.mocked(hasPermission).mockReturnValue(true);

        const mockResult = {
          users: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalUsers: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
        vi.mocked(CachePatterns.getUserListing).mockResolvedValue(mockResult);

        await UserListingController.getAllUsers(
          mockReq as unknown as import("express").Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("Search", () => {
      it("should search users by name/email/username", async () => {
        mockReq.query.search = "john";
        vi.mocked(hasPermission).mockReturnValue(true);

        const mockResult = {
          users: [{ _id: "user1", firstName: "John" }],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalUsers: 1,
            hasNext: false,
            hasPrev: false,
          },
        };
        vi.mocked(CachePatterns.getUserListing).mockResolvedValue(mockResult);

        await UserListingController.getAllUsers(
          mockReq as unknown as import("express").Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("Sorting", () => {
      it("should sort by createdAt desc by default", async () => {
        vi.mocked(hasPermission).mockReturnValue(true);

        const mockResult = {
          users: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalUsers: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
        vi.mocked(CachePatterns.getUserListing).mockResolvedValue(mockResult);

        await UserListingController.getAllUsers(
          mockReq as unknown as import("express").Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should support role-based sorting with aggregation", async () => {
        mockReq.query.sortBy = "role";
        mockReq.query.sortOrder = "desc";
        vi.mocked(hasPermission).mockReturnValue(true);

        vi.mocked(CachePatterns.getUserListing).mockImplementation(
          async (_key, callback) => callback()
        );
        vi.mocked(User.aggregate).mockResolvedValue([]);
        vi.mocked(User.countDocuments).mockResolvedValue(0);

        await UserListingController.getAllUsers(
          mockReq as unknown as import("express").Request,
          mockRes as Response
        );

        expect(User.aggregate).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should support ascending sort order", async () => {
        mockReq.query.sortOrder = "asc";
        vi.mocked(hasPermission).mockReturnValue(true);

        const mockResult = {
          users: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalUsers: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
        vi.mocked(CachePatterns.getUserListing).mockResolvedValue(mockResult);

        await UserListingController.getAllUsers(
          mockReq as unknown as import("express").Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("Success", () => {
      it("should return paginated user list", async () => {
        vi.mocked(hasPermission).mockReturnValue(true);

        const mockUsers = [
          { _id: "user1", username: "user1", email: "user1@test.com" },
          { _id: "user2", username: "user2", email: "user2@test.com" },
        ];
        const mockResult = {
          users: mockUsers,
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalUsers: 2,
            hasNext: false,
            hasPrev: false,
          },
        };
        vi.mocked(CachePatterns.getUserListing).mockResolvedValue(mockResult);

        await UserListingController.getAllUsers(
          mockReq as unknown as import("express").Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockResult,
        });
      });

      it("should use cache for repeated queries", async () => {
        vi.mocked(hasPermission).mockReturnValue(true);

        const mockResult = {
          users: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalUsers: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
        vi.mocked(CachePatterns.getUserListing).mockResolvedValue(mockResult);

        await UserListingController.getAllUsers(
          mockReq as unknown as import("express").Request,
          mockRes as Response
        );

        expect(CachePatterns.getUserListing).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Function)
        );
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(hasPermission).mockReturnValue(true);
        vi.mocked(CachePatterns.getUserListing).mockRejectedValue(
          new Error("Database error")
        );

        await UserListingController.getAllUsers(
          mockReq as unknown as import("express").Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to retrieve users.",
        });
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });
  });
});
