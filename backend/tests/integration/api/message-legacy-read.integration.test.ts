import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../../src/app";
import { ensureIntegrationDB } from "../setup/connect";
import Message from "../../../src/models/Message";
import User from "../../../src/models/User";
import { TokenService } from "../../../src/middleware/auth";

describe("PATCH /api/notifications/system/:messageId/read - LegacyMessageReadController", () => {
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
      const messageId = new mongoose.Types.ObjectId().toString();
      const response = await request(app).patch(
        `/api/notifications/system/${messageId}/read`
      );
      expect(response.status).toBe(401);
    });

    it("should return 401 if token is invalid", async () => {
      const messageId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .patch(`/api/notifications/system/${messageId}/read`)
        .set("Authorization", "Bearer invalid-token");
      expect(response.status).toBe(401);
    });
  });

  describe("Validation", () => {
    it("should return 400 if messageId is not a valid ObjectId", async () => {
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
        .patch("/api/notifications/system/invalid-id/read")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid message ID");
    });

    it("should return 404 for route with double slashes (empty messageId)", async () => {
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
        .patch("/api/notifications/system//read")
        .set("Authorization", `Bearer ${token}`);

      // Express collapses double slashes, making this a 404 (route not found)
      expect(response.status).toBe(404);
    });
  });

  describe("Not Found", () => {
    it("should return 404 if message does not exist", async () => {
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

      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .patch(`/api/notifications/system/${nonExistentId}/read`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Message not found");
    });
  });

  describe("Success Cases", () => {
    it("should mark message as read successfully", async () => {
      const user = await User.create({
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const message = await Message.create({
        title: "Test Message",
        content: "This is a test message",
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
        .patch(`/api/notifications/system/${message._id.toString()}/read`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Message marked as read");
    });

    it("should update message userStates after marking as read", async () => {
      const user = await User.create({
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const message = await Message.create({
        title: "Test Message",
        content: "This is a test message",
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

      await request(app)
        .patch(`/api/notifications/system/${message._id.toString()}/read`)
        .set("Authorization", `Bearer ${token}`);

      // Verify message was updated in database
      const updatedMessage = await Message.findById(message._id);
      expect(updatedMessage).toBeTruthy();

      const userState = updatedMessage!.getUserState(user._id.toString());
      expect(userState.isReadInBell).toBe(true);
      expect(userState.isReadInSystem).toBe(true);
      expect(userState.readInBellAt).toBeTruthy();
      expect(userState.readInSystemAt).toBeTruthy();
    });

    it("should work with different message types", async () => {
      const user = await User.create({
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const messageTypes = ["announcement", "maintenance", "update", "warning"];

      const token = TokenService.generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      for (const type of messageTypes) {
        const message = await Message.create({
          title: `Test ${type}`,
          content: `Content for ${type}`,
          type,
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

        const response = await request(app)
          .patch(`/api/notifications/system/${message._id.toString()}/read`)
          .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle marking an already-read message as read", async () => {
      const user = await User.create({
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const message = await Message.create({
        title: "Test Message",
        content: "This is a test message",
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

      // Mark as read first time
      await request(app)
        .patch(`/api/notifications/system/${message._id.toString()}/read`)
        .set("Authorization", `Bearer ${token}`);

      // Mark as read again
      const response = await request(app)
        .patch(`/api/notifications/system/${message._id.toString()}/read`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Message marked as read");
    });

    it("should handle marking inactive message as read", async () => {
      const user = await User.create({
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const message = await Message.create({
        title: "Inactive Message",
        content: "This message is inactive",
        type: "announcement",
        priority: "low",
        creator: {
          id: "admin123",
          firstName: "Admin",
          lastName: "User",
          username: "admin",
          gender: "male",
          authLevel: "Administrator",
        },
        isActive: false,
        userStates: new Map(),
      });

      const token = TokenService.generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .patch(`/api/notifications/system/${message._id.toString()}/read`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it("should handle marking expired message as read", async () => {
      const user = await User.create({
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const message = await Message.create({
        title: "Expired Message",
        content: "This message has expired",
        type: "announcement",
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
        expiresAt: pastDate,
        userStates: new Map(),
      });

      const token = TokenService.generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .patch(`/api/notifications/system/${message._id.toString()}/read`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it("should handle multiple users marking the same message as read", async () => {
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

      const message = await Message.create({
        title: "Shared Message",
        content: "Multiple users can read this",
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

      const token1 = TokenService.generateAccessToken({
        userId: user1._id.toString(),
        email: user1.email,
        role: user1.role,
      });

      const token2 = TokenService.generateAccessToken({
        userId: user2._id.toString(),
        email: user2.email,
        role: user2.role,
      });

      // User 1 marks as read
      const response1 = await request(app)
        .patch(`/api/notifications/system/${message._id.toString()}/read`)
        .set("Authorization", `Bearer ${token1}`);

      // User 2 marks as read
      const response2 = await request(app)
        .patch(`/api/notifications/system/${message._id.toString()}/read`)
        .set("Authorization", `Bearer ${token2}`);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Verify both users have read states
      const updatedMessage = await Message.findById(message._id);
      const user1State = updatedMessage!.getUserState(user1._id.toString());
      const user2State = updatedMessage!.getUserState(user2._id.toString());

      expect(user1State.isReadInBell).toBe(true);
      expect(user1State.isReadInSystem).toBe(true);
      expect(user2State.isReadInBell).toBe(true);
      expect(user2State.isReadInSystem).toBe(true);
    });

    it("should preserve existing userStates when marking as read", async () => {
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

      const message = await Message.create({
        title: "Message with Existing States",
        content: "Already has user states",
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
            user1._id.toString(),
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

      const token2 = TokenService.generateAccessToken({
        userId: user2._id.toString(),
        email: user2.email,
        role: user2.role,
      });

      // User 2 marks as read
      await request(app)
        .patch(`/api/notifications/system/${message._id.toString()}/read`)
        .set("Authorization", `Bearer ${token2}`);

      // Verify user1's state is preserved
      const updatedMessage = await Message.findById(message._id);
      const user1State = updatedMessage!.getUserState(user1._id.toString());
      const user2State = updatedMessage!.getUserState(user2._id.toString());

      expect(user1State.isReadInBell).toBe(true);
      expect(user1State.isReadInSystem).toBe(false); // Preserved
      expect(user2State.isReadInBell).toBe(true);
      expect(user2State.isReadInSystem).toBe(true);
    });
  });
});
