import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import { emailNotificationRouter } from "../../../src/routes/emailNotifications";
import { EmailRecipientUtils } from "../../../src/utils/emailRecipientUtils";
import { EmailService } from "../../../src/services/infrastructure/emailService";

// Mock dependencies
vi.mock("../../../src/utils/emailRecipientUtils");
vi.mock("../../../src/services/infrastructure/emailService");
vi.mock("../../../src/middleware/auth", () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = {
      _id: "testuser123",
      email: "test@example.com",
      role: "Administrator",
    };
    next();
  },
}));

const MockEmailRecipientUtils = vi.mocked(EmailRecipientUtils);
const MockEmailService = vi.mocked(EmailService);

// Create test app
const app = express();
app.use(express.json());
app.use("/api/v1/notifications", emailNotificationRouter);

describe("Email Notification Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("POST /event-created", () => {
    it("should send event creation notifications to all active users", async () => {
      // Arrange
      const mockRecipients = [
        { email: "user1@test.com", firstName: "User", lastName: "One" },
        { email: "user2@test.com", firstName: "User", lastName: "Two" },
      ];

      MockEmailRecipientUtils.getActiveVerifiedUsers = vi
        .fn()
        .mockResolvedValue(mockRecipients);
      MockEmailService.sendEventCreatedEmail = vi.fn().mockResolvedValue(true);

      const requestBody = {
        eventData: {
          title: "Test Event",
          date: "2025-08-01",
          time: "10:00",
          location: "Test Location",
          organizerName: "Test Organizer",
        },
        excludeEmail: "creator@test.com",
      };

      // Act
      const response = await request(app)
        .post("/api/v1/notifications/event-created")
        .send(requestBody);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "Event creation notifications sent successfully"
      );
      expect(response.body.recipientCount).toBe(2);

      expect(
        MockEmailRecipientUtils.getActiveVerifiedUsers
      ).toHaveBeenCalledWith("creator@test.com");
      expect(MockEmailService.sendEventCreatedEmail).toHaveBeenCalledTimes(2);
    });

    it("should handle missing event data", async () => {
      // Act
      const response = await request(app)
        .post("/api/v1/notifications/event-created")
        .send({});

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Event data is required");
    });

    it("should handle no eligible recipients", async () => {
      // Arrange
      MockEmailRecipientUtils.getActiveVerifiedUsers = vi
        .fn()
        .mockResolvedValue([]);

      const requestBody = {
        eventData: {
          title: "Test Event",
          date: "2025-08-01",
          time: "10:00",
          location: "Test Location",
          organizerName: "Test Organizer",
        },
      };

      // Act
      const response = await request(app)
        .post("/api/v1/notifications/event-created")
        .send(requestBody);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("No eligible recipients found");
      expect(response.body.recipientCount).toBe(0);
    });
  });

  describe("POST /system-authorization-change", () => {
    it("should return placeholder response for role change notifications", async () => {
      // Arrange
      const requestBody = {
        userData: {
          _id: "user123",
          firstName: "Test",
          lastName: "User",
          email: "user@test.com",
          oldRole: "Participant",
          newRole: "Leader",
        },
        changedBy: {
          firstName: "Admin",
          lastName: "User",
          email: "admin@test.com",
          role: "Administrator",
        },
      };

      // Act
      const response = await request(app)
        .post("/api/v1/notifications/system-authorization-change")
        .send(requestBody);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "Role change notifications sent successfully (placeholder)"
      );
    });

    it("should handle missing user data", async () => {
      // Act
      const response = await request(app)
        .post("/api/v1/notifications/system-authorization-change")
        .send({});

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain(
        "User data with ID, old role, and new role is required"
      );
    });
  });

  describe("POST /atcloud-role-change", () => {
    it("should return placeholder response for ministry role change notifications", async () => {
      // Arrange
      const requestBody = {
        userData: {
          _id: "user123",
          firstName: "Test",
          lastName: "User",
          email: "user@test.com",
          oldRoleInAtCloud: "Youth Pastor",
          newRoleInAtCloud: "IT Director",
        },
      };

      // Act
      const response = await request(app)
        .post("/api/v1/notifications/atcloud-role-change")
        .send(requestBody);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "Ministry role change notifications sent successfully (placeholder)"
      );
    });
  });

  describe("POST /new-leader-signup", () => {
    it("should return placeholder response for new leader signup notifications", async () => {
      // Arrange
      const requestBody = {
        userData: {
          firstName: "New",
          lastName: "Leader",
          email: "newleader@test.com",
          roleInAtCloud: "Youth Pastor",
        },
      };

      // Act
      const response = await request(app)
        .post("/api/v1/notifications/new-leader-signup")
        .send(requestBody);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "New leader signup notifications sent successfully (placeholder)"
      );
    });
  });

  describe("POST /co-organizer-assigned", () => {
    it("should return placeholder response for co-organizer assignment notification", async () => {
      // Arrange
      const requestBody = {
        assignedUser: {
          email: "coorganizer@test.com",
          firstName: "Co",
          lastName: "Organizer",
        },
        eventData: {
          title: "Test Event",
          date: "2025-08-01",
          time: "10:00",
          location: "Test Location",
        },
        assignedBy: {
          firstName: "Main",
          lastName: "Organizer",
          email: "main@test.com",
        },
      };

      // Act
      const response = await request(app)
        .post("/api/v1/notifications/co-organizer-assigned")
        .send(requestBody);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "Co-organizer assignment notification sent successfully (placeholder)"
      );
    });
  });

  describe("POST /event-reminder", () => {
    it("should return placeholder response for event reminder notifications", async () => {
      // Arrange
      const requestBody = {
        eventId: "event123",
        eventData: {
          title: "Test Event",
          date: "2025-08-01",
          time: "10:00",
          location: "Test Location",
        },
      };

      // Act
      const response = await request(app)
        .post("/api/v1/notifications/event-reminder")
        .send(requestBody);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "Event reminder notifications sent successfully (placeholder)"
      );
    });
  });
});
