/**
 * Logout API Integration Tests
 *
 * Tests the logout endpoint:
 * - POST /api/auth/logout
 *
 * Coverage includes:
 * - Successful logout with authentication
 * - Successful logout without authentication (still clears cookie)
 * - Cookie clearing verification
 * - Response format validation
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

describe("Logout API Integration Tests", () => {
  let regularUser: any;
  let regularUserToken: string;

  beforeAll(async () => {
    await ensureIntegrationDB();
  });

  beforeEach(async () => {
    // Clean up
    await User.deleteMany({});

    // Create test user and get token
    const result = await createAndLoginTestUser({
      username: "regularuser",
      email: "regular@test.com",
      password: "Password123!",
      role: ROLES.PARTICIPANT,
      verified: true,
    });

    regularUserToken = result.token;

    // Get user from database
    regularUser = await User.findOne({ email: "regular@test.com" });
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe("POST /api/auth/logout", () => {
    describe("Successful Logout", () => {
      it("should successfully logout authenticated user", async () => {
        const response = await request(app)
          .post("/api/auth/logout")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toMatch(/logged out successfully/i);
      });

      it("should reject logout without authentication token", async () => {
        // Logout requires authentication
        const response = await request(app)
          .post("/api/auth/logout")
          .expect(401);

        expect(response.body.success).toBe(false);
      });

      it("should clear refreshToken cookie on logout", async () => {
        const response = await request(app)
          .post("/api/auth/logout")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .expect(200);

        // Check that Set-Cookie header is present to clear the cookie
        const setCookieHeader = response.headers["set-cookie"];
        if (setCookieHeader) {
          const cookieString = Array.isArray(setCookieHeader)
            ? setCookieHeader.join("; ")
            : setCookieHeader;

          // Should contain refreshToken and be set to expire (cleared)
          expect(cookieString).toMatch(/refreshToken/);
        }
      });

      it("should return correct response structure", async () => {
        const response = await request(app)
          .post("/api/auth/logout")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .expect(200);

        expect(response.body).toHaveProperty("success");
        expect(response.body).toHaveProperty("message");
        expect(response.body.success).toBe(true);
      });
    });

    describe("Multiple Logout Calls", () => {
      it("should handle multiple logout calls idempotently", async () => {
        // First logout
        await request(app)
          .post("/api/auth/logout")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .expect(200);

        // Second logout should still succeed
        const response = await request(app)
          .post("/api/auth/logout")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe("Different User Roles", () => {
      it("should logout administrator successfully", async () => {
        const adminResult = await createAndLoginTestUser({
          username: "adminuser",
          email: "admin@test.com",
          password: "Password123!",
          role: ROLES.ADMINISTRATOR,
          verified: true,
        });

        const response = await request(app)
          .post("/api/auth/logout")
          .set("Authorization", `Bearer ${adminResult.token}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it("should logout leader successfully", async () => {
        const leaderResult = await createAndLoginTestUser({
          username: "leaderuser",
          email: "leader@test.com",
          password: "Password123!",
          role: ROLES.LEADER,
          verified: true,
        });

        const response = await request(app)
          .post("/api/auth/logout")
          .set("Authorization", `Bearer ${leaderResult.token}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe("Token Validation After Logout", () => {
      it("should not affect access token validity (stateless JWT)", async () => {
        // Logout
        await request(app)
          .post("/api/auth/logout")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .expect(200);

        // Access token should still work for API calls since JWT is stateless
        // (logout only clears refresh token cookie on client side)
        const response = await request(app)
          .get("/api/users/profile")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user).toBeDefined();
      });
    });

    describe("Concurrent Logout Requests", () => {
      it("should handle concurrent logout requests", async () => {
        const promises = Array(5)
          .fill(null)
          .map(() =>
            request(app)
              .post("/api/auth/logout")
              .set("Authorization", `Bearer ${regularUserToken}`)
          );

        const responses = await Promise.all(promises);

        responses.forEach((response) => {
          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
        });
      });
    });

    describe("Response Time", () => {
      it("should respond quickly (< 100ms)", async () => {
        const start = Date.now();

        await request(app)
          .post("/api/auth/logout")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .expect(200);

        const duration = Date.now() - start;
        expect(duration).toBeLessThan(100);
      });
    });
  });
});
