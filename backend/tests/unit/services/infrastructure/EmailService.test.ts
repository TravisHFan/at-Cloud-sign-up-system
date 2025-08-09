import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";
import nodemailer from "nodemailer";

// Mock nodemailer
vi.mock("nodemailer");

describe("EmailService", () => {
  let mockTransporter: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear EMAIL_FROM to ensure consistent testing
    delete process.env.EMAIL_FROM;

    // Create mock transporter
    mockTransporter = {
      sendMail: vi.fn().mockResolvedValue({
        messageId: "test-message-id",
        response: "250 OK",
      }),
    };

    // Mock nodemailer.createTransport
    vi.mocked(nodemailer.createTransport).mockReturnValue(mockTransporter);

    // Reset static transporter
    (EmailService as any).transporter = null;

    // Mock console methods
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    // Reset static transporter
    (EmailService as any).transporter = null;
    vi.restoreAllMocks();
  });

  describe("getTransporter", () => {
    it("should create production transporter with real SMTP credentials", () => {
      process.env.NODE_ENV = "production";
      process.env.SMTP_USER = "real-user@example.com";
      process.env.SMTP_PASS = "real-password";
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_PORT = "465";
      process.env.SMTP_SECURE = "true";

      const transporter = (EmailService as any).getTransporter();

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: "smtp.example.com",
        port: 465,
        secure: true,
        auth: {
          user: "real-user@example.com",
          pass: "real-password",
        },
      });
      expect(transporter).toBe(mockTransporter);
    });

    it("should create development transporter with real credentials", () => {
      process.env.NODE_ENV = "development";
      process.env.SMTP_USER = "dev-user@example.com";
      process.env.SMTP_PASS = "dev-password";
      process.env.SMTP_HOST = "smtp.gmail.com";
      process.env.SMTP_PORT = "587";

      (EmailService as any).getTransporter();

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: "dev-user@example.com",
          pass: "dev-password",
        },
      });
    });

    it("should create console transporter when no real credentials", () => {
      process.env.NODE_ENV = "development";
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      (EmailService as any).getTransporter();

      expect(console.log).toHaveBeenCalledWith(
        "🔧 Development mode: Email service will use console logging"
      );
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        jsonTransport: true,
      });
    });

    it("should reuse existing transporter", () => {
      const firstTransporter = (EmailService as any).getTransporter();
      const secondTransporter = (EmailService as any).getTransporter();

      expect(firstTransporter).toBe(secondTransporter);
      expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    });

    it("should use default SMTP settings when not provided", () => {
      process.env.NODE_ENV = "development";
      process.env.SMTP_USER = "test@example.com";
      process.env.SMTP_PASS = "password";
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;

      (EmailService as any).getTransporter();

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: "test@example.com",
          pass: "password",
        },
      });
    });

    it("should detect placeholder credentials correctly", () => {
      process.env.SMTP_USER = "your-email@gmail.com";
      process.env.SMTP_PASS = "your-app-password";

      (EmailService as any).getTransporter();

      expect(console.log).toHaveBeenCalledWith(
        "🔧 Development mode: Email service will use console logging"
      );
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        jsonTransport: true,
      });
    });
  });

  describe("sendEmail", () => {
    it("should skip email sending in test environment", async () => {
      process.env.NODE_ENV = "test";

      const result = await EmailService.sendEmail({
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test HTML</p>",
        text: "Test text",
      });

      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        "📧 Email skipped in test environment: Test Subject to test@example.com"
      );
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it("should send email successfully in non-test environment", async () => {
      process.env.NODE_ENV = "development";

      const result = await EmailService.sendEmail({
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test HTML</p>",
        text: "Test text",
      });

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"@Cloud Ministry" <noreply@atcloud.org>',
        to: "test@example.com",
        subject: "Test Subject",
        text: "Test text",
        html: "<p>Test HTML</p>",
      });
    });

    it("should use custom EMAIL_FROM environment variable", async () => {
      process.env.NODE_ENV = "development";
      process.env.EMAIL_FROM = "custom@example.com";

      await EmailService.sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: "custom@example.com",
        to: "test@example.com",
        subject: "Test",
        text: undefined,
        html: "<p>Test</p>",
      });
    });

    it("should handle jsonTransport response in development", async () => {
      process.env.NODE_ENV = "development";
      mockTransporter.sendMail.mockResolvedValue({
        response: '{"jsonTransport":true}',
      });

      const result = await EmailService.sendEmail({
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
      });

      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        "📧 Development Email (not actually sent):"
      );
      expect(console.log).toHaveBeenCalledWith("   To: test@example.com");
      expect(console.log).toHaveBeenCalledWith("   Subject: Test Subject");
    });

    it("should log success message in non-production environment", async () => {
      process.env.NODE_ENV = "development";
      mockTransporter.sendMail.mockResolvedValue({
        messageId: "test-message-id",
        response: "250 OK",
      });

      const result = await EmailService.sendEmail({
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
      });

      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith("📧 Email sent successfully:");
      expect(console.log).toHaveBeenCalledWith(
        "   Message ID: test-message-id"
      );
    });

    it("should handle email sending errors", async () => {
      process.env.NODE_ENV = "development";
      const error = new Error("SMTP connection failed");
      mockTransporter.sendMail.mockRejectedValue(error);

      const result = await EmailService.sendEmail({
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
      });

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        "❌ Email send failed:",
        error
      );
    });

    it("should not log success message in production", async () => {
      process.env.NODE_ENV = "production";
      process.env.SMTP_USER = "prod@example.com";
      process.env.SMTP_PASS = "password";

      await EmailService.sendEmail({
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
      });

      expect(console.log).not.toHaveBeenCalledWith(
        "📧 Email sent successfully:"
      );
    });
  });

  describe("sendVerificationEmail", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    it("should send verification email with default frontend URL", async () => {
      delete process.env.FRONTEND_URL;

      const result = await EmailService.sendVerificationEmail(
        "user@example.com",
        "John Doe",
        "verification-token-123"
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: "Welcome to @Cloud Ministry - Please Verify Your Email",
        })
      );

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain("Hello John Doe");
      expect(callArgs.html).toContain(
        "http://localhost:5173/verify-email/verification-token-123"
      );
      expect(callArgs.text).toContain(
        "http://localhost:5173/verify-email/verification-token-123"
      );
    });

    it("should send verification email with custom frontend URL", async () => {
      process.env.FRONTEND_URL = "https://app.atcloud.com";

      const result = await EmailService.sendVerificationEmail(
        "user@example.com",
        "Jane Smith",
        "token-456"
      );

      expect(result).toBe(true);
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain("Hello Jane Smith");
      expect(callArgs.html).toContain(
        "https://app.atcloud.com/verify-email/token-456"
      );
    });

    it("should include proper HTML structure and styling", async () => {
      await EmailService.sendVerificationEmail(
        "user@example.com",
        "Test User",
        "token"
      );

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain("<!DOCTYPE html>");
      expect(callArgs.html).toContain(
        "<title>Verify Your Email - @Cloud Ministry</title>"
      );
      expect(callArgs.html).toContain('class="container"');
      expect(callArgs.html).toContain('class="header"');
      expect(callArgs.html).toContain('class="content"');
      expect(callArgs.html).toContain('class="footer"');
      expect(callArgs.html).toContain('class="button"');
    });
  });

  describe("sendPasswordResetEmail", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    it("should send password reset email with default frontend URL", async () => {
      delete process.env.FRONTEND_URL;

      const result = await EmailService.sendPasswordResetEmail(
        "user@example.com",
        "John Doe",
        "reset-token-123"
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: "Password Reset Request - @Cloud Ministry",
        })
      );

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain("Hello John Doe");
      expect(callArgs.html).toContain(
        "http://localhost:5173/reset-password/reset-token-123"
      );
    });

    it("should send password reset email with custom frontend URL", async () => {
      process.env.FRONTEND_URL = "https://app.atcloud.com";

      await EmailService.sendPasswordResetEmail(
        "user@example.com",
        "Jane Smith",
        "reset-456"
      );

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain(
        "https://app.atcloud.com/reset-password/reset-456"
      );
    });

    it("should include proper password reset email structure", async () => {
      await EmailService.sendPasswordResetEmail(
        "user@example.com",
        "Test User",
        "token"
      );

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain(
        "<title>Password Reset - @Cloud Ministry</title>"
      );
      expect(callArgs.html).toContain("Reset My Password");
      expect(callArgs.html).toContain("reset your password");
    });
  });

  describe("sendPasswordChangeRequestEmail", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    it("should send password change request email", async () => {
      const result = await EmailService.sendPasswordChangeRequestEmail(
        "user@example.com",
        "John Doe",
        "confirm-token-123"
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: "Password Change Request - @Cloud Ministry",
        })
      );

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain("Hello John Doe");
      expect(callArgs.html).toContain("Password Change Request");
      expect(callArgs.html).toContain("confirm-token-123");
    });
  });

  describe("sendPasswordResetSuccessEmail", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    it("should send password reset success email", async () => {
      const result = await EmailService.sendPasswordResetSuccessEmail(
        "user@example.com",
        "John Doe"
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: "Password Changed Successfully - @Cloud Ministry",
        })
      );

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain("Hello John Doe");
      expect(callArgs.html).toContain("password has been changed successfully");
    });
  });

  describe("sendWelcomeEmail", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    it("should send welcome email", async () => {
      const result = await EmailService.sendWelcomeEmail(
        "user@example.com",
        "John Doe"
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: "Welcome to @Cloud Ministry - Account Verified!",
        })
      );

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain("Hello John Doe");
      expect(callArgs.html).toContain("Welcome to @Cloud Ministry");
    });
  });

  describe("edge cases and error handling", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    it("should handle missing environment variables gracefully", async () => {
      delete process.env.EMAIL_FROM;
      delete process.env.FRONTEND_URL;
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;

      const result = await EmailService.sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"@Cloud Ministry" <noreply@atcloud.org>',
        })
      );
    });

    it("should handle invalid SMTP_PORT gracefully", async () => {
      process.env.SMTP_USER = "test@example.com";
      process.env.SMTP_PASS = "password";
      process.env.SMTP_PORT = "invalid-port";

      (EmailService as any).getTransporter();

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          port: NaN,
        })
      );
    });

    it("should handle SMTP_SECURE boolean conversion", async () => {
      process.env.NODE_ENV = "production";
      process.env.SMTP_USER = "test@example.com";
      process.env.SMTP_PASS = "password";
      process.env.SMTP_SECURE = "false";

      (EmailService as any).getTransporter();

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          secure: false,
        })
      );
    });

    it("should handle transporter creation with minimal configuration", async () => {
      process.env.NODE_ENV = "development";
      process.env.SMTP_USER = "minimal@example.com";
      process.env.SMTP_PASS = "minimal-pass";
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_SECURE;

      (EmailService as any).getTransporter();

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: "minimal@example.com",
          pass: "minimal-pass",
        },
      });
    });

    it("should handle email options without text field", async () => {
      process.env.NODE_ENV = "development";

      const result = await EmailService.sendEmail({
        to: "test@example.com",
        subject: "HTML Only",
        html: "<h1>HTML Content</h1>",
      });

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"@Cloud Ministry" <noreply@atcloud.org>',
        to: "test@example.com",
        subject: "HTML Only",
        text: undefined,
        html: "<h1>HTML Content</h1>",
      });
    });

    it("should handle empty email options gracefully", async () => {
      process.env.NODE_ENV = "development";

      const result = await EmailService.sendEmail({
        to: "",
        subject: "",
        html: "",
      });

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"@Cloud Ministry" <noreply@atcloud.org>',
        to: "",
        subject: "",
        text: undefined,
        html: "",
      });
    });

    it("should handle transporter sendMail promise rejection", async () => {
      process.env.NODE_ENV = "development";
      const networkError = new Error("Network timeout");
      mockTransporter.sendMail.mockRejectedValue(networkError);

      const result = await EmailService.sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        "❌ Email send failed:",
        networkError
      );
    });

    it("should handle production environment logging", async () => {
      process.env.NODE_ENV = "production";
      process.env.SMTP_USER = "prod@example.com";
      process.env.SMTP_PASS = "prod-password";

      mockTransporter.sendMail.mockResolvedValue({
        messageId: "prod-message-id",
      });

      await EmailService.sendEmail({
        to: "test@example.com",
        subject: "Production Test",
        html: "<p>Production email</p>",
      });

      // Should not log success message in production
      expect(console.log).not.toHaveBeenCalledWith(
        "📧 Email sent successfully:"
      );
    });
  });
});

