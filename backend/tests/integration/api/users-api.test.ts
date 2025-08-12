/**
 * Users API Integration Tests
 *
 * Tests the complete user management flow including:
 * - User profile management
 * - User search and filtering
 * - Admin user operations
 * - Role-based access control
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../../src/app";
import User from "../../../src/models/User";

describe("Users API Integration Tests", () => {
  let authToken: string;
  let adminToken: string;
  let userId: string;
  let adminId: string;

  beforeEach(async () => {
    // Clear users collection
    await User.deleteMany({});

    // Create regular user
    const userData = {
      username: "testuser",
      email: "test@example.com",
      password: "TestPass123!",
      confirmPassword: "TestPass123!",
      firstName: "Test",
      lastName: "User",
      role: "Participant",
      gender: "male",
      isAtCloudLeader: false,
      acceptTerms: true,
    };

    const userResponse = await request(app)
      .post("/api/auth/register")
      .send(userData);

    // Manually verify the user using email lookup
    await User.findOneAndUpdate(
      { email: "test@example.com" },
      { isVerified: true }
    );

    const loginResponse = await request(app).post("/api/auth/login").send({
      emailOrUsername: "test@example.com",
      password: "TestPass123!",
    });

    authToken = loginResponse.body.data.accessToken;
    userId = userResponse.body.data.user.id;

    // Create admin user
    const adminData = {
      username: "admin",
      email: "admin@example.com",
      password: "AdminPass123!",
      confirmPassword: "AdminPass123!",
      firstName: "Admin",
      lastName: "User",
      role: "Administrator", // This will be overridden to Participant by registration
      gender: "male",
      isAtCloudLeader: false,
      acceptTerms: true,
    };

    const adminResponse = await request(app)
      .post("/api/auth/register")
      .send(adminData);

    // Manually verify the admin user and set proper role
    await User.findOneAndUpdate(
      { email: "admin@example.com" },
      { isVerified: true, role: "Administrator" } // Set to Administrator role for user management
    );

    const adminLoginResponse = await request(app).post("/api/auth/login").send({
      emailOrUsername: "admin@example.com",
      password: "AdminPass123!",
    });

    adminToken = adminLoginResponse.body.data.accessToken;
    adminId = adminResponse.body.data.user.id;
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  describe("GET /api/users", () => {
    beforeEach(async () => {
      // Create additional test users
      const users = [
        {
          username: "user1",
          email: "user1@example.com",
          password: "Password123!",
          confirmPassword: "Password123!",
          firstName: "John",
          lastName: "Doe",
          gender: "male",
          isAtCloudLeader: false,
          acceptTerms: true,
        },
        {
          username: "user2",
          email: "user2@example.com",
          password: "Password123!",
          confirmPassword: "Password123!",
          firstName: "Jane",
          lastName: "Smith",
          gender: "female",
          isAtCloudLeader: false,
          acceptTerms: true,
        },
      ];

      for (const user of users) {
        const registerResponse = await request(app)
          .post("/api/auth/register")
          .send(user);

        // Manually verify the users like we do for the main test users
        await User.findOneAndUpdate(
          { email: user.email },
          { isVerified: true }
        );
      }
    });

    it("should get all users with admin token", async () => {
      const response = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          users: expect.arrayContaining([
            expect.objectContaining({ username: "testuser" }),
            expect.objectContaining({ username: "admin" }),
            expect.objectContaining({ username: "user1" }),
            expect.objectContaining({ username: "user2" }),
          ]),
        },
      });

      // Should not include passwords
      response.body.data.users.forEach((user: any) => {
        expect(user.password).toBeUndefined();
      });
    });

    it("should allow user list request with user token (community access)", async () => {
      const response = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          users: expect.any(Array),
          pagination: expect.any(Object),
        },
      });
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/api/users").expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining("token"),
      });
    });

    it("should paginate users", async () => {
      const response = await request(app)
        .get("/api/users?page=1&limit=2")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.users).toHaveLength(2);
      expect(response.body.data).toMatchObject({
        pagination: {
          currentPage: 1,
          totalPages: expect.any(Number),
          totalUsers: expect.any(Number),
          hasNext: expect.any(Boolean),
          hasPrev: expect.any(Boolean),
        },
      });
    });

    it("should enforce maximum page size of 20", async () => {
      const response = await request(app)
        .get("/api/users?page=1&limit=50")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      // Should not exceed 20 returned users
      expect(response.body.data.users.length).toBeLessThanOrEqual(20);
      expect(response.body.data.pagination).toMatchObject({
        currentPage: 1,
      });
    });

    it("should default to page 1 and limit 20 on invalid params", async () => {
      const response = await request(app)
        .get("/api/users?page=-5&limit=abc")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.pagination).toMatchObject({
        currentPage: 1,
      });
      // length should be <= 20 due to default limit
      expect(response.body.data.users.length).toBeLessThanOrEqual(20);
    });

    it("should filter users by role", async () => {
      const response = await request(app)
        .get("/api/users?role=Participant")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.users).toHaveLength(3); // testuser, user1, user2 are all Participants
      const usernames = response.body.data.users.map((u: any) => u.username);
      expect(usernames).toEqual(
        expect.arrayContaining(["testuser", "user1", "user2"])
      );
    });

    it("should search users by name", async () => {
      const response = await request(app)
        .get("/api/users?search=John")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.users).toHaveLength(1);
      expect(response.body.data.users[0]).toMatchObject({
        firstName: "John",
        lastName: "Doe",
      });
    });
  });

  describe("GET /api/users/:id", () => {
    it("should get user by ID with admin token", async () => {
      const response = await request(app)
        .get(`/api/users/${userId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            username: "testuser",
            email: "test@example.com",
            firstName: "Test",
            lastName: "User",
            role: "Participant",
          },
        },
      });

      // Should not include password
      expect(response.body.data.user.password).toBeUndefined();
    });

    it("should allow users to get their own profile", async () => {
      const response = await request(app)
        .get(`/api/users/${userId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.user.username).toBe("testuser");
    });

    it("should reject user trying to get another user's profile", async () => {
      const response = await request(app)
        .get(`/api/users/${adminId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining("permission"),
      });
    });

    it("should return 404 for non-existent user", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .get(`/api/users/${fakeId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining("not found"),
      });
    });

    it("should return 400 for invalid user ID", async () => {
      const response = await request(app)
        .get("/api/users/invalid-id")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining("Validation failed"),
      });
    });
  });

  describe("GET /api/search/users", () => {
    beforeEach(async () => {
      // Create users with varied data for search testing
      const searchUsers = [
        {
          username: "developer",
          email: "dev@example.com",
          password: "Password123!",
          confirmPassword: "Password123!",
          firstName: "John",
          lastName: "Developer",
          gender: "male",
          isAtCloudLeader: false,
          acceptTerms: true,
        },
        {
          username: "designer",
          email: "design@example.com",
          password: "Password123!",
          confirmPassword: "Password123!",
          firstName: "Jane",
          lastName: "Designer",
          gender: "female",
          isAtCloudLeader: false,
          acceptTerms: true,
        },
      ];

      for (const user of searchUsers) {
        await request(app).post("/api/auth/register").send(user);

        // Manually verify the users
        await User.findOneAndUpdate(
          { email: user.email },
          { isVerified: true }
        );
      }
    });

    it("should search users by multiple criteria", async () => {
      const response = await request(app)
        .get("/api/search/users?q=John&role=Participant")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.users).toHaveLength(1);
      expect(response.body.data.users[0]).toMatchObject({
        firstName: "John",
        lastName: "Developer",
        role: "Participant",
      });
    });

    it("should search by name keywords", async () => {
      const response = await request(app)
        .get("/api/search/users?q=Developer")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.users).toHaveLength(1);
      expect(response.body.data.users[0]).toMatchObject({
        username: "developer",
      });
    });

    it("should return empty results for no matches", async () => {
      const response = await request(app)
        .get("/api/search/users?q=NonExistent")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.users).toHaveLength(0);
    });

    it("should allow participants to search users", async () => {
      const response = await request(app)
        .get("/api/search/users?q=John")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Participants should see limited user information
      expect(response.body.data.users).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            firstName: "John",
            lastName: "Developer",
          }),
        ])
      );
    });
  });

  describe("PUT /api/users/profile", () => {
    it("should update own profile", async () => {
      const updateData = {
        firstName: "Updated",
        lastName: "Name",
        phone: "+1234567890",
      };

      const response = await request(app)
        .put(`/api/users/profile`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining("updated"),
        data: {
          user: {
            firstName: "Updated",
            lastName: "Name",
            phone: "+1234567890",
          },
        },
      });
    });

    it("should validate email format", async () => {
      const updateData = {
        email: "invalid-email",
      };

      const response = await request(app)
        .put(`/api/users/profile`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining("Validation failed"),
      });
    });

    it("should validate phone format", async () => {
      const updateData = {
        phone: "invalid-phone",
      };

      const response = await request(app)
        .put(`/api/users/profile`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining("Validation failed"),
      });
    });
  });

  describe("PUT /api/users/:id/role", () => {
    it("should allow admin to update user role", async () => {
      const updateData = {
        role: "Leader",
      };

      const response = await request(app)
        .put(`/api/users/${userId}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.user).toMatchObject({
        role: "Leader",
      });
    });

    it("should reject user trying to update another user's role", async () => {
      const updateData = {
        role: "Admin",
      };

      const response = await request(app)
        .put(`/api/users/${adminId}/role`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining("Access denied"),
      });
    });

    it("should reject user trying to change their own role", async () => {
      const updateData = {
        role: "admin",
      };

      const response = await request(app)
        .put(`/api/users/${userId}/role`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining("Access denied"),
      });
    });
  });

  describe("DELETE /api/users/:id", () => {
    it("should allow Super Admin to delete user", async () => {
      // Create a Super Admin user
      const superAdminData = {
        username: "superadmin",
        email: "superadmin@example.com",
        password: "SuperPass123!",
        confirmPassword: "SuperPass123!",
        firstName: "Super",
        lastName: "Admin",
        role: "Participant", // Will be updated after registration
        gender: "male",
        isAtCloudLeader: false,
        acceptTerms: true,
      };

      await request(app).post("/api/auth/register").send(superAdminData);

      // Manually verify and set Super Admin role
      await User.findOneAndUpdate(
        { email: "superadmin@example.com" },
        { isVerified: true, role: "Super Admin" }
      );

      // Login to get Super Admin token
      const superAdminLoginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          emailOrUsername: "superadmin@example.com",
          password: "SuperPass123!",
        });

      const superAdminToken = superAdminLoginResponse.body.data.accessToken;

      const response = await request(app)
        .delete(`/api/users/${userId}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining("deleted"),
      });

      // Verify user was deleted
      const deletedUser = await User.findById(userId);
      expect(deletedUser).toBeNull();
    });

    it("should reject admin trying to delete user (Super Admin only)", async () => {
      const response = await request(app)
        .delete(`/api/users/${userId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining("Access denied"),
      });
    });

    it("should reject user trying to delete another user", async () => {
      const response = await request(app)
        .delete(`/api/users/${adminId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining("Access denied"),
      });
    });

    it("should return 404 for non-existent user (Super Admin)", async () => {
      // Create a Super Admin user for this test
      const superAdminData = {
        username: "superadmin2",
        email: "superadmin2@example.com",
        password: "SuperPass123!",
        confirmPassword: "SuperPass123!",
        firstName: "Super",
        lastName: "Admin2",
        role: "Participant",
        gender: "male",
        isAtCloudLeader: false,
        acceptTerms: true,
      };

      await request(app).post("/api/auth/register").send(superAdminData);

      await User.findOneAndUpdate(
        { email: "superadmin2@example.com" },
        { isVerified: true, role: "Super Admin" }
      );

      const superAdminLoginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          emailOrUsername: "superadmin2@example.com",
          password: "SuperPass123!",
        });

      const superAdminToken = superAdminLoginResponse.body.data.accessToken;
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .delete(`/api/users/${fakeId}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining("not found"),
      });
    });
  });

  describe("POST /api/users/avatar", () => {
    it("should require a file for avatar upload", async () => {
      const response = await request(app)
        .post(`/api/users/avatar`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining("file"),
      });
    });

    it("should require authentication", async () => {
      const imageBuffer = Buffer.from("fake-image-data");

      const response = await request(app)
        .post(`/api/users/avatar`)
        .attach("avatar", imageBuffer, "test-avatar.jpg")
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining("token"),
      });
    });
  });

  describe("POST /api/users/:id/change-password", () => {
    it("should change own password", async () => {
      const passwordData = {
        currentPassword: "TestPass123!",
        newPassword: "NewPassword123!",
        confirmPassword: "NewPassword123!",
      };

      const response = await request(app)
        .post(`/api/users/${userId}/change-password`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(passwordData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: "Password changed successfully",
      });

      // Verify old password no longer works
      const oldPasswordResponse = await request(app)
        .post("/api/auth/login")
        .send({
          emailOrUsername: "test@example.com",
          password: "TestPass123!",
        })
        .expect(401);

      expect(oldPasswordResponse.body.success).toBe(false);

      // Add a small delay to ensure password change is committed
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify can login with new password
      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          emailOrUsername: "test@example.com",
          password: "NewPassword123!",
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });

    it("should reject incorrect current password", async () => {
      const passwordData = {
        currentPassword: "WrongPassword123!",
        newPassword: "NewPassword123!",
        confirmPassword: "NewPassword123!",
      };

      const response = await request(app)
        .post(`/api/users/${userId}/change-password`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: "Current password is incorrect",
      });
    });

    it("should reject mismatched password confirmation", async () => {
      const passwordData = {
        currentPassword: "TestPass123!",
        newPassword: "NewPassword123!",
        confirmPassword: "DifferentPassword123!",
      };

      const response = await request(app)
        .post(`/api/users/${userId}/change-password`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining("confirm"),
      });
    });

    it("should reject weak new password", async () => {
      const passwordData = {
        currentPassword: "TestPass123!",
        newPassword: "weak",
        confirmPassword: "weak",
      };

      const response = await request(app)
        .post(`/api/users/${userId}/change-password`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining("password"),
      });
    });
  });
});
