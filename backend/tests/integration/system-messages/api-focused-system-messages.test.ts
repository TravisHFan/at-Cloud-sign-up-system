/**
 * System Messages & Bell Notifications API Integration Tests
 *
 * This test suite focuses on testing the actual API endpoints that are working
 * in your system to systematically identify bugs in the System Messages and
 * Bell Notification functionality.
 *
 * Based on analysis of your existing controllers:
 * - UnifiedMessageController
 * - SystemMessageController
 * - Existing API routes: /api/v1/system-messages/*
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

describe("System Messages & Bell Notifications API Tests", () => {
  let adminUser: any;
  let participantUser: any;
  let adminToken: string;
  let participantToken: string;
  // Note: testSystemMessage is now created locally in each test block that needs it

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

    // Create test users with correct password format
    adminUser = await User.create({
      firstName: "Admin",
      lastName: "User",
      username: "admin-test",
      email: "admin@test.com",
      password: "TestPassword123!",
      gender: "male", // Required by Message model
      role: "Administrator",
      isActive: true,
      isVerified: true,
    });

    participantUser = await User.create({
      firstName: "Participant",
      lastName: "User",
      username: "participant-test",
      email: "participant@test.com",
      password: "TestPassword123!",
      gender: "female", // Required by Message model
      role: "Participant",
      isActive: true,
      isVerified: true,
    });

    // Login users to get tokens
    const adminLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ emailOrUsername: "admin-test", password: "TestPassword123!" });

    const participantLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({
        emailOrUsername: "participant-test",
        password: "TestPassword123!",
      });

    adminToken = adminLogin.body.data.accessToken;
    participantToken = participantLogin.body.data.accessToken;
  });

  afterEach(async () => {
    await User.deleteMany({});
    await SystemMessage.deleteMany({});
  });

  describe("REQUIREMENT 1: System Messages Read/Unread Status", () => {
    let testSystemMessage: any;

    beforeEach(async () => {
      // Create a test system message
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test Read/Unread Message",
          content: "Testing read/unread functionality",
          type: "announcement",
          priority: "medium",
        });
      testSystemMessage = response.body.data;
    });

    it("should show system messages as unread by default", async () => {
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
      expect(testMessage.readAt).toBeNull();

      console.log("✅ REQUIREMENT 1.1: Messages show as unread by default");
    });

    it("should mark system message as read when API is called", async () => {
      // Mark as read
      const markReadResponse = await request(app)
        .patch(`/api/v1/system-messages/${testSystemMessage.id}/read`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      expect(markReadResponse.body.success).toBe(true);

      // Verify it's marked as read
      const getResponse = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const messages = getResponse.body.data.messages;
      const testMessage = messages.find(
        (msg: any) => msg.id === testSystemMessage.id
      );

      expect(testMessage.isRead).toBe(true);
      expect(testMessage.readAt).toBeTruthy();

      console.log("✅ REQUIREMENT 1.2: Messages can be marked as read");
    });

    it("should mark system message as unread when API is called", async () => {
      // Mark as read first
      await request(app)
        .patch(`/api/v1/system-messages/${testSystemMessage.id}/read`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      // Mark as unread
      const markUnreadResponse = await request(app)
        .patch(`/api/v1/system-messages/${testSystemMessage.id}/unread`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      expect(markUnreadResponse.body.success).toBe(true);

      // Verify it's marked as unread
      const getResponse = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const messages = getResponse.body.data.messages;
      const testMessage = messages.find(
        (msg: any) => msg.id === testSystemMessage.id
      );

      expect(testMessage.isRead).toBe(false);

      console.log("✅ REQUIREMENT 1.3: Messages can be toggled back to unread");
    });
  });

  describe("REQUIREMENT 2: System Messages Permanent Deletion (User-Specific)", () => {
    let testSystemMessage: any;

    beforeEach(async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test Delete Message",
          content: "Testing deletion functionality",
          type: "announcement",
          priority: "medium",
        });
      testSystemMessage = response.body.data.message;
    });

    it("should delete system message for specific user only", async () => {
      // Delete for participant user
      const deleteResponse = await request(app)
        .delete(`/api/v1/system-messages/${testSystemMessage.id}`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);

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

      // Verify still visible for admin
      const adminResponse = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const adminMessages = adminResponse.body.data.messages;
      const visibleMessage = adminMessages.find(
        (msg: any) => msg.id === testSystemMessage.id
      );
      expect(visibleMessage).toBeTruthy();

      console.log("✅ REQUIREMENT 2: User-specific deletion works correctly");
    });
  });

  describe("REQUIREMENT 3: Five Message Types", () => {
    const messageTypes = [
      "announcement",
      "maintenance",
      "update",
      "warning",
      "auth_level_change",
    ];

    it("should create and retrieve all supported message types", async () => {
      // Create messages of each type
      for (const type of messageTypes) {
        const response = await request(app)
          .post("/api/v1/system-messages")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            title: `Test ${type} Message`,
            content: `Testing ${type} message type`,
            type: type,
            priority: "medium",
          });

        expect(response.status).toBe(201);
        expect(response.body.data.type).toBe(type);
      }

      // Retrieve and verify all types
      const getResponse = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const messages = getResponse.body.data.messages;

      messageTypes.forEach((type) => {
        const typeMessage = messages.find((msg: any) => msg.type === type);
        expect(typeMessage).toBeTruthy();
        expect(typeMessage.type).toBe(type);
      });

      console.log("✅ REQUIREMENT 3: All five message types work correctly");
    });

    it("should reject invalid message types", async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Invalid Type Message",
          content: "This should fail",
          type: "invalid_type",
          priority: "medium",
        })
        .expect(400);

      expect(response.body.success).toBe(false);

      console.log("✅ REQUIREMENT 3: Invalid message types are rejected");
    });
  });

  describe("REQUIREMENT 4: Create New Messages (Role-Based Access)", () => {
    it("should allow Administrator to create messages", async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Admin Message",
          content: "Message from administrator",
          type: "announcement",
          priority: "high",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.creator.role).toBe("Administrator");

      console.log("✅ REQUIREMENT 4.1: Administrator can create messages");
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

      console.log("✅ REQUIREMENT 4.2: Participant cannot create messages");
    });

    it("should broadcast created message to all users", async () => {
      // Create message as admin
      const createResponse = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Broadcast Test",
          content: "This should reach all users",
          type: "announcement",
          priority: "high",
        });

      const messageId = createResponse.body.data.id;

      // Both users should see it
      const adminMessages = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const participantMessages = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const adminMessage = adminMessages.body.data.messages.find(
        (msg: any) => msg.id === messageId
      );
      const participantMessage = participantMessages.body.data.messages.find(
        (msg: any) => msg.id === messageId
      );

      expect(adminMessage).toBeTruthy();
      expect(participantMessage).toBeTruthy();
      expect(adminMessage.title).toBe("Broadcast Test");
      expect(participantMessage.title).toBe("Broadcast Test");

      console.log("✅ REQUIREMENT 4.3: Messages broadcast to all users");
    });
  });

  describe("REQUIREMENT 5: Bell Notification Read/Unread with Remove Button", () => {
    beforeEach(async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Bell Notification Test",
          content: "Testing bell notifications",
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
      expect(response.body.data.unreadCount).toBeGreaterThan(0);

      console.log(
        "✅ REQUIREMENT 5.1: Bell notifications show as unread by default"
      );
    });

    it("should mark bell notification as read and show remove button", async () => {
      // Mark as read
      const markReadResponse = await request(app)
        .patch(
          `/api/v1/system-messages/bell-notifications/${testSystemMessage.id}/read`
        )
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      expect(markReadResponse.body.success).toBe(true);

      // Check updated state
      const getResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const notifications = getResponse.body.data.notifications;
      const testNotification = notifications.find(
        (n: any) => n.id === testSystemMessage.id
      );

      expect(testNotification.isRead).toBe(true);
      expect(testNotification.showRemoveButton).toBe(true);
      expect(getResponse.body.data.unreadCount).toBe(0);

      console.log(
        "✅ REQUIREMENT 5.2: Bell notifications can be marked as read with remove button"
      );
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

      console.log(
        "✅ REQUIREMENT 5.3: Bell notifications show creator information"
      );
    });
  });

  describe("REQUIREMENT 6: Bell Notification Removal (Independent)", () => {
    beforeEach(async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Removal Test",
          content: "Testing removal functionality",
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
      const removeResponse = await request(app)
        .delete(
          `/api/v1/system-messages/bell-notifications/${testSystemMessage.id}`
        )
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      expect(removeResponse.body.success).toBe(true);

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

      console.log(
        "✅ REQUIREMENT 6: Bell notification removal is independent of system messages"
      );
    });
  });

  describe("REQUIREMENT 8: Auto-sync Between System Messages and Bell Notifications", () => {
    beforeEach(async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Sync Test",
          content: "Testing synchronization",
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
      const bellResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const notifications = bellResponse.body.data.notifications;
      const syncedNotification = notifications.find(
        (n: any) => n.id === testSystemMessage.id
      );
      expect(syncedNotification.isRead).toBe(true);
      expect(syncedNotification.showRemoveButton).toBe(true);

      console.log(
        "✅ REQUIREMENT 8.1: System message read status syncs to bell notifications"
      );
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
      const systemResponse = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      const messages = systemResponse.body.data.messages;
      const syncedMessage = messages.find(
        (msg: any) => msg.id === testSystemMessage.id
      );
      expect(syncedMessage.isRead).toBe(true);

      console.log(
        "✅ REQUIREMENT 8.2: Bell notification read status syncs to system messages"
      );
    });
  });

  describe("REQUIREMENT 9: Auto-delete Bell Notifications When System Message Deleted", () => {
    beforeEach(async () => {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Auto-delete Test",
          content: "Testing auto-deletion",
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

      console.log(
        "✅ REQUIREMENT 9: Bell notifications auto-delete when system message is deleted"
      );
    });
  });

  describe("Mark All Read Functionality", () => {
    beforeEach(async () => {
      // Create multiple test messages
      for (let i = 1; i <= 3; i++) {
        await request(app)
          .post("/api/v1/system-messages")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            title: `Bulk Test Message ${i}`,
            content: `Test content ${i}`,
            type: "announcement",
            priority: "medium",
          });
      }
    });

    it("should mark all bell notifications as read", async () => {
      // Verify there are unread notifications
      let bellResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      expect(bellResponse.body.data.unreadCount).toBeGreaterThan(0);

      // Mark all as read
      const markAllResponse = await request(app)
        .patch("/api/v1/system-messages/bell-notifications/read-all")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      expect(markAllResponse.body.success).toBe(true);

      // Verify all are marked as read
      bellResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(200);

      expect(bellResponse.body.data.unreadCount).toBe(0);
      bellResponse.body.data.notifications.forEach((notification: any) => {
        expect(notification.isRead).toBe(true);
        expect(notification.showRemoveButton).toBe(true);
      });

      console.log("✅ Mark All Read: Bulk operations work correctly");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle invalid message IDs gracefully", async () => {
      const invalidId = "invalid-message-id";

      await request(app)
        .patch(`/api/v1/system-messages/${invalidId}/read`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(404);

      await request(app)
        .delete(`/api/v1/system-messages/${invalidId}`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(404);

      await request(app)
        .patch(`/api/v1/system-messages/bell-notifications/${invalidId}/read`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(404);

      await request(app)
        .delete(`/api/v1/system-messages/bell-notifications/${invalidId}`)
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(404);

      console.log("✅ Error Handling: Invalid IDs handled gracefully");
    });

    it("should handle unauthorized access", async () => {
      await request(app).get("/api/v1/system-messages").expect(401);

      await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .expect(401);

      await request(app)
        .post("/api/v1/system-messages")
        .send({
          title: "Unauthorized",
          content: "Should be rejected",
          type: "announcement",
          priority: "medium",
        })
        .expect(401);

      console.log("✅ Error Handling: Unauthorized access blocked");
    });
  });
});
