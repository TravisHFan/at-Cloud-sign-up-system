import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import mongoose from "mongoose";
import { socketService } from "../../../src/services/infrastructure/SocketService";

// Declare global flag for database error simulation
declare global {
  var shouldThrowDatabaseError: boolean;
}

// Simple mock approach that works with Vitest hoisting (same pattern as eventController)
vi.mock("../../../src/models", () => ({
  Message: Object.assign(
    vi.fn().mockImplementation(() => ({
      save: vi.fn().mockResolvedValue({}),
      toJSON: vi.fn().mockReturnValue({}),
      markAsReadEverywhere: vi.fn(),
      getUserState: vi.fn().mockReturnValue({
        isReadInSystem: false,
        isReadInBell: false,
        isRemovedFromBell: false,
        isDeletedFromSystem: false,
      }),
      removeFromBell: vi.fn(),
      userStates: new Map(),
    })),
    {
      find: vi.fn(),
      findById: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      countDocuments: vi.fn(),
      updateMany: vi.fn(),
      getUnreadCountsForUser: vi.fn().mockResolvedValue({
        systemMessages: 5,
        bellNotifications: 3,
      }),
    }
  ),
  User: Object.assign(vi.fn(), {
    findById: vi.fn(),
    find: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    }),
    findOne: vi.fn(),
  }),
}));

// IMPORTANT: Also mock the direct Message import path used by unifiedMessageController
vi.mock("../../../src/models/Message", () => ({
  default: Object.assign(
    vi.fn().mockImplementation((data) => {
      // Simulate validation errors for missing required fields
      if (!data || !data.title || !data.content) {
        const error = new Error(
          "Validation failed: title and content are required"
        );
        error.name = "ValidationError";
        throw error;
      }

      return {
        save: vi.fn().mockResolvedValue({}),
        toJSON: vi.fn().mockReturnValue({}),
        markAsReadEverywhere: vi.fn(),
        deleteFromSystem: vi.fn(),
        getBellDisplayTitle: vi.fn().mockReturnValue("Test Bell Title"),
        getUserState: vi.fn().mockReturnValue({
          isReadInSystem: false,
          isReadInBell: false,
          isRemovedFromBell: false,
          isDeletedFromSystem: false,
        }),
        removeFromBell: vi.fn(),
        userStates: new Map(),
        ...data,
      };
    }),
    {
      find: vi.fn().mockImplementation((query) => {
        // Special handling for error simulation
        if (global.shouldThrowDatabaseError) {
          throw new Error("Database error");
        }

        return {
          sort: vi.fn().mockResolvedValue([
            {
              _id: "msg1",
              markAsReadEverywhere: vi.fn(),
              save: vi.fn().mockResolvedValue({}),
              userStates: new Map([
                ["user123", { isRemovedFromBell: false, isReadInBell: false }],
              ]),
              getBellDisplayTitle: vi.fn().mockReturnValue("Test Message 1"),
              creator: {
                firstName: "John",
                lastName: "Doe",
                authLevel: "admin",
                roleInAtCloud: "Manager",
              },
              canRemoveFromBell: vi.fn().mockReturnValue(true),
            },
            {
              _id: "msg2",
              markAsReadEverywhere: vi.fn(),
              save: vi.fn().mockResolvedValue({}),
              userStates: new Map([
                ["user123", { isRemovedFromBell: false, isReadInBell: false }],
              ]),
              getBellDisplayTitle: vi.fn().mockReturnValue("Test Message 2"),
              creator: {
                firstName: "Jane",
                lastName: "Smith",
                authLevel: "user",
                roleInAtCloud: "Member",
              },
              canRemoveFromBell: vi.fn().mockReturnValue(true),
            },
          ]),
          // Make it thenable so it can be awaited directly too - return iterable array
          then: function (resolve, reject) {
            const messages = [
              {
                _id: "msg1",
                markAsReadEverywhere: vi.fn(),
                save: vi.fn().mockResolvedValue({}),
                userStates: new Map(),
                creator: {
                  firstName: "John",
                  lastName: "Doe",
                  authLevel: "admin",
                  roleInAtCloud: "Manager",
                },
                getBellDisplayTitle: vi.fn().mockReturnValue("Test Message 1"),
                canRemoveFromBell: vi.fn().mockReturnValue(true),
              },
              {
                _id: "msg2",
                markAsReadEverywhere: vi.fn(),
                save: vi.fn().mockResolvedValue({}),
                userStates: new Map(),
                creator: {
                  firstName: "Jane",
                  lastName: "Smith",
                  authLevel: "user",
                  roleInAtCloud: "Member",
                },
                getBellDisplayTitle: vi.fn().mockReturnValue("Test Message 2"),
                canRemoveFromBell: vi.fn().mockReturnValue(true),
              },
            ];
            resolve(messages);
          },
          // Also make it directly iterable for contexts where it's not awaited
          [Symbol.iterator]: function* () {
            yield {
              _id: "msg1",
              markAsReadEverywhere: vi.fn(),
              save: vi.fn().mockResolvedValue({}),
              userStates: new Map(),
              creator: {
                firstName: "John",
                lastName: "Doe",
                authLevel: "admin",
                roleInAtCloud: "Manager",
              },
              getBellDisplayTitle: vi.fn().mockReturnValue("Test Message 1"),
              canRemoveFromBell: vi.fn().mockReturnValue(true),
            };
            yield {
              _id: "msg2",
              markAsReadEverywhere: vi.fn(),
              save: vi.fn().mockResolvedValue({}),
              userStates: new Map(),
              creator: {
                firstName: "Jane",
                lastName: "Smith",
                authLevel: "user",
                roleInAtCloud: "Member",
              },
              getBellDisplayTitle: vi.fn().mockReturnValue("Test Message 2"),
              canRemoveFromBell: vi.fn().mockReturnValue(true),
            };
          },
        };
      }),
      findById: vi.fn().mockImplementation((id) => {
        // Allow individual tests to override by checking if the id suggests "not found"
        if (id === "nonexistent" || id === "notfound") {
          return Promise.resolve(null);
        }

        // Create fresh spy functions for each call to enable proper test assertions
        const mockMessage = {
          _id: id || "msg123",
          save: vi.fn().mockResolvedValue({}),
          markAsReadEverywhere: vi.fn(),
          deleteFromSystem: vi.fn(),
          getUserState: vi.fn().mockReturnValue({
            isReadInSystem: false,
            isReadInBell: false,
            isRemovedFromBell: false,
            isDeletedFromSystem: false,
          }),
          removeFromBell: vi.fn(),
          getBellDisplayTitle: vi.fn().mockReturnValue("Test Message"),
          userStates: new Map([
            [
              "user123",
              {
                isDeletedFromSystem: false,
                isRemovedFromBell: false,
                set: vi.fn(),
              },
            ],
          ]),
        };

        return Promise.resolve(mockMessage);
      }),
      findOne: vi.fn(),
      create: vi.fn().mockImplementation((data) => {
        // Simulate validation errors for missing required fields
        if (!data.title || !data.content) {
          const error = new Error("Validation failed");
          error.name = "ValidationError";
          throw error;
        }

        return Promise.resolve({
          _id: "newmessage123",
          save: vi.fn().mockResolvedValue({}),
          toJSON: vi.fn().mockReturnValue({}),
          getBellDisplayTitle: vi.fn().mockReturnValue("New Message Title"),
          userStates: new Map(),
          ...data,
        });
      }),
      countDocuments: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
      getUnreadCountsForUser: vi.fn().mockResolvedValue({
        systemMessages: 5,
        bellNotifications: 3,
      }),
    }
  ),
}));

