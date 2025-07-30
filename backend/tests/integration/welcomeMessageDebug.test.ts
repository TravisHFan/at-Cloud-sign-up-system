import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import { app } from "../../src/index";
// Import the actual User model directly, not the mocked version
import { User as ActualUser } from "../../src/models";
import { ROLES } from "../../src/utils/roleUtils";

// Disable mocking for User model in this integration test
vi.unmock("../../src/models/User");

describe("Welcome Message Bug Debug", () => {
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
    // Clean up test user
    if (testUser && testUser._id) {
      try {
        await ActualUser.findByIdAndDelete(testUser._id);
      } catch (error) {
        console.log("Cleanup error (non-critical):", error);
      }
    }
    await mongoose.connection.close();
  });

  it("should debug complete welcome message flow for new user", async () => {
    // Step 1: Create a new user via registration API (real flow)
    console.log("🔧 Registering new user via API...");

    const registrationData = {
      username: "debugwelcome",
      firstName: "Debug",
      lastName: "Welcome",
      email: "debug.welcome@test.com",
      password: "Password123",
      confirmPassword: "Password123",
      phone: "1234567890",
      isAtCloudLeader: false,
      acceptTerms: true,
    };

    const registerResponse = await request(app)
      .post("/api/v1/auth/register")
      .send(registrationData);

    console.log("✅ Registration response:", {
      status: registerResponse.status,
      success: registerResponse.body.success,
      message: registerResponse.body.message,
      userId: registerResponse.body.data?.user?.id,
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.success).toBe(true);

    const userId = registerResponse.body.data.user.id;
    testUser = { _id: userId }; // Store for cleanup

    // Step 2: Login (simulate first login)
    console.log("🔑 Logging in as new user...");
    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      emailOrUsername: "debug.welcome@test.com",
      password: "Password123",
    });

    console.log("🔑 Login response:", {
      status: loginResponse.status,
      success: loginResponse.body.success,
      message: loginResponse.body.message,
      error: loginResponse.body.error,
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.success).toBe(true);
    userToken = loginResponse.body.accessToken;

    console.log("✅ Login successful, token received");

    // Step 3: Check welcome message status (what frontend would do)
    console.log("📋 Checking welcome message status...");
    const statusResponse = await request(app)
      .get("/api/v1/system-messages/welcome-status")
      .set("Authorization", `Bearer ${userToken}`);

    expect(statusResponse.status).toBe(200);
    console.log("📋 Welcome status response:", {
      success: statusResponse.body.success,
      hasReceivedWelcomeMessage:
        statusResponse.body.data?.hasReceivedWelcomeMessage,
    });

    // Should be false for new user
    expect(statusResponse.body.data.hasReceivedWelcomeMessage).toBe(false);

    // Step 4: Manually trigger welcome notification (what frontend should do)
    console.log("📨 Sending welcome notification...");
    const welcomeResponse = await request(app)
      .post("/api/v1/system-messages/send-welcome")
      .set("Authorization", `Bearer ${userToken}`);

    console.log("📨 Welcome notification response:", {
      status: welcomeResponse.status,
      success: welcomeResponse.body.success,
      message: welcomeResponse.body.message,
      data: welcomeResponse.body.data,
    });

    expect(welcomeResponse.status).toBe(201);
    expect(welcomeResponse.body.success).toBe(true);

    // Step 5: Verify user flag was updated
    const updatedUser = await ActualUser.findById(userId);
    console.log("👤 User updated:", {
      hasReceivedWelcomeMessage: updatedUser?.hasReceivedWelcomeMessage,
    });

    expect(updatedUser?.hasReceivedWelcomeMessage).toBe(true);

    // Step 6: Check system messages
    console.log("📬 Checking system messages...");
    const systemMessagesResponse = await request(app)
      .get("/api/v1/system-messages")
      .set("Authorization", `Bearer ${userToken}`);

    expect(systemMessagesResponse.status).toBe(200);
    const systemMessages = systemMessagesResponse.body.data.messages;
    console.log("📬 System messages found:", systemMessages.length);

    const welcomeMessage = systemMessages.find(
      (msg: any) =>
        msg.title.includes("Welcome") && msg.title.includes("@Cloud")
    );

    console.log("📬 Welcome message found:", !!welcomeMessage);
    if (welcomeMessage) {
      console.log("📬 Welcome message details:", {
        title: welcomeMessage.title,
        content: welcomeMessage.content.substring(0, 100) + "...",
        isRead: welcomeMessage.isRead,
      });
    }

    expect(welcomeMessage).toBeDefined();

    // Step 7: Check bell notifications
    console.log("🔔 Checking bell notifications...");
    const bellResponse = await request(app)
      .get("/api/v1/system-messages/bell-notifications")
      .set("Authorization", `Bearer ${userToken}`);

    expect(bellResponse.status).toBe(200);
    const bellNotifications = bellResponse.body.data.notifications;
    console.log("🔔 Bell notifications found:", bellNotifications.length);

    const welcomeBell = bellNotifications.find(
      (notif: any) =>
        notif.title.includes("Welcome") && notif.title.includes("@Cloud")
    );

    console.log("🔔 Welcome bell notification found:", !!welcomeBell);
    if (welcomeBell) {
      console.log("🔔 Welcome bell details:", {
        title: welcomeBell.title,
        isRead: welcomeBell.isRead,
      });
    }

    expect(welcomeBell).toBeDefined();

    console.log("\n🎯 BUG ANALYSIS COMPLETE:");
    console.log("✅ Backend welcome API endpoints work correctly");
    console.log("✅ Welcome message creation works");
    console.log("✅ System messages and bell notifications are created");
    console.log(
      "🔍 Issue likely in frontend login flow not calling welcome service"
    );
  });
});
