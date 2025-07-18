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
app.use("/api/v1", routes);

describe("FRONTEND-BACKEND ENDPOINT MISMATCH INVESTIGATION", () => {
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

    console.log("Login response:", adminLogin.body);
    adminToken = adminLogin.body.data.token;
  });

  describe("🔍 BELL NOTIFICATIONS - Frontend vs Backend Endpoint Check", () => {
    it("❌ FRONTEND ISSUE 1: Mark all as read endpoint mismatch", async () => {
      console.log("\n🚨 TESTING FRONTEND vs BACKEND ENDPOINTS");

      // Create test notification
      const createResponse = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test Notification",
          content: "Test content",
          type: "announcement",
          priority: "high",
        });

      console.log("\n📋 Frontend calls (WRONG):");
      console.log("❌ PUT /api/v1/user/notifications/bell/read-all");

      // Test what frontend is calling (WRONG)
      const frontendCall = await request(app)
        .put("/api/v1/user/notifications/bell/read-all")
        .set("Authorization", `Bearer ${adminToken}`);

      console.log(
        "Frontend call result:",
        frontendCall.status,
        frontendCall.body
      );

      console.log("\n📋 Backend expects (CORRECT):");
      console.log(
        "✅ PATCH /api/v1/system-messages/bell-notifications/read-all"
      );

      // Test what backend actually supports (CORRECT)
      const backendCall = await request(app)
        .patch("/api/v1/system-messages/bell-notifications/read-all")
        .set("Authorization", `Bearer ${adminToken}`);

      console.log("Backend call result:", backendCall.status, backendCall.body);

      // The frontend call should fail, backend call should succeed
      expect(frontendCall.status).not.toBe(200); // Frontend calling wrong endpoint
      expect(backendCall.status).toBe(200); // Backend endpoint works
    });

    it("✅ BELL NOTIFICATIONS: Individual mark as read (should work)", async () => {
      // Create test notification
      const createResponse = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test Individual Read",
          content: "Test content",
          type: "announcement",
          priority: "high",
        });

      const messageId = createResponse.body.data.id;

      console.log("\n📋 Frontend calls:");
      console.log("PATCH /api/v1/system-messages/bell-notifications/:id/read");

      // Test individual mark as read (frontend calls this correctly)
      const markReadResponse = await request(app)
        .patch(`/api/v1/system-messages/bell-notifications/${messageId}/read`)
        .set("Authorization", `Bearer ${adminToken}`);

      console.log(
        "Mark read result:",
        markReadResponse.status,
        markReadResponse.body
      );
      expect(markReadResponse.status).toBe(200);
    });

    it("✅ BELL NOTIFICATIONS: Delete notification (should work)", async () => {
      // Create test notification
      const createResponse = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test Delete",
          content: "Test content",
          type: "announcement",
          priority: "high",
        });

      const messageId = createResponse.body.data.id;

      console.log("\n📋 Frontend calls:");
      console.log("DELETE /api/v1/system-messages/bell-notifications/:id");

      // Test delete (frontend calls this correctly)
      const deleteResponse = await request(app)
        .delete(`/api/v1/system-messages/bell-notifications/${messageId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      console.log("Delete result:", deleteResponse.status, deleteResponse.body);
      expect(deleteResponse.status).toBe(200);
    });
  });

  describe("🔍 SYSTEM MESSAGES - Frontend vs Backend Endpoint Check", () => {
    it("❌ FRONTEND ISSUE 2: System message delete endpoint mismatch", async () => {
      // Create test system message
      const createResponse = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test System Message Delete",
          content: "Test content",
          type: "announcement",
          priority: "high",
        });

      const messageId = createResponse.body.data.id;

      console.log("\n🚨 SYSTEM MESSAGE DELETE ENDPOINT MISMATCH");
      console.log("\n📋 Frontend calls (WRONG):");
      console.log("❌ DELETE /api/v1/messages/:id");

      // Test what frontend is calling (WRONG)
      const frontendCall = await request(app)
        .delete(`/api/v1/messages/${messageId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      console.log(
        "Frontend call result:",
        frontendCall.status,
        frontendCall.body
      );

      console.log("\n📋 Backend expects (CORRECT):");
      console.log("✅ DELETE /api/v1/system-messages/:id");

      // Test what backend actually supports (CORRECT)
      const backendCall = await request(app)
        .delete(`/api/v1/system-messages/${messageId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      console.log("Backend call result:", backendCall.status, backendCall.body);

      // The frontend call should fail, backend call should succeed
      expect(frontendCall.status).not.toBe(200); // Frontend calling wrong endpoint
      expect(backendCall.status).toBe(200); // Backend endpoint works
    });
  });

  describe("🔍 ADDITIONAL ENDPOINT CHECKS", () => {
    it("Check what routes actually exist", async () => {
      console.log("\n📋 TESTING VARIOUS ENDPOINTS TO FIND WHAT EXISTS");

      // Test various endpoints to see what's available
      const endpoints = [
        { method: "GET", path: "/api/v1/system-messages" },
        { method: "POST", path: "/api/v1/system-messages" },
        { method: "GET", path: "/api/v1/system-messages/bell-notifications" },
        {
          method: "PATCH",
          path: "/api/v1/system-messages/bell-notifications/read-all",
        },
        { method: "PUT", path: "/api/v1/user/notifications/bell/read-all" },
        { method: "GET", path: "/api/v1/user/notifications/bell" },
        { method: "DELETE", path: "/api/v1/messages/test" },
        { method: "GET", path: "/api/v1/messages" },
      ];

      for (const endpoint of endpoints) {
        let response;
        try {
          if (endpoint.method === "GET") {
            response = await request(app)
              .get(endpoint.path)
              .set("Authorization", `Bearer ${adminToken}`);
          } else if (endpoint.method === "POST") {
            response = await request(app)
              .post(endpoint.path)
              .set("Authorization", `Bearer ${adminToken}`)
              .send({ title: "test", content: "test", type: "announcement" });
          } else if (endpoint.method === "PATCH") {
            response = await request(app)
              .patch(endpoint.path)
              .set("Authorization", `Bearer ${adminToken}`);
          } else if (endpoint.method === "PUT") {
            response = await request(app)
              .put(endpoint.path)
              .set("Authorization", `Bearer ${adminToken}`);
          } else if (endpoint.method === "DELETE") {
            response = await request(app)
              .delete(endpoint.path)
              .set("Authorization", `Bearer ${adminToken}`);
          }

          console.log(
            `${endpoint.method} ${endpoint.path}: ${response?.status} ${
              response?.status === 404
                ? "(NOT FOUND)"
                : response?.status === 200
                ? "(EXISTS)"
                : ""
            }`
          );
        } catch (error) {
          console.log(`${endpoint.method} ${endpoint.path}: ERROR`);
        }
      }
    });
  });
});
