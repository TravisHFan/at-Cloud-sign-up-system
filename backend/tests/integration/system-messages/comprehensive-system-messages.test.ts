/**
 * Comprehensive System Messages & Bell Notifications Integration Tests
 *
 * This test suite covers all 10 requirements for the System Messages and Bell Notification system:
 * 1. Read/Unread status toggle in System Messages page
 * 2. Permanent deletion in System Messages page (user-specific)
 * 3. Five message types with unique icons
 * 4. Create new messages (non-Participant roles only)
 * 5. Bell notification read/unread status with remove button
 * 6. Bell notification removal (independent from system messages)
 * 7. Persistence across page refreshes
 * 8. Auto-sync between system messages and bell notifications
 * 9. Auto-delete bell notifications when system message is deleted
 * 10. Navigation from bell notification to system message
 */

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

describe("System Messages & Bell Notifications - Complete Integration Tests", () => {
  let adminUser: any;
  let participantUser: any;
  let moderatorUser: any;
  let adminToken: string;
  let participantToken: string;
  let moderatorToken: string;
  let testSystemMessage: any;

  beforeAll(async () => {
    // Connect to test database
    if (!process.env.MONGODB_URI_TEST) {
      throw new Error("MONGODB_URI_TEST environment variable is not set");
    }
    await mongoose.connect(process.env.MONGODB_URI_TEST);

    // Create test users with different roles
    adminUser = await User.create({
      firstName: "Admin",
      lastName: "User",
      username: "admin-test",
      email: "admin@test.com",
      password: "Password123!",
      role: "Administrator",
      isActive: true,
      bellNotificationStates: [],
      systemMessageStates: [],
    });

    participantUser = await User.create({
      firstName: "Participant",
      lastName: "User",
      username: "participant-test",
      email: "participant@test.com",
      password: "Password123!",
      role: "Participant",
      isActive: true,
      bellNotificationStates: [],
      systemMessageStates: [],
    });

    moderatorUser = await User.create({
      firstName: "Moderator",
      lastName: "User",
      username: "moderator-test",
      email: "moderator@test.com",
      password: "Password123!",
      role: "Moderator",
      isActive: true,
      bellNotificationStates: [],
      systemMessageStates: [],
    });

    // Login users to get tokens
    const adminLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "admin-test", password: "Password123!" });
    adminToken = adminLogin.body.data.accessToken;

    const participantLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "participant-test", password: "Password123!" });
    participantToken = participantLogin.body.data.accessToken;

    const moderatorLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "moderator-test", password: "Password123!" });
    moderatorToken = moderatorLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await SystemMessage.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up before each test
    await SystemMessage.deleteMany({});

    // Reset user states
    await User.updateMany(
      {},
      {
        $set: {
          bellNotificationStates: [],
          systemMessageStates: [],
        },
      }
    );
  });

  describe("Requirement 1: System Messages Read/Unread Status", () => {
    beforeEach(async () => {
      // Create a test message for each test
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test System Message",
          content: "Test content for read/unread functionality",
          type: "announcement",
          priority: "medium",
        });
      testSystemMessage = response.body.data;
    });

    it("should show messages as unread by default", async () => {
      const response = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const messages = response.body.data.messages;
      const testMessage = messages.find(
        (msg: any) => msg.id === testSystemMessage.id
      );

      expect(testMessage).toBeTruthy();
      expect(testMessage.isRead).toBe(false);
      expect(testMessage.readAt).toBeUndefined();
    });

    it("should mark message as read when clicked", async () => {
      // Mark as read
      await request(app)
        .patch(`/api/v1/system-messages/${testSystemMessage.id}/read`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Verify it's marked as read
      const response = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const messages = response.body.data.messages;
      const testMessage = messages.find(
        (msg: any) => msg.id === testSystemMessage.id
      );

      expect(testMessage.isRead).toBe(true);
      expect(testMessage.readAt).toBeDefined();
    });

    it("should toggle read status correctly", async () => {
      // Mark as read first
      await request(app)
        .patch(`/api/v1/system-messages/${testSystemMessage.id}/read`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Mark as unread
      await request(app)
        .patch(`/api/v1/system-messages/${testSystemMessage.id}/unread`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Verify it's unread
      const response = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const messages = response.body.data.messages;
      const testMessage = messages.find(
        (msg: any) => msg.id === testSystemMessage.id
      );

      expect(testMessage.isRead).toBe(false);
    });
  });

  describe("Requirement 2: System Messages Permanent Deletion (User-Specific)", () => {
    beforeEach(async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test Delete Message",
          content: "Test content for deletion",
          type: "announcement",
          priority: "medium",
        });
      testSystemMessage = response.body.data;
    });

    it("should delete message for specific user only", async () => {
      // Delete for participant user
      await request(app)
        .delete(`/api/v1/system-messages/${testSystemMessage.id}`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Verify deleted for participant
      const participantResponse = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const participantMessages = participantResponse.body.data.messages;
      const deletedMessage = participantMessages.find(
        (msg: any) => msg.id === testSystemMessage.id
      );
      expect(deletedMessage).toBeFalsy();

      // Verify still visible for moderator
      const moderatorResponse = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${moderatorToken}`)
        .expect(200);

      const moderatorMessages = moderatorResponse.body.data.messages;
      const visibleMessage = moderatorMessages.find(
        (msg: any) => msg.id === testSystemMessage.id
      );
      expect(visibleMessage).toBeTruthy();
    });

    it("should require confirmation for deletion", async () => {
      // This tests the API layer - frontend confirmation is handled client-side
      const response = await request(app)
        .delete(`/api/v1/system-messages/${testSystemMessage.id}`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("deleted");
    });
  });

  describe("Requirement 3: Five Message Types with Unique Icons", () => {
    const messageTypes = [
      "announcement",
      "maintenance",
      "update",
      "warning",
      "auth_level_change",
    ];

    it("should create messages with all supported types", async () => {
      const createdMessages: any[] = [];

      for (const type of messageTypes) {
        const response = await request(app)
          .post("/api/v1/system-messages")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            title: `Test ${type} Message`,
            content: `Test content for ${type}`,
            type: type,
            priority: "medium",
          });

        expect(response.status).toBe(201);
        expect(response.body.data.type).toBe(type);
        createdMessages.push(response.body.data);
      }

      // Verify all types are visible to users
      const response = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const messages = response.body.data.messages;

      messageTypes.forEach((type) => {
        const typeMessage = messages.find((msg: any) => msg.type === type);
        expect(typeMessage).toBeTruthy();
        expect(typeMessage.type).toBe(type);
      });
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

  describe("Requirement 4: Create New Messages (Non-Participant Only)", () => {
    it("should allow Admin to create messages", async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Admin Created Message",
          content: "Message created by admin",
          type: "announcement",
          priority: "high",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.creator.role).toBe("Administrator");
    });

    it("should allow Moderator to create messages", async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${moderatorToken}`)
        .send({
          title: "Moderator Created Message",
          content: "Message created by moderator",
          type: "update",
          priority: "medium",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.creator.role).toBe("Moderator");
    });

    it("should prevent Participant from creating messages", async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .send({
          title: "Participant Message",
          content: "This should be rejected",
          type: "announcement",
          priority: "medium",
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Forbidden");
    });

    it("should send message to all users when created", async () => {
      // Create message as admin
      const createResponse = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Broadcast Message",
          content: "This should reach all users",
          type: "announcement",
          priority: "high",
        });

      const messageId = createResponse.body.data.id;

      // Verify all users can see it
      const users = [participantToken, moderatorToken, adminToken];

      for (const token of users) {
        const response = await request(app)
          .get("/api/v1/system-messages")
          .set("Authorization", `Bearer ${token}`)
          .expect(200);

        const messages = response.body.data.messages;
        const broadcastMessage = messages.find(
          (msg: any) => msg.id === messageId
        );
        expect(broadcastMessage).toBeTruthy();
        expect(broadcastMessage.title).toBe("Broadcast Message");
      }
    });
  });

  describe("Requirement 5: Bell Notification Read/Unread with Remove Button", () => {
    beforeEach(async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Bell Test Message",
          content: "Test content for bell notifications",
          type: "announcement",
          priority: "high",
        });
      testSystemMessage = response.body.data;
    });

    it("should show bell notifications as unread by default", async () => {
      const response = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const notifications = response.body.data.notifications;
      const testNotification = notifications.find(
        (n: any) => n.id === testSystemMessage.id
      );

      expect(testNotification).toBeTruthy();
      expect(testNotification.isRead).toBe(false);
      expect(testNotification.showRemoveButton).toBe(false);
    });

    it("should mark bell notification as read and show remove button", async () => {
      // Mark as read
      await request(app)
        .patch(
          `/api/v1/system-messages/bell-notifications/${testSystemMessage.id}/read`
        )
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Verify read status and remove button
      const response = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const notifications = response.body.data.notifications;
      const testNotification = notifications.find(
        (n: any) => n.id === testSystemMessage.id
      );

      expect(testNotification.isRead).toBe(true);
      expect(testNotification.showRemoveButton).toBe(true);
      expect(testNotification.readAt).toBeDefined();
    });

    it("should display creator information in bell notifications", async () => {
      const response = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const notifications = response.body.data.notifications;
      const testNotification = notifications.find(
        (n: any) => n.id === testSystemMessage.id
      );

      expect(testNotification.title).toContain("From Admin User");
      expect(testNotification.title).toContain("Administrator");
    });

    it("should update unread count correctly", async () => {
      // Check initial unread count
      let response = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      expect(response.body.data.unreadCount).toBe(1);

      // Mark as read
      await request(app)
        .patch(
          `/api/v1/system-messages/bell-notifications/${testSystemMessage.id}/read`
        )
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Check updated unread count
      response = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      expect(response.body.data.unreadCount).toBe(0);
    });
  });

  describe("Requirement 6: Bell Notification Removal (Independent)", () => {
    beforeEach(async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Removal Test Message",
          content: "Test content for removal",
          type: "announcement",
          priority: "medium",
        });
      testSystemMessage = response.body.data;

      // Mark as read first (required for removal)
      await request(app)
        .patch(
          `/api/v1/system-messages/bell-notifications/${testSystemMessage.id}/read`
        )
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);
    });

    it("should remove bell notification without affecting system message", async () => {
      // Remove bell notification
      await request(app)
        .delete(
          `/api/v1/system-messages/bell-notifications/${testSystemMessage.id}`
        )
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Verify removed from bell notifications
      const bellResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const notifications = bellResponse.body.data.notifications;
      const removedNotification = notifications.find(
        (n: any) => n.id === testSystemMessage.id
      );
      expect(removedNotification).toBeFalsy();

      // Verify still exists in system messages
      const systemResponse = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const messages = systemResponse.body.data.messages;
      const systemMessage = messages.find(
        (msg: any) => msg.id === testSystemMessage.id
      );
      expect(systemMessage).toBeTruthy();
      expect(systemMessage.isRead).toBe(true); // Should maintain read status
    });

    it("should not allow removal of unread bell notifications", async () => {
      // Create a new unread message
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Unread Message",
          content: "Should not be removable",
          type: "announcement",
          priority: "medium",
        });

      const unreadMessage = response.body.data;

      // Try to remove unread notification (should fail or not show remove button)
      const bellResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const notifications = bellResponse.body.data.notifications;
      const unreadNotification = notifications.find(
        (n: any) => n.id === unreadMessage.id
      );
      expect(unreadNotification.showRemoveButton).toBe(false);
    });
  });

  describe("Requirement 7: Persistence Across Page Refreshes", () => {
    beforeEach(async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Persistence Test Message",
          content: "Test content for persistence",
          type: "announcement",
          priority: "medium",
        });
      testSystemMessage = response.body.data;
    });

    it("should persist system message read status", async () => {
      // Mark as read
      await request(app)
        .patch(`/api/v1/system-messages/${testSystemMessage.id}/read`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Simulate page refresh by making fresh API calls
      const response = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const messages = response.body.data.messages;
      const persistedMessage = messages.find(
        (msg: any) => msg.id === testSystemMessage.id
      );
      expect(persistedMessage.isRead).toBe(true);
      expect(persistedMessage.readAt).toBeDefined();
    });

    it("should persist bell notification states", async () => {
      // Mark bell notification as read
      await request(app)
        .patch(
          `/api/v1/system-messages/bell-notifications/${testSystemMessage.id}/read`
        )
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Remove bell notification
      await request(app)
        .delete(
          `/api/v1/system-messages/bell-notifications/${testSystemMessage.id}`
        )
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Simulate page refresh - bell notification should stay removed
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

    it("should persist deletion state in system messages", async () => {
      // Delete system message
      await request(app)
        .delete(`/api/v1/system-messages/${testSystemMessage.id}`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Simulate page refresh - message should stay deleted
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
  });

  describe("Requirement 8: Auto-sync Between System Messages and Bell Notifications", () => {
    beforeEach(async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Sync Test Message",
          content: "Test content for sync",
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

      const notifications = response.body.data.notifications;
      const syncedNotification = notifications.find(
        (n: any) => n.id === testSystemMessage.id
      );
      expect(syncedNotification.isRead).toBe(true);
      expect(syncedNotification.showRemoveButton).toBe(true);
    });

    it("should sync bell notification read status to system message", async () => {
      // Mark bell notification as read
      await request(app)
        .patch(
          `/api/v1/system-messages/bell-notifications/${testSystemMessage.id}/read`
        )
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Check that system message is also marked as read
      const response = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const messages = response.body.data.messages;
      const syncedMessage = messages.find(
        (msg: any) => msg.id === testSystemMessage.id
      );
      expect(syncedMessage.isRead).toBe(true);
    });

    it("should maintain independent removal states", async () => {
      // Mark as read first
      await request(app)
        .patch(
          `/api/v1/system-messages/bell-notifications/${testSystemMessage.id}/read`
        )
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Remove bell notification
      await request(app)
        .delete(
          `/api/v1/system-messages/bell-notifications/${testSystemMessage.id}`
        )
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // System message should still be visible
      const response = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const messages = response.body.data.messages;
      const systemMessage = messages.find(
        (msg: any) => msg.id === testSystemMessage.id
      );
      expect(systemMessage).toBeTruthy();
      expect(systemMessage.isRead).toBe(true);
    });
  });

  describe("Requirement 9: Auto-delete Bell Notifications When System Message Deleted", () => {
    beforeEach(async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Auto-delete Test Message",
          content: "Test content for auto-delete",
          type: "announcement",
          priority: "medium",
        });
      testSystemMessage = response.body.data;
    });

    it("should auto-delete bell notification when system message is deleted", async () => {
      // Verify bell notification exists
      let bellResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      let notifications = bellResponse.body.data.notifications;
      let bellNotification = notifications.find(
        (n: any) => n.id === testSystemMessage.id
      );
      expect(bellNotification).toBeTruthy();

      // Delete system message
      await request(app)
        .delete(`/api/v1/system-messages/${testSystemMessage.id}`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Verify bell notification is also removed
      bellResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      notifications = bellResponse.body.data.notifications;
      bellNotification = notifications.find(
        (n: any) => n.id === testSystemMessage.id
      );
      expect(bellNotification).toBeFalsy();
    });

    it("should auto-delete read bell notifications when system message is deleted", async () => {
      // Mark bell notification as read
      await request(app)
        .patch(
          `/api/v1/system-messages/bell-notifications/${testSystemMessage.id}/read`
        )
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Delete system message
      await request(app)
        .delete(`/api/v1/system-messages/${testSystemMessage.id}`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Verify bell notification is removed regardless of read status
      const bellResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const notifications = bellResponse.body.data.notifications;
      const bellNotification = notifications.find(
        (n: any) => n.id === testSystemMessage.id
      );
      expect(bellNotification).toBeFalsy();
    });
  });

  describe("Requirement 10: Navigation from Bell Notification to System Message", () => {
    beforeEach(async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Navigation Test Message",
          content: "Test content for navigation",
          type: "announcement",
          priority: "medium",
        });
      testSystemMessage = response.body.data;
    });

    it("should provide correct message ID for navigation", async () => {
      const response = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const notifications = response.body.data.notifications;
      const testNotification = notifications.find(
        (n: any) => n.id === testSystemMessage.id
      );

      expect(testNotification).toBeTruthy();
      expect(testNotification.id).toBe(testSystemMessage.id);

      // Verify the same ID exists in system messages for navigation
      const systemResponse = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const messages = systemResponse.body.data.messages;
      const systemMessage = messages.find(
        (msg: any) => msg.id === testSystemMessage.id
      );
      expect(systemMessage).toBeTruthy();
      expect(systemMessage.id).toBe(testNotification.id);
    });

    it("should maintain message visibility for navigation after bell notification operations", async () => {
      // Mark bell notification as read
      await request(app)
        .patch(
          `/api/v1/system-messages/bell-notifications/${testSystemMessage.id}/read`
        )
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Remove bell notification
      await request(app)
        .delete(
          `/api/v1/system-messages/bell-notifications/${testSystemMessage.id}`
        )
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // System message should still be accessible for navigation
      const response = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const messages = response.body.data.messages;
      const systemMessage = messages.find(
        (msg: any) => msg.id === testSystemMessage.id
      );
      expect(systemMessage).toBeTruthy();
      expect(systemMessage.id).toBe(testSystemMessage.id);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle invalid message IDs gracefully", async () => {
      const invalidId = "invalid-message-id";

      // Test system message operations
      await request(app)
        .patch(`/api/v1/system-messages/${invalidId}/read`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(404);

      await request(app)
        .delete(`/api/v1/system-messages/${invalidId}`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(404);

      // Test bell notification operations
      await request(app)
        .patch(`/api/v1/system-messages/bell-notifications/${invalidId}/read`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(404);

      await request(app)
        .delete(`/api/v1/system-messages/bell-notifications/${invalidId}`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(404);
    });

    it("should handle unauthorized access", async () => {
      // Test without authentication
      await request(app).get("/api/v1/system-messages").expect(401);

      await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .expect(401);

      await request(app)
        .post("/api/v1/system-messages")
        .send({
          title: "Unauthorized Message",
          content: "Should be rejected",
          type: "announcement",
          priority: "medium",
        })
        .expect(401);
    });

    it("should handle concurrent operations correctly", async () => {
      // Create message
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Concurrent Test Message",
          content: "Test concurrent operations",
          type: "announcement",
          priority: "medium",
        });

      const messageId = response.body.data.id;

      // Simulate concurrent read operations
      const readPromises = [
        request(app)
          .patch(`/api/v1/system-messages/${messageId}/read`)
          .set("Authorization", `Bearer ${participantToken}`),
        request(app)
          .patch(`/api/v1/system-messages/bell-notifications/${messageId}/read`)
          .set("Authorization", `Bearer ${participantToken}`),
      ];

      const results = await Promise.all(readPromises);
      results.forEach((result) => {
        expect(result.status).toBe(200);
      });

      // Verify final state is consistent
      const finalResponse = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const messages = finalResponse.body.data.messages;
      const finalMessage = messages.find((msg: any) => msg.id === messageId);
      expect(finalMessage.isRead).toBe(true);
    });
  });

  describe("Mark All Read Functionality", () => {
    beforeEach(async () => {
      // Create multiple test messages
      const messagePromises: any[] = [];
      for (let i = 1; i <= 3; i++) {
        messagePromises.push(
          request(app)
            .post("/api/v1/system-messages")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({
              title: `Bulk Test Message ${i}`,
              content: `Test content ${i}`,
              type: "announcement",
              priority: "medium",
            })
        );
      }
      await Promise.all(messagePromises);
    });

    it("should mark all bell notifications as read", async () => {
      // Verify unread notifications exist
      let response = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      expect(response.body.data.unreadCount).toBeGreaterThan(0);

      // Mark all as read
      await request(app)
        .patch("/api/v1/system-messages/bell-notifications/read-all")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Verify all are marked as read
      response = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      expect(response.body.data.unreadCount).toBe(0);
      response.body.data.notifications.forEach((notification: any) => {
        expect(notification.isRead).toBe(true);
        expect(notification.showRemoveButton).toBe(true);
      });
    });
  });
});
