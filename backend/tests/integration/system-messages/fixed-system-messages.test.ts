/**
 * Fixed System Messages API Integration Tests
 *
 * This is a corrected version that creates testSystemMessage locally
 * in each test that needs it, preventing the variable scoping bugs
 * that were causing the original comprehensive test to fail.
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

describe("Fixed System Messages API Tests", () => {
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

  it("REQUIREMENT 1: System messages show as unread by default", async () => {
    // Create test message
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Test Read/Unread Message",
        content: "Testing read/unread functionality",
        type: "announcement",
        priority: "medium",
      });

    expect(createResponse.status).toBe(201);
    const testMessage = createResponse.body.data.message;

    // Check unread by default
    const getResponse = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${participantToken}`)
      .expect(200);

    const messages = getResponse.body.data.messages;
    const foundMessage = messages.find((msg: any) => msg.id === testMessage.id);

    expect(foundMessage).toBeTruthy();
    expect(foundMessage.isRead).toBe(false);
    console.log("✅ REQUIREMENT 1: Messages unread by default");
  });

  it("REQUIREMENT 1: Users can mark messages as read", async () => {
    // Create test message
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Test Read Message",
        content: "Testing read functionality",
        type: "announcement",
        priority: "medium",
      });

    const testMessage = createResponse.body.data.message;

    // Mark as read
    await request(app)
      .patch(`/api/v1/system-messages/${testMessage.id}/read`)
      .set("Authorization", `Bearer ${participantToken}`)
      .expect(200);

    // Verify read status
    const getResponse = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${participantToken}`)
      .expect(200);

    const messages = getResponse.body.data.messages;
    const foundMessage = messages.find((msg: any) => msg.id === testMessage.id);

    expect(foundMessage.isRead).toBe(true);
    console.log("✅ REQUIREMENT 1: Can mark messages as read");
  });

  it("REQUIREMENT 2: Users can delete messages permanently", async () => {
    // Create test message
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Test Delete Message",
        content: "Testing delete functionality",
        type: "announcement",
        priority: "medium",
      });

    const testMessage = createResponse.body.data.message;

    // Delete for participant
    await request(app)
      .delete(`/api/v1/system-messages/${testMessage.id}`)
      .set("Authorization", `Bearer ${participantToken}`)
      .expect(200);

    // Verify not visible for participant
    const participantResponse = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${participantToken}`)
      .expect(200);

    const participantMessages = participantResponse.body.data.messages;
    const foundForParticipant = participantMessages.find(
      (msg: any) => msg.id === testMessage.id
    );
    expect(foundForParticipant).toBeFalsy();

    // Verify still visible for admin
    const adminResponse = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const adminMessages = adminResponse.body.data.messages;
    const foundForAdmin = adminMessages.find(
      (msg: any) => msg.id === testMessage.id
    );
    expect(foundForAdmin).toBeTruthy();

    console.log("✅ REQUIREMENT 2: User-specific deletion works");
  });

  it("REQUIREMENT 3: All five message types are supported", async () => {
    const messageTypes = [
      "announcement",
      "maintenance",
      "update",
      "warning",
      "auth_level_change",
    ];

    // Create messages of each type
    for (const type of messageTypes) {
      const response = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: `Test ${type} Message`,
          content: `Testing ${type} message type`,
          type: type,
          priority: "medium",
        });

      expect(response.status).toBe(201);
      expect(response.body.data.message.type).toBe(type);
    }

    // Retrieve and verify all types
    const getResponse = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${participantToken}`)
      .expect(200);

    const messages = getResponse.body.data.messages;
    expect(messages.length).toBe(5);

    messageTypes.forEach((type) => {
      const messageOfType = messages.find((msg: any) => msg.type === type);
      expect(messageOfType).toBeTruthy();
    });

    console.log("✅ REQUIREMENT 3: All five message types supported");
  });

  it("REQUIREMENT 4: Only admins can create messages", async () => {
    // Admin can create
    const adminResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Admin Created Message",
        content: "Testing admin creation",
        type: "announcement",
        priority: "medium",
      });

    expect(adminResponse.status).toBe(201);

    // Participant cannot create
    const participantResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${participantToken}`)
      .send({
        title: "Participant Attempt",
        content: "Should fail",
        type: "announcement",
        priority: "medium",
      });

    expect(participantResponse.status).toBe(403);
    console.log("✅ REQUIREMENT 4: Role-based access control works");
  });

  it("REQUIREMENT 5-6: Bell notifications work independently", async () => {
    // Create test message
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Test Bell Notification",
        content: "Testing bell functionality",
        type: "announcement",
        priority: "medium",
      });

    const testMessage = createResponse.body.data.message;

    // Check bell notifications
    const bellResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${participantToken}`)
      .expect(200);

    const notifications = bellResponse.body.data.notifications;
    const notification = notifications.find(
      (n: any) => n.id === testMessage.id
    );
    expect(notification).toBeTruthy();
    expect(notification.isRead).toBe(false);

    // Mark bell notification as read
    await request(app)
      .patch(
        `/api/v1/system-messages/bell-notifications/${testMessage.id}/read`
      )
      .set("Authorization", `Bearer ${participantToken}`)
      .expect(200);

    // Remove bell notification
    await request(app)
      .delete(`/api/v1/system-messages/bell-notifications/${testMessage.id}`)
      .set("Authorization", `Bearer ${participantToken}`)
      .expect(200);

    // Verify bell notification removed
    const bellResponse2 = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${participantToken}`)
      .expect(200);

    const notifications2 = bellResponse2.body.data.notifications;
    const notification2 = notifications2.find(
      (n: any) => n.id === testMessage.id
    );
    expect(notification2).toBeFalsy();

    // Verify system message still exists
    const msgResponse = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${participantToken}`)
      .expect(200);

    const messages = msgResponse.body.data.messages;
    const message = messages.find((msg: any) => msg.id === testMessage.id);
    expect(message).toBeTruthy();

    console.log("✅ REQUIREMENTS 5-6: Bell notifications work independently");
  });

  it("VALIDATION: Core system functionality works end-to-end", async () => {
    console.log("\n🎯 Running end-to-end validation test");

    // 1. Admin creates message
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "End-to-End Test Message",
        content: "Testing complete workflow",
        type: "announcement",
        priority: "medium",
      });

    expect(createResponse.status).toBe(201);
    const messageId = createResponse.body.data.message.id;
    console.log(`✅ 1. Message created with ID: ${messageId}`);

    // 2. Participant can see message
    const getResponse = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${participantToken}`)
      .expect(200);

    const messages = getResponse.body.data.messages;
    const foundMessage = messages.find((msg: any) => msg.id === messageId);
    expect(foundMessage).toBeTruthy();
    expect(foundMessage.isRead).toBe(false);
    console.log("✅ 2. Message visible to participant as unread");

    // 3. Participant can see bell notification
    const bellResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${participantToken}`)
      .expect(200);

    const notifications = bellResponse.body.data.notifications;
    const foundNotification = notifications.find(
      (n: any) => n.id === messageId
    );
    expect(foundNotification).toBeTruthy();
    console.log("✅ 3. Bell notification visible");

    // 4. Participant marks as read
    await request(app)
      .patch(`/api/v1/system-messages/${messageId}/read`)
      .set("Authorization", `Bearer ${participantToken}`)
      .expect(200);
    console.log("✅ 4. Message marked as read");

    // 5. Participant deletes message
    await request(app)
      .delete(`/api/v1/system-messages/${messageId}`)
      .set("Authorization", `Bearer ${participantToken}`)
      .expect(200);
    console.log("✅ 5. Message deleted for participant");

    // 6. Verify message gone for participant
    const getResponse2 = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${participantToken}`)
      .expect(200);

    const messages2 = getResponse2.body.data.messages;
    const foundMessage2 = messages2.find((msg: any) => msg.id === messageId);
    expect(foundMessage2).toBeFalsy();
    console.log("✅ 6. Message no longer visible to participant");

    console.log("\n🎉 END-TO-END TEST PASSED: Core system works correctly!");
  });
});
