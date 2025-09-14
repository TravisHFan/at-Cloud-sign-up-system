/**
 * EmailService Phase 3 Coverage Expansion Tests
 *
 * Focus: Reaching 75% coverage by testing remaining uncovered paths
 * Current: 71.32% statement coverage → Target: 75%
 * Strategy: Edge cases, error conditions, and missing branches
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
// Mock nodemailer with robust default/named support (must be before importing EmailService)
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
import { EmailService } from "../../../../src/services/infrastructure/emailService";

describe("EmailService - Phase 3 Coverage Expansion", () => {
  let mockTransporter: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };

    // Setup production-like environment to trigger all code paths
    process.env.NODE_ENV = "production";
    process.env.FRONTEND_URL = "https://atcloud.org";
    process.env.SMTP_USER = "test@atcloud.org";
    process.env.SMTP_PASS = "secure-password";
    process.env.SMTP_HOST = "smtp.atcloud.org";
    process.env.SMTP_PORT = "587";
    process.env.EMAIL_FROM = '"@Cloud Ministry" <noreply@atcloud.org>';

    mockTransporter = {
      sendMail: vi.fn().mockResolvedValue({
        messageId: "test-message-id",
        response: "250 OK",
      }),
    };

    const anyMailer: any = nodemailer as any;
    if (
      anyMailer.createTransport &&
      typeof anyMailer.createTransport === "function"
    ) {
      vi.mocked(anyMailer.createTransport).mockReturnValue(mockTransporter);
    }
    if (anyMailer.default?.createTransport) {
      vi.mocked(anyMailer.default.createTransport).mockReturnValue(
        mockTransporter
      );
    }
    (EmailService as any).transporter = null;

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    (EmailService as any).transporter = null;
    vi.restoreAllMocks();
  });

  describe("Email Sending Edge Cases", () => {
    it("should handle jsonTransport response in development mode", async () => {
      // Test the development mode jsonTransporter path
      mockTransporter.sendMail.mockResolvedValue({
        messageId: "dev-id",
        response: '{"jsonTransport":true,"messageId":"dev-id"}',
      });

      const result = await EmailService.sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<h1>Test</h1>",
        text: "Test",
      });

      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        "📧 Development Email (not actually sent):"
      );
    });

    it("should handle email sending with missing optional fields", async () => {
      const result = await EmailService.sendVerificationEmail(
        "user@example.com",
        "", // Empty name to test template edge case
        "verification-token-123"
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: "Welcome to @Cloud Ministry - Please Verify Your Email",
        })
      );
    });

    it("should handle password reset with special characters in name", async () => {
      const result = await EmailService.sendPasswordResetEmail(
        "user@example.com",
        "Dr. João O'Connor-Smith Jr.", // Name with special characters
        "reset-token-456"
      );

      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Dr. João O'Connor-Smith Jr.");
    });

    it("should handle event creation with missing optional zoomLink", async () => {
      const eventData = {
        title: "Prayer Meeting",
        date: "2024-01-15",
        time: "19:00",
        endTime: "20:30",
        location: "Community Center",
        organizer: "Pastor Smith",
        purpose: "Weekly Prayer",
        format: "In-Person",
        // zoomLink is intentionally missing
      };

      const result = await EmailService.sendEventCreatedEmail(
        "member@example.com",
        "John Doe",
        eventData
      );

      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // Should not contain Zoom link section
      expect(emailCall.html).not.toContain("Join Link:");
      expect(emailCall.html).toContain("Community Center");
    });

    it("should handle event creation with online format and zoomLink", async () => {
      const eventData = {
        title: "Online Bible Study",
        date: "2024-01-20",
        time: "14:00",
        endTime: "15:30",
        location: "Virtual",
        zoomLink: "https://zoom.us/j/123456789",
        organizer: "Teacher Mary",
        purpose: "Bible Study",
        format: "Online",
      };

      const result = await EmailService.sendEventCreatedEmail(
        "student@example.com",
        "Jane Smith",
        eventData
      );

      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Join Link:");
      expect(emailCall.html).toContain("https://zoom.us/j/123456789");
      expect(emailCall.html).toContain("Online Meeting");
    });
  });

  describe("Role Management Notifications - Extended Coverage", () => {
    it("should handle demotion notifications with optional reason", async () => {
      const userData = {
        _id: "user123",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        oldRole: "Administrator",
        newRole: "Participant",
      };

      const changedBy = {
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.com",
        role: "Super Admin",
      };

      const result = await EmailService.sendDemotionNotificationToUser(
        userData.email,
        userData,
        changedBy,
        "Temporary administrative restructuring" // With reason
      );

      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain(
        "Temporary administrative restructuring"
      );
      expect(emailCall.html).toContain("Context for This Change:");
    });

    it("should handle demotion notifications without reason", async () => {
      const userData = {
        _id: "user456",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
        oldRole: "Leader",
        newRole: "Participant",
      };

      const changedBy = {
        firstName: "Admin",
        lastName: "Manager",
        email: "manager@example.com",
        role: "Administrator",
      };

      const result = await EmailService.sendDemotionNotificationToUser(
        userData.email,
        userData,
        changedBy
        // No reason provided
      );

      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).not.toContain("Context for This Change:");
      expect(emailCall.html).toContain("Ministry Role Update");
    });

    it("should handle admin demotion notifications with critical impact", async () => {
      const userData = {
        _id: "superuser",
        firstName: "Former",
        lastName: "SuperAdmin",
        email: "former@example.com",
        oldRole: "Super Admin",
        newRole: "Participant",
      };

      const changedBy = {
        firstName: "Chief",
        lastName: "Administrator",
        email: "chief@example.com",
        role: "Super Admin",
      };

      const result = await EmailService.sendDemotionNotificationToAdmins(
        "admin@example.com",
        "Admin Observer",
        userData,
        changedBy,
        "Security protocol violation"
      );

      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Critical Impact");
      expect(emailCall.html).toContain("URGENT");
      expect(emailCall.html).toContain("Security protocol violation");
    });
  });

  describe("Ministry Role Changes - AtCloud Specific", () => {
    it("should handle AtCloud role assignment notifications", async () => {
      const userData = {
        firstName: "New",
        lastName: "Leader",
        email: "newleader@example.com",
        roleInAtCloud: "Worship Leader",
      };

      const result = await EmailService.sendAtCloudRoleAssignedToAdmins(
        "admin@example.com",
        "Admin Manager",
        userData
      );

      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("@Cloud Co-worker Role Invited");
      expect(emailCall.html).toContain("Worship Leader");
      expect(emailCall.subject).toContain("New Leader");
    });

    it("should handle AtCloud role removal notifications", async () => {
      const userData = {
        firstName: "Former",
        lastName: "Leader",
        email: "former@example.com",
        previousRoleInAtCloud: "Youth Pastor",
      };

      const result = await EmailService.sendAtCloudRoleRemovedToAdmins(
        "admin@example.com",
        "Admin Manager",
        userData
      );

      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("@Cloud Co-worker Role Removed");
      expect(emailCall.html).toContain("Youth Pastor");
      expect(emailCall.subject).toContain("Former Leader");
    });

    it("should handle new AtCloud leader signup notifications", async () => {
      const userData = {
        firstName: "Brand",
        lastName: "NewLeader",
        email: "brandnew@example.com",
        roleInAtCloud: "Children's Ministry Leader",
      };

      const result = await EmailService.sendNewAtCloudLeaderSignupToAdmins(
        "admin@example.com",
        "Admin Supervisor",
        userData
      );

      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("New @Cloud Co-worker Signup");
      expect(emailCall.html).toContain("Children's Ministry Leader");
      expect(emailCall.subject).toContain("Brand NewLeader");
    });
  });

  describe("Environment Configuration Edge Cases", () => {
    it("should handle missing EMAIL_FROM environment variable", async () => {
      delete process.env.EMAIL_FROM;

      const result = await EmailService.sendEmail({
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
        text: "Test",
      });

      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.from).toBe('"@Cloud Ministry" <noreply@atcloud.org>');
    });

    it("should handle missing FRONTEND_URL in templates", async () => {
      delete process.env.FRONTEND_URL;

      const result = await EmailService.sendWelcomeEmail(
        "user@example.com",
        "Test User"
      );

      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("http://localhost:5173");
      expect(emailCall.text).toContain("http://localhost:5173");
    });

    it("should send email in production environment without relying on logs", async () => {
      process.env.NODE_ENV = "production";

      const result = await EmailService.sendEmail({
        to: "production@example.com",
        subject: "Production Email",
        html: "<h1>Production</h1>",
        text: "Production",
      });

      expect(result).toBe(true);
      // Logging behavior may vary; assertions should focus on outcomes
    });
  });

  describe("Template Generation Edge Cases", () => {
    it("should handle empty or null name values in templates", async () => {
      const result = await EmailService.sendPasswordChangeRequestEmail(
        "user@example.com",
        null as any, // null name
        "change-token"
      );

      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Hello null,"); // Should handle null gracefully
    });

    it("should handle event notifications with missing event data fields", async () => {
      const incompleteEventData = {
        eventTitle: "Incomplete Event",
        eventDate: "2024-01-30",
        // message is missing
      } as any;

      const result = await EmailService.sendEventNotificationEmail(
        "user@example.com",
        "Test User",
        incompleteEventData
      );

      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain(
        "Please check your dashboard for more details."
      );
    });

    it("should handle event reminder with missing zoomLink in virtual format", async () => {
      const eventData = {
        title: "Virtual Prayer Meeting",
        date: "2024-02-01",
        time: "18:00",
        location: "Online",
        format: "Online",
        // zoomLink is missing
      };

      const result = await EmailService.sendEventReminderEmail(
        "user@example.com",
        "Prayer Participant",
        eventData,
        "1h"
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });
  });

  describe("Error Resilience", () => {
    it("should handle transporter creation failure gracefully", async () => {
      vi.mocked(nodemailer.createTransport).mockImplementation(() => {
        throw new Error("SMTP Configuration Error");
      });

      const result = await EmailService.sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
        text: "Test",
      });

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        "❌ Email send failed:",
        expect.any(Error)
      );
    });

    it("should handle sendMail promise rejection", async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error("Network timeout"));

      const result = await EmailService.sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
        text: "Test",
      });

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        "❌ Email send failed:",
        expect.any(Error)
      );
    });
  });

  describe("Advanced Template Scenarios", () => {
    it("should handle password reset success notification", async () => {
      const result = await EmailService.sendPasswordResetSuccessEmail(
        "user@example.com",
        "Security User"
      );

      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.subject).toContain("Password Changed Successfully");
      expect(emailCall.html).toContain("Security User");
      expect(emailCall.html).toContain("✅ Success!");
    });

    it("should handle password change request notification", async () => {
      const result = await EmailService.sendPasswordChangeRequestEmail(
        "user@example.com",
        "Change User",
        "change-confirm-token"
      );

      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.subject).toContain("Password Change Request");
      expect(emailCall.html).toContain("Change User");
      expect(emailCall.html).toContain("change-confirm-token");
    });

    it("should handle new leader signup notifications", async () => {
      const newLeaderData = {
        firstName: "New",
        lastName: "Leader",
        email: "newleader@example.com",
        roleInAtCloud: "Outreach Coordinator",
        signupDate: "2024-01-15",
      };

      const result = await EmailService.sendNewLeaderSignupEmail(
        "admin@example.com",
        "Admin Manager",
        newLeaderData
      );

      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.subject).toContain("New Leader Signup: New Leader");
      expect(emailCall.html).toContain("Outreach Coordinator");
      expect(emailCall.html).toContain("2024-01-15");
    });

    it("should handle co-organizer assignment notifications", async () => {
      const assignedUser = {
        firstName: "Co",
        lastName: "Organizer",
      };

      const eventData = {
        title: "Community Outreach",
        date: "2024-02-10",
        time: "10:00",
        location: "Community Center",
      };

      const assignedBy = {
        firstName: "Main",
        lastName: "Organizer",
      };

      const result = await EmailService.sendCoOrganizerAssignedEmail(
        "coorganizer@example.com",
        assignedUser,
        eventData,
        assignedBy
      );

      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.subject).toContain("Co-Organizer Assignment");
      expect(emailCall.html).toContain("Co Organizer");
      expect(emailCall.html).toContain("Community Outreach");
      expect(emailCall.html).toContain("Main Organizer");
    });
  });
});
