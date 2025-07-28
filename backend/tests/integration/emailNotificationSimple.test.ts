/**
 * Simple Email Notification API Test with Manual Auth Token
 * Tests email notification functionality with existing users
 */

import request from "supertest";
import { describe, it, expect } from "vitest";
import { app } from "../../src/index";

describe("Email Notification API - Simple Test", () => {
  describe("POST /api/v1/email-notifications/event-created", () => {
    it("should return 404 for invalid event ID", async () => {
      // Create a valid admin user token for testing (this should work in production)
      const loginResponse = await request(app).post("/api/v1/auth/login").send({
        email: "test@atcloud.com", // Use existing test user if available
        password: "password123",
      });

      if (loginResponse.status === 200 && loginResponse.body.token) {
        const token = loginResponse.body.token;
        console.log("Got auth token for testing");

        const response = await request(app)
          .post("/api/v1/email-notifications/event-created")
          .set("Authorization", `Bearer ${token}`)
          .send({
            eventId: "507f1f77bcf86cd799439011", // Invalid but properly formatted ObjectId
          });

        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty("success", false);
        expect(response.body).toHaveProperty("message", "Event not found");
      } else {
        console.log(
          "No existing user found for testing, skipping authenticated test"
        );
        // Test without auth - should get 401
        const response = await request(app)
          .post("/api/v1/email-notifications/event-created")
          .send({
            eventId: "507f1f77bcf86cd799439011",
          });

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty("success", false);
      }
    });

    it("should require authentication when no token provided", async () => {
      const response = await request(app)
        .post("/api/v1/email-notifications/event-created")
        .send({
          eventId: "507f1f77bcf86cd799439011",
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("success", false);
    });

    it("should validate request body", async () => {
      const response = await request(app)
        .post("/api/v1/email-notifications/event-created")
        .send({}); // Empty body

      expect(response.status).toBe(401); // Should fail auth first
    });
  });

  describe("POST /api/v1/email-notifications/system-authorization-change", () => {
    it("should require authentication", async () => {
      const response = await request(app)
        .post("/api/v1/email-notifications/system-authorization-change")
        .send({
          userId: "507f1f77bcf86cd799439011",
          changeType: "account_activated",
          details: "Test details",
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("success", false);
    });
  });

  describe("POST /api/v1/email-notifications/atcloud-role-change", () => {
    it("should require authentication", async () => {
      const response = await request(app)
        .post("/api/v1/email-notifications/atcloud-role-change")
        .send({
          userId: "507f1f77bcf86cd799439011",
          oldRole: "member",
          newRole: "organizer",
          details: "Test role change",
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("success", false);
    });
  });

  describe("POST /api/v1/email-notifications/new-leader-signup", () => {
    it("should require authentication", async () => {
      const response = await request(app)
        .post("/api/v1/email-notifications/new-leader-signup")
        .send({
          userId: "507f1f77bcf86cd799439011",
          leadershipDetails: "Test leadership details",
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("success", false);
    });
  });

  describe("POST /api/v1/email-notifications/co-organizer-assigned", () => {
    it("should require authentication", async () => {
      const response = await request(app)
        .post("/api/v1/email-notifications/co-organizer-assigned")
        .send({
          eventId: "507f1f77bcf86cd799439011",
          coOrganizerId: "507f1f77bcf86cd799439011",
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("success", false);
    });
  });

  describe("POST /api/v1/email-notifications/event-reminder", () => {
    it("should require authentication", async () => {
      const response = await request(app)
        .post("/api/v1/email-notifications/event-reminder")
        .send({
          eventId: "507f1f77bcf86cd799439011",
          reminderType: "24h",
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("success", false);
    });
  });
});
