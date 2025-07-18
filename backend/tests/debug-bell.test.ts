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
app.use(routes);

describe("Minimal Bell Notification Debug Test", () => {
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

  it("should work with bell notification read endpoint", async () => {
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

    expect(adminLogin.status).toBe(200);
    adminToken = adminLogin.body.data.accessToken;

    // Create system message
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Debug Test Message",
        content: "Debug test content",
        type: "announcement",
        priority: "high",
      });

    expect(createResponse.status).toBe(201);
    const messageId = createResponse.body.data.id;
    console.log("Created message ID:", messageId);

    // Get bell notifications
    const bellGetResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(bellGetResponse.status).toBe(200);
    console.log("Bell notifications:", bellGetResponse.body);

    // Try to mark bell notification as read
    console.log(
      "Attempting PATCH to:",
      `/api/v1/system-messages/bell-notifications/${messageId}/read`
    );
    const bellPatchResponse = await request(app)
      .patch(`/api/v1/system-messages/bell-notifications/${messageId}/read`)
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("Bell PATCH response status:", bellPatchResponse.status);
    console.log("Bell PATCH response body:", bellPatchResponse.body);

    // This should pass if the endpoint works
    expect(bellPatchResponse.status).toBe(200);
  });
});
