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

describe("🚨 CURRENT BELL NOTIFICATION PROBLEMS - DEEP INVESTIGATION", () => {
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

    // Create a system message to generate bell notification
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Current Problems Test Message",
        content: "Testing current bell notification problems",
        type: "announcement",
        priority: "high",
      });

    expect(createResponse.status).toBe(201);
    createdMessageId = createResponse.body.data.id;
  });

  describe("🐛 PROBLEM 1: Cannot Delete Read Items", () => {
    it("should investigate delete endpoint mapping issues", async () => {
      console.log("\n=== INVESTIGATING DELETE PROBLEMS ===");

      // Step 1: Verify initial bell notification exists
      const initialResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${regularToken}`);

      expect(initialResponse.status).toBe(200);
      expect(initialResponse.body.data.notifications).toHaveLength(1);
      console.log("✅ Initial notification exists and unread");

      // Step 2: Mark as read first
      const markReadResponse = await request(app)
        .patch(
          `/api/v1/system-messages/bell-notifications/${createdMessageId}/read`
        )
        .set("Authorization", `Bearer ${regularToken}`);

      expect(markReadResponse.status).toBe(200);
      console.log("✅ Notification marked as read");

      // Step 3: Test ALL possible delete endpoints that frontend might be using
      console.log("\n--- Testing All Possible Delete Endpoints ---");

      // Frontend might be using this endpoint (from notificationService)
      console.log("Testing: DELETE /api/v1/user/notifications/bell/:id");
      const deleteEndpoint1 = await request(app)
        .delete(`/api/v1/user/notifications/bell/${createdMessageId}`)
        .set("Authorization", `Bearer ${regularToken}`);

      console.log("Delete endpoint 1 status:", deleteEndpoint1.status);
      console.log(
        "Delete endpoint 1 body:",
        JSON.stringify(deleteEndpoint1.body, null, 2)
      );

      // Or frontend might be trying this endpoint
      console.log(
        "Testing: DELETE /api/v1/system-messages/bell-notifications/:id"
      );
      const deleteEndpoint2 = await request(app)
        .delete(
          `/api/v1/system-messages/bell-notifications/${createdMessageId}`
        )
        .set("Authorization", `Bearer ${regularToken}`);

      console.log("Delete endpoint 2 status:", deleteEndpoint2.status);
      console.log(
        "Delete endpoint 2 body:",
        JSON.stringify(deleteEndpoint2.body, null, 2)
      );

      // Check if any endpoint worked
      if (deleteEndpoint1.status === 200) {
        console.log("✅ DELETE via /user/notifications/bell works");
      } else {
        console.log("❌ DELETE via /user/notifications/bell FAILED");
      }

      if (deleteEndpoint2.status === 200) {
        console.log("✅ DELETE via /system-messages/bell-notifications works");
      } else {
        console.log("❌ DELETE via /system-messages/bell-notifications FAILED");
      }
    });
  });

  describe("🐛 PROBLEM 2: Mark All Read Button Not Working", () => {
    it("should investigate mark all read endpoint issues", async () => {
      console.log("\n=== INVESTIGATING MARK ALL READ PROBLEMS ===");

      // Create multiple notifications
      await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Second Test Message",
          content: "Second test content",
          type: "maintenance",
          priority: "medium",
        });

      // Verify multiple unread notifications
      const multipleResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${regularToken}`);

      expect(multipleResponse.body.data.unreadCount).toBe(2);
      console.log(
        "✅ Multiple unread notifications exist:",
        multipleResponse.body.data.unreadCount
      );

      // Test ALL possible mark all read endpoints
      console.log("\n--- Testing All Possible Mark All Read Endpoints ---");

      // Frontend might be using this endpoint
      console.log("Testing: PUT /api/v1/user/notifications/bell/read-all");
      const markAllEndpoint1 = await request(app)
        .put("/api/v1/user/notifications/bell/read-all")
        .set("Authorization", `Bearer ${regularToken}`);

      console.log("Mark all endpoint 1 status:", markAllEndpoint1.status);
      console.log(
        "Mark all endpoint 1 body:",
        JSON.stringify(markAllEndpoint1.body, null, 2)
      );

      // Or this endpoint
      console.log(
        "Testing: PATCH /api/v1/system-messages/bell-notifications/read-all"
      );
      const markAllEndpoint2 = await request(app)
        .patch("/api/v1/system-messages/bell-notifications/read-all")
        .set("Authorization", `Bearer ${regularToken}`);

      console.log("Mark all endpoint 2 status:", markAllEndpoint2.status);
      console.log(
        "Mark all endpoint 2 body:",
        JSON.stringify(markAllEndpoint2.body, null, 2)
      );

      // Verify if any worked
      const finalCheckResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${regularToken}`);

      console.log(
        "Final unread count:",
        finalCheckResponse.body.data.unreadCount
      );

      if (finalCheckResponse.body.data.unreadCount === 0) {
        console.log("✅ Mark all read worked");
      } else {
        console.log(
          "❌ Mark all read FAILED - still have unread notifications"
        );
      }
    });
  });

  describe("🐛 PROBLEM 3: Cannot Change Items from Unread to Read", () => {
    it("should investigate individual mark as read endpoint issues", async () => {
      console.log("\n=== INVESTIGATING INDIVIDUAL MARK AS READ PROBLEMS ===");

      // Verify initial unread state
      const initialResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${regularToken}`);

      expect(initialResponse.body.data.unreadCount).toBe(1);
      const notification = initialResponse.body.data.notifications[0];
      expect(notification.isRead).toBe(false);
      console.log("✅ Initial notification is unread");

      // Test ALL possible mark as read endpoints
      console.log("\n--- Testing All Possible Mark As Read Endpoints ---");

      // Frontend might be using this endpoint
      console.log(
        "Testing: PATCH /api/v1/system-messages/bell-notifications/:id/read"
      );
      const markReadEndpoint1 = await request(app)
        .patch(
          `/api/v1/system-messages/bell-notifications/${createdMessageId}/read`
        )
        .set("Authorization", `Bearer ${regularToken}`);

      console.log("Mark read endpoint 1 status:", markReadEndpoint1.status);
      console.log(
        "Mark read endpoint 1 body:",
        JSON.stringify(markReadEndpoint1.body, null, 2)
      );

      // Or this endpoint
      console.log("Testing: PUT /api/v1/user/notifications/bell/:id/read");
      const markReadEndpoint2 = await request(app)
        .put(`/api/v1/user/notifications/bell/${createdMessageId}/read`)
        .set("Authorization", `Bearer ${regularToken}`);

      console.log("Mark read endpoint 2 status:", markReadEndpoint2.status);
      console.log(
        "Mark read endpoint 2 body:",
        JSON.stringify(markReadEndpoint2.body, null, 2)
      );

      // Verify if any worked
      const finalResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${regularToken}`);

      console.log("Final notification state:");
      finalResponse.body.data.notifications.forEach((notif: any) => {
        console.log(`   - ${notif.title}: ${notif.isRead ? "READ" : "UNREAD"}`);
      });
      console.log("Final unread count:", finalResponse.body.data.unreadCount);

      if (finalResponse.body.data.unreadCount === 0) {
        console.log("✅ Mark as read worked");
      } else {
        console.log("❌ Mark as read FAILED - notification still unread");
      }
    });
  });

  describe("🔍 FRONTEND-BACKEND ENDPOINT MISMATCH INVESTIGATION", () => {
    it("should check if frontend is using wrong endpoints", async () => {
      console.log("\n=== CHECKING FRONTEND-BACKEND ENDPOINT MISMATCHES ===");

      // Let's check what endpoints actually exist in the backend
      console.log("Available routes investigation:");

      // Test various endpoint combinations that frontend might be trying
      const testEndpoints = [
        // Bell notification endpoints
        { method: "GET", path: "/api/v1/system-messages/bell-notifications" },
        {
          method: "PATCH",
          path: `/api/v1/system-messages/bell-notifications/${createdMessageId}/read`,
        },
        {
          method: "DELETE",
          path: `/api/v1/system-messages/bell-notifications/${createdMessageId}`,
        },

        // User notification endpoints
        { method: "GET", path: "/api/v1/user/notifications/bell" },
        {
          method: "PUT",
          path: `/api/v1/user/notifications/bell/${createdMessageId}/read`,
        },
        {
          method: "DELETE",
          path: `/api/v1/user/notifications/bell/${createdMessageId}`,
        },
        { method: "PUT", path: "/api/v1/user/notifications/bell/read-all" },

        // Possible alternative endpoints
        {
          method: "POST",
          path: `/api/v1/user/notifications/bell/${createdMessageId}/read`,
        },
        {
          method: "PATCH",
          path: `/api/v1/user/notifications/bell/${createdMessageId}/read`,
        },
      ];

      for (const endpoint of testEndpoints) {
        try {
          let response;
          switch (endpoint.method) {
            case "GET":
              response = await request(app)
                .get(endpoint.path)
                .set("Authorization", `Bearer ${regularToken}`);
              break;
            case "PUT":
              response = await request(app)
                .put(endpoint.path)
                .set("Authorization", `Bearer ${regularToken}`);
              break;
            case "PATCH":
              response = await request(app)
                .patch(endpoint.path)
                .set("Authorization", `Bearer ${regularToken}`);
              break;
            case "DELETE":
              response = await request(app)
                .delete(endpoint.path)
                .set("Authorization", `Bearer ${regularToken}`);
              break;
            case "POST":
              response = await request(app)
                .post(endpoint.path)
                .set("Authorization", `Bearer ${regularToken}`);
              break;
            default:
              continue;
          }

          console.log(
            `${endpoint.method} ${endpoint.path}: ${response.status} ${
              response.status === 404
                ? "(NOT FOUND)"
                : response.status >= 400
                ? "(ERROR)"
                : "(OK)"
            }`
          );
        } catch (error) {
          console.log(`${endpoint.method} ${endpoint.path}: ERROR`);
        }
      }
    });
  });
});
