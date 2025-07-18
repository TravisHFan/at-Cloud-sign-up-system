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

describe("Bell Notification Final Fix Verification", () => {
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

  it("should simulate frontend workflow with correct IDs", async () => {
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

    console.log("=== SIMULATING FRONTEND WORKFLOW ===");

    // 1. Create multiple system messages
    const messages: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const createResponse = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: `Test Message ${i}`,
          content: `Test content ${i}`,
          type: "announcement",
          priority: "medium",
        });
      messages.push(createResponse.body.data.id);
    }

    console.log("Created messages:", messages);

    // 2. Get bell notifications (simulating frontend call)
    const bellResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log(
      "Bell notifications count:",
      bellResponse.body.data.notifications.length
    );
    console.log("Unread count:", bellResponse.body.data.unreadCount);

    const notifications = bellResponse.body.data.notifications;

    // 3. Mark one as read (using actual ID, not prefixed)
    const firstNotificationId = notifications[0].id;
    console.log("\n=== MARK AS READ TEST ===");
    console.log("Marking as read:", firstNotificationId);

    const markReadResponse = await request(app)
      .patch(
        `/api/v1/system-messages/bell-notifications/${firstNotificationId}/read`
      )
      .set("Authorization", `Bearer ${adminToken}`);

    console.log(
      "Mark read response:",
      markReadResponse.status,
      markReadResponse.body
    );
    expect(markReadResponse.status).toBe(200);

    // 4. Delete one (using actual ID, not prefixed)
    const secondNotificationId = notifications[1].id;
    console.log("\n=== DELETE TEST ===");
    console.log("Deleting:", secondNotificationId);

    const deleteResponse = await request(app)
      .delete(
        `/api/v1/system-messages/bell-notifications/${secondNotificationId}`
      )
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("Delete response:", deleteResponse.status, deleteResponse.body);
    expect(deleteResponse.status).toBe(200);

    // 5. Mark all remaining as read
    console.log("\n=== MARK ALL READ TEST ===");
    const markAllResponse = await request(app)
      .patch("/api/v1/system-messages/bell-notifications/read-all")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log(
      "Mark all response:",
      markAllResponse.status,
      markAllResponse.body
    );
    expect(markAllResponse.status).toBe(200);

    // 6. Verify final state
    const finalBellResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("\n=== FINAL STATE ===");
    console.log("Final unread count:", finalBellResponse.body.data.unreadCount);
    console.log(
      "Final notification count:",
      finalBellResponse.body.data.notifications.length
    );

    expect(finalBellResponse.body.data.unreadCount).toBe(0);

    // 7. Test system message deletion
    console.log("\n=== SYSTEM MESSAGE DELETE TEST ===");
    const remainingMessages = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`);

    if (remainingMessages.body.data.messages.length > 0) {
      const messageToDelete = remainingMessages.body.data.messages[0].id;
      console.log("Deleting system message:", messageToDelete);

      const systemDeleteResponse = await request(app)
        .delete(`/api/v1/system-messages/${messageToDelete}`)
        .set("Authorization", `Bearer ${adminToken}`);

      console.log(
        "System delete response:",
        systemDeleteResponse.status,
        systemDeleteResponse.body
      );
      expect(systemDeleteResponse.status).toBe(200);
    }
  });
});
