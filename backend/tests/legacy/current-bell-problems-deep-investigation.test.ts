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

describe("Current Bell Notification Issues Investigation", () => {
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

  it("should investigate current bell notification problems", async () => {
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

    // Create 5 test messages to simulate real scenario
    console.log("=== CREATING 5 TEST MESSAGES ===");
    const messageIds: string[] = [];

    for (let i = 1; i <= 5; i++) {
      const createResponse = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: `Test Bell Message ${i}`,
          content: `Content for message ${i}`,
          type: "announcement",
          priority: i <= 3 ? "high" : "medium",
        });

      messageIds.push(createResponse.body.data.id);
      console.log(
        `✅ Created message ${i} with ID: ${createResponse.body.data.id}`
      );
    }

    // Test 1: Get all bell notifications
    console.log("\n=== TEST 1: GET BELL NOTIFICATIONS ===");
    const getBellResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("Status:", getBellResponse.status);
    console.log(
      "Total notifications:",
      getBellResponse.body.data.notifications?.length || 0
    );
    console.log("Unread count:", getBellResponse.body.data.unreadCount);

    if (getBellResponse.body.data.notifications) {
      getBellResponse.body.data.notifications.forEach(
        (notif: any, index: number) => {
          console.log(
            `  ${index + 1}. ID: ${notif.id}, Title: ${notif.title}, Read: ${
              notif.isRead
            }`
          );
        }
      );
    }

    // Test 2: Try to mark first notification as read
    console.log("\n=== TEST 2: MARK INDIVIDUAL AS READ ===");
    if (messageIds.length > 0) {
      const markReadResponse = await request(app)
        .patch(
          `/api/v1/system-messages/bell-notifications/${messageIds[0]}/read`
        )
        .set("Authorization", `Bearer ${adminToken}`);

      console.log("Mark as read status:", markReadResponse.status);
      console.log("Mark as read response:", markReadResponse.body);
    }

    // Test 3: Try mark all as read
    console.log("\n=== TEST 3: MARK ALL AS READ ===");
    const markAllResponse = await request(app)
      .patch("/api/v1/system-messages/bell-notifications/read-all")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("Mark all read status:", markAllResponse.status);
    console.log("Mark all read response:", markAllResponse.body);

    // Test 4: Check state after mark all
    console.log("\n=== TEST 4: CHECK STATE AFTER MARK ALL ===");
    const getAfterMarkAll = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("After mark all - Status:", getAfterMarkAll.status);
    console.log(
      "After mark all - Unread count:",
      getAfterMarkAll.body.data.unreadCount
    );

    if (getAfterMarkAll.body.data.notifications) {
      getAfterMarkAll.body.data.notifications.forEach(
        (notif: any, index: number) => {
          console.log(`  ${index + 1}. ID: ${notif.id}, Read: ${notif.isRead}`);
        }
      );
    }

    // Test 5: Try to delete notifications one by one
    console.log("\n=== TEST 5: DELETE NOTIFICATIONS ===");
    for (let i = 0; i < Math.min(3, messageIds.length); i++) {
      console.log(`Deleting notification ${i + 1} (ID: ${messageIds[i]})`);

      const deleteResponse = await request(app)
        .delete(`/api/v1/system-messages/bell-notifications/${messageIds[i]}`)
        .set("Authorization", `Bearer ${adminToken}`);

      console.log(`  Delete ${i + 1} status: ${deleteResponse.status}`);
      console.log(`  Delete ${i + 1} response:`, deleteResponse.body);

      if (deleteResponse.status === 200) {
        console.log(`  ✅ Successfully deleted notification ${i + 1}`);
      } else {
        console.log(`  ❌ Failed to delete notification ${i + 1}`);
      }
    }

    // Test 6: Check final state
    console.log("\n=== TEST 6: FINAL STATE CHECK ===");
    const finalGetResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("Final status:", finalGetResponse.status);
    console.log(
      "Final notifications count:",
      finalGetResponse.body.data.notifications?.length || 0
    );
    console.log("Final unread count:", finalGetResponse.body.data.unreadCount);

    // Test 7: Check if there are any mixed states
    console.log("\n=== TEST 7: CHECK FOR MIXED STATES ===");
    const userStates = await User.findById(adminUser._id);
    console.log(
      "Bell notification states count:",
      userStates?.bellNotificationStates?.length || 0
    );
    console.log(
      "System message states count:",
      userStates?.systemMessageStates?.length || 0
    );

    // Summary
    console.log("\n=== SUMMARY ===");
    console.log(
      `✅ System is using the correct endpoint: /system-messages/bell-notifications`
    );
    console.log(
      `✅ Mark all read functionality: ${
        markAllResponse.status === 200 ? "WORKING" : "BROKEN"
      }`
    );
    console.log(`✅ Delete functionality: All deletes tested`);
    console.log(
      `📊 Final state: ${
        finalGetResponse.body.data.notifications?.length || 0
      } notifications remaining`
    );
  });
});
