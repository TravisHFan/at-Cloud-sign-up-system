import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import { ROLES } from "../../../src/utils/roleUtils";
import { ensureIntegrationDB } from "../setup/connect";
import { TokenService } from "../../../src/middleware/auth";
import { EmailService } from "../../../src/services/infrastructure/EmailServiceFacade";

// Mock EmailService
vi.mock("../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendEventCreatedEmail: vi.fn().mockResolvedValue(true),
  },
}));

describe("EventCreatedController - POST /api/email-notifications/event-created", () => {
  beforeEach(async () => {
    await ensureIntegrationDB();
    await User.deleteMany({});
    vi.clearAllMocks();
  });

  // ========== Authentication Tests ==========
  describe("Authentication", () => {
    it("should return 401 when no token provided", async () => {
      const response = await request(app)
        .post("/api/email-notifications/event-created")
        .send({
          eventData: {
            title: "Test Event",
            date: "2025-02-01",
            time: "10:00 AM",
            location: "Test Location",
            organizerName: "Test Organizer",
          },
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should return 401 when invalid token provided", async () => {
      const response = await request(app)
        .post("/api/email-notifications/event-created")
        .set("Authorization", "Bearer invalid-token")
        .send({
          eventData: {
            title: "Test Event",
            date: "2025-02-01",
            time: "10:00 AM",
            location: "Test Location",
            organizerName: "Test Organizer",
          },
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  // ========== Success Cases ==========
  describe("Success Cases", () => {
    it("should send notifications to all active verified users", async () => {
      const user = await User.create({
        name: "Admin User",
        username: "adminuser_evt",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
        emailNotifications: true,
      });

      // Create recipient users
      await User.create({
        firstName: "User",
        lastName: "One",
        username: "userone",
        email: "user1@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
        emailNotifications: true,
      });

      await User.create({
        firstName: "User",
        lastName: "Two",
        username: "usertwo",
        email: "user2@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
        emailNotifications: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .post("/api/email-notifications/event-created")
        .set("Authorization", `Bearer ${token}`)
        .send({
          eventData: {
            title: "New Workshop",
            date: "2025-02-15",
            time: "2:00 PM",
            endTime: "4:00 PM",
            location: "Conference Room A",
            organizerName: "Admin User",
            purpose: "Educational",
            format: "In-Person",
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "Event creation notifications sent successfully"
      );
      expect(response.body.recipientCount).toBe(3);
      expect(EmailService.sendEventCreatedEmail).toHaveBeenCalledTimes(3);
    });

    it("should exclude specified email from recipients", async () => {
      const user = await User.create({
        name: "Admin User",
        username: "adminuser_evt",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
        emailNotifications: true,
      });

      await User.create({
        firstName: "User",
        lastName: "One",
        username: "userone",
        email: "user1@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
        emailNotifications: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .post("/api/email-notifications/event-created")
        .set("Authorization", `Bearer ${token}`)
        .send({
          eventData: {
            title: "New Workshop",
            date: "2025-02-15",
            time: "2:00 PM",
            location: "Conference Room A",
            organizerName: "Admin User",
          },
          excludeEmail: "user1@test.com",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.recipientCount).toBe(1);
      expect(EmailService.sendEventCreatedEmail).toHaveBeenCalledTimes(1);
      expect(EmailService.sendEventCreatedEmail).not.toHaveBeenCalledWith(
        "user1@test.com",
        expect.any(String),
        expect.any(Object)
      );
    });

    it("should handle optional fields correctly", async () => {
      const user = await User.create({
        name: "Admin User",
        username: "adminuser_evt",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
        emailNotifications: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .post("/api/email-notifications/event-created")
        .set("Authorization", `Bearer ${token}`)
        .send({
          eventData: {
            title: "Minimal Event",
            date: "2025-02-20",
            time: "10:00 AM",
            location: "Room B",
            organizerName: "Organizer",
            // Optional fields not provided
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(EmailService.sendEventCreatedEmail).toHaveBeenCalled();

      const callArgs = vi.mocked(EmailService.sendEventCreatedEmail).mock
        .calls[0];
      const emailData = callArgs[2];
      expect(emailData.title).toBe("Minimal Event");
      expect(emailData.endTime).toBe("TBD");
      expect(emailData.purpose).toBe("");
      expect(emailData.format).toBe("");
    });

    it("should return success when no eligible recipients found", async () => {
      const user = await User.create({
        name: "Admin User",
        username: "adminuser_evt",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
        emailNotifications: false, // Opted out
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .post("/api/email-notifications/event-created")
        .set("Authorization", `Bearer ${token}`)
        .send({
          eventData: {
            title: "No Recipients Event",
            date: "2025-02-25",
            time: "3:00 PM",
            location: "Online",
            organizerName: "Admin",
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("No eligible recipients found");
      expect(response.body.recipientCount).toBe(0);
      expect(EmailService.sendEventCreatedEmail).not.toHaveBeenCalled();
    });

    it("should handle zoom link correctly", async () => {
      const user = await User.create({
        name: "Admin User",
        username: "adminuser_evt",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
        emailNotifications: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .post("/api/email-notifications/event-created")
        .set("Authorization", `Bearer ${token}`)
        .send({
          eventData: {
            title: "Virtual Meeting",
            date: "2025-03-01",
            time: "11:00 AM",
            location: "Online",
            organizerName: "Host",
            zoomLink: "https://zoom.us/j/123456789",
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const callArgs = vi.mocked(EmailService.sendEventCreatedEmail).mock
        .calls[0];
      const emailData = callArgs[2];
      expect(emailData.zoomLink).toBe("https://zoom.us/j/123456789");
    });
  });

  // ========== Edge Cases ==========
  describe("Edge Cases", () => {
    it("should return 400 when eventData is missing", async () => {
      const user = await User.create({
        name: "Admin User",
        username: "adminuser_evt",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .post("/api/email-notifications/event-created")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Event data is required");
    });

    it("should return 400 when title is missing", async () => {
      const user = await User.create({
        name: "Admin User",
        username: "adminuser_evt",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .post("/api/email-notifications/event-created")
        .set("Authorization", `Bearer ${token}`)
        .send({
          eventData: {
            date: "2025-02-01",
            time: "10:00 AM",
            location: "Test Location",
            organizerName: "Test Organizer",
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Event data is required");
    });

    it("should return 400 when date is missing", async () => {
      const user = await User.create({
        name: "Admin User",
        username: "adminuser_evt",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .post("/api/email-notifications/event-created")
        .set("Authorization", `Bearer ${token}`)
        .send({
          eventData: {
            title: "Test Event",
            time: "10:00 AM",
            location: "Test Location",
            organizerName: "Test Organizer",
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Event data is required");
    });

    it("should skip inactive users", async () => {
      const user = await User.create({
        name: "Admin User",
        username: "adminuser_evt",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
        emailNotifications: true,
      });

      // Create inactive user
      await User.create({
        firstName: "Inactive",
        lastName: "User",
        username: "inactiveuser",
        email: "inactive@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: false,
        isVerified: true,
        emailNotifications: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .post("/api/email-notifications/event-created")
        .set("Authorization", `Bearer ${token}`)
        .send({
          eventData: {
            title: "Active Only Event",
            date: "2025-03-05",
            time: "1:00 PM",
            location: "Office",
            organizerName: "Admin",
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.recipientCount).toBe(1);
      expect(EmailService.sendEventCreatedEmail).not.toHaveBeenCalledWith(
        "inactive@test.com",
        expect.any(String),
        expect.any(Object)
      );
    });

    it("should skip unverified users", async () => {
      const user = await User.create({
        name: "Admin User",
        username: "adminuser_evt",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
        emailNotifications: true,
      });

      // Create unverified user
      await User.create({
        firstName: "Unverified",
        lastName: "User",
        username: "unverifieduser",
        email: "unverified@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: false,
        emailNotifications: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .post("/api/email-notifications/event-created")
        .set("Authorization", `Bearer ${token}`)
        .send({
          eventData: {
            title: "Verified Only Event",
            date: "2025-03-10",
            time: "4:00 PM",
            location: "Venue",
            organizerName: "Admin",
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.recipientCount).toBe(1);
      expect(EmailService.sendEventCreatedEmail).not.toHaveBeenCalledWith(
        "unverified@test.com",
        expect.any(String),
        expect.any(Object)
      );
    });

    it("should skip users who opted out of emails", async () => {
      const user = await User.create({
        name: "Admin User",
        username: "adminuser_evt",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
        emailNotifications: true,
      });

      // Create user who opted out
      await User.create({
        firstName: "Opted",
        lastName: "Out",
        username: "optedout",
        email: "optedout@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
        emailNotifications: false,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .post("/api/email-notifications/event-created")
        .set("Authorization", `Bearer ${token}`)
        .send({
          eventData: {
            title: "Opt-In Event",
            date: "2025-03-15",
            time: "9:00 AM",
            location: "Hall",
            organizerName: "Admin",
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.recipientCount).toBe(1);
      expect(EmailService.sendEventCreatedEmail).not.toHaveBeenCalledWith(
        "optedout@test.com",
        expect.any(String),
        expect.any(Object)
      );
    });

    it("should handle user with missing name fields", async () => {
      const user = await User.create({
        name: "Admin User",
        username: "adminuser_evt",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
        emailNotifications: true,
      });

      // Create user without firstName/lastName
      await User.create({
        username: "noname",
        email: "noname@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
        emailNotifications: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .post("/api/email-notifications/event-created")
        .set("Authorization", `Bearer ${token}`)
        .send({
          eventData: {
            title: "Name Handling Event",
            date: "2025-03-20",
            time: "5:00 PM",
            location: "Center",
            organizerName: "Admin",
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.recipientCount).toBe(2);

      const calls = vi.mocked(EmailService.sendEventCreatedEmail).mock.calls;
      const noNameCall = calls.find((call) => call[0] === "noname@test.com");
      expect(noNameCall).toBeDefined();
      expect(noNameCall![1]).toBe(""); // Empty name string
    });
  });

  // ========== Response Format ==========
  describe("Response Format", () => {
    it("should have correct success response structure", async () => {
      const user = await User.create({
        name: "Admin User",
        username: "adminuser_evt",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
        emailNotifications: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .post("/api/email-notifications/event-created")
        .set("Authorization", `Bearer ${token}`)
        .send({
          eventData: {
            title: "Format Test Event",
            date: "2025-03-25",
            time: "6:00 PM",
            location: "Plaza",
            organizerName: "Admin",
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success");
      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("recipientCount");
      expect(response.body.success).toBe(true);
      expect(typeof response.body.recipientCount).toBe("number");
    });

    it("should have correct error response structure", async () => {
      const user = await User.create({
        name: "Admin User",
        username: "adminuser_evt",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .post("/api/email-notifications/event-created")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("success");
      expect(response.body).toHaveProperty("message");
      expect(response.body.success).toBe(false);
    });
  });
});
