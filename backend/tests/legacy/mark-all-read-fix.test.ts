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

describe("🔧 Bell Notification Mark All Read Fix", () => {
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

    // Create multiple system messages to generate bell notifications
    await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "First Test Message",
        content: "First test content",
        type: "announcement",
        priority: "high",
      });

    await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Second Test Message",
        content: "Second test content",
        type: "maintenance",
        priority: "medium",
      });

    await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Third Test Message",
        content: "Third test content",
        type: "update",
        priority: "low",
      });
  });

  it("🔍 should demonstrate the mark all read bug is now fixed", async () => {
    console.log("\n=== Demonstrating Mark All Read is Now Fixed ===");

    // Verify we have multiple unread notifications
    const initialResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${regularToken}`);

    expect(initialResponse.status).toBe(200);
    expect(initialResponse.body.data.unreadCount).toBe(3);
    console.log("✅ Initial state: 3 unread notifications");

    // Try mark all as read (should now work with the fix)
    const markAllResponse = await request(app)
      .put("/api/v1/user/notifications/bell/read-all")
      .set("Authorization", `Bearer ${regularToken}`);

    expect(markAllResponse.status).toBe(200);
    console.log(
      "Mark all response:",
      JSON.stringify(markAllResponse.body, null, 2)
    );

    // After fix: markedCount should be 3, not 0
    expect(markAllResponse.body.data.markedCount).toBe(3);
    console.log("✅ FIX CONFIRMED: markedCount is 3 as expected");

    // Verify notifications are now read
    const finalResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${regularToken}`);

    expect(finalResponse.body.data.unreadCount).toBe(0);
    console.log("✅ FIX CONFIRMED: All notifications are now read");
  });

  it("🔧 should test the fixed mark all read functionality", async () => {
    console.log("\n=== Testing Mark All Read After Fix ===");

    // Verify initial state
    const initialResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${regularToken}`);

    expect(initialResponse.status).toBe(200);
    expect(initialResponse.body.data.unreadCount).toBe(3);
    console.log("✅ Initial state: 3 unread notifications");

    // Test mark all as read after fix
    const markAllResponse = await request(app)
      .put("/api/v1/user/notifications/bell/read-all")
      .set("Authorization", `Bearer ${regularToken}`);

    expect(markAllResponse.status).toBe(200);
    console.log(
      "Mark all response after fix:",
      JSON.stringify(markAllResponse.body, null, 2)
    );

    // After fix: markedCount should be 3
    if (markAllResponse.body.data.markedCount === 3) {
      console.log("✅ FIX VERIFIED: markedCount is 3 as expected");
    } else {
      console.log(
        "❌ FIX NOT WORKING: markedCount is still",
        markAllResponse.body.data.markedCount
      );
    }

    // Verify all notifications are now read
    const finalResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${regularToken}`);

    console.log("Final unread count:", finalResponse.body.data.unreadCount);

    if (finalResponse.body.data.unreadCount === 0) {
      console.log("✅ FIX VERIFIED: All notifications are now read");
    } else {
      console.log("❌ FIX NOT WORKING: Still have unread notifications");
    }

    // Show which notifications are read/unread
    console.log("Final notifications status:");
    finalResponse.body.data.notifications.forEach((notification: any) => {
      console.log(
        `   - ${notification.title}: ${notification.isRead ? "READ" : "UNREAD"}`
      );
    });
  });

  it("🔍 should test database state directly", async () => {
    console.log("\n=== Testing Database State Directly ===");

    // Check the user's bellNotificationStates before mark all read
    const userBefore = await User.findById(regularUser._id);
    console.log("Bell notification states before mark all read:");
    userBefore?.bellNotificationStates.forEach((state: any) => {
      console.log(
        `   - messageId: ${state.messageId}, isRead: ${state.isRead}`
      );
    });

    console.log("Bell notifications before mark all read:");
    userBefore?.bellNotifications.forEach((notification: any) => {
      console.log(
        `   - id: ${notification.id}, isRead: ${notification.isRead}`
      );
    });

    // Call mark all read
    await request(app)
      .put("/api/v1/user/notifications/bell/read-all")
      .set("Authorization", `Bearer ${regularToken}`);

    // Check the user's state after mark all read
    const userAfter = await User.findById(regularUser._id);
    console.log("Bell notification states after mark all read:");
    userAfter?.bellNotificationStates.forEach((state: any) => {
      console.log(
        `   - messageId: ${state.messageId}, isRead: ${state.isRead}`
      );
    });

    console.log("Bell notifications after mark all read:");
    userAfter?.bellNotifications.forEach((notification: any) => {
      console.log(
        `   - id: ${notification.id}, isRead: ${notification.isRead}`
      );
    });
  });
});
