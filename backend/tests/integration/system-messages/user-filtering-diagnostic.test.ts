/**
 * User-Specific Message Filtering Diagnostic
 *
 * This test checks if messages are filtered by user/role
 * which might explain why testMessage is undefined
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

describe("User-Specific Message Filtering Diagnostic", () => {
  let adminUser: any;
  let participantUser: any;
  let adminToken: string;
  let participantToken: string;
  let testMessageId: string;

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
    await User.deleteMany({});
    await Message.deleteMany({});

    // Create users
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

    participantUser = await User.create({
      firstName: "Participant",
      lastName: "User",
      username: "participant-test",
      email: "participant@test.com",
      password: "TestPassword123!",
      gender: "female",
      role: "Participant",
      isActive: true,
      isVerified: true,
    });

    // Login both users
    const adminLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ emailOrUsername: "admin-test", password: "TestPassword123!" });

    const participantLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({
        emailOrUsername: "participant-test",
        password: "TestPassword123!",
      });

    adminToken = adminLogin.body.data.accessToken;
    participantToken = participantLogin.body.data.accessToken;
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Message.deleteMany({});
  });

  it("DIAGNOSTIC: Check if message filtering is user-specific", async () => {
    console.log("\n=== USER FILTERING DIAGNOSTIC ===");

    // Step 1: Admin creates message
    console.log("\n📝 Step 1: Admin creates message");
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Admin Created Message",
        content: "Testing user filtering",
        type: "announcement",
        priority: "medium",
      });

    console.log(`Create status: ${createResponse.status}`);
    testMessageId = createResponse.body.data.message.id;
    console.log(`Created message ID: ${testMessageId}`);

    // Step 2: Admin retrieves messages
    console.log("\n🔍 Step 2: Admin retrieves messages");
    const adminGetResponse = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log(`Admin get status: ${adminGetResponse.status}`);
    const adminMessages = adminGetResponse.body.data.messages;
    console.log(`Admin sees ${adminMessages.length} messages`);

    if (adminMessages.length > 0) {
      const adminMessage = adminMessages.find(
        (msg: any) => msg.id === testMessageId
      );
      console.log(`Admin can find created message: ${!!adminMessage}`);
    }

    // Step 3: Participant retrieves messages
    console.log("\n👤 Step 3: Participant retrieves messages");
    const participantGetResponse = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${participantToken}`);

    console.log(`Participant get status: ${participantGetResponse.status}`);
    const participantMessages = participantGetResponse.body.data.messages;
    console.log(`Participant sees ${participantMessages.length} messages`);

    if (participantMessages.length > 0) {
      const participantMessage = participantMessages.find(
        (msg: any) => msg.id === testMessageId
      );
      console.log(
        `Participant can find created message: ${!!participantMessage}`
      );
    } else {
      console.log(
        "🐛 BUG FOUND: Participant cannot see admin-created message!"
      );
      console.log(
        "Full participant response:",
        JSON.stringify(participantGetResponse.body, null, 2)
      );
    }

    // Step 4: Check database directly
    console.log("\n🗄️ Step 4: Check database directly");
    const dbMessages = await Message.find({}).lean();
    console.log(`Database has ${dbMessages.length} messages`);

    if (dbMessages.length > 0) {
      const dbMessage = dbMessages[0];
      console.log("Database message details:");
      console.log("  - ID:", dbMessage._id);
      console.log("  - Title:", dbMessage.title);
      console.log("  - Creator ID:", dbMessage.creator?.id);
      console.log(
        "  - Recipients:",
        (dbMessage as any).recipients?.length || "No recipients field"
      );
      console.log("  - isActive:", dbMessage.isActive);
    }

    // Step 5: Summary
    console.log("\n📊 Step 5: Summary");
    console.log(`Admin sees: ${adminMessages.length} messages`);
    console.log(`Participant sees: ${participantMessages.length} messages`);
    console.log(`Database has: ${dbMessages.length} messages`);

    if (adminMessages.length > 0 && participantMessages.length === 0) {
      console.log(
        "🎯 ISSUE IDENTIFIED: Messages are user-specific or role-filtered"
      );
      console.log("This explains why our original test failed!");
    }

    console.log("\n=== DIAGNOSTIC END ===\n");
  });
});
