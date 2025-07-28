/**
 * Welcome Message System Integration Tests
 * Tests welcome message functionality and historical message filtering for new users
 */

import request from "supertest";
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
import mongoose from "mongoose";
import User from "../../src/models/User";
import Message from "../../src/models/Message";
import { app } from "../../src/index";

describe("Welcome Message System - Integration Tests", () => {
  let adminUser: any;
  let adminToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    console.log("Setting up Welcome Message System tests...");

    // Clean up any existing test data
    await User.deleteMany({
      username: { $in: ["testwelcomeadmin", "testnewuser1", "testnewuser2"] },
    });
    await Message.deleteMany({
      title: { $regex: /Test.*Message|Welcome.*@Cloud/i },
    });

    // Create test admin user
    try {
      adminUser = await User.create({
        username: "testwelcomeadmin",
        firstName: "Welcome",
        lastName: "Admin",
        email: "welcome.admin.test@example.com",
        password: "TestPassword123!",
        isVerified: true,
        isActive: true,
        role: "Super Admin",
        emailNotifications: true,
        isAtCloudLeader: false,
        loginAttempts: 0,
        hasReceivedWelcomeMessage: true, // Admin already received welcome
      });

      if (!adminUser || !adminUser._id) {
        throw new Error(
          "Failed to create admin user - user object or _id is null"
        );
      }

      adminUserId = adminUser._id.toString();
      console.log("Created admin user:", adminUserId);
    } catch (error) {
      console.error("Failed to create admin user:", error);
      throw error;
    }

    // Get admin auth token
    const adminLoginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "welcome.admin.test@example.com",
        password: "TestPassword123!",
      });

    if (adminLoginResponse.body.token) {
      adminToken = adminLoginResponse.body.token;
      console.log("Got admin token");
    } else {
      console.error("Failed to get admin token:", adminLoginResponse.body);
      throw new Error("Failed to get admin token");
    }
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({
      username: { $in: ["testwelcomeadmin", "testnewuser1", "testnewuser2"] },
    });
    await Message.deleteMany({
      title: { $regex: /Test.*Message|Welcome.*@Cloud/i },
    });
    console.log("Cleaned up Welcome Message System test data");
  });

  beforeEach(async () => {
    // Clean up any test users created during tests
    await User.deleteMany({
      username: { $in: ["testnewuser1", "testnewuser2"] },
    });
  });

  afterEach(async () => {
    // Clean up any test messages created during tests
    await Message.deleteMany({
      title: { $regex: /Test.*Message/i },
    });
  });

  describe("Welcome Message on First Login", () => {
    it("should send welcome message and bell notification when new user logs in for first time", async () => {
      // Step 1: Create a new user (simulating registration)
      const newUser = await User.create({
        username: "testnewuser1",
        firstName: "New",
        lastName: "User",
        email: "newuser1.test@example.com",
        password: "TestPassword123!",
        isVerified: true,
        isActive: true,
        role: "Participant",
        emailNotifications: true,
        isAtCloudLeader: false,
        loginAttempts: 0,
        hasReceivedWelcomeMessage: false, // New user hasn't received welcome
      });

      const newUserId = (newUser._id as mongoose.Types.ObjectId).toString();

      // Step 2: Check welcome message status before login
      const preLoginResponse = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "newuser1.test@example.com",
          password: "TestPassword123!",
        });

      expect(preLoginResponse.status).toBe(200);
      expect(preLoginResponse.body.success).toBe(true);
      expect(preLoginResponse.body.token).toBeDefined();

      const userToken = preLoginResponse.body.token;

      // Step 3: Wait a moment for welcome message processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Step 4: Verify user's hasReceivedWelcomeMessage flag is updated
      const updatedUser = await User.findById(newUserId);
      expect(updatedUser?.hasReceivedWelcomeMessage).toBe(true);

      // Step 5: Check system messages for welcome message
      const systemMessagesResponse = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${userToken}`);

      expect(systemMessagesResponse.status).toBe(200);
      expect(systemMessagesResponse.body.success).toBe(true);

      const systemMessages = systemMessagesResponse.body.data.messages;
      const welcomeMessage = systemMessages.find(
        (msg: any) =>
          msg.title.includes("Welcome") && msg.title.includes("@Cloud")
      );

      expect(welcomeMessage).toBeDefined();
      expect(welcomeMessage.content).toContain("excited to have you join us");

      // Step 6: Check bell notifications for welcome message
      const bellNotificationsResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${userToken}`);

      expect(bellNotificationsResponse.status).toBe(200);
      expect(bellNotificationsResponse.body.success).toBe(true);

      const bellNotifications =
        bellNotificationsResponse.body.data.notifications;
      const welcomeBellNotification = bellNotifications.find(
        (notif: any) =>
          notif.title.includes("Welcome") && notif.title.includes("@Cloud")
      );

      expect(welcomeBellNotification).toBeDefined();
      expect(welcomeBellNotification.content).toContain(
        "excited to have you join us"
      );
      expect(welcomeBellNotification.isRead).toBe(false); // Should be unread initially

      // Step 7: Verify unread counts include welcome message
      const unreadCountsResponse = await request(app)
        .get("/api/v1/user/notifications/unread-counts")
        .set("Authorization", `Bearer ${userToken}`);

      expect(unreadCountsResponse.status).toBe(200);
      expect(unreadCountsResponse.body.systemMessages).toBeGreaterThan(0);
      expect(unreadCountsResponse.body.bellNotifications).toBeGreaterThan(0);
    });

    it("should not send duplicate welcome message on subsequent logins", async () => {
      // Step 1: Create a user who already received welcome message
      const existingUser = await User.create({
        username: "testnewuser2",
        firstName: "Existing",
        lastName: "User",
        email: "existinguser.test@example.com",
        password: "TestPassword123!",
        isVerified: true,
        isActive: true,
        role: "Participant",
        emailNotifications: true,
        isAtCloudLeader: false,
        loginAttempts: 0,
        hasReceivedWelcomeMessage: true, // Already received welcome
      });

      // Step 2: Login multiple times
      for (let i = 0; i < 3; i++) {
        const loginResponse = await request(app)
          .post("/api/v1/auth/login")
          .send({
            email: "existinguser.test@example.com",
            password: "TestPassword123!",
          });

        expect(loginResponse.status).toBe(200);
        expect(loginResponse.body.success).toBe(true);

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const userToken = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "existinguser.test@example.com",
          password: "TestPassword123!",
        })
        .then((res) => res.body.token);

      // Step 3: Check that there's only one welcome message (or none if user already had one)
      const systemMessagesResponse = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${userToken}`);

      const systemMessages = systemMessagesResponse.body.data.messages;
      const welcomeMessages = systemMessages.filter(
        (msg: any) =>
          msg.title.includes("Welcome") && msg.title.includes("@Cloud")
      );

      // Should be 0 or 1, but not multiple
      expect(welcomeMessages.length).toBeLessThanOrEqual(1);
    });
  });

  describe("Historical Message Filtering", () => {
    it("should not show historical system messages to new users", async () => {
      // Step 1: Admin creates a system message before user registration
      const historicalMessageResponse = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test Historical Message",
          content: "This is a historical message that new users should not see",
          type: "announcement",
          priority: "medium",
        });

      expect(historicalMessageResponse.status).toBe(201);
      expect(historicalMessageResponse.body.success).toBe(true);

      // Step 2: Wait for message processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Step 3: Create a new user after the message was created
      const newUser = await User.create({
        username: "testnewuser1",
        firstName: "New",
        lastName: "User",
        email: "newuser1.test@example.com",
        password: "TestPassword123!",
        isVerified: true,
        isActive: true,
        role: "Participant",
        emailNotifications: true,
        isAtCloudLeader: false,
        loginAttempts: 0,
        hasReceivedWelcomeMessage: false,
      });

      // Step 4: Login as new user
      const loginResponse = await request(app).post("/api/v1/auth/login").send({
        email: "newuser1.test@example.com",
        password: "TestPassword123!",
      });

      expect(loginResponse.status).toBe(200);
      const userToken = loginResponse.body.token;

      // Wait for welcome message processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Step 5: Check system messages - should NOT include historical message
      const systemMessagesResponse = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${userToken}`);

      expect(systemMessagesResponse.status).toBe(200);
      const systemMessages = systemMessagesResponse.body.data.messages;

      // Should not contain the historical message
      const historicalMessage = systemMessages.find(
        (msg: any) => msg.title === "Test Historical Message"
      );
      expect(historicalMessage).toBeUndefined();

      // Should contain welcome message only
      const welcomeMessage = systemMessages.find(
        (msg: any) =>
          msg.title.includes("Welcome") && msg.title.includes("@Cloud")
      );
      expect(welcomeMessage).toBeDefined();

      // Step 6: Check bell notifications - should NOT include historical message
      const bellNotificationsResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${userToken}`);

      expect(bellNotificationsResponse.status).toBe(200);
      const bellNotifications =
        bellNotificationsResponse.body.data.notifications;

      // Should not contain the historical message
      const historicalBellNotification = bellNotifications.find(
        (notif: any) => notif.title === "Test Historical Message"
      );
      expect(historicalBellNotification).toBeUndefined();

      // Should contain welcome message only
      const welcomeBellNotification = bellNotifications.find(
        (notif: any) =>
          notif.title.includes("Welcome") && notif.title.includes("@Cloud")
      );
      expect(welcomeBellNotification).toBeDefined();
    });

    it("should show new system messages created after user registration", async () => {
      // Step 1: Create a new user first
      const newUser = await User.create({
        username: "testnewuser1",
        firstName: "New",
        lastName: "User",
        email: "newuser1.test@example.com",
        password: "TestPassword123!",
        isVerified: true,
        isActive: true,
        role: "Participant",
        emailNotifications: true,
        isAtCloudLeader: false,
        loginAttempts: 0,
        hasReceivedWelcomeMessage: false,
      });

      // Step 2: Login as new user to trigger welcome message
      const loginResponse = await request(app).post("/api/v1/auth/login").send({
        email: "newuser1.test@example.com",
        password: "TestPassword123!",
      });

      expect(loginResponse.status).toBe(200);
      const userToken = loginResponse.body.token;

      // Wait for welcome message processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Step 3: Admin creates a new system message after user registration
      const newMessageResponse = await request(app)
        .post("/api/v1/system-messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test New Message After Registration",
          content: "This is a new message that the user should see",
          type: "announcement",
          priority: "medium",
        });

      expect(newMessageResponse.status).toBe(201);
      expect(newMessageResponse.body.success).toBe(true);

      // Wait for message processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Step 4: Check system messages - should include the new message
      const systemMessagesResponse = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${userToken}`);

      expect(systemMessagesResponse.status).toBe(200);
      const systemMessages = systemMessagesResponse.body.data.messages;

      // Should contain the new message
      const newMessage = systemMessages.find(
        (msg: any) => msg.title === "Test New Message After Registration"
      );
      expect(newMessage).toBeDefined();
      expect(newMessage.content).toContain("user should see");

      // Should also contain welcome message
      const welcomeMessage = systemMessages.find(
        (msg: any) =>
          msg.title.includes("Welcome") && msg.title.includes("@Cloud")
      );
      expect(welcomeMessage).toBeDefined();

      // Step 5: Check bell notifications - should include the new message
      const bellNotificationsResponse = await request(app)
        .get("/api/v1/system-messages/bell-notifications")
        .set("Authorization", `Bearer ${userToken}`);

      expect(bellNotificationsResponse.status).toBe(200);
      const bellNotifications =
        bellNotificationsResponse.body.data.notifications;

      // Should contain the new message
      const newBellNotification = bellNotifications.find(
        (notif: any) => notif.title === "Test New Message After Registration"
      );
      expect(newBellNotification).toBeDefined();

      // Should also contain welcome message
      const welcomeBellNotification = bellNotifications.find(
        (notif: any) =>
          notif.title.includes("Welcome") && notif.title.includes("@Cloud")
      );
      expect(welcomeBellNotification).toBeDefined();
    });
  });

  describe("Welcome Message API Endpoints", () => {
    it("should check welcome message status correctly", async () => {
      // Step 1: Create a new user
      const newUser = await User.create({
        username: "testnewuser1",
        firstName: "New",
        lastName: "User",
        email: "newuser1.test@example.com",
        password: "TestPassword123!",
        isVerified: true,
        isActive: true,
        role: "Participant",
        emailNotifications: true,
        isAtCloudLeader: false,
        loginAttempts: 0,
        hasReceivedWelcomeMessage: false,
      });

      // Step 2: Login to get token
      const loginResponse = await request(app).post("/api/v1/auth/login").send({
        email: "newuser1.test@example.com",
        password: "TestPassword123!",
      });

      const userToken = loginResponse.body.token;

      // Wait for welcome message processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Step 3: Check welcome message status
      const statusResponse = await request(app)
        .get("/api/v1/system-messages/welcome-status")
        .set("Authorization", `Bearer ${userToken}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.hasReceived).toBe(true);
    });

    it("should send welcome notification via API endpoint", async () => {
      // Step 1: Create a new user without welcome message
      const newUser = await User.create({
        username: "testnewuser1",
        firstName: "New",
        lastName: "User",
        email: "newuser1.test@example.com",
        password: "TestPassword123!",
        isVerified: true,
        isActive: true,
        role: "Participant",
        emailNotifications: true,
        isAtCloudLeader: false,
        loginAttempts: 0,
        hasReceivedWelcomeMessage: false,
      });

      // Step 2: Login to get token
      const loginResponse = await request(app).post("/api/v1/auth/login").send({
        email: "newuser1.test@example.com",
        password: "TestPassword123!",
      });

      const userToken = loginResponse.body.token;

      // Step 3: Manually trigger welcome notification via API
      const welcomeResponse = await request(app)
        .post("/api/v1/system-messages/send-welcome")
        .set("Authorization", `Bearer ${userToken}`);

      expect(welcomeResponse.status).toBe(200);
      expect(welcomeResponse.body.success).toBe(true);
      expect(welcomeResponse.body.message).toContain(
        "Welcome notification sent"
      );

      // Step 4: Verify welcome message appears in system messages
      const systemMessagesResponse = await request(app)
        .get("/api/v1/system-messages")
        .set("Authorization", `Bearer ${userToken}`);

      const systemMessages = systemMessagesResponse.body.data.messages;
      const welcomeMessage = systemMessages.find(
        (msg: any) =>
          msg.title.includes("Welcome") && msg.title.includes("@Cloud")
      );

      expect(welcomeMessage).toBeDefined();
    });
  });
});
