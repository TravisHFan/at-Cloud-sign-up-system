/**
 * Authenticated Email Notification API Test
 * Tests email notification endpoints with proper authentication
 */

import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import User from "../../src/models/User";
import Event from "../../src/models/Event";
import { app } from "../../src/index";

describe("Email Notification API - Authenticated Tests", () => {
  let adminToken: string;
  let organizerToken: string;
  let testEvent: any;
  let adminUserId: string;
  let organizerUserId: string;

  beforeAll(async () => {
    console.log("Setting up test data...");

    // Clean up any existing test data
    await User.deleteMany({
      username: { $in: ["testadmin", "testorganizer"] },
    });
    await Event.deleteMany({ title: "Test Event for Email API" });

    // Create test admin user
    try {
      const adminUser = await User.create({
        username: "testadmin",
        firstName: "Test",
        lastName: "Admin",
        email: "test.admin.email@example.com",
        password: "TestPassword123!",
        isVerified: true,
        isActive: true,
        role: "admin",
        emailNotifications: true,
        isAtCloudLeader: false,
        loginAttempts: 0,
        hasReceivedWelcomeMessage: false,
      });
      adminUserId = (adminUser._id as mongoose.Types.ObjectId).toString();
      console.log("Created admin user:", adminUserId);
    } catch (error) {
      console.error("Failed to create admin user:", error);
      throw error;
    }

    // Create test organizer user
    try {
      const organizerUser = await User.create({
        username: "testorganizer",
        firstName: "Test",
        lastName: "Organizer",
        email: "test.organizer.email@example.com",
        password: "TestPassword123!",
        isVerified: true,
        isActive: true,
        role: "organizer",
        emailNotifications: true,
        isAtCloudLeader: false,
        loginAttempts: 0,
        hasReceivedWelcomeMessage: false,
      });
      organizerUserId = (
        organizerUser._id as mongoose.Types.ObjectId
      ).toString();
      console.log("Created organizer user:", organizerUserId);
    } catch (error) {
      console.error("Failed to create organizer user:", error);
      throw error;
    }

    // Get auth tokens
    const adminLoginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "test.admin.email@example.com",
        password: "TestPassword123!",
      });

    const organizerLoginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "test.organizer.email@example.com",
        password: "TestPassword123!",
      });

    if (adminLoginResponse.body.token) {
      adminToken = adminLoginResponse.body.token;
      console.log("Got admin token");
    } else {
      console.error("Failed to get admin token:", adminLoginResponse.body);
    }

    if (organizerLoginResponse.body.token) {
      organizerToken = organizerLoginResponse.body.token;
      console.log("Got organizer token");
    } else {
      console.error(
        "Failed to get organizer token:",
        organizerLoginResponse.body
      );
    }

    // Create test event
    testEvent = await Event.create({
      title: "Test Event for Email API",
      description: "Test event description",
      date: new Date(Date.now() + 86400000), // Tomorrow
      time: "10:00",
      location: "Test Location",
      maxParticipants: 50,
      createdBy: organizerUserId,
      isActive: true,
    });
    console.log("Created test event:", testEvent._id.toString());
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({
      username: { $in: ["testadmin", "testorganizer"] },
    });
    await Event.deleteMany({ title: "Test Event for Email API" });
    console.log("Cleaned up test data");
  });

  describe("POST /api/v1/email-notifications/event-created", () => {
    it("should successfully send event created notification", async () => {
      const response = await request(app)
        .post("/api/v1/email-notifications/event-created")
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          eventId: testEvent._id.toString(),
        });

      console.log("Event created response:", response.body);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("message");
      expect(response.body.data).toHaveProperty("recipientCount");
      expect(response.body.data.recipientCount).toBeGreaterThanOrEqual(0);
    });

    it("should fail with invalid event ID", async () => {
      const response = await request(app)
        .post("/api/v1/email-notifications/event-created")
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          eventId: new mongoose.Types.ObjectId().toString(),
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("message", "Event not found");
    });
  });

  describe("POST /api/v1/email-notifications/system-authorization-change", () => {
    it("should successfully send system authorization change notification", async () => {
      const response = await request(app)
        .post("/api/v1/email-notifications/system-authorization-change")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          userId: organizerUserId,
          changeType: "account_activated",
          details: "User account has been activated by admin",
        });

      console.log("System auth change response:", response.body);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("message");
      expect(response.body.data).toHaveProperty("recipientCount");
    });

    it("should require admin role", async () => {
      const response = await request(app)
        .post("/api/v1/email-notifications/system-authorization-change")
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          userId: organizerUserId,
          changeType: "account_activated",
          details: "User account has been activated",
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty(
        "message",
        "Access denied. Admin privileges required."
      );
    });
  });

  describe("POST /api/v1/email-notifications/atcloud-role-change", () => {
    it("should successfully send AtCloud role change notification", async () => {
      const response = await request(app)
        .post("/api/v1/email-notifications/atcloud-role-change")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          userId: organizerUserId,
          oldRole: "member",
          newRole: "organizer",
          details: "User promoted to organizer role",
        });

      console.log("Role change response:", response.body);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("message");
      expect(response.body.data).toHaveProperty("recipientCount");
    });
  });

  describe("POST /api/v1/email-notifications/event-reminder", () => {
    it("should successfully send event reminder notification", async () => {
      const response = await request(app)
        .post("/api/v1/email-notifications/event-reminder")
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          eventId: testEvent._id.toString(),
          reminderType: "24h",
        });

      console.log("Event reminder response:", response.body);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("message");
      expect(response.body.data).toHaveProperty("recipientCount");
    });
  });
});
