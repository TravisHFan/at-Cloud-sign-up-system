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

describe("Unified Notification System Migration", () => {
  let adminUser: any;
  let regularUser: any;
  let adminToken: string;
  let regularToken: string;

  beforeAll(async () => {
    if (!process.env.MONGODB_URI_TEST) {
      throw new Error("MONGODB_URI_TEST environment variable is not set");
    }
    await mongoose.connect(process.env.MONGODB_URI_TEST);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it("should successfully migrate to unified System 1 approach", async () => {
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
      username: "regular",
      email: "regular@test.com",
      password: "RegularPass123",
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
    adminToken = adminLogin.body.data.accessToken;

    const regularLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({
        emailOrUsername: "regular@test.com",
        password: "RegularPass123",
      });
    regularToken = regularLogin.body.data.accessToken;

    console.log("=== UNIFIED NOTIFICATION SYSTEM TEST ===");

    // Test 1: Create system message (should create bell notification states)
    console.log("\n--- TEST 1: Create system message ---");
    const systemMessage = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Unified System Test",
        content: "Testing unified notification system",
        type: "announcement",
        priority: "high",
      });

    console.log("Created system message ID:", systemMessage.body.data.id);
    expect(systemMessage.status).toBe(201);

    // Test 2: System 1 should see the notification
    console.log("\n--- TEST 2: System 1 should see the notification ---");
    const system1Get = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${regularToken}`);

    console.log("System 1 status:", system1Get.status);
    console.log(
      "System 1 notification count:",
      system1Get.body.data?.notifications?.length || 0
    );
    expect(system1Get.status).toBe(200);
    expect(system1Get.body.data.notifications.length).toBe(1);

    // Test 3: System 2 should see the SAME notification (after migration)
    console.log("\n--- TEST 3: System 2 should see the SAME notification ---");
    const system2Get = await request(app)
      .get("/api/v1/user/notifications/bell")
      .set("Authorization", `Bearer ${regularToken}`);

    console.log("System 2 status:", system2Get.status);
    console.log(
      "System 2 notification count:",
      system2Get.body.data?.notifications?.length || 0
    );

    // This should work after migration
    expect(system2Get.status).toBe(200);
    expect(system2Get.body.data.notifications.length).toBe(1);

    // Both systems should show the same notification
    const system1NotificationId = system1Get.body.data.notifications[0].id;
    const system2NotificationId =
      system2Get.body.data.notifications[0].id ||
      system2Get.body.data.notifications[0]._id;
    console.log("System 1 notification ID:", system1NotificationId);
    console.log("System 2 notification ID:", system2NotificationId);
    expect(system1NotificationId).toBe(system2NotificationId);

    // Test 4: Mark as read via System 1 should affect both systems
    console.log(
      "\n--- TEST 4: Mark as read via System 1 affects both systems ---"
    );
    const markRead = await request(app)
      .patch(
        `/api/v1/system-messages/bell-notifications/${system1NotificationId}/read`
      )
      .set("Authorization", `Bearer ${regularToken}`);

    console.log("Mark as read status:", markRead.status);
    expect(markRead.status).toBe(200);

    // Check both systems show as read
    const system1AfterRead = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${regularToken}`);

    const system2AfterRead = await request(app)
      .get("/api/v1/user/notifications/bell")
      .set("Authorization", `Bearer ${regularToken}`);

    console.log(
      "After mark read - System 1 unread count:",
      system1AfterRead.body.data?.unreadCount || 0
    );
    console.log(
      "After mark read - System 2 unread count:",
      system2AfterRead.body.data?.unreadCount || 0
    );

    expect(system1AfterRead.body.data.unreadCount).toBe(0);
    expect(system2AfterRead.body.data.unreadCount).toBe(0);

    // Test 5: Create more notifications and test mark all as read
    console.log(
      "\n--- TEST 5: Create more notifications and test mark all as read ---"
    );

    // Create 2 more system messages
    for (let i = 2; i <= 3; i++) {
      const message = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: `Test Message ${i}`,
          content: `Content ${i}`,
          type: "announcement",
          priority: "medium",
        });
      expect(message.status).toBe(201);
    }

    // Check both systems see all notifications
    const beforeMarkAll1 = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${regularToken}`);

    const beforeMarkAll2 = await request(app)
      .get("/api/v1/user/notifications/bell")
      .set("Authorization", `Bearer ${regularToken}`);

    console.log(
      "Before mark all - System 1 total:",
      beforeMarkAll1.body.data?.notifications?.length || 0
    );
    console.log(
      "Before mark all - System 2 total:",
      beforeMarkAll2.body.data?.notifications?.length || 0
    );
    console.log(
      "Before mark all - System 1 unread:",
      beforeMarkAll1.body.data?.unreadCount || 0
    );
    console.log(
      "Before mark all - System 2 unread:",
      beforeMarkAll2.body.data?.unreadCount || 0
    );

    expect(beforeMarkAll1.body.data.notifications.length).toBe(3);
    expect(beforeMarkAll2.body.data.notifications.length).toBe(3);
    expect(beforeMarkAll1.body.data.unreadCount).toBe(2); // 2 new unread
    expect(beforeMarkAll2.body.data.unreadCount).toBe(2); // 2 new unread

    // Test mark all as read
    const markAllRead = await request(app)
      .patch("/api/v1/system-messages/bell-notifications/read-all")
      .set("Authorization", `Bearer ${regularToken}`);

    console.log("Mark all as read status:", markAllRead.status);
    expect(markAllRead.status).toBe(200);

    // Check both systems show all as read
    const afterMarkAll1 = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${regularToken}`);

    const afterMarkAll2 = await request(app)
      .get("/api/v1/user/notifications/bell")
      .set("Authorization", `Bearer ${regularToken}`);

    console.log(
      "After mark all - System 1 unread:",
      afterMarkAll1.body.data?.unreadCount || 0
    );
    console.log(
      "After mark all - System 2 unread:",
      afterMarkAll2.body.data?.unreadCount || 0
    );

    expect(afterMarkAll1.body.data.unreadCount).toBe(0);
    expect(afterMarkAll2.body.data.unreadCount).toBe(0);

    // Test 6: Delete notification should work from both systems
    console.log(
      "\n--- TEST 6: Delete notification works from both systems ---"
    );

    const notificationToDelete = afterMarkAll1.body.data.notifications[0].id;

    // Delete via System 1
    const deleteViaSystem1 = await request(app)
      .delete(
        `/api/v1/system-messages/bell-notifications/${notificationToDelete}`
      )
      .set("Authorization", `Bearer ${regularToken}`);

    console.log("Delete via System 1 status:", deleteViaSystem1.status);
    expect(deleteViaSystem1.status).toBe(200);

    // Check both systems reflect the deletion
    const afterDelete1 = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${regularToken}`);

    const afterDelete2 = await request(app)
      .get("/api/v1/user/notifications/bell")
      .set("Authorization", `Bearer ${regularToken}`);

    console.log(
      "After delete - System 1 total:",
      afterDelete1.body.data?.notifications?.length || 0
    );
    console.log(
      "After delete - System 2 total:",
      afterDelete2.body.data?.notifications?.length || 0
    );

    expect(afterDelete1.body.data.notifications.length).toBe(2);
    expect(afterDelete2.body.data.notifications.length).toBe(2);

    // Test 7: Delete via System 2 should also work
    console.log("\n--- TEST 7: Delete via System 2 also works ---");

    const notificationToDelete2 = afterDelete1.body.data.notifications[0].id;

    const deleteViaSystem2 = await request(app)
      .delete(`/api/v1/user/notifications/bell/${notificationToDelete2}`)
      .set("Authorization", `Bearer ${regularToken}`);

    console.log("Delete via System 2 status:", deleteViaSystem2.status);
    expect(deleteViaSystem2.status).toBe(200);

    // Final check - both systems should have 1 notification left
    const final1 = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${regularToken}`);

    const final2 = await request(app)
      .get("/api/v1/user/notifications/bell")
      .set("Authorization", `Bearer ${regularToken}`);

    console.log(
      "Final - System 1 total:",
      final1.body.data?.notifications?.length || 0
    );
    console.log(
      "Final - System 2 total:",
      final2.body.data?.notifications?.length || 0
    );

    expect(final1.body.data.notifications.length).toBe(1);
    expect(final2.body.data.notifications.length).toBe(1);

    console.log("\n=== MIGRATION SUCCESS CRITERIA ===");
    console.log("✅ Both systems see the same notifications");
    console.log("✅ Mark as read works across both systems");
    console.log("✅ Mark all as read works across both systems");
    console.log("✅ Delete works from both systems");
    console.log("✅ All operations are synchronized");
  });
});
