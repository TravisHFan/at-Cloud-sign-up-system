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

describe("Dual Storage Notification Problem", () => {
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

  it("should demonstrate the dual storage problem", async () => {
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

    // Create regular user
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

    console.log("=== DEMONSTRATING DUAL STORAGE PROBLEM ===");

    // Simulate mixed notification creation (like the issue might occur in production)
    console.log(
      "\n--- STEP 1: Create notifications through different pathways ---"
    );

    // 1. Create system message (creates bellNotificationStates)
    const systemMessage = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "System Message Notification",
        content: "This creates bellNotificationStates",
        type: "announcement",
        priority: "high",
      });

    console.log("Created system message ID:", systemMessage.body.data.id);

    // 2. Manually add a bell notification to user's bellNotifications array
    // (This simulates if some other process creates bell notifications directly)
    await User.findByIdAndUpdate(regularUser._id, {
      $push: {
        bellNotifications: {
          _id: new mongoose.Types.ObjectId(),
          title: "Direct Bell Notification",
          message: "This is stored in bellNotifications array",
          type: "info",
          priority: "medium",
          isRead: false,
          createdAt: new Date(),
        },
      },
    });

    console.log("Added direct bell notification to user");

    // Check storage in user model
    console.log("\n--- STEP 2: Check user storage ---");
    const userCheck = await User.findById(regularUser._id);

    console.log("Regular user storage:");
    console.log(
      "  bellNotificationStates count:",
      userCheck?.bellNotificationStates?.length || 0
    );
    console.log(
      "  bellNotifications count:",
      userCheck?.bellNotifications?.length || 0
    );
    console.log(
      "  systemMessageStates count:",
      userCheck?.systemMessageStates?.length || 0
    );

    // Test what each system sees
    console.log("\n--- STEP 3: What each API endpoint sees ---");

    // System 1: /system-messages/bell-notifications (checks bellNotificationStates)
    const system1Response = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${regularToken}`);

    console.log("SYSTEM 1 (/system-messages/bell-notifications):");
    console.log("  Status:", system1Response.status);
    console.log(
      "  Notifications count:",
      system1Response.body.data?.notifications?.length || 0
    );
    console.log("  Unread count:", system1Response.body.data?.unreadCount || 0);

    if (system1Response.body.data?.notifications?.length > 0) {
      system1Response.body.data.notifications.forEach(
        (notif: any, i: number) => {
          console.log(`    ${i + 1}. ID: ${notif.id}, Title: "${notif.title}"`);
        }
      );
    }

    // System 2: /user/notifications/bell (checks bellNotifications array)
    const system2Response = await request(app)
      .get("/api/v1/user/notifications/bell")
      .set("Authorization", `Bearer ${regularToken}`);

    console.log("\nSYSTEM 2 (/user/notifications/bell):");
    console.log("  Status:", system2Response.status);
    console.log(
      "  Notifications count:",
      system2Response.body.data?.notifications?.length || 0
    );
    console.log("  Unread count:", system2Response.body.data?.unreadCount || 0);

    if (system2Response.body.data?.notifications?.length > 0) {
      system2Response.body.data.notifications.forEach(
        (notif: any, i: number) => {
          console.log(
            `    ${i + 1}. ID: ${notif._id || notif.id}, Title: "${
              notif.title
            }"`
          );
        }
      );
    }

    // Test the problem: Frontend can only interact with one system
    console.log("\n--- STEP 4: Demonstrate the problem ---");

    // If frontend uses System 1 endpoints:
    console.log("If frontend uses System 1 endpoints:");

    // Try to mark all as read via System 1
    const markAllSystem1 = await request(app)
      .patch("/api/v1/system-messages/bell-notifications/read-all")
      .set("Authorization", `Bearer ${regularToken}`);

    console.log(
      "  Mark all read via System 1:",
      markAllSystem1.status === 200 ? "SUCCESS" : "FAILED"
    );

    // Check what each system shows after System 1 mark all
    const afterSystem1 = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${regularToken}`);

    const afterSystem2 = await request(app)
      .get("/api/v1/user/notifications/bell")
      .set("Authorization", `Bearer ${regularToken}`);

    console.log("  After System 1 'mark all read':");
    console.log(
      "    System 1 unread count:",
      afterSystem1.body.data?.unreadCount || 0
    );
    console.log(
      "    System 2 unread count:",
      afterSystem2.body.data?.unreadCount || 0
    );
    console.log("    ❌ PROBLEM: System 2 notifications remain unread!");

    // Analysis
    console.log("\n=== PROBLEM ANALYSIS ===");
    console.log("🔴 ISSUE: Two separate notification storage systems:");
    console.log("   1. bellNotificationStates (for system messages)");
    console.log("   2. bellNotifications (for direct notifications)");
    console.log("");
    console.log(
      "🔴 IMPACT: Frontend can only interact with one system at a time"
    );
    console.log("   - Mark all read only affects one storage system");
    console.log("   - Delete only affects one storage system");
    console.log("   - User sees mixed state with some items unaffected");
    console.log("");
    console.log(
      "💡 SOLUTION: Unify both systems to use single storage approach"
    );
  });
});
