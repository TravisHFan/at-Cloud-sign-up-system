import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import express from "express";
import { User, SystemMessage } from "../../../src/models";
import routes from "../../../src/routes";

// Create test app
const app = express();
app.use(express.json());
app.use(routes);

describe("System Messages API", () => {
  let participantUser: any;
  let adminUser: any;
  let superAdminUser: any;
  let participantToken: string;
  let adminToken: string;
  let superAdminToken: string;
  let testSystemMessage: any;

  beforeAll(async () => {
    // Connect to test database
    if (!process.env.MONGODB_URI_TEST) {
      throw new Error("MONGODB_URI_TEST environment variable is not set");
    }
    await mongoose.connect(process.env.MONGODB_URI_TEST);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up before each test
    await User.deleteMany({});
    await SystemMessage.deleteMany({});

    // Create test users with different roles
    participantUser = await User.create({
      username: "participant",
      email: "participant@test.com",
      password: "ParticipantPass123",
      firstName: "John",
      lastName: "Participant",
      role: "Participant",
      isVerified: true,
      isActive: true,
    });

    adminUser = await User.create({
      username: "admin",
      email: "admin@test.com",
      password: "AdminPass123",
      firstName: "Admin",
      lastName: "User",
      role: "Administrator",
      isVerified: true,
      isActive: true,
    });

    superAdminUser = await User.create({
      username: "superadmin",
      email: "superadmin@test.com",
      password: "SuperAdminPass123",
      firstName: "Super",
      lastName: "Admin",
      role: "Super Admin",
      isVerified: true,
      isActive: true,
    });

    // Get authentication tokens
    const participantLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({
        emailOrUsername: "participant@test.com",
        password: "ParticipantPass123",
      });
    participantToken = participantLogin.body.data.accessToken;

    const adminLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ emailOrUsername: "admin@test.com", password: "AdminPass123" });
    adminToken = adminLogin.body.data.accessToken;

    const superAdminLogin = await request(app).post("/api/v1/auth/login").send({
      emailOrUsername: "superadmin@test.com",
      password: "SuperAdminPass123",
    });
    superAdminToken = superAdminLogin.body.data.accessToken;
  });

  afterEach(async () => {
    // Clean up after each test
    await User.deleteMany({});
    await SystemMessage.deleteMany({});
  });

  describe("GET /api/v1/system-messages", () => {
    it("should get system messages for authenticated user", async () => {
      const response = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.messages).toBeInstanceOf(Array);
    });

    it("should require authentication", async () => {
      await request(app).get("/api/v1/system-messages").expect(401);
    });

    it("should filter by message type", async () => {
      // Create a test system message first
      await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test Announcement",
          content: "Test content",
          type: "announcement",
          priority: "medium",
        });

      const response = await request(app)
        .get("/api/v1/system-messages?type=announcement")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.messages.forEach((msg: any) => {
        expect(msg.type).toBe("announcement");
      });
    });
  });

  describe("POST /api/v1/system-messages - Requirement 4", () => {
    const validMessageData = {
      title: "Test System Message",
      content: "This is a test system message content",
      type: "announcement",
      priority: "medium",
    };

    it("should allow Administrator to create system message", async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(validMessageData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(validMessageData.title);
      expect(response.body.data.recipientCount).toBeGreaterThan(0);
    });

    it("should allow Super Admin to create system message", async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send(validMessageData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(validMessageData.title);
    });

    it("should prevent Participant from creating system message", async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .send(validMessageData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Participants cannot create");
    });

    it("should validate required fields", async () => {
      const invalidData = { title: "", content: "", type: "invalid" };

      await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(400);
    });

    it("should support all message types", async () => {
      const messageTypes = ["announcement", "maintenance", "update", "warning"];

      for (const type of messageTypes) {
        const response = await request(app)
          .post("/api/v1/system-messages")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ ...validMessageData, type, title: `Test ${type}` })
          .expect(201);

        expect(response.body.data.type).toBe(type);
      }
    });

    it("should send message to all users when created", async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(validMessageData)
        .expect(201);

      // Check that all users received the message in their state
      const users = await User.find({});
      for (const user of users) {
        const hasMessageState = user.systemMessageStates.some(
          (state: any) => state.messageId === response.body.data.id
        );
        expect(hasMessageState).toBe(true);

        const hasBellNotificationState = user.bellNotificationStates.some(
          (state: any) => state.messageId === response.body.data.id
        );
        expect(hasBellNotificationState).toBe(true);
      }
    });
  });

  describe("PATCH /api/v1/system-messages/:messageId/read - Requirement 1", () => {
    beforeEach(async () => {
      // Create a test system message
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test Message for Reading",
          content: "Test content",
          type: "announcement",
          priority: "medium",
        });
      testSystemMessage = response.body.data;
    });

    it("should mark system message as read", async () => {
      const response = await request(app)
        .patch(`/api/v1/system-messages/${testSystemMessage.id}/read`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("marked as read");

      // Verify the message is marked as read in user's state
      const user = await User.findById(participantUser._id);
      const messageState = user?.systemMessageStates.find(
        (state: any) => state.messageId === testSystemMessage.id
      );
      expect(messageState?.isRead).toBe(true);
      expect(messageState?.readAt).toBeDefined();
    });

    it("should sync read status with bell notification (Requirement 8)", async () => {
      await request(app)
        .patch(`/api/v1/system-messages/${testSystemMessage.id}/read`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Check that bell notification is also marked as read
      const user = await User.findById(participantUser._id);
      const bellState = user?.bellNotificationStates.find(
        (state: any) => state.messageId === testSystemMessage.id
      );
      expect(bellState?.isRead).toBe(true);
    });

    it("should handle non-existent message ID", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .patch(`/api/v1/system-messages/${fakeId}/read`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(404);
    });
  });

  describe("DELETE /api/v1/system-messages/:messageId - Requirement 2", () => {
    beforeEach(async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test Message for Deletion",
          content: "Test content",
          type: "announcement",
          priority: "medium",
        });
      testSystemMessage = response.body.data;
    });

    it("should delete system message from user view only", async () => {
      const response = await request(app)
        .delete(`/api/v1/system-messages/${testSystemMessage.id}`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("deleted from your view");

      // Verify message is marked as deleted for this user only
      const user = await User.findById(participantUser._id);
      const messageState = user?.systemMessageStates.find(
        (state: any) => state.messageId === testSystemMessage.id
      );
      expect(messageState?.isDeleted).toBe(true);

      // Verify message still exists for other users
      const otherUser = await User.findById(adminUser._id);
      const otherMessageState = otherUser?.systemMessageStates.find(
        (state: any) => state.messageId === testSystemMessage.id
      );
      expect(otherMessageState?.isDeleted).toBe(false);

      // Verify message still exists in SystemMessage collection
      const systemMessage = await SystemMessage.findById(testSystemMessage.id);
      expect(systemMessage).toBeTruthy();
    });

    it("should not affect other users when one user deletes", async () => {
      // User 1 deletes the message
      await request(app)
        .delete(`/api/v1/system-messages/${testSystemMessage.id}`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // User 2 should still see the message
      const response = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const messages = response.body.data.messages;
      const foundMessage = messages.find(
        (msg: any) => msg.id === testSystemMessage.id
      );
      expect(foundMessage).toBeTruthy();
      expect(foundMessage.isDeleted).toBe(false);
    });
  });

  describe("Bell Notifications API - Requirements 5-6", () => {
    beforeEach(async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test Bell Notification",
          content: "Test content for bell",
          type: "announcement",
          priority: "high",
        });
      testSystemMessage = response.body.data;
    });

    describe("GET /api/v1/system-messages/bell-notifications", () => {
      it("should get bell notifications for user", async () => {
        const response = await request(app)
          .get("/api/v1/system-messages/bell-notifications")
          .set("Authorization", `Bearer ${participantToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.notifications).toBeInstanceOf(Array);
        expect(response.body.data.unreadCount).toBeDefined();

        // Should contain the test message
        const notifications = response.body.data.notifications;
        const testNotification = notifications.find(
          (n: any) => n.id === testSystemMessage.id
        );
        expect(testNotification).toBeTruthy();
        expect(testNotification.title).toContain("From Admin User");
        expect(testNotification.isRead).toBe(false);
      });
    });

    describe("PATCH /api/v1/system-messages/bell-notifications/:messageId/read - Requirement 5", () => {
      it("should mark bell notification as read", async () => {
        const response = await request(app)
          .patch(
            `/api/v1/system-messages/bell-notifications/${testSystemMessage.id}/read`
          )
          .set("Authorization", `Bearer ${participantToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify bell notification state is updated
        const user = await User.findById(participantUser._id);
        const bellState = user?.bellNotificationStates.find(
          (state: any) => state.messageId === testSystemMessage.id
        );
        expect(bellState?.isRead).toBe(true);
        expect(bellState?.readAt).toBeDefined();
      });

      it("should show remove button after marking as read", async () => {
        // Mark as read
        await request(app)
          .patch(
            `/api/v1/system-messages/bell-notifications/${testSystemMessage.id}/read`
          )
          .set("Authorization", `Bearer ${participantToken}`)
          .expect(200);

        // Get notifications again
        const response = await request(app)
          .get("/api/v1/system-messages/bell-notifications")
          .set("Authorization", `Bearer ${participantToken}`)
          .expect(200);

        const notifications = response.body.data.notifications;
        const testNotification = notifications.find(
          (n: any) => n.id === testSystemMessage.id
        );
        expect(testNotification.showRemoveButton).toBe(true);
      });
    });

    describe("DELETE /api/v1/system-messages/bell-notifications/:messageId - Requirement 6", () => {
      it("should remove bell notification without affecting system message", async () => {
        const response = await request(app)
          .delete(
            `/api/v1/system-messages/bell-notifications/${testSystemMessage.id}`
          )
          .set("Authorization", `Bearer ${participantToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain("removed");

        // Verify bell notification is removed
        const user = await User.findById(participantUser._id);
        const bellState = user?.bellNotificationStates.find(
          (state: any) => state.messageId === testSystemMessage.id
        );
        expect(bellState?.isRemoved).toBe(true);

        // Verify system message still exists in user's system messages
        const messageState = user?.systemMessageStates.find(
          (state: any) => state.messageId === testSystemMessage.id
        );
        expect(messageState?.isDeleted).toBe(false);

        // Verify system message page still shows the message
        const messagesResponse = await request(app)
          .get("/api/v1/system-messages")
          .set("Authorization", `Bearer ${participantToken}`)
          .expect(200);

        const messages = messagesResponse.body.data.messages;
        const foundMessage = messages.find(
          (msg: any) => msg.id === testSystemMessage.id
        );
        expect(foundMessage).toBeTruthy();
      });

      it("should not appear in bell notifications after removal", async () => {
        // Remove the bell notification
        await request(app)
          .delete(
            `/api/v1/system-messages/bell-notifications/${testSystemMessage.id}`
          )
          .set("Authorization", `Bearer ${participantToken}`)
          .expect(200);

        // Check bell notifications no longer include it
        const response = await request(app)
          .get("/api/v1/system-messages/bell-notifications")
          .set("Authorization", `Bearer ${participantToken}`)
          .expect(200);

        const notifications = response.body.data.notifications;
        const removedNotification = notifications.find(
          (n: any) => n.id === testSystemMessage.id
        );
        expect(removedNotification).toBeFalsy();
      });
    });
  });

  describe("Message Types and Icons - Requirement 3", () => {
    const messageTypes = [
      "announcement",
      "maintenance",
      "update",
      "warning",
      "auth_level_change",
    ];

    it("should support all required message types", async () => {
      for (const type of messageTypes.slice(0, 4)) {
        // Skip auth_level_change for manual creation
        const response = await request(app)
          .post("/api/v1/system-messages")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            title: `Test ${type} Message`,
            content: `Test content for ${type}`,
            type,
            priority: "medium",
          })
          .expect(201);

        expect(response.body.data.type).toBe(type);
      }
    });

    it("should reject invalid message types", async () => {
      await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Invalid Type Message",
          content: "Test content",
          type: "invalid_type",
          priority: "medium",
        })
        .expect(400);
    });
  });

  describe("Persistent State - Requirement 7", () => {
    beforeEach(async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Persistence Test Message",
          content: "Test content",
          type: "announcement",
          priority: "medium",
        });
      testSystemMessage = response.body.data;
    });

    it("should persist read status across requests", async () => {
      // Mark as read
      await request(app)
        .patch(`/api/v1/system-messages/${testSystemMessage.id}/read`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Check persistence in system messages
      const messagesResponse = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const message = messagesResponse.body.data.messages.find(
        (msg: any) => msg.id === testSystemMessage.id
      );
      expect(message.isRead).toBe(true);

      // Check persistence in bell notifications
      const bellResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const bellNotification = bellResponse.body.data.notifications.find(
        (n: any) => n.id === testSystemMessage.id
      );
      expect(bellNotification.isRead).toBe(true);
    });

    it("should persist deletion status across requests", async () => {
      // Delete message
      await request(app)
        .delete(`/api/v1/system-messages/${testSystemMessage.id}`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Check message is not returned in subsequent requests
      const response = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const messages = response.body.data.messages;
      const deletedMessage = messages.find(
        (msg: any) => msg.id === testSystemMessage.id
      );
      expect(deletedMessage).toBeFalsy();
    });

    it("should persist bell notification removal across requests", async () => {
      // Remove bell notification
      await request(app)
        .delete(
          `/api/v1/system-messages/bell-notifications/${testSystemMessage.id}`
        )
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Check bell notification is not returned
      const response = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const notifications = response.body.data.notifications;
      const removedNotification = notifications.find(
        (n: any) => n.id === testSystemMessage.id
      );
      expect(removedNotification).toBeFalsy();
    });
  });

  describe("Synchronization - Requirement 8", () => {
    beforeEach(async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Sync Test Message",
          content: "Test content",
          type: "announcement",
          priority: "medium",
        });
      testSystemMessage = response.body.data;
    });

    it("should sync system message read status to bell notification", async () => {
      // Mark system message as read
      await request(app)
        .patch(`/api/v1/system-messages/${testSystemMessage.id}/read`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Check that bell notification is also marked as read
      const response = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const bellNotification = response.body.data.notifications.find(
        (n: any) => n.id === testSystemMessage.id
      );
      expect(bellNotification.isRead).toBe(true);
      expect(bellNotification.showRemoveButton).toBe(true);
    });

    it("should maintain independent bell notification removal", async () => {
      // Remove bell notification
      await request(app)
        .delete(
          `/api/v1/system-messages/bell-notifications/${testSystemMessage.id}`
        )
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // System message should still be unread and visible
      const response = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const message = response.body.data.messages.find(
        (msg: any) => msg.id === testSystemMessage.id
      );
      expect(message).toBeTruthy();
      expect(message.isRead).toBe(false);
    });
  });
});
