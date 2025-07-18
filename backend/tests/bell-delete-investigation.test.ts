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

describe("Bell Notification Delete Investigation", () => {
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

  it("should investigate why bell notification delete returns 404", async () => {
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

    console.log("=== BELL NOTIFICATION DELETE INVESTIGATION ===");

    // 1. Create a system message
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Test Delete Message",
        content: "This message will be deleted",
        type: "announcement",
        priority: "high",
      });

    const messageId = createResponse.body.data.id;
    console.log("Created message ID:", messageId);

    // 2. Get bell notifications to see the current state
    const bellResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("Bell notifications response status:", bellResponse.status);
    console.log(
      "Bell notifications count:",
      bellResponse.body.data.notifications.length
    );
    console.log("Bell unread count:", bellResponse.body.data.unreadCount);

    if (bellResponse.body.data.notifications.length > 0) {
      const notification = bellResponse.body.data.notifications[0];
      console.log("First notification:", {
        id: notification.id,
        isRead: notification.isRead,
        showRemoveButton: notification.showRemoveButton,
      });

      // 3. Try to delete UNREAD notification (should fail according to business logic)
      console.log("\n=== TRYING TO DELETE UNREAD NOTIFICATION ===");
      const deleteUnreadResponse = await request(app)
        .delete(`/api/v1/system-messages/bell-notifications/${notification.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      console.log(
        "Delete unread response:",
        deleteUnreadResponse.status,
        deleteUnreadResponse.body
      );

      // 4. Mark notification as read first
      console.log("\n=== MARKING NOTIFICATION AS READ FIRST ===");
      const markReadResponse = await request(app)
        .patch(
          `/api/v1/system-messages/bell-notifications/${notification.id}/read`
        )
        .set("Authorization", `Bearer ${adminToken}`);

      console.log(
        "Mark read response:",
        markReadResponse.status,
        markReadResponse.body
      );

      // 5. Get bell notifications again to see updated state
      const bellResponseAfterRead = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${adminToken}`);

      console.log("\n=== AFTER MARKING AS READ ===");
      console.log(
        "Bell notifications count:",
        bellResponseAfterRead.body.data.notifications.length
      );

      if (bellResponseAfterRead.body.data.notifications.length > 0) {
        const readNotification =
          bellResponseAfterRead.body.data.notifications[0];
        console.log("Read notification:", {
          id: readNotification.id,
          isRead: readNotification.isRead,
          showRemoveButton: readNotification.showRemoveButton,
        });

        // 6. Now try to delete READ notification (should work)
        console.log("\n=== TRYING TO DELETE READ NOTIFICATION ===");
        const deleteReadResponse = await request(app)
          .delete(
            `/api/v1/system-messages/bell-notifications/${readNotification.id}`
          )
          .set("Authorization", `Bearer ${adminToken}`);

        console.log(
          "Delete read response:",
          deleteReadResponse.status,
          deleteReadResponse.body
        );

        // 7. Verify deletion worked
        const finalBellResponse = await request(app)
          .get("/api/v1/system-messages/bell-notifications")
          .set("Authorization", `Bearer ${adminToken}`);

        console.log("\n=== AFTER DELETION ===");
        console.log(
          "Final bell notifications count:",
          finalBellResponse.body.data.notifications.length
        );

        // 8. Try to delete again (should fail with 404)
        console.log("\n=== TRYING TO DELETE AGAIN (SHOULD FAIL) ===");
        const deleteAgainResponse = await request(app)
          .delete(
            `/api/v1/system-messages/bell-notifications/${readNotification.id}`
          )
          .set("Authorization", `Bearer ${adminToken}`);

        console.log(
          "Delete again response:",
          deleteAgainResponse.status,
          deleteAgainResponse.body
        );
      }
    }

    // 9. Check user's bellNotificationStates directly
    console.log("\n=== CHECKING USER'S BELL NOTIFICATION STATES ===");
    const userWithStates = await User.findById(adminUser._id).select(
      "bellNotificationStates"
    );
    console.log("User's bell notification states:");
    userWithStates?.bellNotificationStates.forEach(
      (state: any, index: number) => {
        console.log(`State ${index + 1}:`, {
          messageId: state.messageId,
          isRead: state.isRead,
          isRemoved: state.isRemoved,
          readAt: state.readAt,
          removedAt: state.removedAt,
        });
      }
    );
  });
});
