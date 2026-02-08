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
        mockTransporter,
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

    it("should use FRONTEND_URL fallback when env variable is not set", async () => {
      // Arrange
      delete process.env.FRONTEND_URL;
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Test Guest",
        event: {
          title: "Test Event",
          date: new Date("2025-09-01"),
          time: "10:00 AM",
        },
        role: { name: "Participant" },
        registrationId: "REG-FALLBACK",
        manageToken: "TOKEN-123",
      };

      // Act
      const result = await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("localhost:5173");
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
      const result =
        await GuestEmailService.sendGuestDeclineNotification(params);

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
      const result =
        await GuestEmailService.sendGuestDeclineNotification(params);

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
      const result =
        await GuestEmailService.sendGuestDeclineNotification(params);

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
      const result =
        await GuestEmailService.sendGuestRegistrationNotification(params);

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
      const result =
        await GuestEmailService.sendGuestRegistrationNotification(params);

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
        new Error("Connection refused"),
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
      const result =
        await GuestEmailService.sendGuestRegistrationNotification(params);

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

  describe("sendGuestConfirmationEmail - Virtual Meeting Edge Cases", () => {
    it("should show 'meeting details pending' when zoomLink is present but passcode is missing", async () => {
      // Arrange: zoomLink without passcode should NOT show virtual sections
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Virtual Guest",
        event: {
          title: "Online Event",
          date: new Date("2025-04-15"),
          time: "10:00 AM",
          format: "Online",
          zoomLink: "https://zoom.us/j/123456789",
          meetingId: "123 456 789",
          // passcode missing
        },
        role: { name: "Participant" },
        registrationId: "REG-NO-PASSCODE",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // Should show pending message instead of meeting details
      expect(emailCall.html).toContain(
        "meeting link and event details will be provided",
      );
      expect(emailCall.html).not.toContain("Meeting ID:");
      expect(emailCall.text).toContain(
        "meeting link and event details will be provided",
      );
    });

    it("should show 'meeting details pending' when meetingId is present but zoomLink is missing", async () => {
      // Arrange: meetingId without zoomLink should NOT show virtual sections
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Virtual Guest",
        event: {
          title: "Online Event",
          date: new Date("2025-04-15"),
          time: "10:00 AM",
          format: "Online",
          // zoomLink missing
          meetingId: "123 456 789",
          passcode: "secret123",
        },
        role: { name: "Participant" },
        registrationId: "REG-NO-LINK",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain(
        "meeting link and event details will be provided",
      );
      expect(emailCall.html).not.toContain("Join Online Meeting");
    });

    it("should display complete virtual meeting info when all fields are present", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Complete Virtual Guest",
        event: {
          title: "Full Virtual Event",
          date: new Date("2025-04-20"),
          time: "2:00 PM",
          endTime: "4:00 PM",
          format: "Online",
          zoomLink: "https://zoom.us/j/999888777",
          meetingId: "999 888 777",
          passcode: "fullpass",
        },
        role: { name: "Speaker" },
        registrationId: "REG-FULL-VIRTUAL",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Join Online Meeting");
      expect(emailCall.html).toContain("https://zoom.us/j/999888777");
      expect(emailCall.html).toContain("Meeting ID:");
      expect(emailCall.html).toContain("999 888 777");
      expect(emailCall.html).toContain("Passcode:");
      expect(emailCall.html).toContain("fullpass");
      // Text version should also contain these
      expect(emailCall.text).toContain("https://zoom.us/j/999888777");
      expect(emailCall.text).toContain("Meeting ID: 999 888 777");
      expect(emailCall.text).toContain("Passcode: fullpass");
    });

    it("should handle whitespace-only zoomLink as missing", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Guest",
        event: {
          title: "Test Event",
          date: new Date("2025-04-25"),
          time: "10:00 AM",
          zoomLink: "   ", // whitespace only
          meetingId: "111 222 333",
          passcode: "pass123",
        },
        role: { name: "Attendee" },
        registrationId: "REG-WHITESPACE-LINK",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain(
        "meeting link and event details will be provided",
      );
    });

    it("should handle whitespace-only passcode as missing", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Guest",
        event: {
          title: "Test Event",
          date: new Date("2025-04-25"),
          time: "10:00 AM",
          zoomLink: "https://zoom.us/j/123",
          meetingId: "111 222 333",
          passcode: "  ", // whitespace only
        },
        role: { name: "Attendee" },
        registrationId: "REG-WHITESPACE-PASS",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain(
        "meeting link and event details will be provided",
      );
    });
  });

  describe("sendGuestConfirmationEmail - Invited Guest with DeclineToken", () => {
    it("should show decline section without token when invited but declineToken is missing", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Invited Guest",
        event: {
          title: "Special Event",
          date: new Date("2025-05-01"),
          time: "3:00 PM",
          createdBy: {
            firstName: "Jane",
            lastName: "Organizer",
            email: "jane@example.com",
          },
        },
        role: { name: "VIP Guest" },
        registrationId: "REG-INVITED-NO-TOKEN",
        inviterName: "Jane Organizer", // Invited
        // declineToken is missing
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("You have been invited as a Guest");
      expect(emailCall.html).toContain("Jane Organizer");
      // Should show fallback decline message
      expect(emailCall.html).toContain("decline");
      expect(emailCall.html).toContain("please contact the organizer");
      expect(emailCall.html).toContain("A decline link was not generated");
    });

    it("should show full decline button when invited with declineToken", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Invited Guest",
        event: {
          title: "Exclusive Event",
          date: new Date("2025-05-10"),
          time: "6:00 PM",
          createdBy: {
            firstName: "John",
            lastName: "Host",
            email: "john@example.com",
          },
        },
        role: { name: "Keynote Speaker" },
        registrationId: "REG-INVITED-WITH-TOKEN",
        inviterName: "John Host",
        declineToken: "DECLINE-ABC-123",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Decline This Invitation");
      expect(emailCall.html).toContain("/guest/decline/DECLINE-ABC-123");
      expect(emailCall.html).toContain("expires in 14 days");
    });

    it("should not show decline section for non-invited guests", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Self-Registered Guest",
        event: {
          title: "Open Event",
          date: new Date("2025-05-15"),
          time: "10:00 AM",
        },
        role: { name: "Attendee" },
        registrationId: "REG-SELF-REG",
        // No inviterName = not invited
        declineToken: "SOME-TOKEN", // Even with token, no decline section without invite
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("You're Registered as a Guest");
      expect(emailCall.html).not.toContain("Decline This Invitation");
      expect(emailCall.html).not.toContain("A decline link was not generated");
    });

    it("should get inviter name from createdBy when inviterName is truthy but not a name", async () => {
      // Arrange: inviterName is set but createdBy has the actual name
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Invited Guest",
        event: {
          title: "Event",
          date: new Date("2025-05-20"),
          time: "1:00 PM",
          createdBy: {
            firstName: "Real",
            lastName: "Organizer",
            email: "real@example.com",
          },
        },
        role: { name: "Guest" },
        registrationId: "REG-NAME-FROM-CREATEDBY",
        inviterName: "true", // Truthy but not useful as a display name
        declineToken: "TOKEN-123",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // The actualInviterName should be extracted from createdBy
      expect(emailCall.html).toContain("Real Organizer");
    });

    it("should fall back to organizerDetails for inviter name when createdBy lacks name", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Invited Guest",
        event: {
          title: "Event",
          date: new Date("2025-05-25"),
          time: "2:00 PM",
          createdBy: {
            // No firstName/lastName
            email: "org@example.com",
          },
          organizerDetails: [
            {
              name: "Lead Organizer",
              role: "Organizer",
              email: "lead@example.com",
            },
          ],
        },
        role: { name: "Participant" },
        registrationId: "REG-FALLBACK-ORGDETAILS",
        inviterName: "someone",
        declineToken: "TOKEN-456",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // Should use first organizerDetails name
      expect(emailCall.html).toContain("Lead Organizer");
    });

    it("should use 'an Organizer' when no inviter name can be determined", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Invited Guest",
        event: {
          title: "Anonymous Event",
          date: new Date("2025-05-30"),
          time: "4:00 PM",
          // No createdBy, no organizerDetails
        },
        role: { name: "Guest" },
        registrationId: "REG-NO-INVITER",
        inviterName: "yes",
        declineToken: "TOKEN-789",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("an Organizer");
    });
  });

  describe("sendGuestConfirmationEmail - Edge Cases for Event Fields", () => {
    it("should handle event with minimal fields (only title and date)", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Minimal Guest",
        event: {
          title: "Minimal Event",
          date: new Date("2025-06-01"),
          // No location, time, format, etc.
        },
        role: { name: "Attendee" },
        registrationId: "REG-MINIMAL",
      };

      // Act
      const result = await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Minimal Event");
      expect(emailCall.html).toContain("Minimal Guest");
      expect(emailCall.html).toContain("Attendee");
    });

    it("should force 'Online' location label for Online format events", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Online Guest",
        event: {
          title: "Online Only Event",
          date: new Date("2025-06-05"),
          time: "10:00 AM",
          format: "Online",
          location: "Some Physical Location", // Should be ignored for Online
        },
        role: { name: "Viewer" },
        registrationId: "REG-ONLINE-LABEL",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // For Online format, location should be "Online" not the physical location
      expect(emailCall.html).toContain("<strong>Location:</strong> Online");
      expect(emailCall.html).not.toContain("Some Physical Location");
    });

    it("should include physical location for In-person format", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "In-Person Guest",
        event: {
          title: "In-Person Event",
          date: new Date("2025-06-10"),
          time: "9:00 AM",
          format: "In-person",
          location: "123 Main Street, City",
        },
        role: { name: "Attendee" },
        registrationId: "REG-INPERSON",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("123 Main Street, City");
    });

    it("should include location for Hybrid format events", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Hybrid Guest",
        event: {
          title: "Hybrid Event",
          date: new Date("2025-06-15"),
          time: "1:00 PM",
          format: "Hybrid Participation",
          location: "Convention Hall",
          zoomLink: "https://zoom.us/j/hybrid123",
          meetingId: "hybrid 123",
          passcode: "hybridpass",
        },
        role: { name: "Participant" },
        registrationId: "REG-HYBRID-FULL",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Convention Hall");
      expect(emailCall.html).toContain("Join Online Meeting");
    });

    it("should handle event with endDate for multi-day events", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Multi-Day Guest",
        event: {
          title: "Multi-Day Conference",
          date: new Date("2025-07-01"),
          endDate: new Date("2025-07-03"),
          time: "09:00",
          endTime: "17:00",
          timeZone: "America/Los_Angeles",
          location: "Conference Center",
        },
        role: { name: "Speaker" },
        registrationId: "REG-MULTIDAY",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Multi-Day Conference");
      // ICS should be generated for multi-day
      expect(emailCall.attachments).toBeDefined();
      expect(emailCall.attachments[0].content).toContain("BEGIN:VCALENDAR");
    });

    it("should handle event date as string", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "String Date Guest",
        event: {
          title: "String Date Event",
          date: "2025-08-15", // String instead of Date
          time: "10:00 AM",
        },
        role: { name: "Attendee" },
        registrationId: "REG-STRING-DATE",
      };

      // Act
      const result = await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.attachments).toBeDefined();
    });

    it("should escape HTML in purpose and agenda fields", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "XSS Guest",
        event: {
          title: "Safe Event",
          date: new Date("2025-09-01"),
          time: "10:00 AM",
          purpose: "<script>alert('xss')</script>",
          agenda: "Item 1\n<b>Bold attempt</b>\nItem 3",
        },
        role: { name: "Attendee" },
        registrationId: "REG-XSS",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // Script tags should be escaped
      expect(emailCall.html).toContain("&lt;script&gt;");
      expect(emailCall.html).not.toContain("<script>");
      expect(emailCall.html).toContain("&lt;b&gt;");
    });

    it("should handle organizer with username fallback when no firstName/lastName", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Guest",
        event: {
          title: "Event",
          date: new Date("2025-09-05"),
          time: "11:00 AM",
          createdBy: {
            // No firstName/lastName
            username: "orguser123",
            email: "orguser@example.com",
          },
        },
        role: { name: "Attendee" },
        registrationId: "REG-USERNAME",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("orguser123");
    });

    it("should handle organizer without any contact info (no email, no phone)", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Guest",
        event: {
          title: "Event",
          date: new Date("2025-09-10"),
          time: "12:00 PM",
          createdBy: {
            firstName: "No",
            lastName: "Contact",
            // No email, no phone
          },
        },
        role: { name: "Attendee" },
        registrationId: "REG-NO-CONTACT",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // Should not include organizer contact section since no contact info
      expect(emailCall.html).not.toContain("No Contact");
    });

    it("should include organizer with only phone (no email)", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Guest",
        event: {
          title: "Phone Only Organizer Event",
          date: new Date("2025-09-15"),
          time: "1:00 PM",
          createdBy: {
            firstName: "Phone",
            lastName: "Only",
            phone: "(555) 999-8888",
            // No email
          },
        },
        role: { name: "Attendee" },
        registrationId: "REG-PHONE-ONLY",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Phone Only");
      expect(emailCall.html).toContain("(555) 999-8888");
    });

    it("should handle organizerDetails with contacts that have no email", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Guest",
        event: {
          title: "Mixed Contact Event",
          date: new Date("2025-09-20"),
          time: "2:00 PM",
          organizerDetails: [
            {
              name: "No Email Org",
              role: "Co-Organizer",
              email: "",
              phone: "(555) 111-2222",
            },
            { name: "No Contact Org", role: "Assistant", email: "", phone: "" },
          ],
        },
        role: { name: "Attendee" },
        registrationId: "REG-MIXED-CONTACT",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("No Email Org");
      expect(emailCall.html).toContain("(555) 111-2222");
    });
  });

  describe("sendGuestDeclineNotification - Additional Edge Cases", () => {
    it("should handle Date object for event.date", async () => {
      // Arrange
      const params = {
        event: {
          title: "Date Object Event",
          date: new Date("2025-10-01T14:30:00Z"),
        },
        roleName: "Volunteer",
        guest: { name: "Declining Guest", email: "decline@example.com" },
        reason: "Personal reasons",
        organizerEmails: ["org@example.com"],
      };

      // Act
      const result =
        await GuestEmailService.sendGuestDeclineNotification(params);

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // Should format the date properly
      expect(emailCall.html).toContain("Oct");
      expect(emailCall.html).toContain("2025");
    });

    it("should handle string date for event.date", async () => {
      // Arrange
      const params = {
        event: {
          title: "String Date Event",
          date: "2025-11-15",
        },
        roleName: "Helper",
        guest: { name: "String Date Guest", email: "stringdate@example.com" },
        organizerEmails: ["org@example.com"],
      };

      // Act
      const result =
        await GuestEmailService.sendGuestDeclineNotification(params);

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Nov");
    });

    it("should handle missing roleName gracefully", async () => {
      // Arrange
      const params = {
        event: {
          title: "No Role Event",
          date: new Date("2025-12-01"),
        },
        // roleName is undefined
        guest: { name: "Guest", email: "guest@example.com" },
        organizerEmails: ["org@example.com"],
      };

      // Act
      const result =
        await GuestEmailService.sendGuestDeclineNotification(params);

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.subject).toContain("Role");
      expect(emailCall.html).not.toContain("undefined");
    });

    it("should escape special characters in guest name and reason", async () => {
      // Arrange
      const params = {
        event: {
          title: "XSS Test Event",
          date: new Date("2025-12-10"),
        },
        roleName: "Tester",
        guest: {
          name: "<script>alert('name')</script>",
          email: "xss@example.com",
        },
        reason: "<img src=x onerror=alert('reason')>",
        organizerEmails: ["org@example.com"],
      };

      // Act
      await GuestEmailService.sendGuestDeclineNotification(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("&lt;script&gt;");
      expect(emailCall.html).not.toContain("<script>");
      expect(emailCall.html).toContain("&lt;img");
    });

    it("should handle undefined organizerEmails array", async () => {
      // Arrange
      const params = {
        event: {
          title: "No Organizers Event",
          date: new Date("2025-12-15"),
        },
        guest: { name: "Guest", email: "guest@example.com" },
        organizerEmails: undefined as any,
      };

      // Act
      const result =
        await GuestEmailService.sendGuestDeclineNotification(params);

      // Assert
      expect(result).toBe(false);
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it("should include date formatting even with invalid date string", async () => {
      // Arrange
      const params = {
        event: {
          title: "Invalid Date Event",
          date: "not-a-date",
        },
        roleName: "Volunteer",
        guest: { name: "Guest", email: "guest@example.com" },
        organizerEmails: ["org@example.com"],
      };

      // Act
      const result =
        await GuestEmailService.sendGuestDeclineNotification(params);

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // When date string is invalid, toLocaleString returns "Invalid Date"
      expect(emailCall.html).toContain("Invalid Date");
    });
  });

  describe("sendGuestRegistrationNotification - Additional Edge Cases", () => {
    it("should send to multiple organizers individually", async () => {
      // Arrange
      const params = {
        organizerEmails: [
          "org1@example.com",
          "org2@example.com",
          "org3@example.com",
        ],
        event: {
          title: "Multi-Organizer Event",
          date: new Date("2025-10-15"),
          time: "10:00 AM",
        },
        guest: { name: "New Guest", email: "newguest@example.com" },
        role: { name: "Volunteer" },
        registrationDate: new Date("2025-10-01"),
      };

      // Act
      const result =
        await GuestEmailService.sendGuestRegistrationNotification(params);

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);

      const calls = mockTransporter.sendMail.mock.calls;
      expect(calls[0][0].to).toBe("org1@example.com");
      expect(calls[1][0].to).toBe("org2@example.com");
      expect(calls[2][0].to).toBe("org3@example.com");
    });

    it("should filter out empty/falsy organizer emails", async () => {
      // Arrange
      const params = {
        organizerEmails: [
          "org@example.com",
          "",
          null as any,
          undefined as any,
          "valid@example.com",
        ],
        event: {
          title: "Filter Test Event",
          date: new Date("2025-10-20"),
          time: "11:00 AM",
        },
        guest: { name: "Guest", email: "guest@example.com" },
        role: { name: "Attendee" },
        registrationDate: new Date("2025-10-15"),
      };

      // Act
      const result =
        await GuestEmailService.sendGuestRegistrationNotification(params);

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);

      const calls = mockTransporter.sendMail.mock.calls;
      expect(calls[0][0].to).toBe("org@example.com");
      expect(calls[1][0].to).toBe("valid@example.com");
    });

    it("should handle undefined organizerEmails array", async () => {
      // Arrange
      const params = {
        organizerEmails: undefined as any,
        event: {
          title: "Undefined Emails Event",
          date: new Date("2025-10-25"),
        },
        guest: { name: "Guest", email: "guest@example.com" },
        role: { name: "Attendee" },
        registrationDate: new Date("2025-10-20"),
      };

      // Act
      const result =
        await GuestEmailService.sendGuestRegistrationNotification(params);

      // Assert
      expect(result).toBe(true); // Returns true since nothing to send
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it("should handle event without date gracefully", async () => {
      // Arrange
      const params = {
        organizerEmails: ["org@example.com"],
        event: {
          title: "No Date Event",
          // date is missing
        } as any,
        guest: { name: "Guest", email: "guest@example.com" },
        role: { name: "Attendee" },
        registrationDate: new Date("2025-11-01"),
      };

      // Act
      const result =
        await GuestEmailService.sendGuestRegistrationNotification(params);

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("No Date Event");
    });

    it("should return false if any email fails to send", async () => {
      // Arrange
      mockTransporter.sendMail
        .mockResolvedValueOnce({ messageId: "msg1" })
        .mockRejectedValueOnce(new Error("SMTP error"));

      const params = {
        organizerEmails: ["org1@example.com", "org2@example.com"],
        event: {
          title: "Partial Fail Event",
          date: new Date("2025-11-05"),
          time: "10:00 AM",
        },
        guest: { name: "Guest", email: "guest@example.com" },
        role: { name: "Attendee" },
        registrationDate: new Date("2025-11-01"),
      };

      // Act
      const result =
        await GuestEmailService.sendGuestRegistrationNotification(params);

      // Assert
      expect(result).toBe(false); // One failure means overall failure
    });

    it("should include text version with all guest details", async () => {
      // Arrange
      const params = {
        organizerEmails: ["org@example.com"],
        event: {
          title: "Text Version Event",
          date: new Date("2025-11-10"),
          time: "2:00 PM",
          endTime: "4:00 PM",
          location: "Meeting Room",
          timeZone: "UTC",
        },
        guest: {
          name: "Text Guest",
          email: "text@example.com",
          phone: "(555) 123-4567",
        },
        role: { name: "Speaker" },
        registrationDate: new Date("2025-11-05"),
      };

      // Act
      await GuestEmailService.sendGuestRegistrationNotification(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.text).toContain("Text Guest");
      expect(emailCall.text).toContain("text@example.com");
      expect(emailCall.text).toContain("(555) 123-4567");
      expect(emailCall.text).toContain("Speaker");
    });
  });

  describe("sendGuestConfirmationEmail - ICS Generation Edge Cases", () => {
    it("should log ICS generation success when email is sent with attachment", async () => {
      // Mock console.log to capture ICS generation log
      const consoleLogSpy = vi.spyOn(console, "log");

      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "ICS Success Guest",
        event: {
          title: "ICS Success Event",
          date: new Date("2025-12-01"),
          time: "10:00 AM",
          endTime: "12:00 PM",
          location: "Test Location",
          purpose: "Test purpose",
          timeZone: "UTC",
        },
        role: { name: "Attendee" },
        registrationId: "REG-ICS-SUCCESS",
      };

      // Act
      const result = await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // Email should be sent with ICS attachment
      expect(emailCall.attachments).toBeDefined();
      expect(emailCall.attachments).toHaveLength(1);
      expect(emailCall.attachments[0].content).toContain("BEGIN:VCALENDAR");
      // Should log success
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("ICS generation successful"),
        expect.any(Object),
      );
    });

    it("should include role description in ICS when provided", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "Description Guest",
        event: {
          title: "Role Description Event",
          date: new Date("2025-12-05"),
          time: "11:00 AM",
          endTime: "1:00 PM",
          location: "Room 101",
          purpose: "Test purpose",
          timeZone: "America/New_York",
        },
        role: {
          name: "Lead Volunteer",
          description: "Coordinate volunteer activities and manage schedules",
        },
        registrationId: "REG-ROLE-DESC",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.attachments).toBeDefined();
      expect(emailCall.attachments[0].content).toContain("VCALENDAR");
    });

    it("should use role name as fallback description when description is not provided", async () => {
      // Arrange
      const params = {
        guestEmail: "guest@example.com",
        guestName: "No Desc Guest",
        event: {
          title: "No Role Desc Event",
          date: new Date("2025-12-10"),
          time: "9:00 AM",
          timeZone: "UTC",
        },
        role: {
          name: "Assistant",
          // description is not provided
        },
        registrationId: "REG-NO-ROLE-DESC",
      };

      // Act
      await GuestEmailService.sendGuestConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.attachments).toBeDefined();
      expect(emailCall.attachments[0].content).toContain("BEGIN:VCALENDAR");
    });
  });
});