// Event reminder branches: virtual, hybrid, in-person and different reminder labels
describe("EmailService.sendEventReminderEmail", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test"; // ensure sendEmail short-circuits, and we can intercept payload
    vi.restoreAllMocks();
  });

  it("renders virtual event (Online Zoom) with join links and 1h urgency copy", async () => {
    const spy = vi
      .spyOn(EmailService, "sendEmail")
      .mockResolvedValue(true as any);

    await EmailService.sendEventReminderEmail(
      "user@example.com",
      "Alex User",
      {
        title: "Weekly Sync",
        date: "2025-08-10",
        time: "10:00 AM",
        format: "Online",
        location: "Virtual",
        zoomLink: "https://zoom.us/j/123",
      },
      "1h"
    );

    expect(spy).toHaveBeenCalled();
    const args = spy.mock.calls[0][0];
    expect(args.subject).toContain("🚨");
    expect(args.subject).toContain("Weekly Sync");
    expect(args.html).toContain("🚨 STARTING SOON! 🚨");
    // Virtual info section & CTA variations for non-hybrid
    expect(args.html).toContain("Virtual Event Access:");
    expect(args.html).toContain("Join Virtual Event");
    expect(args.html).toContain("Join Now");
    // Should not include in-person location block
    expect(args.html).not.toContain("In-Person Event Location");
  });

  it("renders hybrid event with hybrid-specific copy and button text", async () => {
    const spy = vi
      .spyOn(EmailService, "sendEmail")
      .mockResolvedValue(true as any);

    await EmailService.sendEventReminderEmail(
      "user@example.com",
      "Alex User",
      {
        title: "Town Hall",
        date: "2025-08-12",
        time: "6:00 PM",
        format: "Hybrid Participation",
        location: "Main Hall",
        zoomLink: "https://zoom.us/j/456",
      },
      "24h"
    );

    const args = spy.mock.calls[0][0];
    expect(args.subject).toContain("⏰"); // Tomorrow label indicator
    expect(args.html).toContain("Hybrid (In-person + Online)");
    expect(args.html).toContain("Online Access for Hybrid Event:");
    expect(args.html).toContain(">Join Online<");
    // CTA button text for hybrid should be Join Online
    expect(args.html).toContain('class="button virtual">Join Online');
  });

  it("renders in-person event with location and details CTA", async () => {
    const spy = vi
      .spyOn(EmailService, "sendEmail")
      .mockResolvedValue(true as any);

    await EmailService.sendEventReminderEmail(
      "user@example.com",
      "Alex User",
      {
        title: "Workshop",
        date: "2025-08-20",
        time: "2:00 PM",
        format: "In-Person",
        location: "Room 101",
      },
      "1week"
    );

    const args = spy.mock.calls[0][0];
    // Should not include virtual sections
    expect(args.html).not.toContain("Virtual Event Access:");
    expect(args.html).toContain("In-Person Event Location:");
    expect(args.html).toContain("View Event Details");
  });
});

