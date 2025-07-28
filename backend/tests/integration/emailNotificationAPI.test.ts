/**
 * Integration Tests for Email Notification API
 * Tests actual API endpoints with running server
 */

import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import User, { IUser } from "../../src/models/User";
import Event, { IEvent } from "../../src/models/Event";
import { app } from "../../src/index";

describe("Email Notification API Integration Tests", () => {
  let adminToken: string;
  let organizerToken: string;
  let testEvent: any;

  beforeAll(async () => {
    // Create test admin user
    const adminUser = await User.create({
      firstName: "Test",
      lastName: "Admin",
      email: "test.admin@example.com",
      password: "TestPassword123!",
      isVerified: true,
      isActive: true,
      role: "admin",
      emailNotifications: true,
    });

    // Create test organizer user
    const organizerUser = await User.create({
      firstName: "Test",
      lastName: "Organizer",
      email: "test.organizer@example.com",
      password: "TestPassword123!",
      isVerified: true,
      isActive: true,
      role: "organizer",
      emailNotifications: true,
    });

    // Get auth tokens
    const adminLoginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "test.admin@example.com",
        password: "TestPassword123!",
      });

    const organizerLoginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "test.organizer@example.com",
        password: "TestPassword123!",
      });

    adminToken = adminLoginResponse.body.token;
    organizerToken = organizerLoginResponse.body.token;

    // Create test event
    testEvent = await Event.create({
      title: "Test Event for Email Notifications",
      description: "Test event description",
      date: new Date(Date.now() + 86400000), // Tomorrow
      time: "10:00",
      location: "Test Location",
      maxParticipants: 50,
      createdBy: organizerUser._id,
      isActive: true,
    });
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({
      email: { $in: ["test.admin@example.com", "test.organizer@example.com"] },
    });
    await Event.deleteMany({ title: "Test Event for Email Notifications" });
  });

  describe("POST /api/v1/email-notifications/event-created", () => {
    it("should successfully send event created notification", async () => {
      const response = await request(app)
        .post("/api/v1/email-notifications/event-created")
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          eventId: testEvent._id.toString(),
        });

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

    it("should require authentication", async () => {
      const response = await request(app)
        .post("/api/v1/email-notifications/event-created")
        .send({
          eventId: testEvent._id.toString(),
        });

      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/v1/email-notifications/system-authorization-change", () => {
    it("should successfully send system authorization change notification", async () => {
      const response = await request(app)
        .post("/api/v1/email-notifications/system-authorization-change")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          userId: testEvent.createdBy.toString(),
          changeType: "account_activated",
          details: "User account has been activated by admin",
        });

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
          userId: testEvent.createdBy.toString(),
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
          userId: testEvent.createdBy.toString(),
          oldRole: "member",
          newRole: "organizer",
          details: "User promoted to organizer role",
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("message");
      expect(response.body.data).toHaveProperty("recipientCount");
    });

    it("should require admin role", async () => {
      const response = await request(app)
        .post("/api/v1/email-notifications/atcloud-role-change")
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          userId: testEvent.createdBy.toString(),
          oldRole: "member",
          newRole: "organizer",
          details: "User promoted to organizer role",
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty(
        "message",
        "Access denied. Admin privileges required."
      );
    });
  });

  describe("POST /api/v1/email-notifications/new-leader-signup", () => {
    it("should successfully send new leader signup notification", async () => {
      const response = await request(app)
        .post("/api/v1/email-notifications/new-leader-signup")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          userId: testEvent.createdBy.toString(),
          leadershipDetails: "New team leader for marketing team",
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("message");
      expect(response.body.data).toHaveProperty("recipientCount");
    });
  });

  describe("POST /api/v1/email-notifications/co-organizer-assigned", () => {
    it("should successfully send co-organizer assigned notification", async () => {
      const response = await request(app)
        .post("/api/v1/email-notifications/co-organizer-assigned")
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          eventId: testEvent._id.toString(),
          coOrganizerId: testEvent.createdBy.toString(),
        });

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

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("message");
      expect(response.body.data).toHaveProperty("recipientCount");
    });
  });
});
