/**
 * Token Refresh API Integration Tests
 *
 * Tests the token refresh endpoint:
 * - POST /api/auth/refresh-token
 *
 * Coverage includes:
 * - Successful token refresh
 * - Missing refresh token
 * - Invalid/malformed token
 * - Expired token
 * - User not found/inactive
 * - Cookie handling
 * - Error scenarios
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import request from "supertest";
import app from "../../../src/app";
import mongoose from "mongoose";
import { User } from "../../../src/models";
import { ensureIntegrationDB } from "../setup/connect";
import { createAndLoginTestUser } from "../../test-utils/createTestUser";
import { ROLES } from "../../../src/utils/roleUtils";
import { TokenService } from "../../../src/middleware/auth";

describe("Token Refresh API Integration Tests", () => {
  let testUser: any;
  let testUserToken: string;
  let validRefreshToken: string;

  beforeAll(async () => {
    await ensureIntegrationDB();
  });

  beforeEach(async () => {
    // Clean up
    await User.deleteMany({});

    // Create test user and get tokens
    const result = await createAndLoginTestUser({
      username: "tokenuser",
      email: "token@test.com",
      password: "Password123!",
      role: ROLES.PARTICIPANT,
      verified: true,
    });

    testUserToken = result.token;

    // Get user from database
    testUser = await User.findOne({ email: "token@test.com" });

    // Generate valid refresh token
    const tokens = TokenService.generateTokenPair(testUser);
    validRefreshToken = tokens.refreshToken;
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe("POST /api/auth/refresh-token", () => {
    describe("Successful Token Refresh", () => {
      it("should successfully refresh tokens with valid refresh token", async () => {
        const response = await request(app)
          .post("/api/auth/refresh-token")
          .set("Cookie", `refreshToken=${validRefreshToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toMatch(/token refreshed successfully/i);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.accessToken).toBeDefined();
        expect(response.body.data.refreshToken).toBeDefined();
        expect(typeof response.body.data.accessToken).toBe("string");
        expect(typeof response.body.data.refreshToken).toBe("string");
      });

      it("should set new refresh token cookie", async () => {
        const response = await request(app)
          .post("/api/auth/refresh-token")
          .set("Cookie", `refreshToken=${validRefreshToken}`)
          .expect(200);

        const setCookieHeader = response.headers["set-cookie"];
        expect(setCookieHeader).toBeDefined();

        if (setCookieHeader) {
          const cookieString = Array.isArray(setCookieHeader)
            ? setCookieHeader.join("; ")
            : setCookieHeader;

          expect(cookieString).toMatch(/refreshToken/);
          expect(cookieString).toMatch(/httponly/i);
        }
      });

      it("should return valid access token that can be used", async () => {
        const refreshResponse = await request(app)
          .post("/api/auth/refresh-token")
          .set("Cookie", `refreshToken=${validRefreshToken}`)
          .expect(200);

        const newAccessToken = refreshResponse.body.data.accessToken;

        // Use new access token to access protected endpoint
        const profileResponse = await request(app)
          .get("/api/auth/profile")
          .set("Authorization", `Bearer ${newAccessToken}`)
          .expect(200);

        expect(profileResponse.body.success).toBe(true);
        expect(profileResponse.body.data.user).toBeDefined();
      });
    });

    describe("Missing Refresh Token", () => {
      it("should return 401 when refresh token not provided", async () => {
        const response = await request(app)
          .post("/api/auth/refresh-token")
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/refresh token not provided/i);
      });

      it("should return 401 when cookie header is empty", async () => {
        const response = await request(app)
          .post("/api/auth/refresh-token")
          .set("Cookie", "")
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/refresh token not provided/i);
      });
    });

    describe("Invalid Refresh Token", () => {
      it("should return 401 for malformed token", async () => {
        const response = await request(app)
          .post("/api/auth/refresh-token")
          .set("Cookie", "refreshToken=invalid-token-format")
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(
          /invalid refresh token|token refresh failed/i
        );
      });

      it("should return 401 for token with invalid signature", async () => {
        const fakeToken =
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalidsignature";

        const response = await request(app)
          .post("/api/auth/refresh-token")
          .set("Cookie", `refreshToken=${fakeToken}`)
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(
          /invalid refresh token|token refresh failed/i
        );
      });

      it("should return 401 for token without userId", async () => {
        // Create token without userId
        const tokenWithoutUserId = TokenService.generateTokenPair({
          _id: undefined as any,
        } as any).refreshToken;

        const response = await request(app)
          .post("/api/auth/refresh-token")
          .set("Cookie", `refreshToken=${tokenWithoutUserId}`)
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe("Expired Refresh Token", () => {
      it("should return 401 for expired token", async () => {
        // Mock TokenService to return null (invalid/expired)
        const expiredToken = "expired.token.value";
        vi.spyOn(TokenService, "verifyRefreshToken").mockReturnValue(
          null as any
        );

        const response = await request(app)
          .post("/api/auth/refresh-token")
          .set("Cookie", `refreshToken=${expiredToken}`)
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(
          /invalid refresh token|token refresh failed/i
        );

        vi.restoreAllMocks();
      });
    });

    describe("User Validation", () => {
      it("should return 401 when user not found", async () => {
        // Delete the user
        await User.deleteOne({ _id: testUser._id });

        const response = await request(app)
          .post("/api/auth/refresh-token")
          .set("Cookie", `refreshToken=${validRefreshToken}`)
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(
          /user not found|inactive|token refresh failed/i
        );
      });

      it("should return 401 when user is inactive", async () => {
        // Deactivate user
        await User.updateOne({ _id: testUser._id }, { isActive: false });

        const response = await request(app)
          .post("/api/auth/refresh-token")
          .set("Cookie", `refreshToken=${validRefreshToken}`)
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(
          /user not found|inactive|token refresh failed/i
        );
      });
    });

    describe("Cookie Security Settings", () => {
      it("should set httpOnly flag on refresh token cookie", async () => {
        const response = await request(app)
          .post("/api/auth/refresh-token")
          .set("Cookie", `refreshToken=${validRefreshToken}`)
          .expect(200);

        const setCookieHeader = response.headers["set-cookie"];
        if (setCookieHeader) {
          const cookieString = Array.isArray(setCookieHeader)
            ? setCookieHeader[0]
            : setCookieHeader;

          expect(cookieString).toMatch(/httponly/i);
        }
      });

      it("should set sameSite=strict on refresh token cookie", async () => {
        const response = await request(app)
          .post("/api/auth/refresh-token")
          .set("Cookie", `refreshToken=${validRefreshToken}`)
          .expect(200);

        const setCookieHeader = response.headers["set-cookie"];
        if (setCookieHeader) {
          const cookieString = Array.isArray(setCookieHeader)
            ? setCookieHeader[0]
            : setCookieHeader;

          expect(cookieString).toMatch(/samesite=strict/i);
        }
      });

      it("should set maxAge on refresh token cookie", async () => {
        const response = await request(app)
          .post("/api/auth/refresh-token")
          .set("Cookie", `refreshToken=${validRefreshToken}`)
          .expect(200);

        const setCookieHeader = response.headers["set-cookie"];
        if (setCookieHeader) {
          const cookieString = Array.isArray(setCookieHeader)
            ? setCookieHeader[0]
            : setCookieHeader;

          expect(cookieString).toMatch(/max-age/i);
        }
      });
    });

    describe("Multiple Refresh Operations", () => {
      it("should handle concurrent refresh requests", async () => {
        const promises = Array(3)
          .fill(null)
          .map(() =>
            request(app)
              .post("/api/auth/refresh-token")
              .set("Cookie", `refreshToken=${validRefreshToken}`)
          );

        const responses = await Promise.all(promises);

        // All should succeed (since we're using the same valid token)
        responses.forEach((response) => {
          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
        });
      });
    });

    describe("Different User Roles", () => {
      it("should refresh token for administrator", async () => {
        const adminResult = await createAndLoginTestUser({
          username: "adminuser",
          email: "admin@test.com",
          password: "Password123!",
          role: ROLES.ADMINISTRATOR,
          verified: true,
        });

        const adminUser = await User.findOne({ email: "admin@test.com" });
        const adminTokens = TokenService.generateTokenPair(adminUser);

        const response = await request(app)
          .post("/api/auth/refresh-token")
          .set("Cookie", `refreshToken=${adminTokens.refreshToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it("should refresh token for leader", async () => {
        const leaderResult = await createAndLoginTestUser({
          username: "leaderuser",
          email: "leader@test.com",
          password: "Password123!",
          role: ROLES.LEADER,
          verified: true,
        });

        const leaderUser = await User.findOne({ email: "leader@test.com" });
        const leaderTokens = TokenService.generateTokenPair(leaderUser);

        const response = await request(app)
          .post("/api/auth/refresh-token")
          .set("Cookie", `refreshToken=${leaderTokens.refreshToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe("Response Time", () => {
      it("should respond quickly (< 200ms)", async () => {
        const start = Date.now();

        await request(app)
          .post("/api/auth/refresh-token")
          .set("Cookie", `refreshToken=${validRefreshToken}`)
          .expect(200);

        const duration = Date.now() - start;
        expect(duration).toBeLessThan(200);
      });
    });

    describe("Error Handling", () => {
      it("should handle database errors gracefully", async () => {
        // Temporarily break User.findById
        const originalFindById = User.findById;
        User.findById = vi.fn().mockRejectedValue(new Error("DB Error"));

        const response = await request(app)
          .post("/api/auth/refresh-token")
          .set("Cookie", `refreshToken=${validRefreshToken}`)
          .expect(401);

        expect(response.body.success).toBe(false);

        // Restore
        User.findById = originalFindById;
      });

      it("should handle TokenService errors gracefully", async () => {
        vi.spyOn(TokenService, "verifyRefreshToken").mockImplementation(() => {
          throw new Error("Token service error");
        });

        const response = await request(app)
          .post("/api/auth/refresh-token")
          .set("Cookie", `refreshToken=${validRefreshToken}`)
          .expect(401);

        expect(response.body.success).toBe(false);

        vi.restoreAllMocks();
      });
    });
  });
});
