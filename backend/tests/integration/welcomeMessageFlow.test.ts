import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../../src/index";
import User from "../../src/models/User";
import { ROLES } from "../../src/utils/roleUtils";
import { createAuthenticatedRequest } from "../utils/authHelpers";

describe("Welcome Message Flow Debug", () => {
  let testUser: any;
  let userToken: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-test"
      );
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up
    await User.deleteMany({ email: "welcometest@test.com" });

    // Create test user (simulating NEW user who hasn't received welcome)
    testUser = new User({
      username: "welcometest",
      firstName: "Welcome",
      lastName: "Test",
      email: "welcometest@test.com",
      password: "Password123",
      role: ROLES.PARTICIPANT,
      phone: "1234567890",
      isAtCloudLeader: false,
      isActive: true,
      isVerified: true,
      emailNotifications: true,
      loginAttempts: 0,
      hasReceivedWelcomeMessage: false, // KEY: This should be false for new user
    });

    // Save user to get _id then create auth token
    await testUser.save();

    console.log("Debug user object:", {
      hasId: !!testUser._id,
      id: testUser._id?.toString(),
      email: testUser.email,
    });

    userToken = await createAuthenticatedRequest(testUser);
  });

  afterEach(async () => {
    if (testUser?._id) {
      await User.findByIdAndDelete(testUser._id);
    }
  });

  it("should debug complete welcome message flow", async () => {
    console.log("🔍 Starting welcome message flow debug...");
    console.log("👤 Test user created:", {
      id: testUser._id.toString(),
      email: testUser.email,
      hasReceivedWelcomeMessage: testUser.hasReceivedWelcomeMessage,
    });

    // Step 1: Check initial welcome status
    console.log("\n📋 Step 1: Checking initial welcome status...");
    const statusResponse = await request(app)
      .get("/api/v1/notifications/welcome-status")
      .set("Authorization", `Bearer ${userToken}`);

    console.log("Initial status response:", {
      status: statusResponse.status,
      success: statusResponse.body.success,
      hasReceivedWelcomeMessage:
        statusResponse.body.data?.hasReceivedWelcomeMessage,
    });

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.data.hasReceivedWelcomeMessage).toBe(false);

    // Step 2: Send welcome message
    console.log("\n📨 Step 2: Sending welcome message...");
    const welcomeResponse = await request(app)
      .post("/api/v1/notifications/welcome")
      .set("Authorization", `Bearer ${userToken}`);

    console.log("Send welcome response:", {
      status: welcomeResponse.status,
      success: welcomeResponse.body.success,
      message: welcomeResponse.body.message,
      data: welcomeResponse.body.data,
    });

    expect(welcomeResponse.status).toBe(201);
    expect(welcomeResponse.body.success).toBe(true);

    // Step 3: Verify user flag was updated
    console.log("\n👤 Step 3: Checking user flag update...");
    const updatedUser = await User.findById(testUser._id);
    console.log("User after welcome:", {
      hasReceivedWelcomeMessage: updatedUser?.hasReceivedWelcomeMessage,
    });

    expect(updatedUser?.hasReceivedWelcomeMessage).toBe(true);

    // Step 4: Check welcome status after sending
    console.log("\n📋 Step 4: Checking welcome status after sending...");
    const finalStatusResponse = await request(app)
      .get("/api/v1/notifications/welcome-status")
      .set("Authorization", `Bearer ${userToken}`);

    console.log("Final status response:", {
      status: finalStatusResponse.status,
      hasReceivedWelcomeMessage:
        finalStatusResponse.body.data?.hasReceivedWelcomeMessage,
    });

    expect(finalStatusResponse.body.data.hasReceivedWelcomeMessage).toBe(true);

    // Step 5: Check system messages were created
    console.log("\n📬 Step 5: Checking system messages...");
    const messagesResponse = await request(app)
      .get("/api/v1/notifications/system")
      .set("Authorization", `Bearer ${userToken}`);

    console.log("System messages response:", {
      status: messagesResponse.status,
      messageCount: messagesResponse.body.data?.messages?.length || 0,
    });

    expect(messagesResponse.status).toBe(200);
    const messages = messagesResponse.body.data.messages;

    const welcomeMessage = messages.find(
      (msg: any) =>
        msg.title.includes("Welcome") && msg.title.includes("@Cloud")
    );

    console.log("Welcome message found:", !!welcomeMessage);
    if (welcomeMessage) {
      console.log("Welcome message details:", {
        title: welcomeMessage.title,
        type: welcomeMessage.type,
        isRead: welcomeMessage.isRead,
      });
    }

    expect(welcomeMessage).toBeDefined();

    // Step 6: Check bell notifications
    console.log("\n🔔 Step 6: Checking bell notifications...");
    const bellResponse = await request(app)
      .get("/api/v1/notifications/bell")
      .set("Authorization", `Bearer ${userToken}`);

    console.log("Bell notifications response:", {
      status: bellResponse.status,
      notificationCount: bellResponse.body.data?.notifications?.length || 0,
    });

    expect(bellResponse.status).toBe(200);
    const notifications = bellResponse.body.data.notifications;

    const welcomeBell = notifications.find(
      (notif: any) =>
        notif.title.includes("Welcome") && notif.title.includes("@Cloud")
    );

    console.log("Welcome bell notification found:", !!welcomeBell);
    if (welcomeBell) {
      console.log("Welcome bell details:", {
        title: welcomeBell.title,
        isRead: welcomeBell.isRead,
      });
    }

    expect(welcomeBell).toBeDefined();

    console.log("\n✅ Welcome message flow test completed successfully!");
    console.log(
      "🎯 This confirms the backend welcome message system works correctly"
    );
  });

  it("should not send welcome message twice", async () => {
    console.log("\n🔍 Testing duplicate welcome message prevention...");

    // Send welcome message first time
    const firstResponse = await request(app)
      .post("/api/v1/notifications/welcome")
      .set("Authorization", `Bearer ${userToken}`);

    expect(firstResponse.status).toBe(201);

    // Try to send welcome message second time
    const secondResponse = await request(app)
      .post("/api/v1/notifications/welcome")
      .set("Authorization", `Bearer ${userToken}`);

    console.log("Second welcome attempt:", {
      status: secondResponse.status,
      message: secondResponse.body.message,
    });

    // Should return success but indicate already sent
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.message).toContain("already received");
  });
});
