/**
 * Focused Test - System Messages CRUD to identify bugs
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

describe("System Messages CRUD Test", () => {
  let adminUser: any;
  let participantUser: any;
  let adminToken: string;
  let participantToken: string;

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

    // Create test users
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

    participantUser = await User.create({
      firstName: "Participant",
      lastName: "User",
      username: "participant-test",
      email: "participant@test.com",
      password: "TestPassword123!",
      role: "Participant",
      isActive: true,
      isVerified: true,
    });

    // Login users
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
  });

  it("BUG CHECK 1: Can Administrator create system message?", async () => {
    console.log("Testing Administrator message creation...");

    const response = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Test Message",
        content: "Test content",
        type: "announcement",
        priority: "medium",
      });

    console.log("Create message status:", response.status);
    console.log("Create message body:", JSON.stringify(response.body, null, 2));

    if (response.status !== 201) {
      console.log("🐛 BUG FOUND: Administrator cannot create messages");
    } else {
      console.log("✅ Administrator can create messages");
    }
  });

  it("BUG CHECK 2: Can Participant create system message (should fail)?", async () => {
    console.log("Testing Participant message creation (should be blocked)...");

    const response = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${participantToken}`)
      .send({
        title: "Test Message",
        content: "Test content",
        type: "announcement",
        priority: "medium",
      });

    console.log("Participant create status:", response.status);
    console.log(
      "Participant create body:",
      JSON.stringify(response.body, null, 2)
    );

    if (response.status === 201) {
      console.log(
        "🐛 BUG FOUND: Participant can create messages (should be blocked)"
      );
    } else if (response.status === 403) {
      console.log("✅ Participant correctly blocked from creating messages");
    } else {
      console.log("❓ Unexpected response for Participant creation");
    }
  });

  it("BUG CHECK 3: Message types validation", async () => {
    console.log("Testing message types...");

    const validTypes = [
      "announcement",
      "maintenance",
      "update",
      "warning",
      "auth_level_change",
    ];

    for (const type of validTypes) {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: `Test ${type}`,
          content: "Test content",
          type: type,
          priority: "medium",
        });

      if (response.status !== 201) {
        console.log(
          `🐛 BUG FOUND: Valid type '${type}' rejected. Status: ${response.status}`
        );
        console.log("Response:", JSON.stringify(response.body, null, 2));
      } else {
        console.log(`✅ Type '${type}' accepted`);
      }
    }

    // Test invalid type
    const invalidResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Invalid Type",
        content: "Test content",
        type: "invalid_type",
        priority: "medium",
      });

    if (invalidResponse.status === 201) {
      console.log("🐛 BUG FOUND: Invalid type 'invalid_type' was accepted");
    } else {
      console.log("✅ Invalid type correctly rejected");
    }
  });

  it("BUG CHECK 4: Read/Unread functionality", async () => {
    console.log("Testing read/unread functionality...");

    // Create a message first
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Read Test",
        content: "Test content",
        type: "announcement",
        priority: "medium",
      });

    if (createResponse.status !== 201) {
      console.log("🐛 Cannot create message for read test");
      return;
    }

    const messageId = createResponse.body.data.id;

    // Check if message shows as unread
    const getResponse = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${participantToken}`);

    console.log("Get messages status:", getResponse.status);
    console.log(
      "Get messages body:",
      JSON.stringify(getResponse.body, null, 2)
    );

    if (getResponse.status !== 200) {
      console.log("🐛 BUG FOUND: Cannot retrieve system messages");
      return;
    }

    const messages = getResponse.body.data.messages;
    const testMessage = messages.find((msg: any) => msg.id === messageId);

    if (!testMessage) {
      console.log("🐛 BUG FOUND: Created message not visible to users");
      return;
    }

    if (testMessage.isRead !== false) {
      console.log("🐛 BUG FOUND: New message doesn't show as unread");
    } else {
      console.log("✅ New message shows as unread");
    }

    // Try to mark as read
    const markReadResponse = await request(app)
      .patch(`/api/v1/system-messages/${messageId}/read`)
      .set("Authorization", `Bearer ${participantToken}`);

    console.log("Mark read status:", markReadResponse.status);
    console.log(
      "Mark read body:",
      JSON.stringify(markReadResponse.body, null, 2)
    );

    if (markReadResponse.status !== 200) {
      console.log("🐛 BUG FOUND: Cannot mark message as read");
    } else {
      console.log("✅ Can mark message as read");
    }
  });

  it("BUG CHECK 5: Bell notifications", async () => {
    console.log("Testing bell notifications...");

    // Create a message first
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Bell Test",
        content: "Test content",
        type: "announcement",
        priority: "high",
      });

    if (createResponse.status !== 201) {
      console.log("🐛 Cannot create message for bell test");
      return;
    }

    // Try to get bell notifications
    const bellResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${participantToken}`);

    console.log("Bell notifications status:", bellResponse.status);
    console.log(
      "Bell notifications body:",
      JSON.stringify(bellResponse.body, null, 2)
    );

    if (bellResponse.status !== 200) {
      console.log("🐛 BUG FOUND: Cannot get bell notifications");
    } else {
      console.log("✅ Can get bell notifications");

      const notifications = bellResponse.body.data.notifications;
      if (notifications.length === 0) {
        console.log(
          "🐛 BUG FOUND: No bell notifications appear for new message"
        );
      } else {
        console.log("✅ Bell notifications appear for new message");
      }
    }
  });
});
