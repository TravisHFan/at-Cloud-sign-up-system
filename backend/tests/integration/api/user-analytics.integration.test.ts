import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import { ROLES } from "../../../src/utils/roleUtils";
import { ensureIntegrationDB } from "../setup/connect";
import { TokenService } from "../../../src/middleware/auth";

describe("UserAnalyticsController - GET /api/users/stats", () => {
  beforeEach(async () => {
    await ensureIntegrationDB();
    await User.deleteMany({});
  });

  // ========== Authentication Tests ==========
  describe("Authentication", () => {
    it("should return 401 when no token provided", async () => {
      const response = await request(app).get("/api/users/stats");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should return 401 when invalid token provided", async () => {
      const response = await request(app)
        .get("/api/users/stats")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  // ========== Authorization Tests ==========
  describe("Authorization", () => {
    it("should return 403 when user lacks VIEW_SYSTEM_ANALYTICS permission", async () => {
      const user = await User.create({
        name: "Participant User",
        username: "participant",
        email: "participant@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/users/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access denied");
    });

    it("should return 403 for Guest Expert role", async () => {
      const user = await User.create({
        name: "Guest Expert",
        username: "guestexpert",
        email: "expert@test.com",
        password: "Password123",
        role: ROLES.GUEST_EXPERT,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/users/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  // ========== Success Cases ==========
  describe("Success Cases", () => {
    it("should return stats for Super Admin", async () => {
      const admin = await User.create({
        name: "Super Admin",
        username: "superadmin",
        email: "superadmin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get("/api/users/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.stats).toBeDefined();
    });

    it("should return stats for Administrator", async () => {
      const admin = await User.create({
        name: "Administrator",
        username: "administrator",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.ADMINISTRATOR,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get("/api/users/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.stats).toBeDefined();
    });

    it("should return stats for Leader", async () => {
      const leader = await User.create({
        name: "Leader",
        username: "leader",
        email: "leader@test.com",
        password: "Password123",
        role: ROLES.LEADER,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(leader).accessToken;

      const response = await request(app)
        .get("/api/users/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.stats).toBeDefined();
    });

    it("should return correct stats structure with no users", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get("/api/users/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.stats).toHaveProperty("totalUsers");
      expect(response.body.data.stats).toHaveProperty("activeUsers");
      expect(response.body.data.stats).toHaveProperty("verifiedUsers");
      expect(response.body.data.stats).toHaveProperty("atCloudLeaders");
      expect(response.body.data.stats).toHaveProperty("roleDistribution");

      // Only the admin user exists
      expect(response.body.data.stats.totalUsers).toBe(1);
      expect(response.body.data.stats.activeUsers).toBe(1);
      expect(response.body.data.stats.verifiedUsers).toBe(1);
    });

    it("should return correct total user count", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      // Create multiple users
      await User.create({
        name: "User 1",
        username: "user1",
        email: "user1@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      await User.create({
        name: "User 2",
        username: "user2",
        email: "user2@test.com",
        password: "Password123",
        role: ROLES.LEADER,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get("/api/users/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.stats.totalUsers).toBe(3);
    });

    it("should correctly count active vs inactive users", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      await User.create({
        name: "Active User",
        username: "activeuser",
        email: "active@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      await User.create({
        name: "Inactive User",
        username: "inactiveuser",
        email: "inactive@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: false,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get("/api/users/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.stats.totalUsers).toBe(3);
      expect(response.body.data.stats.activeUsers).toBe(2);
    });

    it("should correctly count verified vs unverified users", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      await User.create({
        name: "Verified User",
        username: "verifieduser",
        email: "verified@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      await User.create({
        name: "Unverified User",
        username: "unverifieduser",
        email: "unverified@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: false,
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get("/api/users/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.stats.totalUsers).toBe(3);
      expect(response.body.data.stats.verifiedUsers).toBe(2);
    });

    it("should correctly count @Cloud Leaders", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
        isAtCloudLeader: false,
      });

      await User.create({
        name: "Cloud Leader 1",
        username: "cloudleader1",
        email: "leader1@test.com",
        password: "Password123",
        role: ROLES.LEADER,
        isActive: true,
        isVerified: true,
        isAtCloudLeader: true,
      });

      await User.create({
        name: "Cloud Leader 2",
        username: "cloudleader2",
        email: "leader2@test.com",
        password: "Password123",
        role: ROLES.LEADER,
        isActive: true,
        isVerified: true,
        isAtCloudLeader: true,
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get("/api/users/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.stats.atCloudLeaders).toBe(2);
    });

    it("should return role distribution correctly", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      await User.create({
        name: "Leader 1",
        username: "leader1",
        email: "leader1@test.com",
        password: "Password123",
        role: ROLES.LEADER,
        isActive: true,
        isVerified: true,
      });

      await User.create({
        name: "Leader 2",
        username: "leader2",
        email: "leader2@test.com",
        password: "Password123",
        role: ROLES.LEADER,
        isActive: true,
        isVerified: true,
      });

      await User.create({
        name: "Participant",
        username: "participant",
        email: "participant@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get("/api/users/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.stats.roleDistribution).toBeDefined();
      expect(response.body.data.stats.roleDistribution[ROLES.SUPER_ADMIN]).toBe(
        1
      );
      expect(response.body.data.stats.roleDistribution[ROLES.LEADER]).toBe(2);
      expect(response.body.data.stats.roleDistribution[ROLES.PARTICIPANT]).toBe(
        1
      );
    });
  });

  // ========== Edge Cases ==========
  describe("Edge Cases", () => {
    it("should handle large number of users efficiently", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      // Create 50 users
      const users = [];
      for (let i = 0; i < 50; i++) {
        users.push({
          name: `User ${i}`,
          username: `user${i}`,
          email: `user${i}@test.com`,
          password: "Password123",
          role: ROLES.PARTICIPANT,
          isActive: i % 2 === 0, // Half active, half inactive
          isVerified: i % 3 === 0, // Every third verified
        });
      }
      await User.insertMany(users);

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get("/api/users/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.stats.totalUsers).toBe(51); // 50 + admin
      expect(response.body.data.stats.activeUsers).toBeGreaterThan(0);
      expect(response.body.data.stats.verifiedUsers).toBeGreaterThan(0);
    });

    it("should handle all users being inactive", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      await User.create({
        name: "Inactive User",
        username: "inactiveuser",
        email: "inactive@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: false,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get("/api/users/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.stats.totalUsers).toBe(2);
      expect(response.body.data.stats.activeUsers).toBe(1); // Only admin
    });

    it("should handle mixed user states correctly", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
        isAtCloudLeader: false,
      });

      await User.create({
        name: "Active Verified Leader",
        username: "avleader",
        email: "avleader@test.com",
        password: "Password123",
        role: ROLES.LEADER,
        isActive: true,
        isVerified: true,
        isAtCloudLeader: true,
      });

      await User.create({
        name: "Inactive Unverified Participant",
        username: "iuparticipant",
        email: "iuparticipant@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: false,
        isVerified: false,
        isAtCloudLeader: false,
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get("/api/users/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.stats.totalUsers).toBe(3);
      expect(response.body.data.stats.activeUsers).toBe(2);
      expect(response.body.data.stats.verifiedUsers).toBe(2);
      expect(response.body.data.stats.atCloudLeaders).toBe(1);
    });
  });

  // ========== Response Format ==========
  describe("Response Format", () => {
    it("should have correct response structure", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get("/api/users/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success");
      expect(response.body).toHaveProperty("data");
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("stats");
      expect(typeof response.body.data.stats).toBe("object");
    });

    it("should not include message field on success", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get("/api/users/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty("message");
    });
  });
});
