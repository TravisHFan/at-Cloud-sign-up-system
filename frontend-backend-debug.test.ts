import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import express from "express";
import dotenv from "dotenv";
import routes from "./backend/src/routes";
import { User } from "./backend/src/models";

// Load environment variables
dotenv.config();

// Create test app
const app = express();
app.use(express.json());
app.use(routes);

describe("Frontend-Backend ID Format Debug", () => {
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

  it("should debug ID format issues", async () => {
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
        title: "Debug ID Format",
        content: "Debug content",
        type: "announcement",
        priority: "high",
      });

    const messageId = createResponse.body.data.id;
    console.log("=== ID FORMAT DEBUG ===");
    console.log("Created message ID:", messageId);
    console.log("ID type:", typeof messageId);
    console.log("ID length:", messageId.length);

    // Get bell notifications to see format
    const bellResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    console.log(
      "Bell notifications response:",
      JSON.stringify(bellResponse.body, null, 2)
    );

    const notifications = bellResponse.body.data.notifications;
    if (notifications.length > 0) {
      const notification = notifications[0];
      console.log("Notification ID from bell endpoint:", notification.id);
      console.log("Notification ID type:", typeof notification.id);
      console.log("IDs match:", notification.id === messageId);

      // Check if frontend might be prefixing 'system-'
      const frontendId = `system-${messageId}`;
      console.log("Frontend style ID:", frontendId);

      // Test delete with actual ID
      console.log("\n=== TESTING DELETE WITH ACTUAL ID ===");
      const deleteResponse1 = await request(app)
        .delete(`/api/v1/system-messages/bell-notifications/${notification.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      console.log(
        "Delete with actual ID:",
        deleteResponse1.status,
        deleteResponse1.body
      );

      // Test delete with frontend-style ID (should fail)
      console.log("\n=== TESTING DELETE WITH FRONTEND-STYLE ID ===");
      const deleteResponse2 = await request(app)
        .delete(`/api/v1/system-messages/bell-notifications/${frontendId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      console.log(
        "Delete with frontend ID:",
        deleteResponse2.status,
        deleteResponse2.body
      );
    }
  });
});
