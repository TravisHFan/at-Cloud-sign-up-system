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

describe("Bell Notifications - Integration Test (Fixed)", () => {
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

  it("COMPLETE WORKFLOW: Create → Read → Mark All Read → Delete", async () => {
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

    console.log("\n🎯 COMPLETE BELL NOTIFICATION WORKFLOW TEST");

    // STEP 1: Create multiple notifications
    console.log("\n📝 STEP 1: Creating notifications...");
    const messageIds: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const createResponse = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: `Workflow Test Message ${i}`,
          content: `Content ${i}`,
          type: "announcement",
          priority: "medium",
        });
      expect(createResponse.status).toBe(201);
      messageIds.push(createResponse.body.data.id);
    }
    console.log(`✅ Created ${messageIds.length} notifications`);

    // STEP 2: Get all notifications (should all be unread)
    console.log("\n📋 STEP 2: Getting notifications...");
    const allNotifications = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(allNotifications.status).toBe(200);
    expect(allNotifications.body.data.unreadCount).toBe(3);
    console.log(
      `✅ Found ${allNotifications.body.data.unreadCount} unread notifications`
    );

    // STEP 3: Mark one notification as read
    console.log("\n📖 STEP 3: Marking one notification as read...");
    const markOneRead = await request(app)
      .patch(`/api/v1/system-messages/bell-notifications/${messageIds[0]}/read`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(markOneRead.status).toBe(200);

    const afterOneRead = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(afterOneRead.body.data.unreadCount).toBe(2);
    console.log(
      `✅ Unread count reduced to ${afterOneRead.body.data.unreadCount}`
    );

    // STEP 4: Mark ALL notifications as read
    console.log("\n📚 STEP 4: Marking all notifications as read...");
    const markAllRead = await request(app)
      .patch("/api/v1/system-messages/bell-notifications/read-all")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(markAllRead.status).toBe(200);
    expect(markAllRead.body.data.markedCount).toBe(3);

    const afterAllRead = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(afterAllRead.body.data.unreadCount).toBe(0);
    console.log(
      `✅ All notifications marked as read (marked ${markAllRead.body.data.markedCount} notifications)`
    );

    // STEP 5: Delete notifications
    console.log("\n🗑️ STEP 5: Deleting notifications...");
    let deletedCount = 0;
    for (const messageId of messageIds) {
      const deleteResponse = await request(app)
        .delete(`/api/v1/system-messages/bell-notifications/${messageId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      if (deleteResponse.status === 200) {
        deletedCount++;
      }
    }

    const finalCheck = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(finalCheck.body.data.notifications.length).toBe(0);
    console.log(
      `✅ Deleted ${deletedCount} notifications, final count: ${finalCheck.body.data.notifications.length}`
    );

    console.log("\n🎉 COMPLETE WORKFLOW TEST PASSED!");
    console.log("✅ All bell notification features working correctly:");
    console.log("   - Create notifications");
    console.log("   - Get notifications with unread count");
    console.log("   - Mark individual notifications as read");
    console.log("   - Mark ALL notifications as read");
    console.log("   - Delete notifications");
  });
});
