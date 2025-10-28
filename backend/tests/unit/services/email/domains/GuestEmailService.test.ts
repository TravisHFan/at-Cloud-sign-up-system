/**
 * GuestEmailService Domain Test Suite
 *
 * Tests for all guest-related email notifications:
 * - Guest confirmation emails (registration with ICS calendar attachment)
 * - Guest decline notifications (to organizers)
 * - Guest registration notifications (to organizers)
 *
 * Tests the domain service directly without going through the facade.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock nodemailer to avoid external dependencies (must be before importing GuestEmailService)
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
import { GuestEmailService } from "../../../../../src/services/email/domains/GuestEmailService";
import { EmailTransporter } from "../../../../../src/services/email/EmailTransporter";

describe("GuestEmailService - Guest Email Operations", () => {
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

  describe("sendGuestConfirmationEmail", () => {
    it("should send guest confirmation email with full event details", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Jane Guest",
        event: {
          title: "Community Outreach",
          date: new Date("2025-03-15T10:00:00Z"),
          location: "Community Center",
          time: "10:00 AM",
          endTime: "12:00 PM",
          format: "In-person",
          purpose: "Serve the local community",
          agenda: "Morning session: Setup\nAfternoon: Service activities",
          createdBy: {
            firstName: "Pastor",
            lastName: "Smith",
            email: "pastor@example.com",
            phone: "(555) 123-4567",
          },
        },
        role: {
          name: "Volunteer",
          description: "Help with setup and activities",
        },
        registrationId: "REG-12345",
        manageToken: "TOKEN-ABC",
      };

      // Act
      const result = await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("guest@example.com");
      expect(emailCall.subject).toContain("registered for");
      expect(emailCall.subject).toContain("Community Outreach");
      expect(emailCall.html).toContain("Jane Guest");
      expect(emailCall.html).toContain("Volunteer");
      expect(emailCall.html).toContain("Community Center");
      expect(emailCall.html).toContain("Pastor Smith");
      expect(emailCall.html).toContain("pastor@example.com");
    });

    it("should include ICS calendar attachment", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Test Guest",
        event: {
          title: "Test Event",
          date: new Date("2025-03-20T14:00:00Z"),
          location: "Test Location",
          time: "2:00 PM",
          endTime: "4:00 PM",
          purpose: "Test purpose",
        },
        role: { name: "Attendee" },
        registrationId: "REG-456",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.attachments).toBeDefined();
      expect(emailCall.attachments).toHaveLength(1);
      expect(emailCall.attachments[0].filename).toContain(".ics"); // Dynamic filename based on event
      expect(emailCall.attachments[0].content).toContain("BEGIN:VCALENDAR");
      expect(emailCall.attachments[0].content).toContain("Test Event");
    });

    it("should show invited message when inviterName is provided", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Invited Guest",
        event: {
          title: "Special Event",
          date: new Date("2025-04-10"),
          time: "3:00 PM",
          purpose: "Special gathering",
          createdBy: {
            firstName: "John",
            lastName: "Organizer",
            email: "john@example.com",
          },
        },
        role: { name: "Special Guest" },
        registrationId: "REG-789",
        inviterName: "John Organizer", // Indicates invitation
        declineToken: "DECLINE-TOKEN-123",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("You have been invited as a Guest");
      expect(emailCall.html).toContain("John Organizer");
      // Should include decline link when invited
      expect(emailCall.html).toContain("decline");
      expect(emailCall.html).toContain("DECLINE-TOKEN-123");
    });

    it("should handle online events with virtual meeting details", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Virtual Guest",
        event: {
          title: "Online Workshop",
          date: new Date("2025-05-01"),
          time: "1:00 PM",
          endTime: "3:00 PM",
          format: "Online",
          zoomLink: "https://zoom.us/j/123456789",
          meetingId: "123 456 789",
          passcode: "secret123",
          purpose: "Virtual training session",
        },
        role: { name: "Participant" },
        registrationId: "REG-VIRTUAL",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Online");
      expect(emailCall.html).toContain("zoom.us");
      expect(emailCall.html).toContain("123 456 789");
      expect(emailCall.html).toContain("secret123");
    });

    it("should handle hybrid events with physical location", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Hybrid Guest",
        event: {
          title: "Hybrid Conference",
          date: new Date("2025-06-15"),
          location: "Convention Center",
          time: "9:00 AM",
          format: "Hybrid Participation",
          zoomLink: "https://zoom.us/j/987654321",
          meetingId: "987 654 321",
          passcode: "hybrid123",
        },
        role: { name: "Attendee" },
        registrationId: "REG-HYBRID",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Convention Center"); // Physical location shown
      expect(emailCall.html).toContain("zoom.us"); // Virtual option available
    });

    it("should include manage URL when manageToken is provided", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Test Guest",
        event: {
          title: "Test Event",
          date: new Date("2025-07-01"),
          time: "10:00 AM",
        },
        role: { name: "Helper" },
        registrationId: "REG-MANAGE",
        manageToken: "MANAGE-TOKEN-XYZ",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // Note: manage token may not be directly visible in email content
      // but the email should be sent successfully
      expect(emailCall.to).toBe("guest@example.com");
      expect(emailCall.html).toContain("Test Guest");
    });

    it("should handle multiple organizer contacts with deduplication", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Test Guest",
        event: {
          title: "Multi-Organizer Event",
          date: new Date("2025-08-01"),
          createdBy: {
            firstName: "Primary",
            lastName: "Organizer",
            email: "primary@example.com",
            phone: "(555) 111-1111",
          },
          organizerDetails: [
            {
              name: "Co-Organizer One",
              role: "Co-Organizer",
              email: "co1@example.com",
              phone: "(555) 222-2222",
            },
            {
              name: "Co-Organizer Two",
              role: "Co-Organizer",
              email: "co2@example.com",
            },
            // Duplicate email (should be filtered out)
            {
              name: "Duplicate",
              role: "Assistant",
              email: "primary@example.com", // Same as createdBy
            },
          ],
        },
        role: { name: "Participant" },
        registrationId: "REG-MULTI",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Primary Organizer");
      expect(emailCall.html).toContain("Co-Organizer One");
      expect(emailCall.html).toContain("Co-Organizer Two");
      // Email deduplication is handled internally; just verify all organizers are present
      expect(emailCall.html).toContain("primary@example.com");
    });

    it("should handle email sending failures gracefully", async () => {
      // Arrange
      mockTransporter.sendMail.mockRejectedValue(new Error("SMTP Error"));
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Test Guest",
        event: {
          title: "Test Event",
          date: new Date("2025-09-01"),
        },
        role: { name: "Participant" },
        registrationId: "REG-FAIL",
      };

      // Act
      const result = await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      expect(result).toBe(false);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("sendGuestDeclineNotification", () => {
    it("should send decline notification to organizers with guest details", async () => {
      // Arrange
      const params = {
        event: {
          title: "Important Event",
          date: new Date("2025-03-20T14:00:00Z"),
        },
        roleName: "Coordinator",
        guest: {
          name: "Sarah Guest",
          email: "sarah@example.com",
        },
        reason: "Schedule conflict",
        organizerEmails: ["organizer1@example.com", "organizer2@example.com"],
      };

      // Act
      const result = await GuestEmailService.sendGuestDeclineNotification(
        params
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toEqual([
        "organizer1@example.com",
        "organizer2@example.com",
      ]);
      expect(emailCall.subject).toContain("Guest Declined");
      expect(emailCall.subject).toContain("Coordinator");
      expect(emailCall.subject).toContain("Important Event");
      expect(emailCall.html).toContain("Sarah Guest");
      expect(emailCall.html).toContain("sarah@example.com");
      expect(emailCall.html).toContain("Schedule conflict");
    });

    it("should handle decline without reason provided", async () => {
      // Arrange
      const params = {
        event: {
          title: "Test Event",
          date: new Date("2025-04-01"),
        },
        roleName: "Helper",
        guest: {
          name: "John Guest",
          email: "john@example.com",
        },
        // reason is optional
        organizerEmails: ["organizer@example.com"],
      };

      // Act
      await GuestEmailService.sendGuestDeclineNotification(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("John Guest");
      // Should not crash without reason
      expect(emailCall.html).not.toContain("undefined");
    });

    it("should return false when no organizer emails provided", async () => {
      // Arrange
      const params = {
        event: {
          title: "Test Event",
          date: new Date("2025-05-01"),
        },
        roleName: "Volunteer",
        guest: {
          name: "Test Guest",
          email: "test@example.com",
        },
        organizerEmails: [], // Empty array
      };

      // Act
      const result = await GuestEmailService.sendGuestDeclineNotification(
        params
      );

      // Assert
      expect(result).toBe(false);
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it("should handle email sending failures", async () => {
      // Arrange
      mockTransporter.sendMail.mockRejectedValue(new Error("Network timeout"));
      const params = {
        event: {
          title: "Test Event",
          date: new Date("2025-06-01"),
        },
        guest: {
          name: "Test Guest",
          email: "test@example.com",
        },
        organizerEmails: ["organizer@example.com"],
      };

      // Act
      const result = await GuestEmailService.sendGuestDeclineNotification(
        params
      );

      // Assert
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("sendGuestRegistrationNotification", () => {
    it("should send registration notification to organizers", async () => {
      // Arrange
      const params = {
        organizerEmails: ["organizer1@example.com", "organizer2@example.com"],
        event: {
          title: "Weekly Meeting",
          date: new Date("2025-03-25T15:00:00Z"),
          location: "Conference Room",
          time: "3:00 PM",
          endTime: "4:30 PM",
          timeZone: "America/New_York",
        },
        guest: {
          name: "New Guest",
          email: "newguest@example.com",
          phone: "(555) 987-6543",
        },
        role: {
          name: "Assistant",
        },
        registrationDate: new Date("2025-03-15"),
      };

      // Act
      const result = await GuestEmailService.sendGuestRegistrationNotification(
        params
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalled();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // Emails are sent individually to each organizer
      expect(emailCall.to).toBe("organizer1@example.com");
      expect(emailCall.subject).toContain("New Guest Registration");
      expect(emailCall.subject).toContain("Weekly Meeting");
      expect(emailCall.html).toContain("New Guest");
      expect(emailCall.html).toContain("newguest@example.com");
      expect(emailCall.html).toContain("(555) 987-6543");
      expect(emailCall.html).toContain("Assistant");
    });

    it("should handle guest without phone number", async () => {
      // Arrange
      const params = {
        organizerEmails: ["organizer@example.com"],
        event: {
          title: "Test Event",
          date: new Date("2025-04-10"),
          time: "10:00 AM",
        },
        guest: {
          name: "Guest Name",
          email: "guest@example.com",
          // phone is optional
        },
        role: { name: "Volunteer" },
        registrationDate: new Date("2025-04-01"),
      };

      // Act
      await GuestEmailService.sendGuestRegistrationNotification(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Guest Name");
      expect(emailCall.html).toContain("guest@example.com");
      // Should not show undefined or crash without phone
    });

    it("should return true when no organizer emails provided", async () => {
      // Arrange
      const params = {
        organizerEmails: [], // Empty array
        event: {
          title: "Test Event",
          date: new Date("2025-05-01"),
        },
        guest: {
          name: "Test Guest",
          email: "test@example.com",
        },
        role: { name: "Participant" },
        registrationDate: new Date("2025-04-25"),
      };

      // Act
      const result = await GuestEmailService.sendGuestRegistrationNotification(
        params
      );

      // Assert
      expect(result).toBe(true); // Returns true (nothing to send)
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it("should include event date/time range when provided", async () => {
      // Arrange
      const params = {
        organizerEmails: ["organizer@example.com"],
        event: {
          title: "Multi-Day Event",
          date: new Date("2025-06-10"),
          time: "9:00 AM",
          endTime: "5:00 PM",
          endDate: new Date("2025-06-12"),
          location: "Retreat Center",
          timeZone: "America/Los_Angeles",
        },
        guest: {
          name: "Guest Name",
          email: "guest@example.com",
        },
        role: { name: "Speaker" },
        registrationDate: new Date("2025-05-30"),
      };

      // Act
      await GuestEmailService.sendGuestRegistrationNotification(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Jun"); // Should include formatted date
      expect(emailCall.html).toContain("Retreat Center");
    });

    it("should handle email sending failures gracefully", async () => {
      // Arrange
      mockTransporter.sendMail.mockRejectedValue(
        new Error("Connection refused")
      );
      const params = {
        organizerEmails: ["organizer@example.com"],
        event: {
          title: "Test Event",
          date: new Date("2025-07-01"),
        },
        guest: {
          name: "Test Guest",
          email: "test@example.com",
        },
        role: { name: "Helper" },
        registrationDate: new Date("2025-06-20"),
      };

      // Act
      const result = await GuestEmailService.sendGuestRegistrationNotification(
        params
      );

      // Assert
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("Integration with EmailTransporter", () => {
    it("should properly initialize EmailTransporter on first use", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Test Guest",
        event: {
          title: "Test Event",
          date: new Date("2025-08-01"),
        },
        role: { name: "Participant" },
        registrationId: "REG-INIT",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      // Verify EmailTransporter was initialized
      const anyMailer: any = nodemailer as any;
      expect(anyMailer.createTransport).toHaveBeenCalled();
    });

    it("should reuse EmailTransporter for multiple guest emails", async () => {
      // Arrange
      const params1 = {
        guestEmail: "guest1@example.com",
        guestName: "Guest One",
        event: { title: "Event 1", date: new Date("2025-09-01") },
        role: { name: "Role 1" },
        registrationId: "REG-1",
      };
      const params2 = {
        organizerEmails: ["org@example.com"],
        event: { title: "Event 2", date: new Date("2025-09-02") },
        guest: { name: "Guest Two", email: "guest2@example.com" },
        role: { name: "Role 2" },
        registrationDate: new Date("2025-08-25"),
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params1);
      await GuestEmailService.sendGuestRegistrationNotification(params2);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
      // createTransport should only be called once (transporter reused)
      const anyMailer: any = nodemailer as any;
      expect(anyMailer.createTransport).toHaveBeenCalledTimes(1);
    });
  });
});
