import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { User, SystemMessage } from "../src/models";
import { NotificationService } from "../src/controllers/userNotificationController";
import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

describe("Complete Notification System Unification", () => {
  let authToken: string;
  let userId: string;
  let adminToken: string;
  let app: any;

  beforeAll(async () => {
    // Import app after environment is loaded - use direct import
    const appModule = await import("../src/index");
    app = (appModule as any).default || appModule;

    // Clean up any existing test data
    await User.deleteMany({ email: { $regex: /test.*@/ } });
    await SystemMessage.deleteMany({ content: /Test.*for complete/ });

    // Create test user
    const testUser = new User({
      firstName: "Test",
      lastName: "User",
      email: "test-complete@example.com",
      password: "password123",
      authLevel: "user",
      role: "user",
      isActive: true,
      emailVerified: true,
    });
    const savedUser = await testUser.save();
    userId = (savedUser as any)._id.toString();

    // Create admin user
    const adminUser = new User({
      firstName: "Admin",
      lastName: "User",
      email: "admin-complete@example.com",
      password: "password123",
      authLevel: "Administrator",
      role: "Administrator",
      isActive: true,
      emailVerified: true,
    });
    await adminUser.save();

    // Get auth tokens
    const userLoginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "test-complete@example.com",
        password: "password123",
      });
    authToken = userLoginResponse.body.data.token;

    const adminLoginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "admin-complete@example.com",
        password: "password123",
      });
    adminToken = adminLoginResponse.body.data.token;
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({ email: { $regex: /test.*@/ } });
    await SystemMessage.deleteMany({ content: /Test.*for complete/ });
  });

  it("should completely resolve the dual notification system problem", async () => {
    console.log("=== TESTING COMPLETE NOTIFICATION SYSTEM UNIFICATION ===");

    // STEP 1: Verify clean starting state
    console.log("--- STEP 1: Verify clean starting state ---");

    const initialNotifications = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${authToken}`);

    console.log(
      `Initial notification count: ${initialNotifications.body.data.notifications.length}`
    );
    console.log(
      `Initial unread count: ${initialNotifications.body.data.unreadCount}`
    );

    // STEP 2: Admin creates a system message (should create only ONE notification per user)
    console.log("--- STEP 2: Admin creates system message ---");

    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Test System Message",
        content: "Test notification for complete unification",
        type: "announcement",
        priority: "medium",
      });

    console.log(`Create system message status: ${createResponse.status}`);
    expect(createResponse.status).toBe(201);

    // STEP 3: Verify user gets exactly ONE notification (not duplicates)
    console.log("--- STEP 3: Verify single notification created ---");

    const afterCreateNotifications = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${authToken}`);

    const newNotificationCount =
      afterCreateNotifications.body.data.notifications.length;
    const newUnreadCount = afterCreateNotifications.body.data.unreadCount;

    console.log(
      `After system message - Total notifications: ${newNotificationCount}`
    );
    console.log(`After system message - Unread count: ${newUnreadCount}`);

    // Should be exactly 1 more notification
    expect(newNotificationCount).toBe(
      initialNotifications.body.data.notifications.length + 1
    );
    expect(newUnreadCount).toBe(initialNotifications.body.data.unreadCount + 1);

    // STEP 4: Use NotificationService (should also create only ONE notification)
    console.log("--- STEP 4: Test NotificationService (should be unified) ---");

    const serviceResult = await NotificationService.sendBellNotificationToUser(
      userId,
      {
        type: "USER_ACTION",
        category: "update",
        title: "Service Notification",
        message: "Test notification from service for complete unification",
        priority: "normal",
      }
    );

    console.log(`NotificationService result: ${serviceResult}`);
    expect(serviceResult).toBe(true);

    // STEP 5: Verify unified system - should have exactly 2 notifications total
    console.log("--- STEP 5: Verify unified system state ---");

    const afterServiceNotifications = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${authToken}`);

    const finalNotificationCount =
      afterServiceNotifications.body.data.notifications.length;
    const finalUnreadCount = afterServiceNotifications.body.data.unreadCount;

    console.log(
      `After service - Total notifications: ${finalNotificationCount}`
    );
    console.log(`After service - Unread count: ${finalUnreadCount}`);

    // Should be exactly 2 notifications total (1 from admin + 1 from service)
    expect(finalNotificationCount).toBe(
      initialNotifications.body.data.notifications.length + 2
    );
    expect(finalUnreadCount).toBe(
      initialNotifications.body.data.unreadCount + 2
    );

    // STEP 6: Test mark all as read (should work on all notifications)
    console.log("--- STEP 6: Test mark all as read functionality ---");

    const markAllResponse = await request(app)
      .patch("/api/v1/user/notifications/bell/read-all")
      .set("Authorization", `Bearer ${authToken}`);

    console.log(`Mark all as read status: ${markAllResponse.status}`);
    expect(markAllResponse.status).toBe(200);

    // Verify all notifications are now read
    const afterMarkAllNotifications = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${authToken}`);

    const afterMarkAllUnreadCount =
      afterMarkAllNotifications.body.data.unreadCount;
    console.log(`After mark all - Unread count: ${afterMarkAllUnreadCount}`);

    expect(afterMarkAllUnreadCount).toBe(0);

    // STEP 7: Test individual delete (should work consistently)
    console.log("--- STEP 7: Test delete functionality ---");

    const notifications = afterMarkAllNotifications.body.data.notifications;
    console.log(
      `All notifications are now read and deletable: ${notifications.length} items`
    );

    // Delete first notification
    if (notifications.length > 0) {
      const firstNotificationId = notifications[0].id;
      const deleteResponse = await request(app)
        .delete(
          `/api/v1/system-messages/bell-notifications/${firstNotificationId}`
        )
        .set("Authorization", `Bearer ${authToken}`);

      console.log(`Delete notification status: ${deleteResponse.status}`);
      expect(deleteResponse.status).toBe(200);

      // Verify notification count decreased
      const afterDeleteNotifications = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${authToken}`);

      const afterDeleteCount =
        afterDeleteNotifications.body.data.notifications.length;
      console.log(
        `After delete - Remaining notifications: ${afterDeleteCount}`
      );

      expect(afterDeleteCount).toBe(notifications.length - 1);
    }

    // STEP 8: Verify unread counts endpoint uses unified system
    console.log("--- STEP 8: Test unified unread counts ---");

    const unreadCountsResponse = await request(app)
      .get("/api/v1/user/notifications/unread-counts")
      .set("Authorization", `Bearer ${authToken}`);

    console.log(`Unread counts status: ${unreadCountsResponse.status}`);
    expect(unreadCountsResponse.status).toBe(200);

    const unreadData = unreadCountsResponse.body.data;
    console.log(
      `Unread counts - Bell: ${unreadData.bellNotifications}, System: ${unreadData.systemMessages}, Total: ${unreadData.total}`
    );

    // systemMessages should be 0 (deprecated), all counts should be in bellNotifications
    expect(unreadData.systemMessages).toBe(0);
    expect(unreadData.total).toBe(unreadData.bellNotifications);

    console.log("=== COMPLETE UNIFICATION SUCCESS ===");
    console.log("✅ No duplicate notifications created");
    console.log("✅ Mark all as read works across all notifications");
    console.log("✅ Delete works consistently for all notifications");
    console.log("✅ NotificationService uses unified system");
    console.log("✅ SystemMessage creation uses unified system");
    console.log("✅ Unread counts use unified system");
    console.log("✅ Single source of truth: bellNotificationStates only");
  });
});
