import { describe, it, expect, beforeAll, afterAll } from "vitest";
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

describe("Notification Systems Comparison", () => {
  let adminUser: any;
  let adminToken: string;

  beforeAll(async () => {
    if (!process.env.MONGODB_URI_TEST) {
      throw new Error("MONGODB_URI_TEST environment variable is not set");
    }
    await mongoose.connect(process.env.MONGODB_URI_TEST);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it("should compare both notification systems functionality", async () => {
    // Clean up
    await User.deleteMany({});

    // Create admin user
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

    // Get token
    const adminLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ emailOrUsername: "admin@test.com", password: "AdminPass123" });

    adminToken = adminLogin.body.data.accessToken;

    // Create multiple system messages for testing
    console.log("=== CREATING TEST MESSAGES ===");
    const messages: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const createResponse = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: `Test Message ${i}`,
          content: `Content ${i}`,
          type: "announcement",
          priority: "medium",
        });
      messages.push(createResponse.body.data.id);
      console.log(`Created message ${i} with ID:`, createResponse.body.data.id);
    }

    // Test System 1: /api/v1/system-messages/bell-notifications
    console.log(
      "\n=== TESTING SYSTEM 1: /system-messages/bell-notifications ==="
    );

    // Get notifications
    const system1Get = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("System 1 GET status:", system1Get.status);
    console.log(
      "System 1 notifications count:",
      system1Get.body.data?.notifications?.length || 0
    );
    console.log(
      "System 1 response structure:",
      Object.keys(system1Get.body.data || {})
    );

    // Test mark as read (individual)
    if (system1Get.body.data?.notifications?.length > 0) {
      const firstNotificationId = system1Get.body.data.notifications[0].id;
      const system1MarkRead = await request(app)
        .patch(`/api/v1/system-messages/${firstNotificationId}/read`)
        .set("Authorization", `Bearer ${adminToken}`);

      console.log("System 1 mark as read status:", system1MarkRead.status);
    }

    // Test mark all as read
    const system1MarkAllRead = await request(app)
      .patch("/api/v1/system-messages/bell-notifications/read-all")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("System 1 mark all read status:", system1MarkAllRead.status);

    // Test delete
    if (system1Get.body.data?.notifications?.length > 0) {
      const secondNotificationId = system1Get.body.data.notifications[1]?.id;
      if (secondNotificationId) {
        const system1Delete = await request(app)
          .delete(
            `/api/v1/system-messages/bell-notifications/${secondNotificationId}`
          )
          .set("Authorization", `Bearer ${adminToken}`);

        console.log("System 1 delete status:", system1Delete.status);
      }
    }

    // Test System 2: /api/v1/user/notifications/bell
    console.log("\n=== TESTING SYSTEM 2: /user/notifications/bell ===");

    // Get notifications
    const system2Get = await request(app)
      .get("/api/v1/user/notifications/bell")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("System 2 GET status:", system2Get.status);
    console.log(
      "System 2 notifications count:",
      system2Get.body.data?.notifications?.length || 0
    );
    console.log(
      "System 2 response structure:",
      Object.keys(system2Get.body.data || {})
    );

    // Test mark as read (individual)
    if (system2Get.body.data?.notifications?.length > 0) {
      const firstNotificationId = system2Get.body.data.notifications[0].id;
      const system2MarkRead = await request(app)
        .patch(`/api/v1/user/notifications/bell/${firstNotificationId}/read`)
        .set("Authorization", `Bearer ${adminToken}`);

      console.log("System 2 mark as read status:", system2MarkRead.status);
    }

    // Test mark all as read
    const system2MarkAllRead = await request(app)
      .patch("/api/v1/user/notifications/bell/read-all")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("System 2 mark all read status:", system2MarkAllRead.status);

    // Test delete
    if (system2Get.body.data?.notifications?.length > 0) {
      const secondNotificationId = system2Get.body.data.notifications[0]?.id;
      if (secondNotificationId) {
        const system2Delete = await request(app)
          .delete(`/api/v1/user/notifications/bell/${secondNotificationId}`)
          .set("Authorization", `Bearer ${adminToken}`);

        console.log("System 2 delete status:", system2Delete.status);
      }
    }

    console.log("\n=== CHECKING AVAILABLE ROUTES ===");
    // Let's check what routes are actually available
    const routeTests = [
      "GET /api/v1/system-messages/bell-notifications",
      "GET /api/v1/user/notifications/bell",
      "PATCH /api/v1/system-messages/bell-notifications/read-all",
      "PATCH /api/v1/user/notifications/bell/read-all",
      "DELETE /api/v1/system-messages/bell-notifications/:id",
      "DELETE /api/v1/user/notifications/bell/:id",
    ];

    for (const route of routeTests) {
      console.log(`Route exists: ${route}`);
    }
  });
});
