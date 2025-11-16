import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../../src/app";
import { ensureIntegrationDB } from "../setup/connect";
import User from "../../../src/models/User";
import { TokenService } from "../../../src/middleware/auth";

describe("GET /api/notifications/welcome-status - WelcomeMessageStatusController", () => {
  beforeAll(async () => {
    await ensureIntegrationDB();
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe("Authentication", () => {
    it("should return 401 if no token is provided", async () => {
      const response = await request(app).get(
        "/api/notifications/welcome-status"
      );
      expect(response.status).toBe(401);
    });

    it("should return 401 if token is invalid", async () => {
      const response = await request(app)
        .get("/api/notifications/welcome-status")
        .set("Authorization", "Bearer invalid-token");
      expect(response.status).toBe(401);
    });

    it("should return 401 if user does not exist", async () => {
      const nonExistentUserId = new mongoose.Types.ObjectId().toString();
      const token = TokenService.generateAccessToken({
        userId: nonExistentUserId,
        email: "nonexistent@example.com",
        role: "Participant",
      });

      const response = await request(app)
        .get("/api/notifications/welcome-status")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(401);
    });
  });

  describe("Success Cases", () => {
    it("should return false for user who has not received welcome message", async () => {
      const user = await User.create({
        username: "newuser",
        email: "new@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
        hasReceivedWelcomeMessage: false,
      } as any);

      const token = TokenService.generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/welcome-status")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.hasReceivedWelcomeMessage).toBe(false);
    });

    it("should return true for user who has received welcome message", async () => {
      const user = await User.create({
        username: "existinguser",
        email: "existing@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
        hasReceivedWelcomeMessage: true,
      } as any);

      const token = TokenService.generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/welcome-status")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.hasReceivedWelcomeMessage).toBe(true);
    });

    it("should default to false when hasReceivedWelcomeMessage is undefined", async () => {
      const user = await User.create({
        username: "undefuser",
        email: "undef@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
      } as any);

      const token = TokenService.generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/welcome-status")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.hasReceivedWelcomeMessage).toBe(false);
    });

    it("should work for users with different roles", async () => {
      const roles = ["Participant", "Leader", "Administrator"];

      for (const role of roles) {
        const user = await User.create({
          username: `user_${role.toLowerCase()}`,
          email: `${role.toLowerCase()}@example.com`,
          password: "TestPass123!",
          role,
          isVerified: true,
          isActive: true,
          hasReceivedWelcomeMessage: true,
        } as any);

        const token = TokenService.generateAccessToken({
          userId: user._id.toString(),
          email: user.email,
          role: user.role,
        });

        const response = await request(app)
          .get("/api/notifications/welcome-status")
          .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.hasReceivedWelcomeMessage).toBe(true);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should return 401 for inactive users", async () => {
      const user = await User.create({
        username: "inactiveuser",
        email: "inactive@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: false,
        hasReceivedWelcomeMessage: true,
      } as any);

      const token = TokenService.generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/welcome-status")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(401);
    });

    it("should return 403 for unverified users", async () => {
      const user = await User.create({
        username: "unverifieduser",
        email: "unverified@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: false,
        isActive: true,
        hasReceivedWelcomeMessage: false,
      } as any);

      const token = TokenService.generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/welcome-status")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
    });

    it("should only select hasReceivedWelcomeMessage field", async () => {
      const user = await User.create({
        username: "selecttest",
        email: "select@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
        hasReceivedWelcomeMessage: true,
      } as any);

      const token = TokenService.generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/welcome-status")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("hasReceivedWelcomeMessage");
      // Should not expose other user fields
      expect(response.body.data).not.toHaveProperty("email");
      expect(response.body.data).not.toHaveProperty("password");
      expect(response.body.data).not.toHaveProperty("username");
    });

    it("should handle concurrent requests for the same user", async () => {
      const user = await User.create({
        username: "concurrentuser",
        email: "concurrent@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
        hasReceivedWelcomeMessage: true,
      } as any);

      const token = TokenService.generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      const requests = [
        request(app)
          .get("/api/notifications/welcome-status")
          .set("Authorization", `Bearer ${token}`),
        request(app)
          .get("/api/notifications/welcome-status")
          .set("Authorization", `Bearer ${token}`),
        request(app)
          .get("/api/notifications/welcome-status")
          .set("Authorization", `Bearer ${token}`),
      ];

      const responses = await Promise.all(requests);

      for (const response of responses) {
        expect(response.status).toBe(200);
        expect(response.body.data.hasReceivedWelcomeMessage).toBe(true);
      }
    });
  });

  describe("Response Format", () => {
    it("should return correct response structure", async () => {
      const user = await User.create({
        username: "formattest",
        email: "format@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
        hasReceivedWelcomeMessage: false,
      } as any);

      const token = TokenService.generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/welcome-status")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success");
      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toHaveProperty("hasReceivedWelcomeMessage");
      expect(typeof response.body.success).toBe("boolean");
      expect(typeof response.body.data.hasReceivedWelcomeMessage).toBe(
        "boolean"
      );
    });

    it("should not include message field on success", async () => {
      const user = await User.create({
        username: "nomessagetest",
        email: "nomessage@example.com",
        password: "TestPass123!",
        role: "Participant",
        isVerified: true,
        isActive: true,
        hasReceivedWelcomeMessage: true,
      } as any);

      const token = TokenService.generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      const response = await request(app)
        .get("/api/notifications/welcome-status")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).not.toHaveProperty("message");
    });
  });
});
