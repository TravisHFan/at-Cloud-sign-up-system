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

  it("TEST 1: Mark notification as read functionality", async () => {
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

    adminToken = adminLogin.body.data.accessToken;

    // Create system message
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Test Read Functionality",
        content: "Test content",
        type: "announcement",
        priority: "high",
      });

    const messageId = createResponse.body.data.id;
    console.log("\n=== TEST 1: Mark as Read ===");
    console.log("Message ID:", messageId);

    // Get notifications before marking as read
    const beforeRead = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log(
      "Before read - unread count:",
      beforeRead.body.data.unreadCount
    );

    // Mark as read
    const markReadResponse = await request(app)
      .patch(`/api/v1/system-messages/bell-notifications/${messageId}/read`)
      .set("Authorization", `Bearer ${adminToken}`);

    console.log(
      "Mark read response:",
      markReadResponse.status,
      markReadResponse.body
    );

    // Get notifications after marking as read
    const afterRead = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("After read - unread count:", afterRead.body.data.unreadCount);

    // Check if unread count decreased
    expect(afterRead.body.data.unreadCount).toBeLessThan(
      beforeRead.body.data.unreadCount
    );
  });

  it("TEST 2: Delete notification functionality", async () => {
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

    adminToken = adminLogin.body.data.accessToken;

    // Create system message
    const createResponse = await request(app)
      .post("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Test Delete Functionality",
        content: "Test content for deletion",
        type: "announcement",
        priority: "high",
      });

    const messageId = createResponse.body.data.id;
    console.log("\n=== TEST 2: Delete Notification ===");
    console.log("Message ID:", messageId);

    // Mark as read first
    await request(app)
      .patch(`/api/v1/system-messages/bell-notifications/${messageId}/read`)
      .set("Authorization", `Bearer ${adminToken}`);

    // Get count before delete
    const beforeDelete = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log(
      "Before delete - total notifications:",
      beforeDelete.body.data.notifications.length
    );

    // Try to delete notification
    const deleteResponse = await request(app)
      .delete(`/api/v1/system-messages/bell-notifications/${messageId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("Delete response:", deleteResponse.status, deleteResponse.body);

    // Get count after delete
    const afterDelete = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log(
      "After delete - total notifications:",
      afterDelete.body.data.notifications.length
    );

    expect(deleteResponse.status).toBe(200);
    expect(afterDelete.body.data.notifications.length).toBeLessThan(
      beforeDelete.body.data.notifications.length
    );
  });

  it("TEST 3: Mark all as read functionality", async () => {
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

    adminToken = adminLogin.body.data.accessToken;

    console.log("\n=== TEST 3: Mark All as Read ===");

    // Create multiple system messages
    for (let i = 1; i <= 3; i++) {
      await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: `Test Message ${i}`,
          content: `Test content ${i}`,
          type: "announcement",
          priority: "medium",
        });
    }

    // Get notifications before mark all read
    const beforeMarkAll = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log(
      "Before mark all - unread count:",
      beforeMarkAll.body.data.unreadCount
    );

    // Mark all as read
    const markAllResponse = await request(app)
      .patch("/api/v1/system-messages/bell-notifications/read-all")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log(
      "Mark all response:",
      markAllResponse.status,
      markAllResponse.body
    );

    // Get notifications after mark all read
    const afterMarkAll = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log(
      "After mark all - unread count:",
      afterMarkAll.body.data.unreadCount
    );

    expect(markAllResponse.status).toBe(200);
    expect(afterMarkAll.body.data.unreadCount).toBe(0);
  });
});
