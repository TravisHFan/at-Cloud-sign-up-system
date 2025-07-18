import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import authRoutes from "../../src/routes/auth";
import User from "../../src/models/User";
import { ROLES } from "../../src/utils/roleUtils";

const app = express();
app.use(express.json());
app.use("/api/v1/auth", authRoutes);

describe("Auth Controller", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!);
  });

  describe("POST /api/v1/auth/register", () => {
    it("should register a new user successfully", async () => {
      const userData = {
        username: "newuser",
        email: "newuser@example.com",
        password: "Password123!",
        confirmPassword: "Password123!",
        firstName: "New",
        lastName: "User",
        gender: "male",
        isAtCloudLeader: false,
        acceptTerms: true,
      };

      const response = await request(app)
        .post("/api/v1/auth/register")
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe("newuser");
      expect(response.body.data.user.email).toBe("newuser@example.com");
      expect(response.body.data.user.role).toBe(ROLES.PARTICIPANT);
      expect(response.body.message).toBeDefined();
    });

    it("should fail with invalid email format", async () => {
      const userData = {
        username: "invaliduser",
        email: "invalid-email",
        password: "Password123!",
        confirmPassword: "Password123!",
        firstName: "Invalid",
        lastName: "User",
        gender: "male",
        isAtCloudLeader: false,
        acceptTerms: true,
      };

      const response = await request(app)
        .post("/api/v1/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should fail with duplicate username", async () => {
      // First user
      const userData1 = {
        username: "duplicatetest",
        email: "test1@example.com",
        password: "Password123!",
        confirmPassword: "Password123!",
        firstName: "Test",
        lastName: "User",
        gender: "male",
        isAtCloudLeader: false,
        acceptTerms: true,
      };

      await request(app)
        .post("/api/v1/auth/register")
        .send(userData1)
        .expect(201);

      // Duplicate user
      const userData2 = {
        username: "duplicatetest",
        email: "test2@example.com",
        password: "Password123!",
        confirmPassword: "Password123!",
        firstName: "Test",
        lastName: "User2",
        gender: "female",
        isAtCloudLeader: false,
        acceptTerms: true,
      };

      const response = await request(app)
        .post("/api/v1/auth/register")
        .send(userData2)
        .expect(409); // Expect 409 Conflict for duplicate username

      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    let testUser: any;

    beforeEach(async () => {
      // Create a test user
      testUser = new User({
        username: "logintest",
        email: "logintest@example.com",
        password: "Password123!",
        firstName: "Login",
        lastName: "Test",
        role: ROLES.PARTICIPANT,
        isAtCloudLeader: false,
        isActive: true,
        isVerified: true, // Make sure user is verified for login
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: true,
        loginAttempts: 0,
        hasReceivedWelcomeMessage: false,
      });
      await testUser.save();
    });

    it("should login with valid credentials", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          emailOrUsername: "logintest",
          password: "Password123!",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe("logintest");
      expect(response.body.data.accessToken).toBeDefined();
    });

    it("should fail with invalid password", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          emailOrUsername: "logintest",
          password: "wrongpassword",
        })
        .expect(401); // Expect 401 for invalid credentials

      expect(response.body.success).toBe(false);
    });

    it("should fail with non-existent user", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          emailOrUsername: "nonexistent",
          password: "Password123!",
        })
        .expect(401); // Expect 401 for non-existent user

      expect(response.body.success).toBe(false);
    });
  });
});