// Additional branch coverage for demotion admin notifications (critical vs standard)
describe("EmailService demotion notifications", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test"; // ensure sendEmail short-circuits
  });

  it("covers Critical demotion path with reason", async () => {
    const ok = await EmailService.sendDemotionNotificationToAdmins(
      "admin@example.com",
      "Admin Name",
      {
        _id: "1",
        firstName: "User",
        lastName: "One",
        email: "user1@example.com",
        oldRole: "Super Admin",
        newRole: "Administrator",
      },
      {
        firstName: "Changer",
        lastName: "X",
        email: "c@example.com",
        role: "Admin",
      },
      "Policy violation"
    );
    expect(ok).toBe(true);
  });

  it("covers non-critical demotion path without reason", async () => {
    const ok = await EmailService.sendDemotionNotificationToAdmins(
      "admin@example.com",
      "Admin Name",
      {
        _id: "2",
        firstName: "User",
        lastName: "Two",
        email: "user2@example.com",
        oldRole: "Leader",
        newRole: "Administrator",
      },
      {
        firstName: "Changer",
        lastName: "Y",
        email: "c2@example.com",
        role: "Admin",
      }
    );
    expect(ok).toBe(true);
  });
});

// Promotion templates and event-created email branches
describe("EmailService promotion templates and event created", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test"; // make sendEmail return true and capture payload
  });

  it("sendPromotionNotificationToUser renders role-specific copy and dashboard link", async () => {
    const spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
    await EmailService.sendPromotionNotificationToUser(
      "user@example.com",
      {
        firstName: "Jane",
        lastName: "Doe",
        oldRole: "Participant",
        newRole: "Leader",
      },
      {
        firstName: "Admin",
        lastName: "One",
        role: "Administrator",
        email: "admin@example.com",
      } as any
    );
    const args = spy.mock.calls[0][0];
    expect(args.subject).toContain("promoted to Leader");
    expect(args.html).toContain("Congratulations on Your Promotion");
    expect(args.html).toContain("Your New Capabilities");
    expect(args.html).toContain("Leader");
    expect(args.html).toContain("Explore Your New Dashboard");
  });

  it("sendPromotionNotificationToAdmins reflects impact and admin-focused content", async () => {
    const spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
    await EmailService.sendPromotionNotificationToAdmins(
      "admin@example.com",
      "Admin User",
      {
        firstName: "Alex",
        lastName: "User",
        email: "alex@example.com",
        oldRole: "Leader",
        newRole: "Administrator",
      },
      {
        firstName: "Root",
        lastName: "Admin",
        role: "Super Admin",
        email: "root@example.com",
      } as any
    );
    const args = spy.mock.calls[0][0];
    expect(args.subject).toContain("Admin Alert");
    expect(args.subject).toContain("User Promoted to Administrator");
    expect(args.html).toContain("Administrative Notification");
    expect(args.html).toContain("User Role Promotion Completed");
    expect(args.html).toContain("impact-badge");
  });

  it("sendEventCreatedEmail includes zoom link block when provided", async () => {
    const spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
    await EmailService.sendEventCreatedEmail("user@example.com", "Alex User", {
      title: "Planning Meeting",
      date: "2025-08-15",
      time: "10:00",
      endTime: "11:00",
      location: "Room 5",
      organizer: "Ops Team",
      purpose: "Plan Q4",
      format: "Online",
      zoomLink: "https://zoom.us/j/999",
    });
    const args = spy.mock.calls[0][0];
    expect(args.subject).toContain("New Event: Planning Meeting");
    expect(args.html).toContain("Join Link");
    expect(args.html).toContain("Online Meeting");
    expect(args.html).toContain("📍 Location:");
  });

  it("sendEventCreatedEmail omits zoom link when not provided and uses Location TBD fallback for non-online", async () => {
    const spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
    await EmailService.sendEventCreatedEmail("user@example.com", "Alex User", {
      title: "Retreat",
      date: "2025-09-01",
      time: "09:00",
      endTime: "17:00",
      organizer: "Leadership",
      purpose: "Team building",
      format: "In-Person",
    } as any);
    const args = spy.mock.calls[0][0];
    expect(args.html).not.toContain("Join Link");
    expect(args.html).toContain("Location:");
  });
});