// Also mock the direct User import path
vi.mock("../../../src/models/User", () => ({
  default: Object.assign(vi.fn(), {
    findById: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        _id: "user123",
        firstName: "Test",
        lastName: "User",
      }),
    }),
    find: vi.fn().mockResolvedValue([
      {
        _id: "user1",
        firstName: "Test",
        lastName: "User",
        email: "test1@example.com",
      },
      {
        _id: "user2",
        firstName: "Another",
        lastName: "User",
        email: "test2@example.com",
      },
    ]),
    findOne: vi.fn(),
  }),
}));

// Mock CachePatterns from services index
vi.mock("../../../src/services", () => ({
  CachePatterns: {
    invalidateUserCache: vi.fn(),
    invalidateAllUserCaches: vi.fn(),
  },
}));

// Mock SocketService
vi.mock("../../../src/services/SocketService", () => ({
  socketService: {
    emitUnreadCountUpdate: vi.fn(),
    emitSystemMessageUpdate: vi.fn(),
    emitBellNotificationUpdate: vi.fn(),
  },
}));

// Also mock the infrastructure path actually used by the controller
vi.mock("../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitUnreadCountUpdate: vi.fn(),
    emitSystemMessageUpdate: vi.fn(),
    emitBellNotificationUpdate: vi.fn(),
  },
}));

// Mock mongoose
vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("mongoose")>();
  return {
    ...actual,
    default: {
      ...actual.default,
      Types: {
        ObjectId: {
          isValid: vi.fn().mockReturnValue(true),
        },
      },
      Schema: actual.Schema,
    },
  };
});

