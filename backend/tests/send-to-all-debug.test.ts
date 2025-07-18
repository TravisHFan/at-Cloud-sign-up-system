import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
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

describe("Send to All System Messages Debug Test", () => {
  let adminUser: any;
  let adminToken: string;
  let regularUser1: any;
  let regularUser1Token: string;
  let regularUser2: any;
  let regularUser2Token: string;

  beforeAll(async () => {
    if (!process.env.MONGODB_URI_TEST) {
      throw new Error("MONGODB_URI_TEST environment variable is not set");
    }
    await mongoose.connect(process.env.MONGODB_URI_TEST);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up all users and system messages
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

    // Create regular users
    regularUser1 = await User.create({
      username: "user1",
      email: "user1@test.com",
      password: "User1Pass123",
      firstName: "User",
      lastName: "One",
      role: "Participant",
      isVerified: true,
      isActive: true,
    });

    regularUser2 = await User.create({
      username: "user2",
      email: "user2@test.com",
      password: "User2Pass123",
      firstName: "User",
      lastName: "Two",
      role: "Participant",
      isVerified: true,
      isActive: true,
    });

    // Get tokens for all users
    const adminLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ emailOrUsername: "admin@test.com", password: "AdminPass123" });
    adminToken = adminLogin.body.data.accessToken;

    const user1Login = await request(app)
      .post("/api/v1/auth/login")
      .send({ emailOrUsername: "user1@test.com", password: "User1Pass123" });
    regularUser1Token = user1Login.body.data.accessToken;

    const user2Login = await request(app)
      .post("/api/v1/auth/login")
      .send({ emailOrUsername: "user2@test.com", password: "User2Pass123" });
    regularUser2Token = user2Login.body.data.accessToken;
  });

  it("should create a system message and make it available to all users", async () => {
    console.log("=== Testing Send to All System Message Functionality ===");

    // Step 1: Admin creates a system message (should go to all users)
    console.log("Step 1: Creating system message as admin...");
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Send to All Test Message",
        content: "This message should reach all users",
        type: "announcement",
        priority: "high",
      });

    console.log("Create response status:", createResponse.status);
    console.log("Create response body:", createResponse.body);
    expect(createResponse.status).toBe(201);

    const messageId = createResponse.body.data.id;
    console.log("Created message ID:", messageId);

    // Step 2: Check that admin can see the message in their bell notifications
    console.log("\nStep 2: Checking admin's bell notifications...");
    const adminBellResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("Admin bell notifications:", adminBellResponse.body);
    expect(adminBellResponse.status).toBe(200);
    expect(adminBellResponse.body.data.unreadCount).toBeGreaterThan(0);

    // Step 3: Check that regular user 1 can see the message
    console.log("\nStep 3: Checking user 1's bell notifications...");
    const user1BellResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${regularUser1Token}`);

    console.log("User 1 bell notifications:", user1BellResponse.body);
    expect(user1BellResponse.status).toBe(200);
    expect(user1BellResponse.body.data.unreadCount).toBeGreaterThan(0);

    // Step 4: Check that regular user 2 can see the message
    console.log("\nStep 4: Checking user 2's bell notifications...");
    const user2BellResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${regularUser2Token}`);

    console.log("User 2 bell notifications:", user2BellResponse.body);
    expect(user2BellResponse.status).toBe(200);
    expect(user2BellResponse.body.data.unreadCount).toBeGreaterThan(0);

    // Step 5: Check that all users can see the message in their system messages list
    console.log("\nStep 5: Checking system messages endpoint for all users...");

    const adminSystemMessages = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`);
    console.log(
      "Admin system messages count:",
      adminSystemMessages.body.data?.messages?.length || 0
    );

    const user1SystemMessages = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${regularUser1Token}`);
    console.log(
      "User 1 system messages count:",
      user1SystemMessages.body.data?.messages?.length || 0
    );

    const user2SystemMessages = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${regularUser2Token}`);
    console.log(
      "User 2 system messages count:",
      user2SystemMessages.body.data?.messages?.length || 0
    );

    // All users should see the system message
    expect(adminSystemMessages.status).toBe(200);
    expect(user1SystemMessages.status).toBe(200);
    expect(user2SystemMessages.status).toBe(200);

    expect(adminSystemMessages.body.data.messages).toHaveLength(1);
    expect(user1SystemMessages.body.data.messages).toHaveLength(1);
    expect(user2SystemMessages.body.data.messages).toHaveLength(1);
  });

  it("should verify system message creation endpoint creates proper notifications", async () => {
    console.log(
      "=== Testing System Message Creation with Notification Creation ==="
    );

    // Create a system message and trace the notification creation process
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Notification Creation Test",
        content: "Testing notification creation",
        type: "announcement",
        priority: "medium",
      });

    expect(createResponse.status).toBe(201);
    console.log("System message created successfully");

    // Check the database directly for notification records
    // This will help us understand if notifications are being created properly

    // Get all users to verify notifications were created for each
    const allUsers = await User.find({});
    console.log(`Found ${allUsers.length} users in database`);

    for (const user of allUsers) {
      console.log(
        `Checking notifications for user: ${user.username} (${user.role})`
      );

      const userBellResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set(
          "Authorization",
          user.role === "Administrator"
            ? adminToken
            : user.username === "user1"
            ? regularUser1Token
            : regularUser2Token
        );

      console.log(`${user.username} notifications:`, userBellResponse.body);
      expect(userBellResponse.status).toBe(200);
    }
  });
});
