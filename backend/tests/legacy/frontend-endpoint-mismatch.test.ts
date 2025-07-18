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

describe("Frontend Endpoint Mismatch Test", () => {
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

  it("should reveal the frontend endpoint mismatch issue", async () => {
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

    console.log("=== Testing Frontend Endpoint Mismatch ===");

    // Step 1: Create a system message using the correct backend endpoint
    console.log("Step 1: Creating system message using correct endpoint...");
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Frontend Mismatch Test Message",
        content:
          "This message should appear in correct endpoint but not in old one",
        type: "announcement",
        priority: "high",
      });

    expect(createResponse.status).toBe(201);
    console.log("✅ System message created successfully");

    // Step 2: Test the CORRECT endpoint (what backend tests use)
    console.log("Step 2: Testing CORRECT endpoint /api/v1/system-messages...");
    const correctEndpointResponse = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("Correct endpoint status:", correctEndpointResponse.status);
    console.log(
      "Correct endpoint data:",
      JSON.stringify(correctEndpointResponse.body.data, null, 2)
    );

    expect(correctEndpointResponse.status).toBe(200);
    expect(correctEndpointResponse.body.data.messages).toHaveLength(1);
    console.log("✅ Correct endpoint shows the message");

    // Step 3: Test the WRONG endpoint (what frontend uses)
    console.log(
      "Step 3: Testing WRONG endpoint /api/v1/user/notifications/system..."
    );
    const wrongEndpointResponse = await request(app)
      .get("/api/v1/user/notifications/system")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("Wrong endpoint status:", wrongEndpointResponse.status);
    console.log(
      "Wrong endpoint data:",
      JSON.stringify(wrongEndpointResponse.body.data, null, 2)
    );

    expect(wrongEndpointResponse.status).toBe(200);
    expect(wrongEndpointResponse.body.data.systemMessages).toHaveLength(0);
    console.log("❌ Wrong endpoint returns empty array!");

    // Step 4: Prove this is the exact issue
    console.log("Step 4: Proving this is the frontend issue...");
    console.log("✅ Backend creates messages correctly");
    console.log("✅ Correct endpoint (/api/v1/system-messages) shows messages");
    console.log(
      "❌ Frontend endpoint (/api/v1/user/notifications/system) returns empty array"
    );
    console.log(
      "🎯 ROOT CAUSE: Frontend uses deprecated endpoint that intentionally returns empty array!"
    );
  });
});