// Additional branch coverage across templates
describe("EmailService additional branches", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
  });

  it("sendPromotionNotificationToUser covers Super Admin role content", async () => {
    const spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
    await EmailService.sendPromotionNotificationToUser(
      "user@example.com",
      {
        firstName: "Sam",
        lastName: "Root",
        oldRole: "Administrator",
        newRole: "Super Admin",
      },
      { firstName: "Boss", lastName: "Man", role: "Super Admin" }
    );
    const args = spy.mock.calls[0][0];
    expect(args.subject).toContain("promoted to Super Admin");
    expect(args.html).toContain("highest level of system administration");
    expect(args.html).toContain("Explore Your New Dashboard");
  });

  it("sendPromotionNotificationToUser covers default role content", async () => {
    const spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
    await EmailService.sendPromotionNotificationToUser(
      "user@example.com",
      {
        firstName: "Val",
        lastName: "Ue",
        oldRole: "Participant",
        newRole: "Volunteer",
      },
      { firstName: "Admin", lastName: "Two", role: "Administrator" }
    );
    const args = spy.mock.calls[0][0];
    expect(args.subject).toContain("promoted to Volunteer");
    expect(args.html).toContain("Welcome to your new role!");
  });

  it("sendPromotionNotificationToAdmins covers Super Admin impact High", async () => {
    const spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
    await EmailService.sendPromotionNotificationToAdmins(
      "admin@example.com",
      "Admin User",
      {
        firstName: "Prom",
        lastName: "Otee",
        email: "prom@example.com",
        oldRole: "Administrator",
        newRole: "Super Admin",
      },
      { firstName: "Root", lastName: "Admin", role: "Super Admin" }
    );
    const args = spy.mock.calls[0][0];
    expect(args.subject).toContain("User Promoted to Super Admin");
    expect(args.html).toContain("High Impact");
  });

  it("sendPromotionNotificationToAdmins covers default impact Standard", async () => {
    const spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
    await EmailService.sendPromotionNotificationToAdmins(
      "admin@example.com",
      "Admin User",
      {
        firstName: "Alex",
        lastName: "Volunteer",
        email: "alexv@example.com",
        oldRole: "Participant",
        newRole: "Volunteer Coordinator",
      },
      { firstName: "Root", lastName: "Admin", role: "Super Admin" }
    );
    const args = spy.mock.calls[0][0];
    expect(args.html).toContain("Standard");
  });

  it("sendDemotionNotificationToAdmins covers High impact (Administrator -> Participant)", async () => {
    const ok = await EmailService.sendDemotionNotificationToAdmins(
      "admin@example.com",
      "Admin Name",
      {
        _id: "3",
        firstName: "User",
        lastName: "Three",
        email: "user3@example.com",
        oldRole: "Administrator",
        newRole: "Participant",
      },
      {
        firstName: "Changer",
        lastName: "Z",
        email: "cz@example.com",
        role: "Admin",
      }
    );
    expect(ok).toBe(true);
  });

  it("sendDemotionNotificationToAdmins covers Medium impact (Leader -> Participant)", async () => {
    const ok = await EmailService.sendDemotionNotificationToAdmins(
      "admin@example.com",
      "Admin Name",
      {
        _id: "4",
        firstName: "User",
        lastName: "Four",
        email: "user4@example.com",
        oldRole: "Leader",
        newRole: "Participant",
      },
      {
        firstName: "Changer",
        lastName: "Z",
        email: "cz@example.com",
        role: "Admin",
      }
    );
    expect(ok).toBe(true);
  });

  it("sendEventCreatedEmail uses Location TBD when format is In-Person and location missing", async () => {
    const spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
    await EmailService.sendEventCreatedEmail("user@example.com", "Name", {
      title: "No Location Event",
      date: "2025-10-01",
      time: "10:00",
      endTime: "11:00",
      organizer: "Org",
      purpose: "Purpose",
      format: "In-Person",
    } as any);
    const args = spy.mock.calls[0][0];
    expect(args.html).toContain("Location TBD");
  });

  it("sendEventReminderEmail renders 24h (medium) urgency with Tomorrow message", async () => {
    const spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
    await EmailService.sendEventReminderEmail(
      "user@example.com",
      "Alex User",
      {
        title: "Workshop",
        date: "2025-08-20",
        time: "2:00 PM",
        format: "In-Person",
        location: "Room 101",
      },
      "24h"
    );
    const args = spy.mock.calls[0][0];
    expect(args.html).toContain("Tomorrow!");
    expect(args.subject).toContain("24 Hours");
  });
});
