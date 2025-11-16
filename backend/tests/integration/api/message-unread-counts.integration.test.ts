import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../../src/app";
import { ensureIntegrationDB } from "../setup/connect";
import Message from "../../../src/models/Message";
import User from "../../../src/models/User";
import { TokenService } from "../../../src/middleware/auth";

describe("GET /api/notifications/unread-counts - UnreadCountsController", () => {
  beforeAll(async () => {
    await ensureIntegrationDB();
  });

  afterEach(async () => {
    await Message.deleteMany({});
    await User.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe("Authentication", () => {
    it("should return 401 if no token is provided", async () => {
      const response = await request(app).get(
        "/api/notifications/unread-counts"
      );
      expect(response.status).toBe(401);
    });

    it("should return 401 if token is invalid", async () => {
      const response = await request(app)
        .get("/api/notifications/unread-counts")
        .set("Authorization", "Bearer invalid-token");
      expect(response.status).toBe(401);
    });
  });

  describe("Success Cases - No Messages", () => {
    it("should return zero counts when user has no messages", async () => {
      const user = await User.create({
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const token = TokenService.generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/unread-counts")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.bellNotifications).toBe(0);
      expect(response.body.data.systemMessages).toBe(0);
      expect(response.body.data.total).toBe(0);
    });

    it("should return zero counts when no messages exist in database", async () => {
      const user = await User.create({
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const token = TokenService.generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/unread-counts")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.bellNotifications).toBe(0);
      expect(response.body.data.systemMessages).toBe(0);
      expect(response.body.data.total).toBe(0);
    });
  });

  describe("Success Cases - Bell Notifications", () => {
    it("should count unread bell notifications", async () => {
      const user = await User.create({
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const userId = user._id.toString();

      // Create message with user state (unread in bell)
      await Message.create({
        title: "Bell Message",
        content: "Unread bell notification",
        type: "announcement",
        priority: "medium",
        creator: {
          id: "admin123",
          firstName: "Admin",
          lastName: "User",
          username: "admin",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        userStates: new Map([
          [
            userId,
            {
              isReadInBell: false,
              isRemovedFromBell: false,
              isReadInSystem: false,
              isDeletedFromSystem: false,
            },
          ],
        ]),
      });

      const token = TokenService.generateAccessToken({
        userId,
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/unread-counts")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.bellNotifications).toBe(1);
    });

    it("should not count read bell notifications", async () => {
      const user = await User.create({
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const userId = user._id.toString();

      // Create message with read bell notification
      await Message.create({
        title: "Read Bell Message",
        content: "Read bell notification",
        type: "announcement",
        priority: "medium",
        creator: {
          id: "admin123",
          firstName: "Admin",
          lastName: "User",
          username: "admin",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        userStates: new Map([
          [
            userId,
            {
              isReadInBell: true,
              readInBellAt: new Date(),
              isRemovedFromBell: false,
              isReadInSystem: false,
              isDeletedFromSystem: false,
            },
          ],
        ]),
      });

      const token = TokenService.generateAccessToken({
        userId,
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/unread-counts")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.bellNotifications).toBe(0);
    });

    it("should not count removed bell notifications", async () => {
      const user = await User.create({
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const userId = user._id.toString();

      // Create message removed from bell
      await Message.create({
        title: "Removed Bell Message",
        content: "Removed from bell",
        type: "announcement",
        priority: "medium",
        creator: {
          id: "admin123",
          firstName: "Admin",
          lastName: "User",
          username: "admin",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        userStates: new Map([
          [
            userId,
            {
              isReadInBell: false,
              isRemovedFromBell: true,
              removedFromBellAt: new Date(),
              isReadInSystem: false,
              isDeletedFromSystem: false,
            },
          ],
        ]),
      });

      const token = TokenService.generateAccessToken({
        userId,
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/unread-counts")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.bellNotifications).toBe(0);
    });

    it("should count multiple unread bell notifications", async () => {
      const user = await User.create({
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const userId = user._id.toString();

      // Create 3 unread bell notifications
      for (let i = 0; i < 3; i++) {
        await Message.create({
          title: `Bell Message ${i + 1}`,
          content: `Unread bell notification ${i + 1}`,
          type: "announcement",
          priority: "medium",
          creator: {
            id: "admin123",
            firstName: "Admin",
            lastName: "User",
            username: "admin",
            gender: "male",
            authLevel: "Administrator",
          },
          isActive: true,
          userStates: new Map([
            [
              userId,
              {
                isReadInBell: false,
                isRemovedFromBell: false,
                isReadInSystem: false,
                isDeletedFromSystem: false,
              },
            ],
          ]),
        });
      }

      const token = TokenService.generateAccessToken({
        userId,
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/unread-counts")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.bellNotifications).toBe(3);
    });
  });

  describe("Success Cases - System Messages", () => {
    it("should count unread system messages", async () => {
      const user = await User.create({
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const userId = user._id.toString();

      // Create message with unread system message
      await Message.create({
        title: "System Message",
        content: "Unread system message",
        type: "announcement",
        priority: "medium",
        creator: {
          id: "admin123",
          firstName: "Admin",
          lastName: "User",
          username: "admin",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        userStates: new Map([
          [
            userId,
            {
              isReadInBell: false,
              isRemovedFromBell: false,
              isReadInSystem: false,
              isDeletedFromSystem: false,
            },
          ],
        ]),
      });

      const token = TokenService.generateAccessToken({
        userId,
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/unread-counts")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.systemMessages).toBe(1);
    });

    it("should not count read system messages", async () => {
      const user = await User.create({
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const userId = user._id.toString();

      // Create message with read system message
      await Message.create({
        title: "Read System Message",
        content: "Read system message",
        type: "announcement",
        priority: "medium",
        creator: {
          id: "admin123",
          firstName: "Admin",
          lastName: "User",
          username: "admin",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        userStates: new Map([
          [
            userId,
            {
              isReadInBell: false,
              isRemovedFromBell: false,
              isReadInSystem: true,
              readInSystemAt: new Date(),
              isDeletedFromSystem: false,
            },
          ],
        ]),
      });

      const token = TokenService.generateAccessToken({
        userId,
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/unread-counts")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.systemMessages).toBe(0);
    });

    it("should not count deleted system messages", async () => {
      const user = await User.create({
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const userId = user._id.toString();

      // Create message deleted from system
      await Message.create({
        title: "Deleted System Message",
        content: "Deleted from system",
        type: "announcement",
        priority: "medium",
        creator: {
          id: "admin123",
          firstName: "Admin",
          lastName: "User",
          username: "admin",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        userStates: new Map([
          [
            userId,
            {
              isReadInBell: false,
              isRemovedFromBell: false,
              isReadInSystem: false,
              isDeletedFromSystem: true,
              deletedFromSystemAt: new Date(),
            },
          ],
        ]),
      });

      const token = TokenService.generateAccessToken({
        userId,
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/unread-counts")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.systemMessages).toBe(0);
    });
  });

  describe("Success Cases - Mixed Scenarios", () => {
    it("should count both bell and system unread messages separately", async () => {
      const user = await User.create({
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const userId = user._id.toString();

      // Create message unread in both
      await Message.create({
        title: "Unread Both",
        content: "Unread in both systems",
        type: "announcement",
        priority: "medium",
        creator: {
          id: "admin123",
          firstName: "Admin",
          lastName: "User",
          username: "admin",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        userStates: new Map([
          [
            userId,
            {
              isReadInBell: false,
              isRemovedFromBell: false,
              isReadInSystem: false,
              isDeletedFromSystem: false,
            },
          ],
        ]),
      });

      // Create message read in bell but unread in system
      await Message.create({
        title: "Read Bell, Unread System",
        content: "Different states",
        type: "update",
        priority: "low",
        creator: {
          id: "admin123",
          firstName: "Admin",
          lastName: "User",
          username: "admin",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        userStates: new Map([
          [
            userId,
            {
              isReadInBell: true,
              readInBellAt: new Date(),
              isRemovedFromBell: false,
              isReadInSystem: false,
              isDeletedFromSystem: false,
            },
          ],
        ]),
      });

      const token = TokenService.generateAccessToken({
        userId,
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/unread-counts")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.bellNotifications).toBe(1);
      expect(response.body.data.systemMessages).toBe(2);
      expect(response.body.data.total).toBe(1); // Total follows bell count
    });

    it("should not count inactive messages", async () => {
      const user = await User.create({
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const userId = user._id.toString();

      // Create inactive message
      await Message.create({
        title: "Inactive Message",
        content: "This message is inactive",
        type: "announcement",
        priority: "medium",
        creator: {
          id: "admin123",
          firstName: "Admin",
          lastName: "User",
          username: "admin",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: false,
        userStates: new Map([
          [
            userId,
            {
              isReadInBell: false,
              isRemovedFromBell: false,
              isReadInSystem: false,
              isDeletedFromSystem: false,
            },
          ],
        ]),
      });

      const token = TokenService.generateAccessToken({
        userId,
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/unread-counts")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.bellNotifications).toBe(0);
      expect(response.body.data.systemMessages).toBe(0);
    });

    it("should not count messages without user state", async () => {
      const user = await User.create({
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      // Create message without user state
      await Message.create({
        title: "No User State",
        content: "Message without user state",
        type: "announcement",
        priority: "medium",
        creator: {
          id: "admin123",
          firstName: "Admin",
          lastName: "User",
          username: "admin",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        userStates: new Map(),
      });

      const token = TokenService.generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/unread-counts")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.bellNotifications).toBe(0);
      expect(response.body.data.systemMessages).toBe(0);
    });

    it("should only count messages for the authenticated user", async () => {
      const user1 = await User.create({
        username: "user1",
        email: "user1@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const user2 = await User.create({
        username: "user2",
        email: "user2@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const userId1 = user1._id.toString();
      const userId2 = user2._id.toString();

      // Create message for user2 only
      await Message.create({
        title: "User2 Message",
        content: "Only for user2",
        type: "announcement",
        priority: "medium",
        creator: {
          id: "admin123",
          firstName: "Admin",
          lastName: "User",
          username: "admin",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: true,
        userStates: new Map([
          [
            userId2,
            {
              isReadInBell: false,
              isRemovedFromBell: false,
              isReadInSystem: false,
              isDeletedFromSystem: false,
            },
          ],
        ]),
      });

      const token1 = TokenService.generateAccessToken({
        userId: userId1,
        email: user1.email,
        role: user1.role,
      });

      const response = await request(app)
        .get("/api/notifications/unread-counts")
        .set("Authorization", `Bearer ${token1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.bellNotifications).toBe(0);
      expect(response.body.data.systemMessages).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle user with many unread messages", async () => {
      const user = await User.create({
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const userId = user._id.toString();

      // Create 50 unread messages
      for (let i = 0; i < 50; i++) {
        await Message.create({
          title: `Message ${i + 1}`,
          content: `Content ${i + 1}`,
          type: "announcement",
          priority: "medium",
          creator: {
            id: "admin123",
            firstName: "Admin",
            lastName: "User",
            username: "admin",
            gender: "male",
            authLevel: "Administrator",
          },
          isActive: true,
          userStates: new Map([
            [
              userId,
              {
                isReadInBell: false,
                isRemovedFromBell: false,
                isReadInSystem: false,
                isDeletedFromSystem: false,
              },
            ],
          ]),
        });
      }

      const token = TokenService.generateAccessToken({
        userId,
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/unread-counts")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.bellNotifications).toBe(50);
      expect(response.body.data.systemMessages).toBe(50);
      expect(response.body.data.total).toBe(50);
    });

    it("should verify total equals bellNotifications", async () => {
      const user = await User.create({
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const userId = user._id.toString();

      // Create 3 unread bell, 5 unread system
      for (let i = 0; i < 3; i++) {
        await Message.create({
          title: `Bell ${i + 1}`,
          content: `Bell content ${i + 1}`,
          type: "announcement",
          priority: "medium",
          creator: {
            id: "admin123",
            firstName: "Admin",
            lastName: "User",
            username: "admin",
            gender: "male",
            authLevel: "Administrator",
          },
          isActive: true,
          userStates: new Map([
            [
              userId,
              {
                isReadInBell: false,
                isRemovedFromBell: false,
                isReadInSystem: false,
                isDeletedFromSystem: false,
              },
            ],
          ]),
        });
      }

      for (let i = 0; i < 2; i++) {
        await Message.create({
          title: `System ${i + 1}`,
          content: `System content ${i + 1}`,
          type: "update",
          priority: "low",
          creator: {
            id: "admin123",
            firstName: "Admin",
            lastName: "User",
            username: "admin",
            gender: "male",
            authLevel: "Administrator",
          },
          isActive: true,
          userStates: new Map([
            [
              userId,
              {
                isReadInBell: true,
                readInBellAt: new Date(),
                isRemovedFromBell: false,
                isReadInSystem: false,
                isDeletedFromSystem: false,
              },
            ],
          ]),
        });
      }

      const token = TokenService.generateAccessToken({
        userId,
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/unread-counts")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.bellNotifications).toBe(3);
      expect(response.body.data.systemMessages).toBe(5);
      expect(response.body.data.total).toBe(3); // Total = bellNotifications
      expect(response.body.data.total).toBe(
        response.body.data.bellNotifications
      );
    });
  });

  describe("Response Format", () => {
    it("should return correct response structure", async () => {
      const user = await User.create({
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const token = TokenService.generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/unread-counts")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success");
      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toHaveProperty("bellNotifications");
      expect(response.body.data).toHaveProperty("systemMessages");
      expect(response.body.data).toHaveProperty("total");
      expect(typeof response.body.data.bellNotifications).toBe("number");
      expect(typeof response.body.data.systemMessages).toBe("number");
      expect(typeof response.body.data.total).toBe("number");
    });

    it("should not include message field on success", async () => {
      const user = await User.create({
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const token = TokenService.generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/unread-counts")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).not.toHaveProperty("message");
    });
  });
});
