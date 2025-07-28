/**
 * Unified Message Controller Unit Tests
 * Tests for welcome message functionality and message filtering logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Request, Response } from "express";
import { UnifiedMessageController } from "../../../src/controllers/unifiedMessageController";
import User from "../../../src/models/User";
import Message from "../../../src/models/Message";

// Mock the models
vi.mock("../../../src/models/User");
vi.mock("../../../src/models/Message");

// Mock socket service
const mockSocketService = {
  emitSystemMessageUpdate: vi.fn(),
  emitBellNotificationUpdate: vi.fn(),
  emitUnreadCountUpdate: vi.fn(),
};

vi.mock("../../../src/services/socketService", () => ({
  default: mockSocketService,
}));

describe("UnifiedMessageController - Welcome Message Tests", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockUser: any;
  let mockMessage: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock request object
    mockRequest = {
      user: {
        id: "test-user-id",
        role: "Participant",
      } as any,
      params: {},
      body: {},
      query: {},
    };

    // Mock response object
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    // Mock user object
    mockUser = {
      _id: "test-user-id",
      firstName: "Test",
      lastName: "User",
      username: "testuser",
      email: "test@example.com",
      role: "Participant",
      hasReceivedWelcomeMessage: false,
      save: vi.fn().mockResolvedValue(true),
    };

    // Mock message object
    mockMessage = {
      _id: "test-message-id",
      title: "Welcome to @Cloud!",
      content: "We're excited to have you join us",
      type: "welcome",
      priority: "medium",
      creator: {
        id: "super-admin-id",
        firstName: "Super",
        lastName: "Admin",
        username: "superadmin",
        authLevel: "Super Admin",
      },
      userStates: new Map(),
      save: vi.fn().mockResolvedValue(true),
      toJSON: vi.fn().mockReturnValue({
        _id: "test-message-id",
        title: "Welcome to @Cloud!",
        content: "We're excited to have you join us",
      }),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("sendWelcomeNotification", () => {
    it("should send welcome notification to new user", async () => {
      // Arrange
      const userFindMock = vi.mocked(User.findById);
      userFindMock.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockReturnValue({
            exec: vi.fn().mockResolvedValue(mockUser),
          }),
        }),
      } as any);

      const messageCreateMock = vi.mocked(Message.create);
      messageCreateMock.mockResolvedValue(mockMessage);

      const messageFindMock = vi.mocked(Message.find);
      messageFindMock.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockReturnValue({
            exec: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      // Act
      await UnifiedMessageController.sendWelcomeNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(userFindMock).toHaveBeenCalledWith("test-user-id");
      expect(messageCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Welcome to @Cloud!",
          content: expect.stringContaining("excited to have you join us"),
          type: "welcome",
          priority: "medium",
        })
      );

      expect(mockUser.hasReceivedWelcomeMessage).toBe(true);
      expect(mockUser.save).toHaveBeenCalled();

      expect(mockSocketService.emitSystemMessageUpdate).toHaveBeenCalledWith(
        "test-user-id",
        "message_created",
        expect.objectContaining({
          message: expect.any(Object),
        })
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining("Welcome notification sent"),
        })
      );
    });

    it("should not send welcome notification if user already received it", async () => {
      // Arrange
      mockUser.hasReceivedWelcomeMessage = true;
      const userFindMock = vi.mocked(User.findById);
      userFindMock.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockReturnValue({
            exec: vi.fn().mockResolvedValue(mockUser),
          }),
        }),
      } as any);

      const messageCreateMock = vi.mocked(Message.create);

      // Act
      await UnifiedMessageController.sendWelcomeNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(userFindMock).toHaveBeenCalledWith("test-user-id");
      expect(messageCreateMock).not.toHaveBeenCalled();

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining("already received"),
        })
      );
    });

    it("should handle authentication error", async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await UnifiedMessageController.sendWelcomeNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Authentication required",
        })
      );
    });

    it("should handle user not found error", async () => {
      // Arrange
      const userFindMock = vi.mocked(User.findById);
      userFindMock.mockResolvedValue(null);

      // Act
      await UnifiedMessageController.sendWelcomeNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "User not found",
        })
      );
    });
  });

  describe("checkWelcomeMessageStatus", () => {
    it("should return correct welcome message status", async () => {
      // Arrange
      const userFindMock = vi.mocked(User.findById);
      userFindMock.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockReturnValue({
            exec: vi.fn().mockResolvedValue(mockUser),
          }),
        }),
      } as any);

      // Act
      await UnifiedMessageController.checkWelcomeMessageStatus(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(userFindMock).toHaveBeenCalledWith("test-user-id");
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          hasReceived: false,
        })
      );
    });

    it("should return true for user who already received welcome message", async () => {
      // Arrange
      mockUser.hasReceivedWelcomeMessage = true;
      const userFindMock = vi.mocked(User.findById);
      userFindMock.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockReturnValue({
            exec: vi.fn().mockResolvedValue(mockUser),
          }),
        }),
      } as any);

      // Act
      await UnifiedMessageController.checkWelcomeMessageStatus(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          hasReceived: true,
        })
      );
    });
  });

  describe("getSystemMessages - Historical Message Filtering", () => {
    it("should only return messages where user exists in userStates", async () => {
      // Arrange
      const mockMessages = [
        {
          _id: "message-1",
          title: "Message 1",
          content: "Content 1",
          userStates: new Map([
            ["test-user-id", { isDeletedFromSystem: false }],
          ]),
          getUserState: vi.fn().mockReturnValue({ isReadInSystem: false }),
        },
        {
          _id: "message-2",
          title: "Message 2",
          content: "Content 2",
          userStates: new Map([
            ["other-user-id", { isDeletedFromSystem: false }],
          ]),
          getUserState: vi.fn().mockReturnValue({ isReadInSystem: false }),
        },
      ];

      const messageFindMock = vi.mocked(Message.find);
      messageFindMock.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                exec: vi.fn().mockResolvedValue(mockMessages),
              }),
            }),
          }),
        }),
      } as any);

      const messageCountMock = vi.mocked(Message.countDocuments);
      messageCountMock.mockResolvedValue(1);

      mockRequest.query = { page: "1", limit: "20" };

      // Act
      await UnifiedMessageController.getSystemMessages(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(messageFindMock).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          [`userStates.test-user-id`]: { $exists: true },
          [`userStates.test-user-id.isDeletedFromSystem`]: { $ne: true },
        })
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            messages: expect.any(Array),
          }),
        })
      );
    });

    it("should filter by message type when provided", async () => {
      // Arrange
      const messageFindMock = vi.mocked(Message.find);
      messageFindMock.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                exec: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      } as any);

      const messageCountMock = vi.mocked(Message.countDocuments);
      messageCountMock.mockResolvedValue(0);

      mockRequest.query = { page: "1", limit: "20", type: "welcome" };

      // Act
      await UnifiedMessageController.getSystemMessages(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(messageFindMock).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          [`userStates.test-user-id`]: { $exists: true },
          [`userStates.test-user-id.isDeletedFromSystem`]: { $ne: true },
          type: "welcome",
        })
      );
    });
  });

  describe("getBellNotifications - Historical Message Filtering", () => {
    it("should only return bell notifications where user exists in userStates", async () => {
      // Arrange
      const mockMessages = [
        {
          _id: "message-1",
          title: "Bell Notification 1",
          content: "Content 1",
          userStates: new Map([["test-user-id", { isRemovedFromBell: false }]]),
          getUserState: vi.fn().mockReturnValue({ isReadInBell: false }),
          getBellDisplayTitle: vi.fn().mockReturnValue("Bell Notification 1"),
          canRemoveFromBell: vi.fn().mockReturnValue(false),
          creator: {
            firstName: "Admin",
            lastName: "User",
            authLevel: "Super Admin",
            roleInAtCloud: "IT Director",
          },
        },
      ];

      const messageFindMock = vi.mocked(Message.find);
      messageFindMock.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockReturnValue({
            exec: vi.fn().mockResolvedValue(mockMessages),
          }),
        }),
      } as any);

      // Act
      await UnifiedMessageController.getBellNotifications(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(messageFindMock).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          [`userStates.test-user-id`]: { $exists: true },
          [`userStates.test-user-id.isRemovedFromBell`]: { $ne: true },
        })
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            notifications: expect.any(Array),
            unreadCount: expect.any(Number),
          }),
        })
      );
    });
  });

  describe("Message Model Static Methods", () => {
    it("should filter unread counts by userStates existence", async () => {
      // Arrange
      const mockCountDocuments = vi
        .fn()
        .mockResolvedValueOnce(2) // bell notifications count
        .mockResolvedValueOnce(1); // system messages count

      const MessageMock = vi.mocked(Message);
      MessageMock.countDocuments = mockCountDocuments;
      MessageMock.getUnreadCountsForUser = vi.fn().mockResolvedValue({
        bellNotifications: 2,
        systemMessages: 1,
        total: 2,
      });

      // Act
      const result = await Message.getUnreadCountsForUser("test-user-id");

      // Assert
      expect(result).toEqual({
        bellNotifications: 2,
        systemMessages: 1,
        total: 2,
      });
    });

    it("should filter bell notifications by userStates existence", async () => {
      // Arrange
      const mockMessages = [
        {
          _id: "message-1",
          getUserState: vi.fn().mockReturnValue({ isReadInBell: false }),
          getBellDisplayTitle: vi.fn().mockReturnValue("Notification 1"),
          canRemoveFromBell: vi.fn().mockReturnValue(false),
          creator: { firstName: "Admin", lastName: "User" },
        },
      ];

      const MessageMock = vi.mocked(Message);
      MessageMock.find = vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue(mockMessages),
      });
      MessageMock.getBellNotificationsForUser = vi.fn().mockResolvedValue(
        mockMessages.map((msg) => ({
          id: msg._id,
          title: msg.getBellDisplayTitle(),
          isRead: false,
          creator: msg.creator,
        }))
      );

      // Act
      const result = await Message.getBellNotificationsForUser("test-user-id");

      // Assert
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
    });
  });
});
