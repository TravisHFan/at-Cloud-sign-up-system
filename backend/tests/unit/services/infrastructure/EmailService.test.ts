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
