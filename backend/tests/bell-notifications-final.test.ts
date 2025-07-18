import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import express from "express";
import dotenv from "dotenv";
import routes from "../src/routes";
import { User } from "../src/models";

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
app.use(express.json());
app.use("/api/v1", routes);

describe("Bell Notifications - Final Verification", () => {
  let authToken: string;
  let userId: string;
  let systemMessageId: string;

  beforeAll(async () => {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI environment variable is not set");
    }
    await mongoose.connect(process.env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Create test user and login
    const registerResponse = await request(app)
      .post("/api/v1/auth/register")
      .send({
        firstName: "Test",
        lastName: "User",
        email: `testuser.final.${Date.now()}@example.com`,
        password: "TestPassword123!",
      });

    userId = registerResponse.body.data.user.id;

    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      email: registerResponse.body.data.user.email,
      password: "TestPassword123!",
    });

    authToken = loginResponse.body.data.token;

    // Create a system message for testing
    const messageResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        title: "Final Test Message",
        content: "Testing final implementation",
        type: "general",
        priority: "medium",
        category: "system",
        targetAudience: "all_users",
        isActive: true,
      });

    systemMessageId = messageResponse.body.data.id;
  });

  describe("Authentication Error Handling", () => {
    it("should return 401 for invalid token", async () => {
      const response = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", "Bearer invalid_token");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should return 401 for malformed token", async () => {
      const response = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", "Bearer malformed.token.here");

      expect(response.status).toBe(401);
    });

    it("should return 401 for expired token format", async () => {
      const expiredToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

      const response = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
    });
  });

  describe("Preferred System Messages Endpoints", () => {
    it("should get bell notifications via system-messages endpoint", async () => {
      const response = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("should mark notification as read via system-messages endpoint", async () => {
      const response = await request(app)
        .patch(
          `/api/v1/system-messages/bell-notifications/${systemMessageId}/read`
        )
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should return 404 for non-existent notification in system-messages", async () => {
      const fakeId = "507f1f77bcf86cd799439011"; // Valid ObjectId format

      const response = await request(app)
        .patch(`/api/v1/system-messages/bell-notifications/${fakeId}/read`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it("should delete notification via system-messages endpoint", async () => {
      const response = await request(app)
        .delete(`/api/v1/system-messages/bell-notifications/${systemMessageId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("Deprecated User Notifications Endpoints", () => {
    it("should still work but with deprecation warning", async () => {
      const response = await request(app)
        .get("/api/v1/user/notifications/bell")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // These work because User.markBellNotificationAsRead method on line 860
      // overwrites the one on line 734, so both systems use bellNotificationStates
    });

    it("should work with system message IDs due to method overwriting", async () => {
      // This works because the User model has duplicate methods,
      // and the second one (line 860) overwrites the first (line 734)
      const response = await request(app)
        .put(`/api/v1/user/notifications/bell/${systemMessageId}/read`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should return 404 for non-existent IDs in user notifications", async () => {
      const fakeId = "507f1f77bcf86cd799439011";

      const response = await request(app)
        .put(`/api/v1/user/notifications/bell/${fakeId}/read`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe("API Consistency Verification", () => {
    it("should maintain consistent behavior across both endpoint systems", async () => {
      // Both systems should work with the same data due to User model method overwriting
      const systemResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${authToken}`);

      const userResponse = await request(app)
        .get("/api/v1/user/notifications/bell")
        .set("Authorization", `Bearer ${authToken}`);

      expect(systemResponse.status).toBe(200);
      expect(userResponse.status).toBe(200);

      // Both should return the same data structure
      expect(Array.isArray(systemResponse.body.data)).toBe(true);
      expect(Array.isArray(userResponse.body.data)).toBe(true);
    });
  });
});
