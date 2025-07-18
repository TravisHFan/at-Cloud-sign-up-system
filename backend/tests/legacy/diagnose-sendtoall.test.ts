import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import express from "express";
import dotenv from "dotenv";
import routes from "../src/routes";
import { User, SystemMessage } from "../src/models";

// Load environment variables
dotenv.config();

// Create test app
const app = express();
app.use(express.json());
app.use(routes);

describe("🔍 DIAGNOSE SEND TO ALL BELL NOTIFICATION CREATION", () => {
  let testUser: any;
  let authToken: string;

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
    // Clear all collections before each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }

    // Create test user
    testUser = await User.create({
      username: "testuser",
      firstName: "Test",
      lastName: "User",
      email: "testuser@example.com",
      password: "Password123", // Meets requirements: uppercase, lowercase, number
      role: "Administrator", // Need admin role to create system messages
      isActive: true,
      isVerified: true,
      isAtCloudLeader: false,
      loginAttempts: 0,
      hasReceivedWelcomeMessage: false,
    });

    // Get auth token through login (more reliable than manual JWT)
    const loginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        emailOrUsername: "testuser@example.com",
        password: "Password123",
      });

    expect(loginResponse.status).toBe(200);
    authToken = loginResponse.body.data.accessToken;

    console.log("✅ Created test user:", testUser.email);
    console.log("✅ Got auth token via login");
  });

  describe("Bell Notification Creation Investigation", () => {
    it("should investigate if sendToAll creates bell notifications", async () => {
      console.log(
        "\n🔍 === TESTING SEND TO ALL BELL NOTIFICATION CREATION ==="
      );

      // Step 1: Check initial state
      console.log("📊 Step 1 - Check initial user state...");
      const initialUser = await User.findById(testUser._id);
      console.log(
        "   Initial bellNotifications:",
        initialUser?.bellNotifications?.length || 0
      );
      console.log(
        "   Initial bellNotificationStates:",
        initialUser?.bellNotificationStates?.length || 0
      );

      // Step 2: Create system message (automatically sends to all users)
      console.log(
        "\n📝 Step 2 - Create system message (auto-sends to all users)..."
      );
      const createResponse = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          title: "Test Message",
          content:
            "This message should create bell notifications for all users",
          priority: "medium", // Fix: use 'medium' instead of 'normal'
          type: "announcement",
        });

      console.log("   Create response status:", createResponse.status);
      console.log(
        "   Create response body:",
        JSON.stringify(createResponse.body, null, 2)
      );

      if (createResponse.status !== 201) {
        console.log("❌ System message creation failed!");
        return;
      }

      const messageId = createResponse.body.id || createResponse.body._id;
      console.log("   ✅ Created system message ID:", messageId);

      // Step 3: Check if bell notifications were created
      console.log("\n🔔 Step 3 - Check if bell notifications were created...");
      const updatedUser = await User.findById(testUser._id);
      console.log(
        "   Updated bellNotifications:",
        updatedUser?.bellNotifications?.length || 0
      );
      console.log(
        "   Updated bellNotificationStates:",
        updatedUser?.bellNotificationStates?.length || 0
      );

      if (updatedUser?.bellNotificationStates?.length) {
        console.log(
          "   Bell notification state details:",
          updatedUser.bellNotificationStates[0]
        );
      }

      // Step 4: Check what's in the SystemMessage
      console.log("\n📄 Step 4 - Check system message details...");
      const systemMessage = await SystemMessage.findById(messageId);
      console.log("   System message isActive:", systemMessage?.isActive);
      console.log("   System message details:", {
        id: systemMessage?._id,
        title: systemMessage?.title,
        isActive: systemMessage?.isActive,
        createdAt: systemMessage?.createdAt,
        type: systemMessage?.type,
      });

      // Step 5: Try to get bell notifications via API
      console.log("\n📡 Step 5 - Try to get bell notifications via API...");
      const bellNotificationsResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${authToken}`);

      console.log(
        "   Bell notifications API status:",
        bellNotificationsResponse.status
      );
      console.log(
        "   Bell notifications API body:",
        JSON.stringify(bellNotificationsResponse.body, null, 2)
      );

      // Step 6: Check if there are ANY system messages for this user
      console.log("\n📋 Step 6 - Check system messages for user...");
      const systemMessagesResponse = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${authToken}`);

      console.log(
        "   System messages API status:",
        systemMessagesResponse.status
      );
      console.log(
        "   System messages count:",
        systemMessagesResponse.body?.data?.length || 0
      );

      // Summary
      console.log("\n📊 === INVESTIGATION SUMMARY ===");
      console.log(
        "System Message Created:",
        createResponse.status === 201 ? "✅" : "❌"
      );
      console.log(
        "Bell Notifications in User Model:",
        (updatedUser?.bellNotificationStates?.length || 0) > 0 ? "✅" : "❌"
      );
      console.log(
        "Bell Notifications API Working:",
        bellNotificationsResponse.status === 200 ? "✅" : "❌"
      );
      console.log(
        "System Messages API Working:",
        systemMessagesResponse.status === 200 ? "✅" : "❌"
      );
    });

    it("should check all available endpoints for bell notifications", async () => {
      console.log("\n🌐 === CHECKING ALL BELL NOTIFICATION ENDPOINTS ===");

      // Create a system message first
      const createResponse = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          title: "Test Message for Endpoint Check",
          content: "Testing endpoints",
          priority: "medium", // Fix: use 'medium' instead of 'normal'
          type: "announcement",
        });

      console.log("Created message status:", createResponse.status);

      // Test all possible bell notification endpoints
      const endpoints = [
        "GET /api/v1/system-messages/bell-notifications",
        "GET /api/v1/user/notifications/bell",
        "GET /api/v1/user/notifications",
        "GET /api/v1/system-messages/notifications",
      ];

      for (const endpoint of endpoints) {
        const [method, path] = endpoint.split(" ");
        console.log(`\n🔍 Testing ${endpoint}...`);

        const response = await request(app)
          .get(path)
          .set("Authorization", `Bearer ${authToken}`);

        console.log(`   Status: ${response.status}`);
        if (response.status === 200) {
          console.log(`   ✅ Working! Response:`, response.body);
        } else {
          console.log(`   ❌ Failed: ${response.status}`);
        }
      }
    });
  });
});
