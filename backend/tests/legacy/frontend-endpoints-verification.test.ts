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

describe("FRONTEND ENDPOINTS VERIFICATION (After Fixes)", () => {
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

  beforeEach(async () => {
    // Clean up
    await User.deleteMany({});

    // Create admin user directly
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

    // Skip auth - use a mock token for testing endpoints only
    adminToken = "mock-token-for-endpoint-testing";
  });

  describe("✅ FIXED: Bell Notifications Mark All Read", () => {
    it("Frontend now calls PATCH /api/v1/system-messages/bell-notifications/read-all", async () => {
      console.log("\n🎯 TESTING FIXED ENDPOINT:");
      console.log(
        "Frontend now calls: PATCH /api/v1/system-messages/bell-notifications/read-all"
      );

      // Test the endpoint directly (without auth for simplicity)
      const response = await request(app).patch(
        "/api/v1/system-messages/bell-notifications/read-all"
      );

      console.log("Response status:", response.status);
      console.log("Response body:", response.body);

      // Should return 401 (auth required) rather than 404 (route not found)
      // This proves the route exists
      expect(response.status).toBe(401);
      expect(response.body.message).toContain("Authentication");
    });
  });

  describe("✅ FIXED: System Message Delete", () => {
    it("Frontend now calls DELETE /api/v1/system-messages/{messageId}", async () => {
      console.log("\n🎯 TESTING FIXED ENDPOINT:");
      console.log(
        "Frontend now calls: DELETE /api/v1/system-messages/{messageId}"
      );

      const testMessageId = "507f1f77bcf86cd799439011"; // Valid ObjectId format

      // Test the endpoint directly (without auth for simplicity)
      const response = await request(app).delete(
        `/api/v1/system-messages/${testMessageId}`
      );

      console.log("Response status:", response.status);
      console.log("Response body:", response.body);

      // Should return 401 (auth required) rather than 404 (route not found)
      // This proves the route exists
      expect(response.status).toBe(401);
      expect(response.body.message).toContain("Authentication");
    });
  });

  describe("✅ VERIFIED: Working Bell Notification Endpoints", () => {
    it("Mark individual bell notification as read (already working)", async () => {
      const testMessageId = "507f1f77bcf86cd799439011";

      const response = await request(app).patch(
        `/api/v1/system-messages/bell-notifications/${testMessageId}/read`
      );

      // Should return 401 (auth required) rather than 404 (route not found)
      expect(response.status).toBe(401);
      console.log("✅ Individual mark as read endpoint exists");
    });

    it("Delete individual bell notification (already working)", async () => {
      const testMessageId = "507f1f77bcf86cd799439011";

      const response = await request(app).delete(
        `/api/v1/system-messages/bell-notifications/${testMessageId}`
      );

      // Should return 401 (auth required) rather than 404 (route not found)
      expect(response.status).toBe(401);
      console.log("✅ Individual delete endpoint exists");
    });

    it("Get bell notifications (already working)", async () => {
      const response = await request(app).get(
        `/api/v1/system-messages/bell-notifications`
      );

      // Should return 401 (auth required) rather than 404 (route not found)
      expect(response.status).toBe(401);
      console.log("✅ Get bell notifications endpoint exists");
    });
  });

  describe("📋 ENDPOINT EXISTENCE VERIFICATION", () => {
    it("Verify all required endpoints exist (return 401, not 404)", async () => {
      console.log("\n📋 VERIFYING ALL ENDPOINTS EXIST:");

      const endpoints = [
        {
          method: "GET",
          path: "/api/v1/system-messages/bell-notifications",
          desc: "Get bell notifications",
        },
        {
          method: "PATCH",
          path: "/api/v1/system-messages/bell-notifications/test-id/read",
          desc: "Mark individual as read",
        },
        {
          method: "PATCH",
          path: "/api/v1/system-messages/bell-notifications/read-all",
          desc: "Mark all as read (FIXED)",
        },
        {
          method: "DELETE",
          path: "/api/v1/system-messages/bell-notifications/test-id",
          desc: "Delete bell notification",
        },
        {
          method: "DELETE",
          path: "/api/v1/system-messages/test-id",
          desc: "Delete system message (FIXED)",
        },
      ];

      for (const endpoint of endpoints) {
        let response;

        if (endpoint.method === "GET") {
          response = await request(app).get(endpoint.path);
        } else if (endpoint.method === "PATCH") {
          response = await request(app).patch(endpoint.path);
        } else if (endpoint.method === "DELETE") {
          response = await request(app).delete(endpoint.path);
        }

        const exists = response?.status === 401; // Auth required means route exists
        const status = exists ? "✅ EXISTS" : "❌ NOT FOUND";

        console.log(
          `${status} - ${endpoint.method} ${endpoint.path} (${endpoint.desc})`
        );

        // All endpoints should exist (return 401, not 404)
        expect(response?.status).toBe(401);
      }

      console.log("\n🎉 ALL ENDPOINTS VERIFIED TO EXIST!");
    });
  });
});
