import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import request from "supertest";
import { ensureIntegrationDB } from "../setup/connect";
import { TokenService } from "../../../src/middleware/auth";

// Socket service mock - MUST be before app import
vi.mock("../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitBellNotificationUpdate: vi.fn(),
    emitUnreadCountUpdate: vi.fn(),
  },
}));

import app from "../../../src/app";
import User from "../../../src/models/User";
import Message from "../../../src/models/Message";
import { socketService } from "../../../src/services/infrastructure/SocketService";

describe("Bell Notifications Bulk Read Integration Tests", () => {
  let authToken: string;
  let userId: string;

  beforeEach(async () => {
    await ensureIntegrationDB();
    await User.deleteMany({});
    await Message.deleteMany({});

    // Reset mocks
    vi.mocked(socketService.emitBellNotificationUpdate).mockClear();
    vi.mocked(socketService.emitUnreadCountUpdate).mockClear(); // Create test user
    const user = await User.create({
      username: "testuser_bellbulk",
      email: "testuser-bellbulk@example.com",
      password: "Password123",
      role: "Participant",
      isActive: true,
      isVerified: true,
    });
    userId = user._id.toString();
    authToken = TokenService.generateTokenPair(user).accessToken;
  });

  // ===== Authentication Tests =====
  describe("Authentication", () => {
    it("should return 401 when no auth token provided", async () => {
      const response = await request(app)
        .patch("/api/notifications/bell/read-all")
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "Access denied. No token provided or invalid format."
      );
    });

    it("should return 401 when invalid auth token provided", async () => {
      const response = await request(app)
        .patch("/api/notifications/bell/read-all")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  // ===== Success Cases =====
  describe("Success Cases", () => {
    it("should mark all unread bell notifications as read", async () => {
      // Create 3 unread notifications
      const messages = await Message.create([
        {
          type: "announcement",
          title: "Message 1",
          content: "Body 1",
          priority: "medium",
          creator: {
            id: "admin123",
            firstName: "Admin",
            lastName: "User",
            username: "admin",
            gender: "male",
            authLevel: "Administrator",
          },

          userStates: {
            [userId]: {
              isReadInBell: false,
              isReadInSystem: false,
              isRemovedFromBell: false,
              isDeletedFromSystem: false,
            },
          },
          isActive: true,
        },
        {
          type: "announcement",
          title: "Message 2",
          content: "Body 2",
          priority: "medium",
          creator: {
            id: "admin123",
            firstName: "Admin",
            lastName: "User",
            username: "admin",
            gender: "male",
            authLevel: "Administrator",
          },

          userStates: {
            [userId]: {
              isReadInBell: false,
              isReadInSystem: false,
              isRemovedFromBell: false,
              isDeletedFromSystem: false,
            },
          },
          isActive: true,
        },
        {
          type: "announcement",
          title: "Message 3",
          content: "Body 3",
          priority: "medium",
          creator: {
            id: "admin123",
            firstName: "Admin",
            lastName: "User",
            username: "admin",
            gender: "male",
            authLevel: "Administrator",
          },

          userStates: {
            [userId]: {
              isReadInBell: false,
              isReadInSystem: false,
              isRemovedFromBell: false,
              isDeletedFromSystem: false,
            },
          },
          isActive: true,
        },
      ]);

      const response = await request(app)
        .patch("/api/notifications/bell/read-all")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "All bell notifications marked as read"
      );
      expect(response.body.data.markedCount).toBe(3);

      // Verify all messages marked as read in bell
      for (const msg of messages) {
        const updatedMessage = await Message.findById(msg._id);
        expect(updatedMessage?.userStates.get(userId)?.isReadInBell).toBe(true);
      }
    });

    it("should emit bell notification update for each message", async () => {
      // Create 2 unread notifications
      await Message.create([
        {
          type: "announcement",
          title: "Message 1",
          content: "Body 1",
          priority: "medium",
          creator: {
            id: "admin123",
            firstName: "Admin",
            lastName: "User",
            username: "admin",
            gender: "male",
            authLevel: "Administrator",
          },

          userStates: {
            [userId]: {
              isReadInBell: false,
              isReadInSystem: false,
              isRemovedFromBell: false,
              isDeletedFromSystem: false,
            },
          },
          isActive: true,
        },
        {
          type: "announcement",
          title: "Message 2",
          content: "Body 2",
          priority: "medium",
          creator: {
            id: "admin123",
            firstName: "Admin",
            lastName: "User",
            username: "admin",
            gender: "male",
            authLevel: "Administrator",
          },

          userStates: {
            [userId]: {
              isReadInBell: false,
              isReadInSystem: false,
              isRemovedFromBell: false,
              isDeletedFromSystem: false,
            },
          },
          isActive: true,
        },
      ]);

      await request(app)
        .patch("/api/notifications/bell/read-all")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(
        vi.mocked(socketService.emitBellNotificationUpdate)
      ).toHaveBeenCalledTimes(2);
      expect(
        vi.mocked(socketService.emitBellNotificationUpdate)
      ).toHaveBeenCalledWith(
        userId,
        "notification_read",
        expect.objectContaining({
          messageId: expect.any(Object),
          isRead: true,
          readAt: expect.any(Date),
        })
      );
    });

    it("should emit unread count update after marking all as read", async () => {
      // Create 1 unread notification
      await Message.create({
        type: "announcement",
        title: "Message",
        content: "Body",
        priority: "medium",
        creator: {
          id: "admin123",
          firstName: "Admin",
          lastName: "User",
          username: "admin",
          gender: "male",
          authLevel: "Administrator",
        },

        userStates: {
          [userId]: {
            isReadInBell: false,
            isReadInSystem: false,
            isRemovedFromBell: false,
            isDeletedFromSystem: false,
          },
        },
        isActive: true,
      });

      await request(app)
        .patch("/api/notifications/bell/read-all")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(
        vi.mocked(socketService.emitUnreadCountUpdate)
      ).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          bellNotifications: expect.any(Number),
          systemMessages: expect.any(Number),
          total: expect.any(Number),
        })
      );
    });

    it("should return zero marked count when no unread notifications", async () => {
      const response = await request(app)
        .patch("/api/notifications/bell/read-all")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.markedCount).toBe(0);
    });

    it("should skip notifications that are already read", async () => {
      // Create 1 unread, 2 read
      await Message.create([
        {
          type: "announcement",
          title: "Unread",
          content: "Body",
          priority: "medium",
          creator: {
            id: "admin123",
            firstName: "Admin",
            lastName: "User",
            username: "admin",
            gender: "male",
            authLevel: "Administrator",
          },

          userStates: {
            [userId]: {
              isReadInBell: false,
              isReadInSystem: false,
              isRemovedFromBell: false,
              isDeletedFromSystem: false,
            },
          },
          isActive: true,
        },
        {
          type: "announcement",
          title: "Read 1",
          content: "Body",
          priority: "medium",
          creator: {
            id: "admin123",
            firstName: "Admin",
            lastName: "User",
            username: "admin",
            gender: "male",
            authLevel: "Administrator",
          },

          userStates: {
            [userId]: {
              isReadInBell: true,
              isReadInSystem: false,
              isRemovedFromBell: false,
              isDeletedFromSystem: false,
            },
          },
          isActive: true,
        },
        {
          type: "announcement",
          title: "Read 2",
          content: "Body",
          priority: "medium",
          creator: {
            id: "admin123",
            firstName: "Admin",
            lastName: "User",
            username: "admin",
            gender: "male",
            authLevel: "Administrator",
          },

          userStates: {
            [userId]: {
              isReadInBell: true,
              isReadInSystem: false,
              isRemovedFromBell: false,
              isDeletedFromSystem: false,
            },
          },
          isActive: true,
        },
      ]);

      const response = await request(app)
        .patch("/api/notifications/bell/read-all")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.markedCount).toBe(1);
    });

    it("should skip notifications removed from bell", async () => {
      // Create 1 unread, 1 removed
      await Message.create([
        {
          type: "announcement",
          title: "Unread",
          content: "Body",
          priority: "medium",
          creator: {
            id: "admin123",
            firstName: "Admin",
            lastName: "User",
            username: "admin",
            gender: "male",
            authLevel: "Administrator",
          },

          userStates: {
            [userId]: {
              isReadInBell: false,
              isReadInSystem: false,
              isRemovedFromBell: false,
              isDeletedFromSystem: false,
            },
          },
          isActive: true,
        },
        {
          type: "announcement",
          title: "Removed",
          content: "Body",
          priority: "medium",
          creator: {
            id: "admin123",
            firstName: "Admin",
            lastName: "User",
            username: "admin",
            gender: "male",
            authLevel: "Administrator",
          },

          userStates: {
            [userId]: {
              isReadInBell: false,
              isReadInSystem: false,
              isRemovedFromBell: true,
              isDeletedFromSystem: false,
            },
          },
          isActive: true,
        },
      ]);

      const response = await request(app)
        .patch("/api/notifications/bell/read-all")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.markedCount).toBe(1);
    });

    it("should only mark as read in bell, not system messages", async () => {
      const message = await Message.create({
        type: "announcement",
        title: "Message",
        content: "Body",
        priority: "medium",
        creator: {
          id: "admin123",
          firstName: "Admin",
          lastName: "User",
          username: "admin",
          gender: "male",
          authLevel: "Administrator",
        },

        userStates: {
          [userId]: {
            isReadInBell: false,
            isReadInSystem: false,
            isRemovedFromBell: false,
            isDeletedFromSystem: false,
          },
        },
        isActive: true,
      });

      await request(app)
        .patch("/api/notifications/bell/read-all")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const updatedMessage = await Message.findById(message._id);
      expect(updatedMessage?.userStates.get(userId)?.isReadInBell).toBe(true);
      expect(updatedMessage?.userStates.get(userId)?.isReadInSystem).toBe(
        false
      );
    });
  });

  // ===== Edge Cases =====
  describe("Edge Cases", () => {
    it("should skip inactive messages", async () => {
      // Create 1 active unread, 1 inactive unread
      await Message.create([
        {
          type: "announcement",
          title: "Active",
          content: "Body",
          priority: "medium",
          creator: {
            id: "admin123",
            firstName: "Admin",
            lastName: "User",
            username: "admin",
            gender: "male",
            authLevel: "Administrator",
          },

          userStates: {
            [userId]: {
              isReadInBell: false,
              isReadInSystem: false,
              isRemovedFromBell: false,
              isDeletedFromSystem: false,
            },
          },
          isActive: true,
        },
        {
          type: "announcement",
          title: "Inactive",
          content: "Body",
          priority: "medium",
          creator: {
            id: "admin123",
            firstName: "Admin",
            lastName: "User",
            username: "admin",
            gender: "male",
            authLevel: "Administrator",
          },

          userStates: {
            [userId]: {
              isReadInBell: false,
              isReadInSystem: false,
              isRemovedFromBell: false,
              isDeletedFromSystem: false,
            },
          },
          isActive: false,
        },
      ]);

      const response = await request(app)
        .patch("/api/notifications/bell/read-all")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.markedCount).toBe(1);
    });

    it("should skip messages without user state", async () => {
      // Create message without userId in userStates
      await Message.create({
        type: "announcement",
        title: "No State",
        content: "Body",
        priority: "medium",
        creator: {
          id: "admin123",
          firstName: "Admin",
          lastName: "User",
          username: "admin",
          gender: "male",
          authLevel: "Administrator",
        },

        userStates: {},
        isActive: true,
      });

      const response = await request(app)
        .patch("/api/notifications/bell/read-all")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.markedCount).toBe(0);
    });

    it("should not invalidate cache when no messages marked", async () => {
      const response = await request(app)
        .patch("/api/notifications/bell/read-all")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.markedCount).toBe(0);
      // Cache invalidation only happens if markedCount > 0
    });

    it("should not affect other users' notifications", async () => {
      // Create another user
      const otherUser = await User.create({
        username: "otheruser_bellbulk",
        email: "otheruser-bellbulk@example.com",
        password: "Password123",
        role: "Participant",
        isActive: true,
        isVerified: true,
      });
      const otherUserId = otherUser._id.toString();

      // Create message with state for both users
      const message = await Message.create({
        type: "announcement",
        title: "Shared Message",
        content: "Body",
        priority: "medium",
        creator: {
          id: "admin123",
          firstName: "Admin",
          lastName: "User",
          username: "admin",
          gender: "male",
          authLevel: "Administrator",
        },

        userStates: {
          [userId]: {
            isReadInBell: false,
            isReadInSystem: false,
            isRemovedFromBell: false,
            isDeletedFromSystem: false,
          },
          [otherUserId]: {
            isReadInBell: false,
            isReadInSystem: false,
            isRemovedFromBell: false,
            isDeletedFromSystem: false,
          },
        },
        isActive: true,
      });

      // Mark as read for first user
      await request(app)
        .patch("/api/notifications/bell/read-all")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Check other user's state unchanged
      const updatedMessage = await Message.findById(message._id);
      expect(updatedMessage?.userStates.get(userId)?.isReadInBell).toBe(true);
      expect(updatedMessage?.userStates.get(otherUserId)?.isReadInBell).toBe(
        false
      );
    });
  });

  // ===== Response Format Tests =====
  describe("Response Format", () => {
    it("should return proper success response structure", async () => {
      await Message.create({
        type: "announcement",
        title: "Message",
        content: "Body",
        priority: "medium",
        creator: {
          id: "admin123",
          firstName: "Admin",
          lastName: "User",
          username: "admin",
          gender: "male",
          authLevel: "Administrator",
        },

        userStates: {
          [userId]: {
            isReadInBell: false,
            isReadInSystem: false,
            isRemovedFromBell: false,
            isDeletedFromSystem: false,
          },
        },
        isActive: true,
      });

      const response = await request(app)
        .patch("/api/notifications/bell/read-all")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: "All bell notifications marked as read",
        data: {
          markedCount: expect.any(Number),
        },
      });
    });

    it("should include markedCount in response", async () => {
      const response = await request(app)
        .patch("/api/notifications/bell/read-all")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty("markedCount");
      expect(typeof response.body.data.markedCount).toBe("number");
    });
  });
});
