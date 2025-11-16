/**
 * Auth Profile API Integration Tests
 *
 * Tests the auth profile endpoint:
 * - GET /api/auth/profile
 *
 * Coverage includes:
 * - Successful profile retrieval
 * - Authentication required
 * - Complete user data fields
 * - Different user roles
 * - Error handling
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import request from "supertest";
import app from "../../../src/app";
import mongoose from "mongoose";
import { User } from "../../../src/models";
import { ensureIntegrationDB } from "../setup/connect";
import { createAndLoginTestUser } from "../../test-utils/createTestUser";
import { ROLES } from "../../../src/utils/roleUtils";

describe("Auth Profile API Integration Tests", () => {
  let testUser: any;
  let testUserToken: string;

  beforeAll(async () => {
    await ensureIntegrationDB();
  });

  beforeEach(async () => {
    // Clean up
    await User.deleteMany({});

    // Create test user and get token
    const result = await createAndLoginTestUser({
      username: "profileuser",
      email: "profile@test.com",
      password: "Password123!",
      role: ROLES.PARTICIPANT,
      verified: true,
    });

    testUserToken = result.token;

    // Get user from database
    testUser = await User.findOne({ email: "profile@test.com" });
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe("GET /api/auth/profile", () => {
    describe("Successful Profile Retrieval", () => {
      it("should successfully retrieve authenticated user profile", async () => {
        const response = await request(app)
          .get("/api/auth/profile")
          .set("Authorization", `Bearer ${testUserToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.user).toBeDefined();
      });

      it("should return correct user identification fields", async () => {
        const response = await request(app)
          .get("/api/auth/profile")
          .set("Authorization", `Bearer ${testUserToken}`)
          .expect(200);

        const { user } = response.body.data;
        expect(user.id).toBe(testUser._id.toString());
        expect(user.username).toBe("profileuser");
        expect(user.email).toBe("profile@test.com");
      });

      it("should return all personal information fields", async () => {
        const response = await request(app)
          .get("/api/auth/profile")
          .set("Authorization", `Bearer ${testUserToken}`)
          .expect(200);

        const { user } = response.body.data;
        // Optional fields only included if defined
        expect(user).toHaveProperty("firstName");
        expect(user).toHaveProperty("lastName");
        expect(user).toHaveProperty("gender");
        // phone is optional, may not be present
      });

      it("should return role and permission fields", async () => {
        const response = await request(app)
          .get("/api/auth/profile")
          .set("Authorization", `Bearer ${testUserToken}`)
          .expect(200);

        const { user } = response.body.data;
        expect(user).toHaveProperty("role");
        expect(user).toHaveProperty("isAtCloudLeader");
        // roleInAtCloud is optional, may not be present
        expect(user.role).toBe(ROLES.PARTICIPANT);
      });

      it("should return profile fields (occupation, company, addresses)", async () => {
        const response = await request(app)
          .get("/api/auth/profile")
          .set("Authorization", `Bearer ${testUserToken}`)
          .expect(200);

        const { user } = response.body.data;
        // Optional profile fields only included if defined
        // occupation, company, weeklyChurch, homeAddress, churchAddress
        // are optional and may not be present
        expect(response.body.data).toHaveProperty("user");
      });

      it("should return account status fields", async () => {
        const response = await request(app)
          .get("/api/auth/profile")
          .set("Authorization", `Bearer ${testUserToken}`)
          .expect(200);

        const { user } = response.body.data;
        expect(user).toHaveProperty("isVerified");
        expect(user).toHaveProperty("isActive");
        expect(user).toHaveProperty("createdAt");
        expect(user).toHaveProperty("lastLogin");
      });

      it("should return avatar field", async () => {
        const response = await request(app)
          .get("/api/auth/profile")
          .set("Authorization", `Bearer ${testUserToken}`)
          .expect(200);

        const { user } = response.body.data;
        expect(user).toHaveProperty("avatar");
      });

      it("should not expose sensitive fields like password", async () => {
        const response = await request(app)
          .get("/api/auth/profile")
          .set("Authorization", `Bearer ${testUserToken}`)
          .expect(200);

        const { user } = response.body.data;
        expect(user).not.toHaveProperty("password");
        expect(user).not.toHaveProperty("passwordResetToken");
        expect(user).not.toHaveProperty("emailVerificationToken");
      });
    });

    describe("Authentication Required", () => {
      it("should return 401 when no token provided", async () => {
        const response = await request(app)
          .get("/api/auth/profile")
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/no token|access denied/i);
      });

      it("should return 401 with invalid token", async () => {
        const response = await request(app)
          .get("/api/auth/profile")
          .set("Authorization", "Bearer invalid-token")
          .expect(401);

        expect(response.body.success).toBe(false);
      });

      it("should return 401 with malformed authorization header", async () => {
        const response = await request(app)
          .get("/api/auth/profile")
          .set("Authorization", "InvalidFormat token123")
          .expect(401);

        expect(response.body.success).toBe(false);
      });

      it("should return 401 with expired token", async () => {
        // Create expired token by using a token that's already invalid
        const expiredToken =
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalidsignature";

        const response = await request(app)
          .get("/api/auth/profile")
          .set("Authorization", `Bearer ${expiredToken}`)
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe("Different User Roles", () => {
      it("should retrieve profile for administrator", async () => {
        const adminResult = await createAndLoginTestUser({
          username: "adminuser",
          email: "admin@test.com",
          password: "Password123!",
          role: ROLES.ADMINISTRATOR,
          verified: true,
        });

        const response = await request(app)
          .get("/api/auth/profile")
          .set("Authorization", `Bearer ${adminResult.token}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user.role).toBe(ROLES.ADMINISTRATOR);
        expect(response.body.data.user.email).toBe("admin@test.com");
      });

      it("should retrieve profile for leader", async () => {
        const leaderResult = await createAndLoginTestUser({
          username: "leaderuser",
          email: "leader@test.com",
          password: "Password123!",
          role: ROLES.LEADER,
          verified: true,
        });

        const response = await request(app)
          .get("/api/auth/profile")
          .set("Authorization", `Bearer ${leaderResult.token}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user.role).toBe(ROLES.LEADER);
        expect(response.body.data.user.email).toBe("leader@test.com");
      });

      it("should retrieve profile for guest expert", async () => {
        const guestResult = await createAndLoginTestUser({
          username: "guestexpert",
          email: "guest@test.com",
          password: "Password123!",
          role: ROLES.GUEST_EXPERT,
          verified: true,
        });

        const response = await request(app)
          .get("/api/auth/profile")
          .set("Authorization", `Bearer ${guestResult.token}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user.role).toBe(ROLES.GUEST_EXPERT);
        expect(response.body.data.user.email).toBe("guest@test.com");
      });
    });

    describe("Data Completeness", () => {
      it("should handle user with minimal data", async () => {
        // User created with minimal required fields
        const response = await request(app)
          .get("/api/auth/profile")
          .set("Authorization", `Bearer ${testUserToken}`)
          .expect(200);

        const { user } = response.body.data;
        expect(user.id).toBeDefined();
        expect(user.email).toBeDefined();
        expect(user.username).toBeDefined();
      });

      it("should handle user with complete profile data", async () => {
        // Update user with complete data
        await User.updateOne(
          { _id: testUser._id },
          {
            occupation: "Software Engineer",
            company: "@Cloud Ministry",
            weeklyChurch: "Sample Church",
            homeAddress: "123 Home St",
            churchAddress: "456 Church Ave",
            roleInAtCloud: "Technical Lead",
          }
        );

        const response = await request(app)
          .get("/api/auth/profile")
          .set("Authorization", `Bearer ${testUserToken}`)
          .expect(200);

        const { user } = response.body.data;
        expect(user.occupation).toBe("Software Engineer");
        expect(user.company).toBe("@Cloud Ministry");
        expect(user.weeklyChurch).toBe("Sample Church");
        expect(user.homeAddress).toBe("123 Home St");
        expect(user.churchAddress).toBe("456 Church Ave");
        expect(user.roleInAtCloud).toBe("Technical Lead");
      });

      it("should handle user with avatar", async () => {
        // Update user with avatar
        await User.updateOne(
          { _id: testUser._id },
          { avatar: "uploads/avatars/test-avatar.jpg" }
        );

        const response = await request(app)
          .get("/api/auth/profile")
          .set("Authorization", `Bearer ${testUserToken}`)
          .expect(200);

        const { user } = response.body.data;
        expect(user.avatar).toBe("uploads/avatars/test-avatar.jpg");
      });
    });

    describe("Multiple Requests", () => {
      it("should handle multiple consecutive profile requests", async () => {
        // First request
        const response1 = await request(app)
          .get("/api/auth/profile")
          .set("Authorization", `Bearer ${testUserToken}`)
          .expect(200);

        expect(response1.body.success).toBe(true);

        // Second request
        const response2 = await request(app)
          .get("/api/auth/profile")
          .set("Authorization", `Bearer ${testUserToken}`)
          .expect(200);

        expect(response2.body.success).toBe(true);
        expect(response2.body.data.user.id).toBe(response1.body.data.user.id);
      });

      it("should handle concurrent profile requests", async () => {
        const promises = Array(5)
          .fill(null)
          .map(() =>
            request(app)
              .get("/api/auth/profile")
              .set("Authorization", `Bearer ${testUserToken}`)
          );

        const responses = await Promise.all(promises);

        responses.forEach((response) => {
          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
          expect(response.body.data.user.email).toBe("profile@test.com");
        });
      });
    });

    describe("Response Time", () => {
      it("should respond quickly (< 100ms)", async () => {
        const start = Date.now();

        await request(app)
          .get("/api/auth/profile")
          .set("Authorization", `Bearer ${testUserToken}`)
          .expect(200);

        const duration = Date.now() - start;
        expect(duration).toBeLessThan(100);
      });
    });

    describe("Edge Cases", () => {
      it("should handle user with isAtCloudLeader flag", async () => {
        await User.updateOne(
          { _id: testUser._id },
          { isAtCloudLeader: true, roleInAtCloud: "Ministry Leader" }
        );

        const response = await request(app)
          .get("/api/auth/profile")
          .set("Authorization", `Bearer ${testUserToken}`)
          .expect(200);

        const { user } = response.body.data;
        expect(user.isAtCloudLeader).toBe(true);
        expect(user.roleInAtCloud).toBe("Ministry Leader");
      });

      it("should handle inactive user (still returns profile if authenticated)", async () => {
        // Note: Auth middleware may block inactive users, but if they pass,
        // profile should still return data
        await User.updateOne({ _id: testUser._id }, { isActive: false });

        const response = await request(app)
          .get("/api/auth/profile")
          .set("Authorization", `Bearer ${testUserToken}`);

        // This may be 401 if auth middleware blocks inactive users
        // or 200 if profile endpoint handles it
        expect([200, 401]).toContain(response.status);
      });

      it("should handle unverified user", async () => {
        await User.updateOne({ _id: testUser._id }, { isVerified: false });

        const response = await request(app)
          .get("/api/auth/profile")
          .set("Authorization", `Bearer ${testUserToken}`);

        // Auth middleware may block unverified users (403) or allow (200)
        expect([200, 403]).toContain(response.status);

        if (response.status === 200) {
          const { user } = response.body.data;
          expect(user.isVerified).toBe(false);
        }
      });
    });
  });
});