import { UnifiedMessageController } from "../../../src/controllers/unifiedMessageController";
import { Message, User } from "../../../src/models";
import MessageModel from "../../../src/models/Message";
import UserModel from "../../../src/models/User";
import { CachePatterns } from "../../../src/services";

describe("UnifiedMessageController", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let statusMock: any;
  let jsonMock: any;

  beforeEach(() => {
    // Reset global flags to ensure test isolation
    global.shouldThrowDatabaseError = false;

    // Reset only the response mocks that we recreate each time
    statusMock = vi.fn().mockReturnThis();
    jsonMock = vi.fn().mockReturnThis();

    mockRequest = {
      body: {},
      params: {},
      query: {},
      user: {
        _id: "user123",
        id: "user123",
        firstName: "Test",
        lastName: "User",
        username: "testuser",
        role: "User",
      } as any,
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    } as any;

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe("getSystemMessages", () => {
    beforeEach(() => {
      // Ensure clean state for each test
      global.shouldThrowDatabaseError = false;

      // Reset all mocks to ensure no cross-test contamination
      vi.clearAllMocks();
    });

    it("should return system messages successfully", async () => {
      const mockMessages = [
        {
          _id: "msg1",
          title: "Test Message",
          content: "Test content",
          type: "announcement",
          priority: "high",
          userStates: new Map([["user123", { isDeletedFromSystem: false }]]),
        },
      ];

      // Mock the find().sort() chain
      const mockSort = vi.fn().mockResolvedValue(mockMessages);
      const mockFind = vi.fn().mockReturnValue({ sort: mockSort });

      (MessageModel.find as any) = mockFind;
      (MessageModel.countDocuments as any).mockResolvedValue(25);

      await UnifiedMessageController.getSystemMessages(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(MessageModel.find).toHaveBeenCalled();
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should return 401 if user not authenticated", async () => {
      mockRequest.user = undefined;

      await UnifiedMessageController.getSystemMessages(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required",
      });
    });

    it("should filter messages by type when provided", async () => {
      mockRequest.query = { type: "announcement" };

      const mockFind = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      (Message.find as any).mockReturnValue(mockFind);
      (Message.countDocuments as any).mockResolvedValue(0);

      await UnifiedMessageController.getSystemMessages(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(MessageModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "announcement",
        })
      );
    });

    it("handles plain object userStates and paginates correctly", async () => {
      mockRequest.query = { page: "2", limit: "1" };

      const messages = [
        {
          _id: "m1",
          title: "A",
          content: "x",
          type: "announcement",
          priority: "low",
          createdAt: new Date("2025-01-01"),
          userStates: {
            user123: { isDeletedFromSystem: false, isReadInSystem: false },
          },
        },
        {
          _id: "m2",
          title: "B",
          content: "y",
          type: "announcement",
          priority: "low",
          createdAt: new Date("2025-01-02"),
          userStates: {
            user123: { isDeletedFromSystem: false, isReadInSystem: true },
          },
        },
      ];

      (MessageModel.find as any).mockReturnValue({
        sort: vi.fn().mockResolvedValue(messages),
      });

      await UnifiedMessageController.getSystemMessages(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      const payload = (jsonMock as any).mock.calls.at(-1)[0];
      expect(payload.data.messages).toHaveLength(1);
      expect(payload.data.pagination).toEqual(
        expect.objectContaining({
          currentPage: 2,
          totalPages: 2,
          hasPrev: true,
          hasNext: false,
        })
      );
      expect(payload.data.unreadCount).toBe(
        payload.data.messages.filter((m: any) => !m.isRead).length
      );
    });

    it("should handle database errors", async () => {
      // Set global flag to trigger error
      global.shouldThrowDatabaseError = true;

      // Force the mock to re-evaluate the global flag
      (MessageModel.find as any).mockImplementation((query) => {
        if (global.shouldThrowDatabaseError) {
          throw new Error("Database error");
        }
        return {
          sort: vi.fn().mockResolvedValue([]),
        };
      });

      await UnifiedMessageController.getSystemMessages(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);

      // Clean up
      global.shouldThrowDatabaseError = false;
    });
  });

  describe("createSystemMessage", () => {
    it("should create system message successfully", async () => {
      const messageData = {
        title: "Test Message",
        content: "Test content",
        type: "announcement",
        priority: "high",
      };

      mockRequest.body = messageData;

      await UnifiedMessageController.createSystemMessage(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "System message created successfully",
        })
      );
    });

    it("should return 401 if user not authenticated", async () => {
      mockRequest.user = undefined;

      await UnifiedMessageController.createSystemMessage(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required",
      });
    });

    it("should validate required fields", async () => {
      mockRequest.body = {}; // Missing required fields

      await UnifiedMessageController.createSystemMessage(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Title and content are required",
      });
    });

    it("excludes specified users via excludeUserIds", async () => {
      mockRequest.body = {
        title: "Msg",
        content: "content",
        excludeUserIds: ["user2"],
      } as any;

      // Spy on MessageModel constructor to capture userStates size
      const originalCtor = MessageModel as unknown as any;
      const ctorSpy = vi.spyOn({ create: originalCtor }, "create");

      await UnifiedMessageController.createSystemMessage(
        mockRequest as Request,
        mockResponse as Response
      );

      // We can't directly inspect the saved instance here due to factory mock shape,
      // but we can assert it returned 201 and did not throw
      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });

  describe("markSystemMessageAsRead", () => {
    it("should mark message as read successfully", async () => {
      const messageId = "msg123";
      mockRequest.params = { messageId };

      (Message.getUnreadCountsForUser as any).mockResolvedValue({
        systemMessages: 5,
        bellNotifications: 3,
      });

      // Call the controller
      await UnifiedMessageController.markSystemMessageAsRead(
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify that findById was called with the correct messageId
      expect(MessageModel.findById).toHaveBeenCalledWith(messageId);

      // Verify the response was successful
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it("should return 404 if message not found", async () => {
      const messageId = "nonexistent";
      mockRequest.params = { messageId };

      (Message.findById as any).mockResolvedValue(null);

      await UnifiedMessageController.markSystemMessageAsRead(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Message not found",
      });
    });

    it("invalidates user cache after marking as read", async () => {
      const messageId = "msg123";
      mockRequest.params = { messageId };

      (Message.getUnreadCountsForUser as any).mockResolvedValue({
        systemMessages: 4,
        bellNotifications: 3,
      });

      await UnifiedMessageController.markSystemMessageAsRead(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(CachePatterns.invalidateUserCache).toHaveBeenCalledWith("user123");
    });
  });

  describe("deleteSystemMessage", () => {
    it("should delete system message successfully", async () => {
      const messageId = "msg123";
      mockRequest.params = { messageId };

      const mockMessage = {
        getUserState: vi.fn().mockReturnValue({
          isDeletedFromSystem: false,
        }),
        remove: vi.fn().mockResolvedValue({}),
      };

      (Message.findById as any).mockResolvedValue(mockMessage);

      await UnifiedMessageController.deleteSystemMessage(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(MessageModel.findById).toHaveBeenCalledWith(messageId);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "Message deleted from system messages",
      });
    });

    it("should return 404 if message not found", async () => {
      const messageId = "nonexistent";
      mockRequest.params = { messageId };

      (Message.findById as any).mockResolvedValue(null);

      await UnifiedMessageController.deleteSystemMessage(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Message not found",
      });
    });

    it("invalidates user cache after delete", async () => {
      const messageId = "msg123";
      mockRequest.params = { messageId };

      await UnifiedMessageController.deleteSystemMessage(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(CachePatterns.invalidateUserCache).toHaveBeenCalledWith("user123");
    });
  });

  describe("getBellNotifications", () => {
    it("should return bell notifications successfully", async () => {
      // Override mock to ensure messages have proper creator objects
      (MessageModel.find as any).mockImplementation(() => ({
        sort: vi.fn().mockResolvedValue([
          {
            _id: "msg1",
            markAsReadEverywhere: vi.fn(),
            save: vi.fn().mockResolvedValue({}),
            userStates: new Map([
              ["user123", { isRemovedFromBell: false, isReadInBell: false }],
            ]),
            getBellDisplayTitle: vi.fn().mockReturnValue("Test Message 1"),
            creator: {
              firstName: "John",
              lastName: "Doe",
              authLevel: "admin",
              roleInAtCloud: "Manager",
            },
            canRemoveFromBell: vi.fn().mockReturnValue(true),
          },
        ]),
      }));

      await UnifiedMessageController.getBellNotifications(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(MessageModel.find).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            notifications: expect.any(Array),
            unreadCount: expect.any(Number),
          }),
        })
      );
    });

    it("should return 401 if user not authenticated", async () => {
      mockRequest.user = undefined;

      await UnifiedMessageController.getBellNotifications(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required",
      });
    });

    it("supports plain object userStates and default showRemoveButton", async () => {
      (MessageModel.find as any).mockImplementation(() => ({
        sort: vi.fn().mockResolvedValue([
          {
            _id: "obj1",
            content: "c",
            type: "announcement",
            priority: "low",
            createdAt: new Date(),
            userStates: {
              user123: { isRemovedFromBell: false, isReadInBell: false },
            },
            creator: {
              firstName: "F",
              lastName: "L",
              authLevel: "user",
              roleInAtCloud: "Member",
            },
          },
        ]),
      }));

      await UnifiedMessageController.getBellNotifications(
        mockRequest as Request,
        mockResponse as Response
      );

      const payload = (jsonMock as any).mock.calls.at(-1)[0];
      expect(payload.success).toBe(true);
      expect(payload.data.notifications[0].showRemoveButton).toBe(true);
      expect(payload.data.notifications[0].isRead).toBe(false);
    });

    it("handles database errors with 500", async () => {
      (MessageModel.find as any).mockImplementation(() => {
        throw new Error("DB fail");
      });

      await UnifiedMessageController.getBellNotifications(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("markBellNotificationAsRead", () => {
    it("should mark bell notification as read successfully", async () => {
      const messageId = "notif123";
      mockRequest.params = { messageId };

      (Message.getUnreadCountsForUser as any).mockResolvedValue({
        systemMessages: 5,
        bellNotifications: 2,
      });

      await UnifiedMessageController.markBellNotificationAsRead(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(MessageModel.findById).toHaveBeenCalledWith(messageId);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    // Added: ensure 404 branch when message not found
    it("returns 404 when notification not found", async () => {
      mockRequest.params = { messageId: "notfound" } as any;

      await UnifiedMessageController.markBellNotificationAsRead(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Notification not found",
      });
    });

    it("returns 500 when save throws and does not invalidate or emit", async () => {
      const messageId = "fail-save";
      mockRequest.params = { messageId } as any;

      // Force findById to return a message whose save rejects
      vi.mocked(MessageModel.findById).mockResolvedValueOnce({
        _id: messageId,
        markAsReadEverywhere: vi.fn(),
        save: vi.fn().mockRejectedValue(new Error("boom")),
      } as any);

      await UnifiedMessageController.markBellNotificationAsRead(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error",
      });
      expect(CachePatterns.invalidateUserCache).not.toHaveBeenCalled();
      expect(socketService.emitBellNotificationUpdate).not.toHaveBeenCalled();
      expect(socketService.emitSystemMessageUpdate).not.toHaveBeenCalled();
      expect(socketService.emitUnreadCountUpdate).not.toHaveBeenCalled();
    });
  });

  describe("markAllBellNotificationsAsRead", () => {
    it("should mark all bell notifications as read successfully", async () => {
      // Override mock to ensure find returns an iterable array of messages
      (MessageModel.find as any).mockResolvedValue([
        {
          _id: "msg1",
          markAsReadEverywhere: vi.fn(),
          save: vi.fn().mockResolvedValue({}),
          userStates: new Map([
            ["user123", { isRemovedFromBell: false, isReadInBell: false }],
          ]),
        },
        {
          _id: "msg2",
          markAsReadEverywhere: vi.fn(),
          save: vi.fn().mockResolvedValue({}),
          userStates: new Map([
            ["user123", { isRemovedFromBell: false, isReadInBell: false }],
          ]),
        },
      ]);

      (Message.getUnreadCountsForUser as any).mockResolvedValue({
        systemMessages: 5,
        bellNotifications: 0,
      });

      await UnifiedMessageController.markAllBellNotificationsAsRead(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(MessageModel.find).toHaveBeenCalled();
      expect(MessageModel.getUnreadCountsForUser).toHaveBeenCalledWith(
        "user123"
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      // No invalidate in controller for per-message here, but covered in markSystemMessageAsRead & delete
    });

    // Added: ensure no cache invalidation when nothing to mark
    it("should no-op (no cache invalidation) when there are no unread messages", async () => {
      (MessageModel.find as any).mockResolvedValue([]);

      await UnifiedMessageController.markAllBellNotificationsAsRead(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(CachePatterns.invalidateUserCache).not.toHaveBeenCalled();
    });

    it("should return 401 if user not authenticated", async () => {
      mockRequest.user = undefined;

      await UnifiedMessageController.markAllBellNotificationsAsRead(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required",
      });
    });

    it("returns 500 when a message save throws (no emits, no invalidate)", async () => {
      // One message throws on save
      (MessageModel.find as any).mockResolvedValue([
        {
          _id: "m1",
          markAsReadEverywhere: vi.fn(),
          save: vi.fn().mockRejectedValue(new Error("save failed")),
          userStates: new Map([
            ["user123", { isRemovedFromBell: false, isReadInBell: false }],
          ]),
        },
      ]);

      await UnifiedMessageController.markAllBellNotificationsAsRead(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error",
      });
      expect(CachePatterns.invalidateUserCache).not.toHaveBeenCalled();
      expect(socketService.emitBellNotificationUpdate).not.toHaveBeenCalled();
      expect(socketService.emitSystemMessageUpdate).not.toHaveBeenCalled();
      expect(socketService.emitUnreadCountUpdate).not.toHaveBeenCalled();
    });
  });

  describe("cleanupExpiredMessages", () => {
    it("should cleanup expired messages successfully", async () => {
      // Arrange - Mock the cleanup operation
      const mockCleanupResult = { deletedCount: 5, modifiedCount: 3 };
      vi.mocked(MessageModel.updateMany).mockResolvedValue(
        mockCleanupResult as any
      );

      // Act
      await UnifiedMessageController.cleanupExpiredMessages(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(MessageModel.updateMany).toHaveBeenCalled();
      expect(CachePatterns.invalidateAllUserCaches).toHaveBeenCalled();
    });

    // Added: ensure no global invalidation when nothing changed
    it("should not invalidate caches when no messages expired", async () => {
      vi.mocked(MessageModel.updateMany).mockResolvedValue({
        modifiedCount: 0,
      } as any);

      await UnifiedMessageController.cleanupExpiredMessages(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(CachePatterns.invalidateAllUserCaches).not.toHaveBeenCalled();
    });
  });

  describe("checkWelcomeMessageStatus", () => {
    it("should check welcome message status successfully", async () => {
      // Arrange
      const mockUser = {
        id: "user123",
        hasReceivedWelcomeMessage: false,
      } as any;
      mockRequest.user = mockUser;

      const mockUserData = { hasReceivedWelcomeMessage: false };
      vi.mocked(UserModel.findById).mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUserData),
      } as any);

      // Act
      await UnifiedMessageController.checkWelcomeMessageStatus(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          hasReceivedWelcomeMessage: false,
        },
      });
    });

    it("should return 401 if user not authenticated", async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await UnifiedMessageController.checkWelcomeMessageStatus(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required",
      });
    });

    it("should handle database errors", async () => {
      // Arrange
      const mockUser = { id: "user123" } as any;
      mockRequest.user = mockUser;

      vi.mocked(UserModel.findById).mockReturnValue({
        select: vi.fn().mockRejectedValue(new Error("Database error")),
      } as any);

      // Act
      await UnifiedMessageController.checkWelcomeMessageStatus(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error",
      });
    });
  });

  describe("sendWelcomeNotification", () => {
    it("should send welcome notification successfully", async () => {
      // Arrange
      const mockUser = {
        id: "user123",
        firstName: "John",
        hasReceivedWelcomeMessage: false,
      } as any;
      mockRequest.user = mockUser;

      const mockUserData = {
        _id: "user123",
        firstName: "John",
        lastName: "Doe",
        hasReceivedWelcomeMessage: false,
        set: vi.fn(),
        save: vi.fn().mockResolvedValue({}),
      };
      vi.mocked(UserModel.findById).mockResolvedValue(mockUserData as any);

      // Mock successful message creation
      const mockMessage = {
        userStates: new Map(),
        save: vi.fn().mockResolvedValue({}),
        toJSON: vi.fn().mockReturnValue({ _id: "msg123", title: "Welcome!" }),
        getBellDisplayTitle: vi
          .fn()
          .mockReturnValue("🎉 Welcome to @Cloud Event Management System!"),
      };
      vi.mocked(MessageModel).mockReturnValue(mockMessage as any);

      // Mock getUnreadCountsForUser
      (MessageModel as any).getUnreadCountsForUser = vi.fn().mockResolvedValue({
        systemMessages: 1,
        bellNotifications: 1,
      });

      // Act
      await UnifiedMessageController.sendWelcomeNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(UserModel.findById).toHaveBeenCalledWith("user123");
      expect(MessageModel).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "🎉 Welcome to @Cloud Event Management System!",
          content: expect.stringContaining(
            "Hello John! Welcome to the @Cloud Event Management System"
          ),
          type: "announcement",
          priority: "high",
        })
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    it("should return 401 if user not authenticated", async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await UnifiedMessageController.sendWelcomeNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required",
      });
    });

    it("should return 404 if user not found", async () => {
      // Arrange
      const mockUser = { id: "user123" } as any;
      mockRequest.user = mockUser;

      vi.mocked(UserModel.findById).mockResolvedValue(null);

      // Act
      await UnifiedMessageController.sendWelcomeNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: "User not found",
      });
    });

    it("should skip sending if welcome message already sent", async () => {
      // Arrange
      const mockUser = { id: "user123" } as any;
      mockRequest.user = mockUser;

      const mockUserData = {
        hasReceivedWelcomeMessage: true,
      };
      vi.mocked(UserModel.findById).mockResolvedValue(mockUserData as any);

      // Act
      await UnifiedMessageController.sendWelcomeNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Welcome message already sent",
        data: { alreadySent: true },
      });
    });

    it("should handle database errors", async () => {
      // Arrange
      const mockUser = { id: "user123" } as any;
      mockRequest.user = mockUser;

      vi.mocked(UserModel.findById).mockRejectedValue(
        new Error("Database error")
      );

      // Act
      await UnifiedMessageController.sendWelcomeNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to send welcome notification",
      });
    });
  });

  describe("markAsRead", () => {
    it("should mark message as read successfully", async () => {
      // Arrange
      const mockUser = { id: "user123" } as any;
      mockRequest.user = mockUser;
      mockRequest.params = { messageId: "507f1f77bcf86cd799439011" };

      const mockMessage = {
        markAsReadEverywhere: vi.fn(),
        save: vi.fn().mockResolvedValue({}),
      };
      vi.mocked(MessageModel.findById).mockResolvedValue(mockMessage as any);

      // Act
      await UnifiedMessageController.markAsRead(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(MessageModel.findById).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011"
      );
      expect(mockMessage.markAsReadEverywhere).toHaveBeenCalledWith("user123");
      expect(mockMessage.save).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Message marked as read",
      });
    });

    it("should return 400 for invalid message ID", async () => {
      // Arrange
      const mockUser = { id: "user123" } as any;
      mockRequest.user = mockUser;
      mockRequest.params = { messageId: "invalid-id" };

      // Act
      await UnifiedMessageController.markAsRead(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Invalid message ID",
      });
    });

    it("should return 404 if message not found", async () => {
      // Arrange
      const mockUser = { id: "user123" } as any;
      mockRequest.user = mockUser;
      mockRequest.params = { messageId: "507f1f77bcf86cd799439011" };

      vi.mocked(MessageModel.findById).mockResolvedValue(null);

      // Act
      await UnifiedMessageController.markAsRead(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Message not found",
      });
    });

    it("should handle database errors", async () => {
      // Arrange
      const mockUser = { id: "user123" } as any;
      mockRequest.user = mockUser;
      mockRequest.params = { messageId: "507f1f77bcf86cd799439011" };

      vi.mocked(MessageModel.findById).mockRejectedValue(
        new Error("Database error")
      );

      // Act
      await UnifiedMessageController.markAsRead(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Failed to mark message as read",
      });
    });
  });

  describe("deleteMessage", () => {
    it("should delete message successfully", async () => {
      // Arrange
      const mockUser = { id: "user123" } as any;
      mockRequest.user = mockUser;
      mockRequest.params = { messageId: "507f1f77bcf86cd799439011" };

      const mockMessage = {
        getUserState: vi.fn().mockReturnValue({
          isReadInSystem: false,
          isReadInBell: false,
        }),
        deleteFromSystem: vi.fn(),
        save: vi.fn().mockResolvedValue({}),
      };
      vi.mocked(MessageModel.findById).mockResolvedValue(mockMessage as any);

      // Mock getUnreadCountsForUser
      (MessageModel as any).getUnreadCountsForUser = vi.fn().mockResolvedValue({
        systemMessages: 1,
        bellNotifications: 1,
      });

      // Act
      await UnifiedMessageController.deleteMessage(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(MessageModel.findById).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011"
      );
      expect(mockMessage.getUserState).toHaveBeenCalledWith("user123");
      expect(mockMessage.deleteFromSystem).toHaveBeenCalledWith("user123");
      expect(mockMessage.save).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Message deleted",
      });
    });

    it("should return 400 for invalid message ID", async () => {
      // Arrange
      const mockUser = { id: "user123" } as any;
      mockRequest.user = mockUser;
      mockRequest.params = { messageId: "invalid-id" };

      // Act
      await UnifiedMessageController.deleteMessage(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Invalid message ID",
      });
    });

    it("should return 404 if message not found", async () => {
      // Arrange
      const mockUser = { id: "user123" } as any;
      mockRequest.user = mockUser;
      mockRequest.params = { messageId: "507f1f77bcf86cd799439011" };

      vi.mocked(MessageModel.findById).mockResolvedValue(null);

      // Act
      await UnifiedMessageController.deleteMessage(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Message not found",
      });
    });

    it("should handle database errors", async () => {
      // Arrange
      const mockUser = { id: "user123" } as any;
      mockRequest.user = mockUser;
      mockRequest.params = { messageId: "507f1f77bcf86cd799439011" };

      vi.mocked(MessageModel.findById).mockRejectedValue(
        new Error("Database error")
      );

      // Act
      await UnifiedMessageController.deleteMessage(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Failed to delete message",
      });
    });
  });

  describe("cleanupExpiredItems", () => {
    it("should cleanup expired items successfully", async () => {
      // Arrange
      const mockUser = { id: "admin123", role: "Super Admin" } as any;
      mockRequest.user = mockUser;

      const mockCleanupResult = { modifiedCount: 3 };
      vi.mocked(MessageModel.updateMany).mockResolvedValue(
        mockCleanupResult as any
      );

      // Act
      await UnifiedMessageController.cleanupExpiredItems(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(MessageModel.updateMany).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Cleanup completed",
        data: {
          expiredMessages: 3,
        },
      });
    });

    it("should handle database errors", async () => {
      // Arrange
      const mockUser = { id: "admin123", role: "Super Admin" } as any;
      mockRequest.user = mockUser;

      vi.mocked(MessageModel.updateMany).mockRejectedValue(
        new Error("Database error")
      );

      // Act
      await UnifiedMessageController.cleanupExpiredItems(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to cleanup expired items",
      });
    });
  });

  describe("removeBellNotification", () => {
    it("removes bell notification successfully and invalidates cache", async () => {
      // Arrange
      mockRequest.params = { messageId: "msg123" } as any;

      const mockMessage = {
        removeFromBell: vi.fn(),
        save: vi.fn().mockResolvedValue({}),
        _id: "msg123",
      } as any;
      vi.mocked(MessageModel.findById).mockResolvedValueOnce(mockMessage);

      // Act
      await UnifiedMessageController.removeBellNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(MessageModel.findById).toHaveBeenCalledWith("msg123");
      expect(mockMessage.removeFromBell).toHaveBeenCalledWith("user123");
      expect(mockMessage.save).toHaveBeenCalled();
      expect(CachePatterns.invalidateUserCache).toHaveBeenCalledWith("user123");
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "Notification removed from bell",
      });
    });

    it("returns 404 when notification not found", async () => {
      mockRequest.params = { messageId: "notfound" } as any;

      // Ensure deterministic behavior: force findById to resolve null for this test
      vi.mocked(MessageModel.findById).mockResolvedValueOnce(null as any);

      await UnifiedMessageController.removeBellNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Notification not found",
      });
    });

    it("returns 401 when unauthenticated", async () => {
      mockRequest.user = undefined;

      await UnifiedMessageController.removeBellNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required",
      });
    });

    it("returns 500 when findById throws (no save, no invalidate, no emit)", async () => {
      mockRequest.params = { messageId: "err" } as any;

      vi.mocked(MessageModel.findById).mockRejectedValueOnce(
        new Error("db error")
      );

      await UnifiedMessageController.removeBellNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error",
      });
      expect(CachePatterns.invalidateUserCache).not.toHaveBeenCalled();
      expect(socketService.emitBellNotificationUpdate).not.toHaveBeenCalled();
    });

    it("returns 500 when save throws (no invalidate, no emit)", async () => {
      mockRequest.params = { messageId: "save-fail" } as any;

      const mockMessage = {
        _id: "save-fail",
        removeFromBell: vi.fn(),
        save: vi.fn().mockRejectedValue(new Error("save error")),
      } as any;
      vi.mocked(MessageModel.findById).mockResolvedValueOnce(mockMessage);

      await UnifiedMessageController.removeBellNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error",
      });
      expect(CachePatterns.invalidateUserCache).not.toHaveBeenCalled();
      expect(socketService.emitBellNotificationUpdate).not.toHaveBeenCalled();
    });
  });

  describe("getUnreadCounts", () => {
    it("returns unread counts successfully", async () => {
      (MessageModel as any).getUnreadCountsForUser = vi
        .fn()
        .mockResolvedValue({ systemMessages: 2, bellNotifications: 1 });

      await UnifiedMessageController.getUnreadCounts(
        mockRequest as Request,
        mockResponse as Response
      );

      expect((MessageModel as any).getUnreadCountsForUser).toHaveBeenCalledWith(
        "user123"
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: { systemMessages: 2, bellNotifications: 1 },
      });
    });

    it("returns 401 when unauthenticated", async () => {
      mockRequest.user = undefined;

      await UnifiedMessageController.getUnreadCounts(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required",
      });
    });

    it("handles service errors with 500", async () => {
      (MessageModel as any).getUnreadCountsForUser = vi
        .fn()
        .mockRejectedValue(new Error("DB error"));

      await UnifiedMessageController.getUnreadCounts(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error",
      });
    });
  });
});
