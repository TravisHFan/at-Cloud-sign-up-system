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

describe("System Messages Frontend-Backend Integration Test", () => {
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

  it("should test all System Messages page operations", async () => {
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

    console.log("=== SYSTEM MESSAGES INTEGRATION TEST ===");

    // 1. Create system messages
    const messageIds: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const createResponse = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: `System Message ${i}`,
          content: `System content ${i}`,
          type: "announcement",
          priority: i === 1 ? "high" : i === 2 ? "medium" : "low",
        });

      expect(createResponse.status).toBe(201);
      messageIds.push(createResponse.body.data.id);
    }

    console.log("Created system message IDs:", messageIds);

    // 2. Get all system messages
    console.log("\n=== TESTING GET SYSTEM MESSAGES ===");
    const getResponse = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("Get system messages response:", getResponse.status);
    expect(getResponse.status).toBe(200);
    console.log("Total messages:", getResponse.body.data.messages.length);
    console.log("Unread count:", getResponse.body.data.unreadCount);

    // 3. Test mark as read (simulating System Messages page click)
    console.log("\n=== TESTING MARK AS READ FROM SYSTEM MESSAGES PAGE ===");
    const messageToRead = messageIds[0];
    console.log("Marking as read:", messageToRead);

    const markReadResponse = await request(app)
      .patch(`/api/v1/system-messages/${messageToRead}/read`)
      .set("Authorization", `Bearer ${adminToken}`);

    console.log(
      "Mark read response:",
      markReadResponse.status,
      markReadResponse.body
    );
    expect(markReadResponse.status).toBe(200);

    // 4. Verify read status changed
    const getAfterReadResponse = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log(
      "After read - unread count:",
      getAfterReadResponse.body.data.unreadCount
    );
    const readMessage = getAfterReadResponse.body.data.messages.find(
      (msg: any) => msg.id === messageToRead
    );
    console.log("Read message isRead status:", readMessage?.isRead);
    expect(readMessage?.isRead).toBe(true);

    // 5. Test delete system message (simulating System Messages page delete)
    console.log("\n=== TESTING DELETE FROM SYSTEM MESSAGES PAGE ===");
    const messageToDelete = messageIds[1];
    console.log("Deleting message:", messageToDelete);

    const deleteResponse = await request(app)
      .delete(`/api/v1/system-messages/${messageToDelete}`)
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("Delete response:", deleteResponse.status, deleteResponse.body);
    expect(deleteResponse.status).toBe(200);

    // 6. Verify message was deleted
    const getAfterDeleteResponse = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log(
      "After delete - total messages:",
      getAfterDeleteResponse.body.data.messages.length
    );
    const deletedMessage = getAfterDeleteResponse.body.data.messages.find(
      (msg: any) => msg.id === messageToDelete
    );
    console.log("Deleted message still exists:", !!deletedMessage);
    expect(deletedMessage).toBeUndefined();

    // 7. Test that bell notifications are also updated correctly
    console.log("\n=== TESTING BELL NOTIFICATIONS SYNC ===");
    const bellResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("Bell notifications response:", bellResponse.status);
    console.log(
      "Bell notifications count:",
      bellResponse.body.data.notifications.length
    );
    console.log("Bell unread count:", bellResponse.body.data.unreadCount);

    // Should have 2 notifications (1 deleted, so 3-1=2)
    expect(bellResponse.body.data.notifications.length).toBe(2);

    // Should have 1 unread (1 marked as read, so 2-1=1)
    expect(bellResponse.body.data.unreadCount).toBe(1);

    console.log("\n=== ALL SYSTEM MESSAGES OPERATIONS VERIFIED ===");
  });
});
