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

describe("Dual Origin Notification Problem Investigation", () => {
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

  it("should investigate notifications from different origins", async () => {
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

    console.log("=== INVESTIGATING DUAL ORIGIN NOTIFICATIONS ===");

    // Create system message (this should create bell notifications automatically)
    console.log("\n--- STEP 1: Create system message ---");
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Dual Origin Test Message",
        content: "Testing dual notification origins",
        type: "announcement",
        priority: "high",
      });

    const messageId = createResponse.body.data.id;
    console.log("Created system message ID:", messageId);

    // Check what both systems see
    console.log("\n--- STEP 2: Check both notification systems ---");

    // System 1: /system-messages/bell-notifications
    const system1Response = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("SYSTEM 1 (/system-messages/bell-notifications):");
    console.log("  Status:", system1Response.status);
    console.log(
      "  Count:",
      system1Response.body.data?.notifications?.length || 0
    );
    console.log("  Unread:", system1Response.body.data?.unreadCount || 0);

    if (system1Response.body.data?.notifications?.length > 0) {
      system1Response.body.data.notifications.forEach(
        (notif: any, i: number) => {
          console.log(
            `    ${i + 1}. ID: ${notif.id}, Title: ${notif.title}, Read: ${
              notif.isRead
            }`
          );
        }
      );
    }

    // System 2: /user/notifications/bell
    const system2Response = await request(app)
      .get("/api/v1/user/notifications/bell")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("\nSYSTEM 2 (/user/notifications/bell):");
    console.log("  Status:", system2Response.status);
    console.log(
      "  Count:",
      system2Response.body.data?.notifications?.length || 0
    );
    console.log("  Unread:", system2Response.body.data?.unreadCount || 0);

    if (system2Response.body.data?.notifications?.length > 0) {
      system2Response.body.data.notifications.forEach(
        (notif: any, i: number) => {
          console.log(
            `    ${i + 1}. ID: ${notif.id}, Title: ${notif.title}, Read: ${
              notif.isRead
            }`
          );
        }
      );
    }

    // Check user model to see the states
    console.log("\n--- STEP 3: Check user model states ---");
    const userStates = await User.findById(adminUser._id);
    console.log(
      "Bell notification states count:",
      userStates?.bellNotificationStates?.length || 0
    );
    console.log(
      "System message states count:",
      userStates?.systemMessageStates?.length || 0
    );

    if (
      userStates?.bellNotificationStates &&
      userStates.bellNotificationStates.length > 0
    ) {
      console.log("Bell notification states:");
      userStates.bellNotificationStates.forEach((state: any, i: number) => {
        console.log(
          `  ${i + 1}. MessageID: ${state.messageId}, Read: ${
            state.isRead
          }, Removed: ${state.isRemoved}`
        );
      });
    }

    if (
      userStates?.systemMessageStates &&
      userStates.systemMessageStates.length > 0
    ) {
      console.log("System message states:");
      userStates.systemMessageStates.forEach((state: any, i: number) => {
        console.log(
          `  ${i + 1}. MessageID: ${state.messageId}, Read: ${
            state.isRead
          }, Removed: ${state.isRemoved}`
        );
      });
    }

    // Test cross-system operations
    console.log("\n--- STEP 4: Test cross-system operations ---");

    // Try to mark as read using System 1 endpoint
    console.log("Marking as read via System 1...");
    const markReadSystem1 = await request(app)
      .patch(`/api/v1/system-messages/bell-notifications/${messageId}/read`)
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("Mark read System 1 status:", markReadSystem1.status);

    // Check both systems after System 1 mark as read
    const afterSystem1Read = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    const afterSystem2Read = await request(app)
      .get("/api/v1/user/notifications/bell")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("After System 1 mark as read:");
    console.log(
      "  System 1 unread count:",
      afterSystem1Read.body.data?.unreadCount || 0
    );
    console.log(
      "  System 2 unread count:",
      afterSystem2Read.body.data?.unreadCount || 0
    );

    // Try to delete using System 1 endpoint
    console.log("\nDeleting via System 1...");
    const deleteSystem1 = await request(app)
      .delete(`/api/v1/system-messages/bell-notifications/${messageId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("Delete System 1 status:", deleteSystem1.status);

    // Check both systems after System 1 delete
    const finalSystem1 = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    const finalSystem2 = await request(app)
      .get("/api/v1/user/notifications/bell")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("After System 1 delete:");
    console.log(
      "  System 1 notification count:",
      finalSystem1.body.data?.notifications?.length || 0
    );
    console.log(
      "  System 2 notification count:",
      finalSystem2.body.data?.notifications?.length || 0
    );

    // Summary
    console.log("\n=== PROBLEM ANALYSIS ===");
    console.log(
      "🔍 Issue: Two parallel notification systems with separate state management"
    );
    console.log(
      "📊 Impact: Frontend can only interact with one system, leaving orphaned notifications"
    );
    console.log(
      "💡 Solution: Unify both systems to use the same state management"
    );
  });
});
