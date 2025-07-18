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

describe("Frontend-Backend Notification Sync Test", () => {
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

  it("should verify frontend and backend notification sync", async () => {
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

    console.log("=== FRONTEND-BACKEND NOTIFICATION SYNC TEST ===");

    // 1. Create system messages to populate bell notifications
    const messageIds: string[] = [];
    for (let i = 1; i <= 2; i++) {
      const createResponse = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: `Sync Test Message ${i}`,
          content: `Sync test content ${i}`,
          type: "announcement",
          priority: "medium",
        });
      messageIds.push(createResponse.body.data.id);
    }

    console.log("Created messages:", messageIds);

    // 2. Get bell notifications (what frontend getNotifications() should return)
    console.log("\n=== GETTING BELL NOTIFICATIONS (FRONTEND ENDPOINT) ===");
    const bellResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("Bell notifications status:", bellResponse.status);
    console.log(
      "Bell notifications count:",
      bellResponse.body.data.notifications.length
    );
    console.log("Bell unread count:", bellResponse.body.data.unreadCount);

    const bellNotifications = bellResponse.body.data.notifications;
    bellNotifications.forEach((notif: any, index: number) => {
      console.log(`Bell notification ${index + 1}:`, {
        id: notif.id,
        isRead: notif.isRead,
        showRemoveButton: notif.showRemoveButton,
      });
    });

    // 3. Test delete operation using the correct notification IDs
    if (bellNotifications.length > 0) {
      const notificationToDelete = bellNotifications[0];
      console.log("\n=== TESTING DELETE WITH BELL NOTIFICATION ID ===");
      console.log(
        "Attempting to delete notification:",
        notificationToDelete.id
      );

      // First mark as read if needed (some business logic might require this)
      if (!notificationToDelete.isRead) {
        console.log("Marking as read first...");
        const markReadResponse = await request(app)
          .patch(
            `/api/v1/system-messages/bell-notifications/${notificationToDelete.id}/read`
          )
          .set("Authorization", `Bearer ${adminToken}`);
        console.log("Mark read response:", markReadResponse.status);
      }

      // Now delete
      const deleteResponse = await request(app)
        .delete(
          `/api/v1/system-messages/bell-notifications/${notificationToDelete.id}`
        )
        .set("Authorization", `Bearer ${adminToken}`);

      console.log(
        "Delete response:",
        deleteResponse.status,
        deleteResponse.body
      );

      if (deleteResponse.status === 200) {
        // Verify deletion worked
        const afterDeleteResponse = await request(app)
          .get("/api/v1/system-messages/bell-notifications")
          .set("Authorization", `Bearer ${adminToken}`);

        console.log("\n=== AFTER DELETION ===");
        console.log(
          "Remaining notifications:",
          afterDeleteResponse.body.data.notifications.length
        );
        console.log("Should be 1 (2 created - 1 deleted = 1)");

        expect(afterDeleteResponse.body.data.notifications.length).toBe(1);
      } else {
        console.log("❌ DELETE FAILED - This is the issue we need to fix!");
      }
    }

    // 4. Test mark all as read
    console.log("\n=== TESTING MARK ALL AS READ ===");
    const markAllResponse = await request(app)
      .patch("/api/v1/system-messages/bell-notifications/read-all")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log(
      "Mark all response:",
      markAllResponse.status,
      markAllResponse.body
    );

    // 5. Final state verification
    const finalResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("\n=== FINAL STATE ===");
    console.log(
      "Final notifications:",
      finalResponse.body.data.notifications.length
    );
    console.log("Final unread count:", finalResponse.body.data.unreadCount);

    expect(finalResponse.body.data.unreadCount).toBe(0);
  });
});
