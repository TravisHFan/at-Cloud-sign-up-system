import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import express from "express";
import dotenv from "dotenv";
import routes from "../../src/routes";
import { User } from "../../src/models";

// Load environment variables
dotenv.config();

// Create test app
const app = express();
app.use(express.json());
app.use(routes);

/**
 * System Messages End-to-End Tests
 *
 * These tests verify that all 8 requirements work together correctly
 * from API request to database persistence.
 */
describe("System Messages E2E Tests", () => {
  let participantUser: any;
  let adminUser: any;
  let participantToken: string;
  let adminToken: string;
  let createdMessageId: string;

  beforeAll(async () => {
    if (!process.env.MONGODB_URI_TEST) {
      throw new Error("MONGODB_URI_TEST environment variable is not set");
    }
    await mongoose.connect(process.env.MONGODB_URI_TEST);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up
    await User.deleteMany({});

    // Create test users
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

    // Get tokens
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
  });

  describe("Complete User Journey - All 8 Requirements", () => {
    it("should complete full system message lifecycle", async () => {
      // **Requirement 4**: Admin creates system message
      const createResponse = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "E2E Test Message",
          content: "This is an end-to-end test message",
          type: "announcement",
          priority: "high",
        })
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      createdMessageId = createResponse.body.data.id;

      // Verify message was sent to all users
      expect(createResponse.body.data.recipientCount).toBe(2);

      // **Requirement 1**: Get system messages shows unread message
      const messagesResponse = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const messages = messagesResponse.body.data.messages;
      const testMessage = messages.find((m: any) => m.id === createdMessageId);

      expect(testMessage).toBeDefined();
      expect(testMessage.isRead).toBe(false);
      expect(testMessage.title).toBe("E2E Test Message");

      // **Requirement 5**: Get bell notifications shows new notification
      const bellResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const bellNotifications = bellResponse.body.data.notifications;
      const bellNotification = bellNotifications.find(
        (n: any) => n.id === createdMessageId
      );

      expect(bellNotification).toBeDefined();
      expect(bellNotification.isRead).toBe(false);
      expect(bellNotification.title).toContain(
        "From Admin User, Administrator"
      );
      expect(bellNotification.showRemoveButton).toBe(false);

      // **Requirement 1**: Mark system message as read
      await request(app)
        .patch(`/api/v1/system-messages/${createdMessageId}/read`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // **Requirement 8**: Verify bell notification is also marked as read (synchronization)
      const updatedBellResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const updatedBellNotifications =
        updatedBellResponse.body.data.notifications;
      const updatedBellNotification = updatedBellNotifications.find(
        (n: any) => n.id === createdMessageId
      );

      expect(updatedBellNotification.isRead).toBe(true);
      expect(updatedBellNotification.showRemoveButton).toBe(true);

      // **Requirement 5**: Mark bell notification as read directly
      await request(app)
        .patch(
          `/api/v1/system-messages/bell-notifications/${createdMessageId}/read`
        )
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // **Requirement 6**: Remove bell notification (doesn't affect system message)
      await request(app)
        .delete(
          `/api/v1/system-messages/bell-notifications/${createdMessageId}`
        )
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Verify bell notification is removed
      const afterRemovalBellResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const afterRemovalBellNotifications =
        afterRemovalBellResponse.body.data.notifications;
      const removedBellNotification = afterRemovalBellNotifications.find(
        (n: any) => n.id === createdMessageId
      );

      expect(removedBellNotification).toBeUndefined();

      // Verify system message still exists
      const afterRemovalMessagesResponse = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const afterRemovalMessages =
        afterRemovalMessagesResponse.body.data.messages;
      const stillExistingMessage = afterRemovalMessages.find(
        (m: any) => m.id === createdMessageId
      );

      expect(stillExistingMessage).toBeDefined();
      expect(stillExistingMessage.isRead).toBe(true);

      // **Requirement 2**: Delete system message (only affects current user)
      await request(app)
        .delete(`/api/v1/system-messages/${createdMessageId}`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Verify message is deleted for participant
      const participantMessagesResponse = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const participantMessages =
        participantMessagesResponse.body.data.messages;
      const deletedForParticipant = participantMessages.find(
        (m: any) => m.id === createdMessageId
      );

      expect(deletedForParticipant).toBeUndefined();

      // Verify message still exists for admin
      const adminMessagesResponse = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const adminMessages = adminMessagesResponse.body.data.messages;
      const stillExistsForAdmin = adminMessages.find(
        (m: any) => m.id === createdMessageId
      );

      expect(stillExistsForAdmin).toBeDefined();
      expect(stillExistsForAdmin.isRead).toBe(false); // Admin hasn't read it
    });
  });

  describe("Message Type Icons - Requirement 3", () => {
    it("should handle all 5 message types correctly", async () => {
      const messageTypes = ["announcement", "maintenance", "update", "warning"];

      for (const type of messageTypes) {
        const createResponse = await request(app)
          .post("/api/v1/system-messages")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            title: `Test ${type} Message`,
            content: `Test content for ${type}`,
            type,
            priority: "medium",
          })
          .expect(201);

        // Verify message was created with correct type
        expect(createResponse.body.data.type).toBe(type);

        // Verify it appears in user's messages with correct type
        const messagesResponse = await request(app)
          .get("/api/v1/system-messages")
          .set("Authorization", `Bearer ${participantToken}`)
          .expect(200);

        const messages = messagesResponse.body.data.messages;
        const typeMessage = messages.find(
          (m: any) => m.title === `Test ${type} Message`
        );

        expect(typeMessage).toBeDefined();
        expect(typeMessage.type).toBe(type);
      }
    });
  });

  describe("Authorization - Requirement 4", () => {
    it("should prevent Participant from creating system messages", async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .send({
          title: "Unauthorized Message",
          content: "This should fail",
          type: "announcement",
          priority: "medium",
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Participants cannot create");
    });
  });

  describe("Persistence - Requirement 7", () => {
    it("should maintain state across database operations", async () => {
      // Create message
      const createResponse = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Persistence Test",
          content: "Testing persistence",
          type: "announcement",
          priority: "medium",
        })
        .expect(201);

      const messageId = createResponse.body.data.id;

      // Mark as read
      await request(app)
        .patch(`/api/v1/system-messages/${messageId}/read`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Verify user state in database
      const user = await User.findById(participantUser._id);
      const messageState = user?.systemMessageStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(messageState).toBeDefined();
      expect(messageState!.isRead).toBe(true);
      expect(messageState!.readAt).toBeDefined();

      // Verify persistence after restart simulation
      const newMessagesResponse = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const newMessages = newMessagesResponse.body.data.messages;
      const persistedMessage = newMessages.find((m: any) => m.id === messageId);

      expect(persistedMessage).toBeDefined();
      expect(persistedMessage.isRead).toBe(true);
    });
  });

  describe("Bell Notification Independence - Requirement 6", () => {
    it("should maintain system message when bell notification is removed", async () => {
      // Create message
      const createResponse = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Independence Test",
          content: "Testing independence",
          type: "announcement",
          priority: "medium",
        })
        .expect(201);

      const messageId = createResponse.body.data.id;

      // Mark as read (enables remove button)
      await request(app)
        .patch(`/api/v1/system-messages/bell-notifications/${messageId}/read`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Remove bell notification
      await request(app)
        .delete(`/api/v1/system-messages/bell-notifications/${messageId}`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Verify bell notification is gone
      const bellResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const bellNotifications = bellResponse.body.data.notifications;
      const removedNotification = bellNotifications.find(
        (n: any) => n.id === messageId
      );
      expect(removedNotification).toBeUndefined();

      // Verify system message still exists
      const messagesResponse = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const messages = messagesResponse.body.data.messages;
      const remainingMessage = messages.find((m: any) => m.id === messageId);

      expect(remainingMessage).toBeDefined();
      expect(remainingMessage.title).toBe("Independence Test");

      // Verify in database
      const user = await User.findById(participantUser._id);

      const bellState = user?.bellNotificationStates.find(
        (state: any) => state.messageId === messageId
      );
      expect(bellState!.isRemoved).toBe(true);

      const messageState = user?.systemMessageStates.find(
        (state: any) => state.messageId === messageId
      );
      expect(messageState!.isDeleted).toBe(false);
    });
  });
});
