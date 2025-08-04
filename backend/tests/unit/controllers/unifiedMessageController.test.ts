import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import mongoose from "mongoose";

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

// Mock SocketService
vi.mock("../../../src/services/SocketService", () => ({
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
  });

  describe("removeBellNotification", () => {
    it("should remove bell notification successfully", async () => {
      const messageId = "notif123";
      mockRequest.params = { messageId };

      await UnifiedMessageController.removeBellNotification(
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

    it("should return 404 if notification not found", async () => {
      const messageId = "nonexistent";
      mockRequest.params = { messageId };

      (Message.findById as any).mockResolvedValue(null);

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
  });

  describe("createTargetedSystemMessage", () => {
    it("should create targeted system message successfully", async () => {
      const messageData = {
        title: "Targeted Message",
        content: "Targeted content",
        type: "announcement",
        priority: "high",
      };

      const targetUserIds = ["user1", "user2", "user3"];

      const result = await UnifiedMessageController.createTargetedSystemMessage(
        messageData,
        targetUserIds
      );

      // This method returns the message object directly, not a {success: true, message: ...} wrapper
      expect(result).toEqual(
        expect.objectContaining({
          save: expect.any(Function),
          toJSON: expect.any(Function),
        })
      );
    });

    it("should handle errors gracefully", async () => {
      const messageData = {
        title: "", // Missing title to trigger validation error
        content: "Error content",
      };

      const targetUserIds = ["user1"];

      await expect(
        UnifiedMessageController.createTargetedSystemMessage(
          messageData,
          targetUserIds
        )
      ).rejects.toThrow();
    });
  });

  describe("Method Existence Tests", () => {
    it("should have getSystemMessages method", () => {
      expect(typeof UnifiedMessageController.getSystemMessages).toBe(
        "function"
      );
    });

    it("should have createSystemMessage method", () => {
      expect(typeof UnifiedMessageController.createSystemMessage).toBe(
        "function"
      );
    });

    it("should have markSystemMessageAsRead method", () => {
      expect(typeof UnifiedMessageController.markSystemMessageAsRead).toBe(
        "function"
      );
    });

    it("should have deleteSystemMessage method", () => {
      expect(typeof UnifiedMessageController.deleteSystemMessage).toBe(
        "function"
      );
    });

    it("should have getBellNotifications method", () => {
      expect(typeof UnifiedMessageController.getBellNotifications).toBe(
        "function"
      );
    });

    it("should have markBellNotificationAsRead method", () => {
      expect(typeof UnifiedMessageController.markBellNotificationAsRead).toBe(
        "function"
      );
    });

    it("should have markAllBellNotificationsAsRead method", () => {
      expect(
        typeof UnifiedMessageController.markAllBellNotificationsAsRead
      ).toBe("function");
    });

    it("should have removeBellNotification method", () => {
      expect(typeof UnifiedMessageController.removeBellNotification).toBe(
        "function"
      );
    });

    it("should have createTargetedSystemMessage method", () => {
      expect(typeof UnifiedMessageController.createTargetedSystemMessage).toBe(
        "function"
      );
    });
  });
});
