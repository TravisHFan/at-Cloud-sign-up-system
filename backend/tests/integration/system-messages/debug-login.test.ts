/**
 * Quick Debug Test - Login and Basic API
 *
 * Let's debug why login is failing
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
import mongoose from "mongoose";
import express from "express";
import { User } from "../../../src/models";
import routes from "../../../src/routes";

// Create test app
const app = express();
app.use(express.json());
app.use(routes);

describe("Debug Test - Login & API", () => {
  let adminUser: any;
  let adminToken: string;

  beforeAll(async () => {
    // Connect to test database
    if (!process.env.MONGODB_URI_TEST) {
      throw new Error("MONGODB_URI_TEST environment variable is not set");
    }
    await mongoose.connect(process.env.MONGODB_URI_TEST);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up before each test
    await User.deleteMany({});

    // Create test user with correct password format
    adminUser = await User.create({
      firstName: "Admin",
      lastName: "User",
      username: "admin-test",
      email: "admin@test.com",
      password: "TestPassword123!",
      role: "Administrator",
      isActive: true,
      isVerified: true,
    });

    console.log("Created admin user:", {
      id: adminUser._id,
      username: adminUser.username,
      email: adminUser.email,
      role: adminUser.role,
      isActive: adminUser.isActive,
      isVerified: adminUser.isVerified,
    });
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  it("should test login API and response structure", async () => {
    console.log("Attempting login...");

    // Login user to get token
    const loginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({ emailOrUsername: "admin-test", password: "TestPassword123!" });

    console.log("Login response status:", loginResponse.status);
    console.log(
      "Login response body:",
      JSON.stringify(loginResponse.body, null, 2)
    );

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.success).toBe(true);
    expect(loginResponse.body.data).toBeTruthy();
    expect(loginResponse.body.data.accessToken).toBeTruthy();

    adminToken = loginResponse.body.data.accessToken;
    console.log("Got admin token:", adminToken);

    // Test system messages endpoint
    console.log("Testing system messages endpoint...");
    const systemMessagesResponse = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log(
      "System messages response status:",
      systemMessagesResponse.status
    );
    console.log(
      "System messages response body:",
      JSON.stringify(systemMessagesResponse.body, null, 2)
    );
  });
});
