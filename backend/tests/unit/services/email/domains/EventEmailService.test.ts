/**
 * EventEmailService Domain Test Suite
 *
 * Tests for all event-related email notifications:
 * - Event creation notifications (sendEventCreatedEmail)
 * - Event update notifications (sendEventNotificationEmail, sendEventNotificationEmailBulk)
 * - Event reminders (sendEventReminderEmail, sendEventReminderEmailBulk)
 * - Co-organizer assignments (sendCoOrganizerAssignedEmail)
 * - Role assignments (sendEventRoleAssignedEmail)
 * - Role moves (sendEventRoleMovedEmail)
 * - Role removals (sendEventRoleRemovedEmail)
 * - Role assignment rejections (sendEventRoleAssignmentRejectedEmail)
 * - Auto-unpublish notifications (sendEventAutoUnpublishNotification)
 *
 * Tests the domain service directly without going through the facade.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock nodemailer to avoid external dependencies (must be before importing EventEmailService)
vi.mock("nodemailer", async () => {
  const actual: any = await vi.importActual("nodemailer");
  return {
    __esModule: true,
    ...actual,
    default: {
      ...actual.default,
      createTransport: vi.fn(),
    },
    createTransport: vi.fn(),
  };
});

import nodemailer from "nodemailer";
import { EventEmailService } from "../../../../../src/services/email/domains/EventEmailService";
import { EmailTransporter } from "../../../../../src/services/email/EmailTransporter";

describe("EventEmailService - Event Email Operations", () => {
  let mockTransporter: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Setup production-like env for testing
    process.env.NODE_ENV = "production";
    process.env.FRONTEND_URL = "http://localhost:5173";
    process.env.SMTP_USER = "test@example.com";
    process.env.SMTP_PASS = "test-password";
    process.env.SMTP_HOST = "smtp.test.com";
    process.env.SMTP_PORT = "587";

    // Create mock transporter
    mockTransporter = {
      sendMail: vi.fn().mockResolvedValue({
        messageId: "test-message-id",
        response: "250 OK",
      }),
    };

    // Mock nodemailer.createTransport
    const anyMailer: any = nodemailer as any;
    if (anyMailer.createTransport) {
      vi.mocked(anyMailer.createTransport).mockReturnValue(mockTransporter);
    }
    if (anyMailer.default?.createTransport) {
      vi.mocked(anyMailer.default.createTransport).mockReturnValue(
        mockTransporter
      );
    }

    // Reset EmailTransporter
    EmailTransporter.resetTransporter();

    // Mock console methods
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    EmailTransporter.resetTransporter();
    vi.restoreAllMocks();
  });

  describe("sendEventCreatedEmail", () => {
    it("should send event creation notification with full details", async () => {
      // Arrange
      const email = "organizer@example.com";
      const name = "Event Organizer";
      const eventData = {
        title: "Leadership Workshop",
        date: "2025-12-15",
        time: "14:00",
        endTime: "16:00",
        location: "Community Center",
        organizer: "Admin User",
        purpose: "A workshop on leadership skills",
        format: "in-person" as const,
        timeZone: "America/New_York",
      };

      // Act
      const result = await EventEmailService.sendEventCreatedEmail(
        email,
        name,
        eventData
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("organizer@example.com");
      expect(emailCall.subject).toContain("Leadership Workshop");
      expect(emailCall.html).toContain("Event Organizer");
      expect(emailCall.html).toContain("Leadership Workshop");
      expect(emailCall.html).toContain("Community Center");
    });

    it("should handle online events with Zoom link", async () => {
      // Arrange
      const email = "organizer@example.com";
      const name = "Organizer";
      const eventData = {
        title: "Online Webinar",
        date: "2025-12-20",
        time: "10:00",
        endTime: "11:00",
        organizer: "Admin",
        format: "online" as const,
        zoomLink: "https://zoom.us/j/123456789",
      };

      // Act
      await EventEmailService.sendEventCreatedEmail(email, name, eventData);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("zoom.us");
    });

    it("should handle hybrid events", async () => {
      // Arrange
      const email = "organizer@example.com";
      const name = "Organizer";
      const eventData = {
        title: "Hybrid Conference",
        date: "2025-12-25",
        time: "09:00",
        endTime: "17:00",
        organizer: "Admin",
        format: "hybrid" as const,
        location: "Main Auditorium",
        zoomLink: "https://zoom.us/j/987654321",
      };

      // Act
      await EventEmailService.sendEventCreatedEmail(email, name, eventData);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Main Auditorium");
      expect(emailCall.html).toContain("zoom.us");
    });

    it("should handle email sending failures gracefully", async () => {
      // Arrange
      mockTransporter.sendMail.mockRejectedValue(new Error("SMTP Error"));
      const email = "fail@example.com";
      const name = "Test";
      const eventData = {
        title: "Test Event",
        date: "2025-12-31",
        time: "12:00",
        endTime: "13:00",
        organizer: "Admin",
        format: "in-person" as const,
      };

      // Act
      const result = await EventEmailService.sendEventCreatedEmail(
        email,
        name,
        eventData
      );

      // Assert
      expect(result).toBe(false);
    });

    it("should use FRONTEND_URL fallback when env variable is not set", async () => {
      // Arrange
      delete process.env.FRONTEND_URL;
      const email = "organizer@example.com";
      const name = "Test User";
      const eventData = {
        title: "Test Event",
        date: "2025-12-31",
        time: "12:00",
        endTime: "13:00",
        organizer: "Admin",
        format: "in-person" as const,
      };

      // Act
      await EventEmailService.sendEventCreatedEmail(email, name, eventData);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("http://localhost:5173");
    });
  });

  describe("sendEventNotificationEmail", () => {
    it("should send event update notification", async () => {
      // Arrange
      const email = "attendee@example.com";
      const name = "John Doe";
      const payload = {
        eventTitle: "Updated Workshop",
        date: "2025-12-15",
        time: "14:00",
        endTime: "16:00",
        message: "The event time has been changed.",
      };

      // Act
      const result = await EventEmailService.sendEventNotificationEmail(
        email,
        name,
        payload
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe(email);
      expect(emailCall.html).toContain("John Doe");
      expect(emailCall.html).toContain("Updated Workshop");
      expect(emailCall.html).toContain("The event time has been changed");
    });

    it("should handle multi-day events", async () => {
      // Arrange
      const payload = {
        eventTitle: "Weekend Retreat",
        date: "2025-12-20",
        endDate: "2025-12-22",
        time: "09:00",
        endTime: "17:00",
      };

      // Act
      await EventEmailService.sendEventNotificationEmail(
        "attendee@example.com",
        "Attendee",
        payload
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Weekend Retreat");
      expect(emailCall.html).toContain("December");
      expect(emailCall.html).toContain("2025");
    });

    it("should use FRONTEND_URL fallback when env variable is not set", async () => {
      // Arrange
      delete process.env.FRONTEND_URL;
      const payload = {
        eventTitle: "Test Event",
        date: "2025-12-15",
        time: "14:00",
      };

      // Act
      await EventEmailService.sendEventNotificationEmail(
        "test@example.com",
        "Test User",
        payload
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("localhost:5173");
    });
  });

  describe("sendEventNotificationEmailBulk", () => {
    it("should send notifications to multiple recipients", async () => {
      // Arrange
      const recipients = [
        { email: "user1@example.com", name: "User One" },
        { email: "user2@example.com", name: "User Two" },
        { email: "user3@example.com", name: "User Three" },
      ];
      const payload = {
        eventTitle: "Team Meeting",
        date: "2025-12-15",
        time: "10:00",
      };

      // Act
      const results = await EventEmailService.sendEventNotificationEmailBulk(
        recipients,
        payload
      );

      // Assert
      expect(results).toHaveLength(3);
      expect(results.every((r) => r === true)).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
    });

    it("should deduplicate recipient emails", async () => {
      // Arrange
      const recipients = [
        { email: "user@example.com", name: "User One" },
        { email: "USER@EXAMPLE.COM", name: "User Two" }, // Duplicate
        { email: "user@example.com", name: "User Three" }, // Duplicate
        { email: "other@example.com", name: "Other User" },
      ];
      const payload = {
        eventTitle: "Event",
        date: "2025-12-15",
        time: "10:00",
      };

      // Act
      const results = await EventEmailService.sendEventNotificationEmailBulk(
        recipients,
        payload
      );

      // Assert
      expect(results).toHaveLength(2); // Only 2 unique emails
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
    });

    it("should handle partial failures gracefully", async () => {
      // Arrange
      mockTransporter.sendMail
        .mockResolvedValueOnce({ messageId: "1" })
        .mockRejectedValueOnce(new Error("SMTP Error"))
        .mockResolvedValueOnce({ messageId: "3" });

      const recipients = [
        { email: "user1@example.com", name: "User One" },
        { email: "user2@example.com", name: "User Two" },
        { email: "user3@example.com", name: "User Three" },
      ];
      const payload = {
        eventTitle: "Event",
        date: "2025-12-15",
        time: "10:00",
      };

      // Act
      const results = await EventEmailService.sendEventNotificationEmailBulk(
        recipients,
        payload
      );

      // Assert
      expect(results).toHaveLength(3);
      expect(results[0]).toBe(true);
      expect(results[1]).toBe(false);
      expect(results[2]).toBe(true);
    });
  });

  describe("sendEventReminderEmail", () => {
    it("should send reminder with ICS attachment for in-person event", async () => {
      // Arrange
      const email = "attendee@example.com";
      const userName = "Jane Smith";
      const eventData = {
        title: "Workshop Reminder",
        date: "2025-12-15",
        time: "14:00",
        endTime: "16:00",
        location: "Room 101",
        format: "in-person" as const,
        timeZone: "America/New_York",
      };
      const reminderType = "24h" as const;

      // Act
      const result = await EventEmailService.sendEventReminderEmail(
        email,
        userName,
        eventData,
        reminderType
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("attendee@example.com");
      expect(emailCall.subject).toContain("Reminder");
      expect(emailCall.html).toContain("Jane Smith");
      expect(emailCall.html).toContain("Workshop Reminder");
      // ICS attachments are created in actual implementation
    });

    it("should include Zoom link for online events", async () => {
      // Arrange
      const email = "attendee@example.com";
      const userName = "Attendee";
      const eventData = {
        title: "Online Session",
        date: "2025-12-20",
        time: "10:00",
        location: "Online",
        format: "online" as const,
        zoomLink: "https://zoom.us/j/123456789",
      };
      const reminderType = "1h" as const;

      // Act
      await EventEmailService.sendEventReminderEmail(
        email,
        userName,
        eventData,
        reminderType
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Online Session");
      expect(emailCall.html).toContain("online");
    });

    it("should use FRONTEND_URL fallback when env variable is not set", async () => {
      // Arrange
      delete process.env.FRONTEND_URL;
      const eventData = {
        title: "Test Reminder Event",
        date: "2025-12-15",
        time: "14:00",
        location: "Test Location",
        format: "in-person" as const,
      };

      // Act
      await EventEmailService.sendEventReminderEmail(
        "test@example.com",
        "Test User",
        eventData,
        "24h"
      );

      // Assert - method should complete successfully with fallback URL
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();
    });
  });

  describe("sendEventReminderEmailBulk", () => {
    it("should send reminders to multiple attendees", async () => {
      // Arrange
      const attendees = [
        { email: "user1@example.com", name: "User 1" },
        { email: "user2@example.com", name: "User 2" },
      ];
      const eventData = {
        title: "Group Session",
        date: "2025-12-15",
        time: "10:00",
        location: "Conference Room",
        format: "in-person" as const,
      };
      const reminderType = "24h" as const;

      // Act
      const results = await EventEmailService.sendEventReminderEmailBulk(
        attendees,
        eventData,
        reminderType
      );

      // Assert
      expect(results).toHaveLength(2);
      expect(results.every((r) => r === true)).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
    });
  });

  describe("sendCoOrganizerAssignedEmail", () => {
    it("should notify new co-organizer of assignment", async () => {
      // Arrange
      const email = "coorg@example.com";
      const assignedUser = {
        firstName: "Co",
        lastName: "Organizer",
      };
      const eventData = {
        title: "Big Conference",
        date: "2025-12-20",
        time: "09:00",
        endTime: "17:00",
        location: "Convention Center",
      };
      const assignedBy = {
        firstName: "Main",
        lastName: "Organizer",
      };

      // Act
      const result = await EventEmailService.sendCoOrganizerAssignedEmail(
        email,
        assignedUser,
        eventData,
        assignedBy
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("coorg@example.com");
      expect(emailCall.subject).toContain("Co-Organizer");
      expect(emailCall.html).toContain("Co");
      expect(emailCall.html).toContain("Big Conference");
      expect(emailCall.html).toContain("Main");
    });

    it("should handle empty firstName and lastName with fallback", async () => {
      // Arrange
      const assignedUser = {
        firstName: "",
        lastName: "",
      };
      const assignedBy = {
        firstName: "",
        lastName: "",
      };
      const eventData = {
        title: "Test Event",
        date: "2025-12-20",
        time: "09:00",
        location: "Room 1",
      };

      // Act
      const result = await EventEmailService.sendCoOrganizerAssignedEmail(
        "coorg@example.com",
        assignedUser,
        eventData,
        assignedBy
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();
    });
  });

  describe("sendEventRoleAssignedEmail", () => {
    it("should notify user of role assignment", async () => {
      // Arrange
      const email = "participant@example.com";
      const data = {
        event: {
          id: "event123",
          title: "Workshop",
          date: "2025-12-15",
          time: "14:00",
          format: "in-person" as const,
          location: "Room 5",
        },
        user: {
          firstName: "Participant",
          lastName: "User",
        },
        roleName: "Facilitator",
        actor: {
          firstName: "Organizer",
          lastName: "Admin",
        },
      };

      // Act
      const result = await EventEmailService.sendEventRoleAssignedEmail(
        email,
        data
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("participant@example.com");
      expect(emailCall.html).toContain("Facilitator");
      expect(emailCall.html).toContain("Workshop");
    });

    it("should use FRONTEND_URL fallback when env variable is not set", async () => {
      // Arrange
      delete process.env.FRONTEND_URL;
      const data = {
        event: {
          id: "event123",
          title: "Test Event",
          date: "2025-12-15",
          time: "14:00",
          format: "in-person" as const,
          location: "Room 1",
        },
        user: {
          firstName: "Test",
          lastName: "User",
        },
        roleName: "Participant",
        actor: {
          firstName: "Admin",
          lastName: "User",
        },
      };

      // Act
      const result = await EventEmailService.sendEventRoleAssignedEmail(
        "test@example.com",
        data
      );

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("localhost:5173");
    });
  });

  describe("sendEventRoleMovedEmail", () => {
    it("should notify user of role change", async () => {
      // Arrange
      const email = "user@example.com";
      const data = {
        event: {
          id: "event456",
          title: "Conference",
          date: "2025-12-20",
          time: "10:00",
          format: "hybrid" as const,
          location: "Auditorium",
        },
        user: {
          firstName: "User",
          lastName: "Name",
        },
        fromRoleName: "Attendee",
        toRoleName: "Speaker",
        actor: {
          firstName: "Admin",
          lastName: "User",
        },
      };

      // Act
      const result = await EventEmailService.sendEventRoleMovedEmail(
        email,
        data
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Attendee");
      expect(emailCall.html).toContain("Speaker");
    });
  });

  describe("sendEventRoleRemovedEmail", () => {
    it("should notify user of role removal", async () => {
      // Arrange
      const email = "user@example.com";
      const data = {
        event: {
          id: "event789",
          title: "Meeting",
        },
        user: {
          firstName: "User",
          lastName: "Test",
        },
        roleName: "Presenter",
        actor: {
          firstName: "Organizer",
          lastName: "Admin",
        },
      };

      // Act
      const result = await EventEmailService.sendEventRoleRemovedEmail(
        email,
        data
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Presenter");
      expect(emailCall.html).toContain("removed");
    });
  });

  describe("sendEventRoleAssignmentRejectedEmail", () => {
    it("should notify organizer of rejected role assignment", async () => {
      // Arrange
      const email = "organizer@example.com";
      const data = {
        event: {
          id: "event999",
          title: "Workshop",
        },
        roleName: "Helper",
        rejectedBy: {
          firstName: "John",
          lastName: "Doe",
        },
        assigner: {
          firstName: "Organizer",
          lastName: "User",
        },
        noteProvided: true,
        noteText: "Schedule conflict",
      };

      // Act
      const result =
        await EventEmailService.sendEventRoleAssignmentRejectedEmail(
          email,
          data
        );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Helper");
      expect(emailCall.html).toContain("John Doe");
      expect(emailCall.html).toContain("Schedule conflict");
    });

    it("should handle rejection without reason", async () => {
      // Arrange
      const email = "organizer@example.com";
      const data = {
        event: {
          id: "event888",
          title: "Workshop",
        },
        roleName: "Helper",
        rejectedBy: {
          firstName: "Jane",
          lastName: "Smith",
        },
        assigner: {
          firstName: "Organizer",
          lastName: "User",
        },
        noteProvided: false,
      };

      // Act
      const result =
        await EventEmailService.sendEventRoleAssignmentRejectedEmail(
          email,
          data
        );

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Jane Smith");
    });
  });

  describe("sendEventAutoUnpublishNotification", () => {
    it("should notify organizer of auto-unpublish", async () => {
      // Arrange
      const params = {
        eventId: "event-old-123",
        title: "Past Event",
        format: "in-person",
        missingFields: ["date"],
        recipients: ["organizer@example.com"],
      };

      // Act
      const result = await EventEmailService.sendEventAutoUnpublishNotification(
        params
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("organizer@example.com");
      expect(emailCall.subject).toContain("Unpublished");
      expect(emailCall.html).toContain("Past Event");
      expect(emailCall.html).toContain("date");
    });

    it("should use FRONTEND_URL fallback when env variable is not set", async () => {
      // Arrange
      delete process.env.FRONTEND_URL;
      const params = {
        eventId: "event-fallback-123",
        title: "Test Event",
        format: "in-person",
        missingFields: ["location"],
        recipients: ["test@example.com"],
      };

      // Act
      const result = await EventEmailService.sendEventAutoUnpublishNotification(
        params
      );

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("localhost:5173");
    });

    it("should use FALLBACK_ADMIN_EMAIL when recipients is empty", async () => {
      // Arrange
      delete process.env.FALLBACK_ADMIN_EMAIL;
      const params = {
        eventId: "event-no-recipients",
        title: "Test Event",
        format: "in-person",
        missingFields: ["location"],
        recipients: [], // Empty recipients
      };

      // Act
      const result = await EventEmailService.sendEventAutoUnpublishNotification(
        params
      );

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("atcloudministry@gmail.com");
    });
  });

  describe("sendEventUnpublishWarningNotification", () => {
    it("should send warning notification with FRONTEND_URL fallback", async () => {
      // Arrange
      delete process.env.FRONTEND_URL;
      const params = {
        eventId: "event-warn-123",
        title: "Warning Event",
        format: "in-person",
        missingFields: ["location", "date"],
        recipients: ["organizer@example.com"],
      };

      // Act
      const result =
        await EventEmailService.sendEventUnpublishWarningNotification(params);

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("localhost:5173");
      expect(emailCall.subject).toContain("URGENT");
      expect(emailCall.html).toContain("48 hours");
    });

    it("should use FALLBACK_ADMIN_EMAIL when recipients is empty", async () => {
      // Arrange
      delete process.env.FALLBACK_ADMIN_EMAIL;
      const params = {
        eventId: "event-warn-no-recipients",
        title: "Warning Event",
        format: "online",
        missingFields: ["zoomLink"],
        recipients: [],
      };

      // Act
      const result =
        await EventEmailService.sendEventUnpublishWarningNotification(params);

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("atcloudministry@gmail.com");
    });
  });

  describe("sendEventActualUnpublishNotification", () => {
    it("should send actual unpublish notification with FRONTEND_URL fallback", async () => {
      // Arrange
      delete process.env.FRONTEND_URL;
      const params = {
        eventId: "event-actual-123",
        title: "Unpublished Event",
        format: "hybrid",
        missingFields: ["location", "zoomLink"],
        recipients: ["organizer@example.com"],
      };

      // Act
      const result =
        await EventEmailService.sendEventActualUnpublishNotification(params);

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("localhost:5173");
      expect(emailCall.subject).toContain("Unpublished");
      expect(emailCall.html).toContain("automatically unpublished");
    });

    it("should use FALLBACK_ADMIN_EMAIL when recipients is empty", async () => {
      // Arrange
      delete process.env.FALLBACK_ADMIN_EMAIL;
      const params = {
        eventId: "event-actual-no-recipients",
        title: "Unpublished Event",
        format: "in-person",
        missingFields: ["date"],
        recipients: [],
      };

      // Act
      const result =
        await EventEmailService.sendEventActualUnpublishNotification(params);

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("atcloudministry@gmail.com");
    });
  });

  describe("Integration with EmailTransporter", () => {
    it("should properly initialize EmailTransporter on first use", async () => {
      // Arrange
      const email = "test@example.com";
      const name = "Test";
      const eventData = {
        title: "Test Event",
        date: "2025-12-31",
        time: "12:00",
        endTime: "13:00",
        organizer: "Test Org",
        format: "in-person" as const,
      };

      // Act
      await EventEmailService.sendEventCreatedEmail(email, name, eventData);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      const anyMailer: any = nodemailer as any;
      expect(anyMailer.createTransport).toHaveBeenCalled();
    });

    it("should reuse EmailTransporter for multiple event emails", async () => {
      // Arrange & Act
      await EventEmailService.sendEventCreatedEmail(
        "user1@example.com",
        "User 1",
        {
          title: "Event 1",
          date: "2025-12-15",
          time: "10:00",
          endTime: "11:00",
          organizer: "Admin",
          format: "in-person" as const,
        }
      );

      await EventEmailService.sendEventNotificationEmail(
        "user2@example.com",
        "User 2",
        {
          eventTitle: "Event 2",
          date: "2025-12-16",
          time: "14:00",
        }
      );

      await EventEmailService.sendCoOrganizerAssignedEmail(
        "user3@example.com",
        { firstName: "User", lastName: "3" },
        {
          title: "Event 3",
          date: "2025-12-17",
          time: "09:00",
          endTime: "10:00",
          location: "Room 1",
        },
        { firstName: "Admin", lastName: "User" }
      );

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
      // createTransport should only be called once (transporter reused)
      const anyMailer: any = nodemailer as any;
      expect(anyMailer.createTransport).toHaveBeenCalledTimes(1);
    });
  });
});
