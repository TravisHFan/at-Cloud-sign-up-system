import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import { SearchController } from "../../../src/controllers/searchController";
import { User, Event } from "../../../src/models";
import { hasPermission, PERMISSIONS } from "../../../src/utils/roleUtils";
import { CachePatterns } from "../../../src/services";

// Mock dependencies
vi.mock("../../../src/models", () => ({
  User: {
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
  Event: {
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock("../../../src/utils/roleUtils", () => ({
  hasPermission: vi.fn(),
  PERMISSIONS: {
    VIEW_USER_PROFILES: "view_user_profiles",
  },
}));

vi.mock("../../../src/services", () => ({
  CachePatterns: {
    getSearchResults: vi.fn(),
  },
}));

// Test helpers
const createMockRequest = (user?: any, query?: any): Partial<Request> => ({
  user,
  query: query || {},
});

const createMockResponse = (): Partial<Response> => {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
};

const mockUser = {
  id: "user123",
  role: "Administrator",
  username: "admin",
};

const mockUserWithoutPermission = {
  id: "user456",
  role: "Participant",
  username: "participant",
};

describe("SearchController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset console.error mock
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("searchUsers", () => {
    const mockUsers = [
      {
        _id: "user1",
        username: "john_doe",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        role: "Participant",
        isAtCloudLeader: false,
        weeklyChurch: "First Baptist",
      },
      {
        _id: "user2",
        username: "jane_smith",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
        role: "Administrator",
        isAtCloudLeader: true,
        weeklyChurch: "Methodist Church",
      },
    ];

    it("should require authentication", async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await SearchController.searchUsers(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should require search query", async () => {
      const req = createMockRequest(mockUser);
      const res = createMockResponse();

      await SearchController.searchUsers(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Search query is required.",
      });
    });

    it("should reject empty search query", async () => {
      const req = createMockRequest(mockUser, { q: "" });
      const res = createMockResponse();

      await SearchController.searchUsers(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Search query is required.",
      });
    });

    it("should reject non-string search query", async () => {
      const req = createMockRequest(mockUser, { q: 123 });
      const res = createMockResponse();

      await SearchController.searchUsers(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Search query is required.",
      });
    });

    it("should search users successfully with default pagination", async () => {
      const req = createMockRequest(mockUser, { q: "john" });
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      const mockSearchResult = {
        users: mockUsers,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalUsers: 2,
          hasNext: false,
          hasPrev: false,
        },
      };

      vi.mocked(CachePatterns.getSearchResults).mockResolvedValue(
        mockSearchResult
      );

      await SearchController.searchUsers(req as Request, res as Response);

      expect(CachePatterns.getSearchResults).toHaveBeenCalledWith(
        expect.stringContaining("search-users-"),
        expect.any(Function)
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockSearchResult,
      });
    });

    it("should search users with custom pagination", async () => {
      const req = createMockRequest(mockUser, {
        q: "john",
        page: "2",
        limit: "5",
      });
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      const mockSearchResult = {
        users: [],
        pagination: {
          currentPage: 2,
          totalPages: 1,
          totalUsers: 2,
          hasNext: false,
          hasPrev: true,
        },
      };

      vi.mocked(CachePatterns.getSearchResults).mockResolvedValue(
        mockSearchResult
      );

      await SearchController.searchUsers(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockSearchResult,
      });
    });

    it("should apply role filter", async () => {
      const req = createMockRequest(mockUser, {
        q: "john",
        role: "Administrator",
      });
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      const mockSearchResult = {
        users: [mockUsers[1]], // Only administrator
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalUsers: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      vi.mocked(CachePatterns.getSearchResults).mockResolvedValue(
        mockSearchResult
      );

      await SearchController.searchUsers(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockSearchResult,
      });
    });

    it("should apply isAtCloudLeader filter", async () => {
      const req = createMockRequest(mockUser, {
        q: "john",
        isAtCloudLeader: "true",
      });
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      const mockSearchResult = {
        users: [mockUsers[1]], // Only AtCloud leader
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalUsers: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      vi.mocked(CachePatterns.getSearchResults).mockResolvedValue(
        mockSearchResult
      );

      await SearchController.searchUsers(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockSearchResult,
      });
    });

    it("should apply weeklyChurch filter", async () => {
      const req = createMockRequest(mockUser, {
        q: "john",
        weeklyChurch: "Baptist",
      });
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      const mockSearchResult = {
        users: [mockUsers[0]], // Only Baptist church member
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalUsers: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      vi.mocked(CachePatterns.getSearchResults).mockResolvedValue(
        mockSearchResult
      );

      await SearchController.searchUsers(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockSearchResult,
      });
    });

    it("should limit fields for users without VIEW_USER_PROFILES permission", async () => {
      const req = createMockRequest(mockUserWithoutPermission, { q: "john" });
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(false);

      const mockSearchResult = {
        users: [
          {
            username: "john_doe",
            firstName: "John",
            lastName: "Doe",
            avatar: null,
            role: "Participant",
            isAtCloudLeader: false,
            weeklyChurch: "First Baptist",
          },
        ],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalUsers: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      vi.mocked(CachePatterns.getSearchResults).mockResolvedValue(
        mockSearchResult
      );

      await SearchController.searchUsers(req as Request, res as Response);

      expect(hasPermission).toHaveBeenCalledWith(
        mockUserWithoutPermission.role,
        PERMISSIONS.VIEW_USER_PROFILES
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockSearchResult,
      });
    });

    it("should execute database queries when cache callback is invoked", async () => {
      const req = createMockRequest(mockUser, { q: "john" });
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      // Mock the cache to call the callback function
      vi.mocked(CachePatterns.getSearchResults).mockImplementation(
        async (key, callback) => {
          return await callback();
        }
      );

      // Mock the chained query methods
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockUsers),
      };

      vi.mocked(User.find).mockReturnValue(mockQuery as any);
      vi.mocked(User.countDocuments).mockResolvedValue(2);

      await SearchController.searchUsers(req as Request, res as Response);

      expect(User.find).toHaveBeenCalledWith({
        isActive: true,
        $or: [
          { username: { $regex: "john", $options: "i" } },
          { firstName: { $regex: "john", $options: "i" } },
          { lastName: { $regex: "john", $options: "i" } },
          { email: { $regex: "john", $options: "i" } },
          { weeklyChurch: { $regex: "john", $options: "i" } },
          { occupation: { $regex: "john", $options: "i" } },
          { company: { $regex: "john", $options: "i" } },
        ],
      });
      expect(mockQuery.select).toHaveBeenCalledWith("-password");
      expect(mockQuery.sort).toHaveBeenCalledWith({
        firstName: 1,
        lastName: 1,
      });
      expect(mockQuery.limit).toHaveBeenCalledWith(20);
      expect(mockQuery.skip).toHaveBeenCalledWith(0);
      expect(User.countDocuments).toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle database errors gracefully", async () => {
      const req = createMockRequest(mockUser, { q: "john" });
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(CachePatterns.getSearchResults).mockRejectedValue(
        new Error("Database connection failed")
      );

      await SearchController.searchUsers(req as Request, res as Response);

      expect(console.error).toHaveBeenCalledWith(
        "Search users error:",
        expect.any(Error)
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to search users.",
      });
    });
  });

  describe("searchEvents", () => {
    const mockEvents = [
      {
        _id: "event1",
        title: "Sunday Service",
        description: "Weekly worship service",
        location: "Main Sanctuary",
        organizer: "Pastor John",
        purpose: "Worship",
        type: "Service",
        format: "In-Person",
        date: new Date("2025-08-10"),
      },
      {
        _id: "event2",
        title: "Bible Study",
        description: "Weekly Bible study session",
        location: "Fellowship Hall",
        organizer: "Teacher Jane",
        purpose: "Education",
        type: "Study",
        format: "Hybrid",
        date: new Date("2025-08-15"),
      },
    ];

    it("should require authentication", async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await SearchController.searchEvents(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should require search query", async () => {
      const req = createMockRequest(mockUser);
      const res = createMockResponse();

      await SearchController.searchEvents(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Search query is required.",
      });
    });

    it("should search events successfully", async () => {
      const req = createMockRequest(mockUser, { q: "service" });
      const res = createMockResponse();

      const mockSearchResult = {
        events: mockEvents,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalEvents: 2,
          hasNext: false,
          hasPrev: false,
        },
      };

      vi.mocked(CachePatterns.getSearchResults).mockResolvedValue(
        mockSearchResult
      );

      await SearchController.searchEvents(req as Request, res as Response);

      expect(CachePatterns.getSearchResults).toHaveBeenCalledWith(
        expect.stringContaining("search-events-"),
        expect.any(Function)
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockSearchResult,
      });
    });

    it("should apply type filter", async () => {
      const req = createMockRequest(mockUser, {
        q: "service",
        type: "Service",
      });
      const res = createMockResponse();

      const mockSearchResult = {
        events: [mockEvents[0]],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalEvents: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      vi.mocked(CachePatterns.getSearchResults).mockResolvedValue(
        mockSearchResult
      );

      await SearchController.searchEvents(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockSearchResult,
      });
    });

    it("should apply format filter", async () => {
      const req = createMockRequest(mockUser, {
        q: "service",
        format: "In-Person",
      });
      const res = createMockResponse();

      const mockSearchResult = {
        events: [mockEvents[0]],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalEvents: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      vi.mocked(CachePatterns.getSearchResults).mockResolvedValue(
        mockSearchResult
      );

      await SearchController.searchEvents(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should apply upcoming status filter", async () => {
      const req = createMockRequest(mockUser, {
        q: "service",
        status: "upcoming",
      });
      const res = createMockResponse();

      const mockSearchResult = {
        events: mockEvents,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalEvents: 2,
          hasNext: false,
          hasPrev: false,
        },
      };

      vi.mocked(CachePatterns.getSearchResults).mockResolvedValue(
        mockSearchResult
      );

      await SearchController.searchEvents(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should apply past status filter", async () => {
      const req = createMockRequest(mockUser, { q: "service", status: "past" });
      const res = createMockResponse();

      const mockSearchResult = {
        events: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalEvents: 0,
          hasNext: false,
          hasPrev: false,
        },
      };

      vi.mocked(CachePatterns.getSearchResults).mockResolvedValue(
        mockSearchResult
      );

      await SearchController.searchEvents(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should apply date range filters", async () => {
      const req = createMockRequest(mockUser, {
        q: "service",
        dateFrom: "2025-08-01",
        dateTo: "2025-08-31",
      });
      const res = createMockResponse();

      const mockSearchResult = {
        events: mockEvents,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalEvents: 2,
          hasNext: false,
          hasPrev: false,
        },
      };

      vi.mocked(CachePatterns.getSearchResults).mockResolvedValue(
        mockSearchResult
      );

      await SearchController.searchEvents(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should execute database queries when cache callback is invoked", async () => {
      const req = createMockRequest(mockUser, { q: "service" });
      const res = createMockResponse();

      // Mock the cache to call the callback function
      vi.mocked(CachePatterns.getSearchResults).mockImplementation(
        async (key, callback) => {
          return await callback();
        }
      );

      // Mock the chained query methods
      const mockQuery = {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockEvents),
      };

      vi.mocked(Event.find).mockReturnValue(mockQuery as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(2);

      await SearchController.searchEvents(req as Request, res as Response);

      expect(Event.find).toHaveBeenCalledWith({
        $or: [
          { title: { $regex: "service", $options: "i" } },
          { description: { $regex: "service", $options: "i" } },
          { location: { $regex: "service", $options: "i" } },
          { organizer: { $regex: "service", $options: "i" } },
          { purpose: { $regex: "service", $options: "i" } },
          { type: { $regex: "service", $options: "i" } },
        ],
      });
      expect(mockQuery.sort).toHaveBeenCalledWith({ date: -1 });
      expect(mockQuery.limit).toHaveBeenCalledWith(20);
      expect(mockQuery.skip).toHaveBeenCalledWith(0);
      expect(Event.countDocuments).toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle database errors gracefully", async () => {
      const req = createMockRequest(mockUser, { q: "service" });
      const res = createMockResponse();

      vi.mocked(CachePatterns.getSearchResults).mockRejectedValue(
        new Error("Database connection failed")
      );

      await SearchController.searchEvents(req as Request, res as Response);

      expect(console.error).toHaveBeenCalledWith(
        "Search events error:",
        expect.any(Error)
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to search events.",
      });
    });
  });

  describe("globalSearch", () => {
    const mockUsers = [
      {
        _id: "user1",
        username: "john_doe",
        firstName: "John",
        lastName: "Doe",
        avatar: null,
        role: "Participant",
        isAtCloudLeader: false,
        weeklyChurch: "First Baptist",
      },
    ];

    const mockEvents = [
      {
        _id: "event1",
        title: "Sunday Service",
        description: "Weekly worship service",
        location: "Main Sanctuary",
        organizer: "Pastor John",
        type: "Service",
      },
    ];

    it("should require authentication", async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await SearchController.globalSearch(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should require search query", async () => {
      const req = createMockRequest(mockUser);
      const res = createMockResponse();

      await SearchController.globalSearch(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Search query is required.",
      });
    });

    it("should perform global search successfully", async () => {
      const req = createMockRequest(mockUser, { q: "john" });
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      // Mock user query
      const mockUserQuery = {
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockUsers),
      };

      // Mock event query
      const mockEventQuery = {
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockEvents),
      };

      vi.mocked(User.find).mockReturnValue(mockUserQuery as any);
      vi.mocked(Event.find).mockReturnValue(mockEventQuery as any);

      await SearchController.globalSearch(req as Request, res as Response);

      expect(User.find).toHaveBeenCalledWith({
        isActive: true,
        $or: [
          { username: { $regex: "john", $options: "i" } },
          { firstName: { $regex: "john", $options: "i" } },
          { lastName: { $regex: "john", $options: "i" } },
          { weeklyChurch: { $regex: "john", $options: "i" } },
        ],
      });

      expect(Event.find).toHaveBeenCalledWith({
        $or: [
          { title: { $regex: "john", $options: "i" } },
          { description: { $regex: "john", $options: "i" } },
          { location: { $regex: "john", $options: "i" } },
          { organizer: { $regex: "john", $options: "i" } },
          { type: { $regex: "john", $options: "i" } },
        ],
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          users: [
            {
              id: "user1",
              username: "john_doe",
              firstName: "John",
              lastName: "Doe",
              avatar: null,
              role: "Participant",
              isAtCloudLeader: false,
              weeklyChurch: "First Baptist",
            },
          ],
          events: [
            {
              id: "event1",
              title: "Sunday Service",
              description: "Weekly worship service",
              location: "Main Sanctuary",
              type: "Service",
              organizer: "Pastor John",
            },
          ],
          totalResults: 2,
        },
      });
    });

    it("should apply custom limit", async () => {
      const req = createMockRequest(mockUser, { q: "john", limit: "5" });
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      const mockUserQuery = {
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockUsers),
      };

      const mockEventQuery = {
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockEvents),
      };

      vi.mocked(User.find).mockReturnValue(mockUserQuery as any);
      vi.mocked(Event.find).mockReturnValue(mockEventQuery as any);

      await SearchController.globalSearch(req as Request, res as Response);

      expect(mockUserQuery.limit).toHaveBeenCalledWith(5);
      expect(mockEventQuery.limit).toHaveBeenCalledWith(5);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should limit user fields based on permissions", async () => {
      const req = createMockRequest(mockUserWithoutPermission, { q: "john" });
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(false);

      const mockUserQuery = {
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockUsers),
      };

      const mockEventQuery = {
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockEvents),
      };

      vi.mocked(User.find).mockReturnValue(mockUserQuery as any);
      vi.mocked(Event.find).mockReturnValue(mockEventQuery as any);

      await SearchController.globalSearch(req as Request, res as Response);

      expect(mockUserQuery.select).toHaveBeenCalledWith(
        "username firstName lastName avatar role isAtCloudLeader weeklyChurch"
      );
      expect(hasPermission).toHaveBeenCalledWith(
        mockUserWithoutPermission.role,
        PERMISSIONS.VIEW_USER_PROFILES
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle database errors gracefully", async () => {
      const req = createMockRequest(mockUser, { q: "john" });
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(User.find).mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      await SearchController.globalSearch(req as Request, res as Response);

      expect(console.error).toHaveBeenCalledWith(
        "Global search error:",
        expect.any(Error)
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to perform global search.",
      });
    });

    it("should return empty results when no matches found", async () => {
      const req = createMockRequest(mockUser, { q: "nonexistent" });
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      const mockUserQuery = {
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([]),
      };

      const mockEventQuery = {
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(User.find).mockReturnValue(mockUserQuery as any);
      vi.mocked(Event.find).mockReturnValue(mockEventQuery as any);

      await SearchController.globalSearch(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          users: [],
          events: [],
          totalResults: 0,
        },
      });
    });
  });
});
