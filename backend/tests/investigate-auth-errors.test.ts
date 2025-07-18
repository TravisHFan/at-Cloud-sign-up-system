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

describe("🔍 INVESTIGATE AUTH ERROR HANDLING", () => {
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

    // Create a system message
    const systemMessageResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        title: "Test Message for Auth Investigation",
        content: "Testing auth error handling",
        priority: "medium",
        type: "announcement",
      });

    systemMessageId = systemMessageResponse.body.data.id;
  });

  describe("Authentication Error Investigation", () => {
    it("should investigate authentication error handling", async () => {
      console.log("\n🔍 === INVESTIGATING AUTH ERROR HANDLING ===");

      // Test with completely invalid token
      console.log("\n🧪 Testing with invalid token format...");
      const invalidTokenResponse = await request(app)
        .delete(`/api/v1/system-messages/bell-notifications/${systemMessageId}`)
        .set("Authorization", "Bearer invalid-token-format");

      console.log("❓ DELETE with invalid token:", invalidTokenResponse.status);
      console.log("   Response:", invalidTokenResponse.body);

      // Test with no Authorization header
      console.log("\n🧪 Testing with no auth header...");
      const noAuthResponse = await request(app).delete(
        `/api/v1/system-messages/bell-notifications/${systemMessageId}`
      );

      console.log("❓ DELETE with no auth:", noAuthResponse.status);
      console.log("   Response:", noAuthResponse.body);

      // Test with malformed Bearer token
      console.log("\n🧪 Testing with malformed Bearer token...");
      const malformedResponse = await request(app)
        .delete(`/api/v1/system-messages/bell-notifications/${systemMessageId}`)
        .set("Authorization", "malformed");

      console.log("❓ DELETE with malformed auth:", malformedResponse.status);
      console.log("   Response:", malformedResponse.body);

      // Test with valid format but wrong JWT
      console.log("\n🧪 Testing with valid format but wrong JWT...");
      const wrongJwtResponse = await request(app)
        .delete(`/api/v1/system-messages/bell-notifications/${systemMessageId}`)
        .set(
          "Authorization",
          "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        );

      console.log("❓ DELETE with wrong JWT:", wrongJwtResponse.status);
      console.log("   Response:", wrongJwtResponse.body);

      console.log("\n🔍 === AUTH INVESTIGATION COMPLETE ===");
    });
  });
});
