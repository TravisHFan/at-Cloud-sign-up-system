import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import { ROLES } from "../../../src/utils/roleUtils";
import { ensureIntegrationDB } from "../setup/connect";
import { TokenService } from "../../../src/middleware/auth";

describe("GetProfileController - GET /api/users/profile", () => {
  beforeEach(async () => {
    await ensureIntegrationDB();
    await User.deleteMany({});
  });

  // ========== Authentication Tests ==========
  describe("Authentication", () => {
    it("should return 401 when no token provided", async () => {
      const response = await request(app).get("/api/users/profile");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "Access denied. No token provided or invalid format."
      );
    });

    it("should return 401 when invalid token provided", async () => {
      const response = await request(app)
        .get("/api/users/profile")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  // ========== Success Cases ==========
  describe("Success Cases", () => {
    it("should return user profile with all fields", async () => {
      const user = await User.create({
        name: "John Doe",
        username: "johndoe",
        email: "john@test.com",
        password: "Password123",
        phone: "1234567890",
        firstName: "John",
        lastName: "Doe",
        gender: "male",
        avatar: "https://example.com/avatar.jpg",
        role: ROLES.PARTICIPANT,
        isAtCloudLeader: false,
        roleInAtCloud: "Member",
        homeAddress: "123 Main St, City, State 12345",
        occupation: "Software Engineer",
        company: "Tech Corp",
        weeklyChurch: "Grace Church",
        churchAddress: "456 Church St, City, State 12345",
        isVerified: true,
        isActive: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/users/profile")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();

      const { user: userData } = response.body.data;
      expect(userData.id).toBeDefined();
      expect(userData.username).toBe("johndoe");
      expect(userData.email).toBe("john@test.com");
      expect(userData.phone).toBe("1234567890");
      expect(userData.firstName).toBe("John");
      expect(userData.lastName).toBe("Doe");
      expect(userData.gender).toBe("male");
      expect(userData.avatar).toBe("https://example.com/avatar.jpg");
      expect(userData.role).toBe(ROLES.PARTICIPANT);
      expect(userData.isAtCloudLeader).toBe(false);
      // roleInAtCloud is cleared when isAtCloudLeader is false
      expect(userData.roleInAtCloud).toBeUndefined();
      expect(userData.homeAddress).toBe("123 Main St, City, State 12345");
      expect(userData.occupation).toBe("Software Engineer");
      expect(userData.company).toBe("Tech Corp");
      expect(userData.weeklyChurch).toBe("Grace Church");
      expect(userData.churchAddress).toBe("456 Church St, City, State 12345");
      expect(userData.isVerified).toBe(true);
      expect(userData.isActive).toBe(true);
      expect(userData.createdAt).toBeDefined();
    });

    it("should return profile for Super Admin", async () => {
      const admin = await User.create({
        name: "Super Admin",
        username: "superadmin",
        email: "admin@test.com",
        password: "Password123",
        firstName: "Super",
        lastName: "Admin",
        gender: "male",
        role: ROLES.SUPER_ADMIN,
        isAtCloudLeader: true,
        roleInAtCloud: "Administrator",
        isVerified: true,
        isActive: true,
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get("/api/users/profile")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe(ROLES.SUPER_ADMIN);
      expect(response.body.data.user.isAtCloudLeader).toBe(true);
    });

    it("should return profile for Leader", async () => {
      const leader = await User.create({
        name: "Team Leader",
        username: "leader",
        email: "leader@test.com",
        password: "Password123",
        firstName: "Team",
        lastName: "Leader",
        gender: "female",
        role: ROLES.LEADER,
        isAtCloudLeader: true,
        roleInAtCloud: "Team Lead",
        isVerified: true,
        isActive: true,
      });

      const token = TokenService.generateTokenPair(leader).accessToken;

      const response = await request(app)
        .get("/api/users/profile")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe(ROLES.LEADER);
      expect(response.body.data.user.isAtCloudLeader).toBe(true);
      expect(response.body.data.user.roleInAtCloud).toBe("Team Lead");
    });

    it("should return profile for Guest Expert", async () => {
      const guest = await User.create({
        name: "Guest Expert",
        username: "guestexpert",
        email: "guest@test.com",
        password: "Password123",
        firstName: "Guest",
        lastName: "Expert",
        gender: "male",
        role: ROLES.GUEST_EXPERT,
        isAtCloudLeader: false,
        isVerified: true,
        isActive: true,
      });

      const token = TokenService.generateTokenPair(guest).accessToken;

      const response = await request(app)
        .get("/api/users/profile")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe(ROLES.GUEST_EXPERT);
      expect(response.body.data.user.isAtCloudLeader).toBe(false);
    });

    it("should handle profile with minimal fields", async () => {
      const user = await User.create({
        name: "Minimal User",
        username: "minimaluser",
        email: "minimal@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/users/profile")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe("minimaluser");
      expect(response.body.data.user.email).toBe("minimal@test.com");
      // Optional fields may be undefined
      expect(response.body.data.user.phone).toBeUndefined();
      // Avatar has default value
      expect(response.body.data.user.avatar).toBeDefined();
      expect(response.body.data.user.homeAddress).toBeUndefined();
    });

    it("should not include sensitive data like password", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/users/profile")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.user).not.toHaveProperty("password");
      expect(response.body.data.user).not.toHaveProperty("passwordHash");
    });
  });

  // ========== Edge Cases ==========
  describe("Edge Cases", () => {
    it("should handle user with maximum length text fields", async () => {
      const maxAddress = "A".repeat(200); // Max homeAddress length
      const maxOccupation = "B".repeat(100); // Max occupation length
      const user = await User.create({
        name: "Max Length User",
        username: "maxlengthuser",
        email: "maxlength@test.com",
        password: "Password123",
        firstName: "Max",
        lastName: "Length",
        gender: "male",
        role: ROLES.PARTICIPANT,
        homeAddress: maxAddress,
        occupation: maxOccupation,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/users/profile")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.homeAddress).toBe(maxAddress);
      expect(response.body.data.user.occupation).toBe(maxOccupation);
    });

    it("should handle user with special characters in fields", async () => {
      const user = await User.create({
        name: "Special <>&\"' User",
        username: "specialuser",
        email: "special@test.com",
        password: "Password123",
        firstName: "Special",
        lastName: "<>&\"'",
        gender: "female",
        role: ROLES.PARTICIPANT,
        homeAddress: "123 Main <>&\"' St",
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/users/profile")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.lastName).toBe("<>&\"'");
      expect(response.body.data.user.homeAddress).toBe("123 Main <>&\"' St");
    });

    it("should deny inactive user profile access", async () => {
      const user = await User.create({
        name: "Inactive User",
        username: "inactiveuser",
        email: "inactive@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: false, // Inactive user
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/users/profile")
        .set("Authorization", `Bearer ${token}`);

      // Middleware blocks inactive users
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should deny unverified user profile access", async () => {
      const user = await User.create({
        name: "Unverified User",
        username: "unverifieduser",
        email: "unverified@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: false, // Unverified user
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/users/profile")
        .set("Authorization", `Bearer ${token}`);

      // Middleware blocks unverified users
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it("should return lastLogin if previously set", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        lastLogin: new Date(), // Set lastLogin explicitly
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/users/profile")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.user.lastLogin).toBeDefined();
    });
  });

  // ========== Response Format ==========
  describe("Response Format", () => {
    it("should have correct response structure", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/users/profile")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success");
      expect(response.body).toHaveProperty("data");
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("user");
    });

    it("should not include message field on success", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/users/profile")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty("message");
    });

    it("should have user object with expected fields", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        firstName: "Test",
        lastName: "User",
        gender: "male",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .get("/api/users/profile")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      const { user: userData } = response.body.data;

      // Required fields
      expect(userData).toHaveProperty("id");
      expect(userData).toHaveProperty("username");
      expect(userData).toHaveProperty("email");
      expect(userData).toHaveProperty("role");
      expect(userData).toHaveProperty("isVerified");
      expect(userData).toHaveProperty("isActive");
      expect(userData).toHaveProperty("createdAt");

      // Fields with values should be present
      expect(userData).toHaveProperty("firstName");
      expect(userData).toHaveProperty("lastName");
      expect(userData).toHaveProperty("gender");
      expect(userData).toHaveProperty("avatar");
    });
  });
});
