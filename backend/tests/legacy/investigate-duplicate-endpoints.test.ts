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

describe("🔍 INVESTIGATE DUPLICATE ENDPOINT ISSUE", () => {
  let testUser: any;
  let authToken: string;
  let systemMessageId: string;

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
      password: "Password123",
      role: "Administrator",
      isActive: true,
      isVerified: true,
      isAtCloudLeader: false,
      loginAttempts: 0,
      hasReceivedWelcomeMessage: false,
    });

    // Get auth token through login
    const loginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        emailOrUsername: "testuser@example.com",
        password: "Password123",
      });

    expect(loginResponse.status).toBe(200);
    authToken = loginResponse.body.data.accessToken;

    // Create a system message that automatically sends to all users
    const systemMessageResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        title: "Test Message for Endpoint Investigation",
        content: "This message should create bell notifications for all users",
        priority: "medium",
        type: "announcement",
      });

    systemMessageId = systemMessageResponse.body.data.id;
    console.log("✅ Created system message with ID:", systemMessageId);
  });

  describe("Endpoint Investigation", () => {
    it("should investigate why user/notifications/bell endpoints return 200", async () => {
      console.log("\n🔍 === INVESTIGATING DUPLICATE ENDPOINTS ===");

      // Check what's in the user's bellNotifications vs bellNotificationStates
      const user = await User.findById(testUser._id);
      console.log(
        "📋 User bellNotifications array:",
        user?.bellNotifications?.length || 0
      );
      console.log(
        "📋 User bellNotificationStates array:",
        user?.bellNotificationStates?.length || 0
      );

      if (user?.bellNotificationStates?.length) {
        console.log(
          "📧 First bellNotificationState:",
          user.bellNotificationStates[0]
        );
      }

      // Test correct system-messages endpoints
      console.log("\n✅ Testing CORRECT system-messages endpoints...");

      const correctGetResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${authToken}`);

      console.log(
        "✅ GET /api/v1/system-messages/bell-notifications:",
        correctGetResponse.status
      );
      console.log(
        "   Notifications count:",
        correctGetResponse.body.data?.notifications?.length || 0
      );

      if (correctGetResponse.body.data?.notifications?.length > 0) {
        const notificationId = correctGetResponse.body.data.notifications[0].id;

        const correctMarkReadResponse = await request(app)
          .patch(
            `/api/v1/system-messages/bell-notifications/${notificationId}/read`
          )
          .set("Authorization", `Bearer ${authToken}`);

        console.log(
          "✅ PATCH /api/v1/system-messages/bell-notifications/:id/read:",
          correctMarkReadResponse.status
        );
      }

      // Test problematic user/notifications/bell endpoints
      console.log(
        "\n❓ Testing PROBLEMATIC user/notifications/bell endpoints..."
      );

      const userBellGetResponse = await request(app)
        .get("/api/v1/user/notifications/bell")
        .set("Authorization", `Bearer ${authToken}`);

      console.log(
        "❓ GET /api/v1/user/notifications/bell:",
        userBellGetResponse.status
      );
      console.log(
        "   Notifications count:",
        userBellGetResponse.body.data?.notifications?.length || 0
      );
      console.log(
        "   Full response:",
        JSON.stringify(userBellGetResponse.body, null, 2)
      );

      // Try to mark read using the wrong endpoint with system message ID
      console.log(
        "\n🧪 Testing user/notifications/bell methods with system message ID..."
      );
      const wrongMarkReadResponse = await request(app)
        .put(`/api/v1/user/notifications/bell/${systemMessageId}/read`)
        .set("Authorization", `Bearer ${authToken}`);

      console.log(
        "❓ PUT /api/v1/user/notifications/bell/:id/read:",
        wrongMarkReadResponse.status
      );
      console.log("   Response:", wrongMarkReadResponse.body);

      // Try to delete using the wrong endpoint with system message ID
      const wrongDeleteResponse = await request(app)
        .delete(`/api/v1/user/notifications/bell/${systemMessageId}`)
        .set("Authorization", `Bearer ${authToken}`);

      console.log(
        "❓ DELETE /api/v1/user/notifications/bell/:id:",
        wrongDeleteResponse.status
      );
      console.log("   Response:", wrongDeleteResponse.body);

      // Try with a completely fake ID to see if it returns 404
      console.log("\n🧪 Testing with completely fake ID...");
      const fakeId = "507f1f77bcf86cd799439011";

      const fakeMarkReadResponse = await request(app)
        .put(`/api/v1/user/notifications/bell/${fakeId}/read`)
        .set("Authorization", `Bearer ${authToken}`);

      console.log(
        "❓ PUT /api/v1/user/notifications/bell/fake-id/read:",
        fakeMarkReadResponse.status
      );
      console.log("   Response:", fakeMarkReadResponse.body);

      const fakeDeleteResponse = await request(app)
        .delete(`/api/v1/user/notifications/bell/${fakeId}`)
        .set("Authorization", `Bearer ${authToken}`);

      console.log(
        "❓ DELETE /api/v1/user/notifications/bell/fake-id:",
        fakeDeleteResponse.status
      );
      console.log("   Response:", fakeDeleteResponse.body);

      console.log("\n🔍 === INVESTIGATION COMPLETE ===");
    });
  });
});
