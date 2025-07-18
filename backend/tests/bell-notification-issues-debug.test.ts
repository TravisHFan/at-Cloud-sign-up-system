import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import express from "express";
import dotenv from "dotenv";
import routes from "../src/routes";
import { User } from "../src/models";

// Load environment variables
dotenv.config();

// Create test app
const app = express();
app.use(express.json());
app.use(routes);

describe("🔍 Bell Notification Issues Debug", () => {
  let adminUser: any;
  let regularUser: any;
  let adminToken: string;
  let regularToken: string;
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

    // Create users
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

    regularUser = await User.create({
      username: "user",
      email: "user@test.com",
      password: "UserPass123",
      firstName: "Regular",
      lastName: "User",
      role: "Participant",
      isVerified: true,
      isActive: true,
    });

    // Get tokens
    const adminLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ emailOrUsername: "admin@test.com", password: "AdminPass123" });

    const userLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ emailOrUsername: "user@test.com", password: "UserPass123" });

    expect(adminLogin.status).toBe(200);
    expect(userLogin.status).toBe(200);
    adminToken = adminLogin.body.data.accessToken;
    regularToken = userLogin.body.data.accessToken;

    // Create a system message to generate bell notifications
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Bell Test Message",
        content: "Testing bell notification functionality",
        type: "announcement",
        priority: "high",
      });

    expect(createResponse.status).toBe(201);
    createdMessageId = createResponse.body.data.id;
  });

  describe("🐛 Issue 1: Cannot Delete Read Bell Notifications", () => {
    it("should test delete functionality for unread bell notifications", async () => {
      console.log("\n=== Testing Delete Unread Bell Notification ===");

      // Step 1: Get initial bell notifications (should be unread)
      const initialBellResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${regularToken}`);

      expect(initialBellResponse.status).toBe(200);
      expect(initialBellResponse.body.data.notifications).toHaveLength(1);
      expect(initialBellResponse.body.data.unreadCount).toBe(1);
      console.log("✅ Initial unread bell notification exists");

      // Step 2: Try to delete the unread notification
      console.log("Step 2: Attempting to delete unread notification...");
      const deleteUnreadResponse = await request(app)
        .delete(`/api/v1/user/notifications/bell/${createdMessageId}`)
        .set("Authorization", `Bearer ${regularToken}`);

      console.log(
        "Delete unread response status:",
        deleteUnreadResponse.status
      );
      console.log(
        "Delete unread response body:",
        JSON.stringify(deleteUnreadResponse.body, null, 2)
      );

      if (deleteUnreadResponse.status === 200) {
        console.log("✅ Delete unread notification works");
      } else {
        console.log("❌ Delete unread notification failed");
      }
    });

    it("should test delete functionality for read bell notifications", async () => {
      console.log("\n=== Testing Delete Read Bell Notification ===");

      // Step 1: Mark notification as read first
      console.log("Step 1: Marking notification as read...");
      const markReadResponse = await request(app)
        .patch(
          `/api/v1/system-messages/bell-notifications/${createdMessageId}/read`
        )
        .set("Authorization", `Bearer ${regularToken}`);

      expect(markReadResponse.status).toBe(200);
      console.log("✅ Notification marked as read");

      // Step 2: Verify it's marked as read
      const verifyReadResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${regularToken}`);

      expect(verifyReadResponse.status).toBe(200);
      expect(verifyReadResponse.body.data.unreadCount).toBe(0);
      console.log("✅ Notification is confirmed as read");

      // Step 3: Try to delete the read notification (this is where the problem occurs)
      console.log("Step 3: Attempting to delete read notification...");
      const deleteReadResponse = await request(app)
        .delete(`/api/v1/user/notifications/bell/${createdMessageId}`)
        .set("Authorization", `Bearer ${regularToken}`);

      console.log("Delete read response status:", deleteReadResponse.status);
      console.log(
        "Delete read response body:",
        JSON.stringify(deleteReadResponse.body, null, 2)
      );

      if (deleteReadResponse.status === 200) {
        console.log("✅ Delete read notification works");
      } else {
        console.log("❌ Delete read notification failed - PROBLEM IDENTIFIED!");
      }

      // Step 4: Verify deletion result
      const finalBellResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${regularToken}`);

      console.log(
        "Final bell notifications:",
        JSON.stringify(finalBellResponse.body.data, null, 2)
      );
    });
  });

  describe("🐛 Issue 2: Mark All Read Button Not Working", () => {
    it("should test mark all as read functionality", async () => {
      console.log("\n=== Testing Mark All Bell Notifications As Read ===");

      // Step 1: Create additional notifications for comprehensive testing
      console.log("Step 1: Creating additional system messages...");

      const createResponse2 = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Second Bell Test Message",
          content: "Second testing bell notification functionality",
          type: "maintenance",
          priority: "medium",
        });

      expect(createResponse2.status).toBe(201);
      console.log("✅ Additional system message created");

      // Step 2: Verify we have multiple unread notifications
      const multipleNotificationsResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${regularToken}`);

      expect(multipleNotificationsResponse.status).toBe(200);
      console.log(
        "Unread notifications count:",
        multipleNotificationsResponse.body.data.unreadCount
      );
      console.log(
        "Total notifications count:",
        multipleNotificationsResponse.body.data.notifications.length
      );

      // Step 3: Try to mark all as read (this is where the problem occurs)
      console.log("Step 3: Attempting mark all as read...");
      const markAllReadResponse = await request(app)
        .put("/api/v1/user/notifications/bell/read-all")
        .set("Authorization", `Bearer ${regularToken}`);

      console.log("Mark all read response status:", markAllReadResponse.status);
      console.log(
        "Mark all read response body:",
        JSON.stringify(markAllReadResponse.body, null, 2)
      );

      if (markAllReadResponse.status === 200) {
        console.log("✅ Mark all as read endpoint works");
      } else {
        console.log(
          "❌ Mark all as read endpoint failed - PROBLEM IDENTIFIED!"
        );
      }

      // Step 4: Verify the result
      const finalCheckResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${regularToken}`);

      console.log(
        "Final unread count:",
        finalCheckResponse.body.data.unreadCount
      );
      console.log(
        "Final notifications:",
        JSON.stringify(
          finalCheckResponse.body.data.notifications.map((n) => ({
            id: n.id,
            title: n.title,
            isRead: n.isRead,
          })),
          null,
          2
        )
      );

      if (finalCheckResponse.body.data.unreadCount === 0) {
        console.log("✅ Mark all as read worked correctly");
      } else {
        console.log(
          "❌ Mark all as read did not work - notifications still unread"
        );
      }
    });
  });

  describe("🔍 Backend Endpoint Verification", () => {
    it("should verify all bell notification endpoints exist", async () => {
      console.log("\n=== Verifying Backend Endpoints ===");

      // Test GET endpoint
      const getResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${regularToken}`);

      console.log("GET bell-notifications status:", getResponse.status);

      // Test PATCH read endpoint
      const patchResponse = await request(app)
        .patch(
          `/api/v1/system-messages/bell-notifications/${createdMessageId}/read`
        )
        .set("Authorization", `Bearer ${regularToken}`);

      console.log("PATCH bell-notification read status:", patchResponse.status);

      // Test DELETE endpoint
      const deleteResponse = await request(app)
        .delete(`/api/v1/user/notifications/bell/${createdMessageId}`)
        .set("Authorization", `Bearer ${regularToken}`);

      console.log("DELETE bell-notification status:", deleteResponse.status);

      // Test mark all read endpoint
      const markAllResponse = await request(app)
        .put("/api/v1/user/notifications/bell/read-all")
        .set("Authorization", `Bearer ${regularToken}`);

      console.log("PUT mark-all-read status:", markAllResponse.status);

      console.log("\n📊 Endpoint Status Summary:");
      console.log(
        `   GET /api/v1/system-messages/bell-notifications: ${getResponse.status}`
      );
      console.log(
        `   PATCH /api/v1/system-messages/bell-notifications/:id/read: ${patchResponse.status}`
      );
      console.log(
        `   DELETE /api/v1/user/notifications/bell/:id: ${deleteResponse.status}`
      );
      console.log(
        `   PUT /api/v1/user/notifications/bell/read-all: ${markAllResponse.status}`
      );
    });
  });
});
