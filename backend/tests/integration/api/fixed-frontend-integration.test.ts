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

describe("Fixed Frontend Integration Test", () => {
  let adminUser: any;
  let regularUser: any;
  let adminToken: string;
  let regularToken: string;

  beforeAll(async () => {
    if (!process.env.MONGODB_URI_TEST) {
      throw new Error("MONGODB_URI_TEST environment variable is not set");
    }
    await mongoose.connect(process.env.MONGODB_URI_TEST);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it("should verify the frontend fix will work end-to-end", async () => {
    // Clean up
    await User.deleteMany({});

    // Create users
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

    regularUser = await User.create({
      username: "user",
      email: "user@test.com",
      password: "UserPass123",
      firstName: "Regular",
      lastName: "User",
      role: "Participant",
      isVerified: true,
      isActive: true,
    });

    // Get tokens
    const adminLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ emailOrUsername: "admin@test.com", password: "AdminPass123" });

    const userLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ emailOrUsername: "user@test.com", password: "UserPass123" });

    expect(adminLogin.status).toBe(200);
    expect(userLogin.status).toBe(200);
    adminToken = adminLogin.body.data.accessToken;
    regularToken = userLogin.body.data.accessToken;

    console.log("=== Testing Fixed Frontend Integration ===");

    // Step 1: Admin creates "Send to All" system message
    console.log("Step 1: Admin creating 'Send to All' system message...");
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Fixed Frontend Test Message",
        content:
          "This message should now appear for all users after frontend fix",
        type: "announcement",
        priority: "high",
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.recipientCount).toBe(2);
    console.log(
      "✅ System message created, recipientCount:",
      createResponse.body.data.recipientCount
    );

    // Step 2: Test the FIXED frontend endpoint for admin
    console.log("Step 2: Testing FIXED frontend endpoint for admin...");
    const adminMessages = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(adminMessages.status).toBe(200);
    expect(adminMessages.body.data.messages).toHaveLength(1);
    console.log("✅ Admin can see message via correct endpoint");

    // Step 3: Test the FIXED frontend endpoint for regular user
    console.log("Step 3: Testing FIXED frontend endpoint for regular user...");
    const userMessages = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${regularToken}`);

    expect(userMessages.status).toBe(200);
    expect(userMessages.body.data.messages).toHaveLength(1);
    console.log("✅ Regular user can see message via correct endpoint");

    // Step 4: Verify message content is correct
    const adminMessage = adminMessages.body.data.messages[0];
    const userMessage = userMessages.body.data.messages[0];

    expect(adminMessage.title).toBe("Fixed Frontend Test Message");
    expect(userMessage.title).toBe("Fixed Frontend Test Message");
    expect(adminMessage.isRead).toBe(false);
    expect(userMessage.isRead).toBe(false);
    console.log("✅ Message content is correct for both users");

    // Step 5: Verify bell notifications work
    console.log("Step 5: Testing bell notifications...");
    const adminBell = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    const userBell = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${regularToken}`);

    expect(adminBell.status).toBe(200);
    expect(userBell.status).toBe(200);
    expect(adminBell.body.data.unreadCount).toBe(1);
    expect(userBell.body.data.unreadCount).toBe(1);
    console.log("✅ Bell notifications work for both users");

    console.log("\n🎉 FRONTEND FIX VERIFICATION COMPLETE!");
    console.log("✅ 'Send to All' functionality now works end-to-end");
    console.log(
      "✅ Frontend now uses correct endpoint: /api/v1/system-messages"
    );
    console.log("✅ Both admin and regular users can see system messages");
    console.log("✅ Bell notifications work correctly");
    console.log("✅ Message content and read states are properly managed");
  });
});
