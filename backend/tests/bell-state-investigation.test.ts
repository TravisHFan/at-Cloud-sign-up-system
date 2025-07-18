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

describe("Bell Notification State Investigation", () => {
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

  it("should investigate bell notification state behavior", async () => {
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

    console.log("=== BELL NOTIFICATION STATE INVESTIGATION ===");

    // Create multiple system messages
    const messageIds: string[] = [];
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
      messageIds.push(createResponse.body.data.id);
    }

    console.log("Created message IDs:", messageIds);

    // Get initial bell notifications
    let bellResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("\n=== INITIAL STATE ===");
    console.log(
      "Initial notifications count:",
      bellResponse.body.data.notifications.length
    );
    console.log("Initial unread count:", bellResponse.body.data.unreadCount);
    bellResponse.body.data.notifications.forEach(
      (notif: any, index: number) => {
        console.log(
          `Notification ${index + 1}: ID=${notif.id}, isRead=${
            notif.isRead
          }, showRemoveButton=${notif.showRemoveButton}`
        );
      }
    );

    // Mark first notification as read
    const firstNotificationId = bellResponse.body.data.notifications[0].id;
    console.log("\n=== MARKING FIRST AS READ ===");
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

    // Get bell notifications after marking as read
    bellResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("\n=== AFTER MARKING AS READ ===");
    console.log(
      "Notifications count:",
      bellResponse.body.data.notifications.length
    );
    console.log("Unread count:", bellResponse.body.data.unreadCount);
    bellResponse.body.data.notifications.forEach(
      (notif: any, index: number) => {
        console.log(
          `Notification ${index + 1}: ID=${notif.id}, isRead=${
            notif.isRead
          }, showRemoveButton=${notif.showRemoveButton}`
        );
      }
    );

    // Try to delete the read notification
    console.log("\n=== ATTEMPTING TO DELETE READ NOTIFICATION ===");
    console.log("Attempting to delete:", firstNotificationId);

    const deleteResponse = await request(app)
      .delete(
        `/api/v1/system-messages/bell-notifications/${firstNotificationId}`
      )
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("Delete response:", deleteResponse.status, deleteResponse.body);

    // Get bell notifications after delete attempt
    bellResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("\n=== AFTER DELETE ATTEMPT ===");
    console.log(
      "Notifications count:",
      bellResponse.body.data.notifications.length
    );
    console.log("Unread count:", bellResponse.body.data.unreadCount);
    bellResponse.body.data.notifications.forEach(
      (notif: any, index: number) => {
        console.log(
          `Notification ${index + 1}: ID=${notif.id}, isRead=${
            notif.isRead
          }, showRemoveButton=${notif.showRemoveButton}`
        );
      }
    );

    // Try deleting again (should fail)
    console.log("\n=== ATTEMPTING TO DELETE AGAIN (SHOULD FAIL) ===");
    const deleteResponse2 = await request(app)
      .delete(
        `/api/v1/system-messages/bell-notifications/${firstNotificationId}`
      )
      .set("Authorization", `Bearer ${adminToken}`);

    console.log(
      "Second delete response:",
      deleteResponse2.status,
      deleteResponse2.body
    );

    // Test mark all as read
    console.log("\n=== TESTING MARK ALL AS READ ===");
    const markAllResponse = await request(app)
      .patch("/api/v1/system-messages/bell-notifications/read-all")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log(
      "Mark all response:",
      markAllResponse.status,
      markAllResponse.body
    );

    // Final state
    bellResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("\n=== FINAL STATE ===");
    console.log(
      "Final notifications count:",
      bellResponse.body.data.notifications.length
    );
    console.log("Final unread count:", bellResponse.body.data.unreadCount);
    bellResponse.body.data.notifications.forEach(
      (notif: any, index: number) => {
        console.log(
          `Notification ${index + 1}: ID=${notif.id}, isRead=${
            notif.isRead
          }, showRemoveButton=${notif.showRemoveButton}`
        );
      }
    );
  });
});
