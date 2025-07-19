/**
 * Message Retrieval Diagnostic Test
 *
 * This test will help us understand why messages aren't appearing
 * in the GET /api/v1/system-messages endpoint
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
import { User, Message } from "../../../src/models";
import routes from "../../../src/routes";

const app = express();
app.use(express.json());
app.use(routes);

describe("Message Retrieval Diagnostic", () => {
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

  beforeEach(async () => {
    // Clean database
    await User.deleteMany({});
    await Message.deleteMany({});

    // Create admin user with gender
    adminUser = await User.create({
      firstName: "Admin",
      lastName: "User",
      username: "admin-test",
      email: "admin@test.com",
      password: "TestPassword123!",
      gender: "male",
      role: "Administrator",
      isActive: true,
      isVerified: true,
    });

    // Login to get token
    const loginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({ emailOrUsername: "admin-test", password: "TestPassword123!" });

    adminToken = loginResponse.body.data.accessToken;
    console.log("🔐 Admin login successful, token acquired");
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Message.deleteMany({});
  });

  it("DIAGNOSTIC: Create message and check database + API response", async () => {
    console.log("\n=== DIAGNOSTIC TEST START ===");

    // Step 1: Check initial state
    console.log("\n📊 Step 1: Check initial database state");
    const initialMessageCount = await Message.countDocuments();
    console.log(`Initial message count in DB: ${initialMessageCount}`);

    const initialApiResponse = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log(`Initial API response status: ${initialApiResponse.status}`);
    console.log(
      `Initial API messages count: ${
        initialApiResponse.body.data?.messages?.length || 0
      }`
    );
    console.log(
      `Initial API response:`,
      JSON.stringify(initialApiResponse.body, null, 2)
    );

    // Step 2: Create a message via API
    console.log("\n📝 Step 2: Create message via API");
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Diagnostic Test Message",
        content: "Testing message retrieval",
        type: "announcement",
        priority: "medium",
      });

    console.log(`Create response status: ${createResponse.status}`);
    console.log(
      `Create response body:`,
      JSON.stringify(createResponse.body, null, 2)
    );

    // Step 3: Check database after creation
    console.log("\n🗄️ Step 3: Check database after creation");
    const afterCreateCount = await Message.countDocuments();
    console.log(`Message count after creation: ${afterCreateCount}`);

    // Get all messages from database directly
    const dbMessages = await Message.find({}).lean();
    console.log(`DB Messages found: ${dbMessages.length}`);
    dbMessages.forEach((msg, index) => {
      console.log(`DB Message ${index + 1}:`, {
        id: msg._id,
        title: msg.title,
        type: msg.type,
        creator: msg.creator,
        isActive: msg.isActive,
        createdAt: msg.createdAt,
      });
    });

    // Step 4: Try to retrieve via API
    console.log("\n🔍 Step 4: Retrieve messages via API");
    const getResponse = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log(`Get response status: ${getResponse.status}`);
    console.log(
      `Get response body:`,
      JSON.stringify(getResponse.body, null, 2)
    );

    const apiMessages = getResponse.body.data?.messages || [];
    console.log(`API Messages returned: ${apiMessages.length}`);

    // Step 5: Compare database vs API
    console.log("\n🔄 Step 5: Database vs API comparison");
    console.log(`Database has ${dbMessages.length} messages`);
    console.log(`API returned ${apiMessages.length} messages`);

    if (dbMessages.length > 0 && apiMessages.length === 0) {
      console.log(
        "🐛 BUG IDENTIFIED: Messages exist in DB but not returned by API"
      );

      // Check specific message details
      const dbMessage = dbMessages[0];
      console.log("🔍 Analyzing first DB message:");
      console.log("  - ID:", dbMessage._id);
      console.log("  - Title:", dbMessage.title);
      console.log("  - Type:", dbMessage.type);
      console.log("  - isActive:", dbMessage.isActive);
      console.log("  - Creator ID:", dbMessage.creator?.id);
      console.log("  - Creator exists:", !!dbMessage.creator);
    } else if (dbMessages.length === apiMessages.length) {
      console.log("✅ Database and API counts match");
    }

    // Step 6: Try different API query parameters
    console.log("\n🔧 Step 6: Test different API parameters");

    const withPageResponse = await request(app)
      .get("/api/v1/system-messages?page=1&limit=10")
      .set("Authorization", `Bearer ${adminToken}`);
    console.log(
      `With pagination params - Status: ${withPageResponse.status}, Messages: ${
        withPageResponse.body.data?.messages?.length || 0
      }`
    );

    const withTypeResponse = await request(app)
      .get("/api/v1/system-messages?type=announcement")
      .set("Authorization", `Bearer ${adminToken}`);
    console.log(
      `With type filter - Status: ${withTypeResponse.status}, Messages: ${
        withTypeResponse.body.data?.messages?.length || 0
      }`
    );

    console.log("\n=== DIAGNOSTIC TEST END ===\n");

    // Final assertions to check what we found
    expect(createResponse.status).toBe(201); // Message creation should work
    expect(afterCreateCount).toBeGreaterThan(initialMessageCount); // Should have more messages in DB

    // This is the main issue we're investigating:
    if (dbMessages.length > 0 && apiMessages.length === 0) {
      console.log(
        "🎯 CONFIRMED: Message retrieval bug - messages exist but API doesn't return them"
      );
    }
  });
});
