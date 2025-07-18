import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import express from "express";
import dotenv from "dotenv";
import routes from "../src/routes";
import jwt from "jsonwebtoken";
import { User, SystemMessage } from "../src/models";

// Load environment variables
dotenv.config();

// Create test app
const app = express();
app.use(express.json());
app.use(routes);

describe("Verify All Bell Notification Fixes", () => {
  let testUser: any;
  let authToken: string;
  let createdSystemMessage: any;

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
    // Clear all collections before each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }

    // Create test user
    testUser = await User.create({
      username: "testuser",
      firstName: "Test",
      lastName: "User",
      email: "testuser@example.com",
      password: "Password123", // Meets requirements: uppercase, lowercase, number
      role: "Administrator", // Need admin role to create system messages
      isActive: true,
      isVerified: true,
      isAtCloudLeader: false,
      loginAttempts: 0,
      hasReceivedWelcomeMessage: false,
    });

    // Get auth token through login (more reliable than manual JWT)
    const loginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        emailOrUsername: "testuser@example.com",
        password: "Password123",
      });

    expect(loginResponse.status).toBe(200);
    authToken = loginResponse.body.data.accessToken;

    // Create a system message that automatically sends to all users
    const systemMessageResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        title: "Test Message for Bell Notifications",
        content: "This message should create bell notifications for all users",
        priority: "medium", // Use valid priority
        type: "announcement",
      });

    createdSystemMessage = systemMessageResponse.body;
    console.log(
      "✅ Created system message with ID:",
      createdSystemMessage.data?.id
    );

    // Verify bell notification was created
    const updatedUser = await User.findById(testUser._id);
    console.log(
      "📋 User bell notifications after creation:",
      updatedUser?.bellNotificationStates?.length || 0
    );
  });

  describe("Complete Bell Notification Flow Test", () => {
    test("should complete full bell notification workflow: create → read → mark read → delete", async () => {
      console.log("\n🔍 === TESTING COMPLETE BELL NOTIFICATION WORKFLOW ===");

      // Step 1: Verify bell notifications were created
      const getUserResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${authToken}`);

      expect(getUserResponse.status).toBe(200);
      expect(getUserResponse.body.notifications).toHaveLength(1);

      const bellNotification = getUserResponse.body.notifications[0];
      console.log(
        "✅ Step 1 - Bell notification created:",
        bellNotification.systemMessage.title
      );
      console.log("   📧 Bell notification ID:", bellNotification.id);
      console.log("   👁️  Is read:", bellNotification.isRead);

      // Step 2: Mark individual notification as read using CORRECT endpoint
      console.log("\n📖 Step 2 - Testing mark individual as read...");
      const markReadResponse = await request(app)
        .patch(
          `/api/system-messages/bell-notifications/${bellNotification.id}/read`
        )
        .set("Authorization", `Bearer ${authToken}`);

      expect(markReadResponse.status).toBe(200);
      console.log("✅ Individual mark as read successful");

      // Verify notification is now marked as read
      const afterMarkReadResponse = await request(app)
        .get("/api/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${authToken}`);

      expect(afterMarkReadResponse.status).toBe(200);
      expect(afterMarkReadResponse.body.notifications[0].isRead).toBe(true);
      console.log("✅ Verified notification is now marked as read");

      // Step 3: Test mark all as read functionality
      console.log("\n📚 Step 3 - Testing mark all as read...");

      // First create another notification to test mark all
      await request(app)
        .post("/api/system-messages")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          title: "Second Test Message",
          content: "Another message for mark all test",
          priority: "normal",
          sendToAll: true,
        });

      // Verify we have notifications (one read, one unread)
      const beforeMarkAllResponse = await request(app)
        .get("/api/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${authToken}`);

      expect(beforeMarkAllResponse.body.notifications).toHaveLength(2);
      console.log(
        "📧 Notifications before mark all:",
        beforeMarkAllResponse.body.notifications.length
      );

      // Mark all as read
      const markAllReadResponse = await request(app)
        .put("/api/user/notifications/bell/read-all")
        .set("Authorization", `Bearer ${authToken}`);

      expect(markAllReadResponse.status).toBe(200);
      console.log("✅ Mark all as read successful");

      // Verify all notifications are now read
      const afterMarkAllResponse = await request(app)
        .get("/api/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${authToken}`);

      expect(afterMarkAllResponse.body.notifications).toHaveLength(2);
      afterMarkAllResponse.body.notifications.forEach(
        (notif: any, index: number) => {
          expect(notif.isRead).toBe(true);
          console.log(
            `✅ Notification ${index + 1} is marked as read:`,
            notif.isRead
          );
        }
      );

      // Step 4: Test deletion using CORRECT endpoint
      console.log("\n🗑️  Step 4 - Testing delete notification...");
      const notificationToDelete = afterMarkAllResponse.body.notifications[0];

      const deleteResponse = await request(app)
        .delete(
          `/api/system-messages/bell-notifications/${notificationToDelete.id}`
        )
        .set("Authorization", `Bearer ${authToken}`);

      expect(deleteResponse.status).toBe(200);
      console.log("✅ Delete notification successful");

      // Verify notification was deleted
      const afterDeleteResponse = await request(app)
        .get("/api/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${authToken}`);

      expect(afterDeleteResponse.body.notifications).toHaveLength(1);
      console.log(
        "✅ Verified notification was deleted, remaining count:",
        afterDeleteResponse.body.notifications.length
      );

      console.log(
        "\n🎉 === ALL BELL NOTIFICATION OPERATIONS WORKING CORRECTLY ==="
      );
    });

    test("should confirm wrong endpoints return 404 (to verify our fixes)", async () => {
      console.log("\n⚠️  === CONFIRMING OLD WRONG ENDPOINTS RETURN 404 ===");

      // Get a bell notification to test with
      const getUserResponse = await request(app)
        .get("/api/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${authToken}`);

      const bellNotification = getUserResponse.body.notifications[0];

      // Test wrong delete endpoint (old frontend was using this)
      const wrongDeleteResponse = await request(app)
        .delete(`/api/user/notifications/bell/${bellNotification.id}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(wrongDeleteResponse.status).toBe(404);
      console.log("✅ Wrong delete endpoint returns 404 as expected");

      // Test wrong mark read endpoint (old frontend was using this)
      const wrongMarkReadResponse = await request(app)
        .put(`/api/user/notifications/bell/${bellNotification.id}/read`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(wrongMarkReadResponse.status).toBe(404);
      console.log("✅ Wrong mark read endpoint returns 404 as expected");

      console.log(
        "✅ Confirmed: Frontend fixes target the correct working endpoints"
      );
    });
  });

  describe("Bell Notification Edge Cases", () => {
    test("should handle non-existent notification IDs gracefully", async () => {
      const fakeId = "507f1f77bcf86cd799439011";

      // Test mark read with fake ID
      const markReadResponse = await request(app)
        .patch(`/api/system-messages/bell-notifications/${fakeId}/read`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(markReadResponse.status).toBe(404);
      console.log("✅ Mark read with fake ID returns 404");

      // Test delete with fake ID
      const deleteResponse = await request(app)
        .delete(`/api/system-messages/bell-notifications/${fakeId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(deleteResponse.status).toBe(404);
      console.log("✅ Delete with fake ID returns 404");
    });

    test("should handle unauthorized requests properly", async () => {
      const getUserResponse = await request(app)
        .get("/api/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${authToken}`);

      const bellNotification = getUserResponse.body.notifications[0];

      // Test without auth token
      const noAuthResponse = await request(app).patch(
        `/api/system-messages/bell-notifications/${bellNotification.id}/read`
      );

      expect(noAuthResponse.status).toBe(401);
      console.log("✅ Request without auth returns 401");

      // Test with invalid auth token
      const invalidAuthResponse = await request(app)
        .delete(
          `/api/system-messages/bell-notifications/${bellNotification.id}`
        )
        .set("Authorization", "Bearer invalid-token");

      expect(invalidAuthResponse.status).toBe(401);
      console.log("✅ Request with invalid auth returns 401");
    });
  });
});
