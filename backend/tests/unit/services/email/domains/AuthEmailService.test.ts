/**
 * AuthEmailService Test Suite
 *
 * Tests authentication and account-related email notifications:
 * - Email verification
 * - Password reset flows
 * - Welcome messages
 * - Account status changes (activation/deactivation)
 *
 * Testing Strategy:
 * - Spy on AuthEmailService methods to test actual business logic
 * - Mock only external dependencies (EmailTransporter)
 * - Verify email content, subjects, and URLs match specifications
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EmailTransporter } from "../../../../../src/services/email/EmailTransporter";

// Mock nodemailer to avoid external dependencies
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
import { AuthEmailService } from "../../../../../src/services/email/domains/AuthEmailService";

describe("AuthEmailService - Authentication Email Operations", () => {
  let mockTransporter: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Setup production-like env to ensure emails actually send
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

    // Reset static transporter for clean state
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

  describe("sendVerificationEmail", () => {
    it("should send verification email with correct subject and content", async () => {
      // Act
      const result = await AuthEmailService.sendVerificationEmail(
        "newuser@example.com",
        "Test User",
        "test-verification-token-123"
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("newuser@example.com");
      expect(emailCall.subject).toBe(
        "Welcome to @Cloud Ministry - Please Verify Your Email"
      );
      expect(emailCall.html).toContain("Test User");
      expect(emailCall.html).toContain(
        "/verify-email/test-verification-token-123"
      );
      expect(emailCall.text).toContain("Please verify your email by visiting:");
    });

    it("should use custom FRONTEND_URL when set", async () => {
      // Arrange
      process.env.FRONTEND_URL = "https://custom-domain.com";

      // Act
      await AuthEmailService.sendVerificationEmail(
        "user@example.com",
        "User",
        "token456"
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain(
        "https://custom-domain.com/verify-email/token456"
      );
      expect(emailCall.text).toContain(
        "https://custom-domain.com/verify-email/token456"
      );
    });

    it("should handle email sending failure gracefully", async () => {
      // Arrange
      mockTransporter.sendMail.mockRejectedValue(
        new Error("SMTP connection failed")
      );

      // Act
      const result = await AuthEmailService.sendVerificationEmail(
        "fail@example.com",
        "Fail User",
        "token"
      );

      // Assert - EmailService catches errors and returns false
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        "❌ Email send failed:",
        expect.any(Error)
      );
    });
  });

  describe("sendPasswordResetEmail", () => {
    it("should send password reset email with correct subject and content", async () => {
      // Act
      const result = await AuthEmailService.sendPasswordResetEmail(
        "user@example.com",
        "John Doe",
        "reset-token-xyz"
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("user@example.com");
      expect(emailCall.subject).toBe(
        "Password Reset Request - @Cloud Ministry"
      );
      expect(emailCall.html).toContain("John Doe");
      expect(emailCall.html).toContain("/reset-password/reset-token-xyz");
      expect(emailCall.text).toContain("expires in 10 minutes");
    });

    it("should use correct default URL when FRONTEND_URL is not set", async () => {
      // Arrange
      delete process.env.FRONTEND_URL;

      // Act
      await AuthEmailService.sendPasswordResetEmail(
        "user@example.com",
        "User",
        "token"
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain(
        "http://localhost:5173/reset-password/token"
      );
    });
  });

  describe("sendPasswordChangeRequestEmail", () => {
    it("should send password change confirmation email", async () => {
      // Act
      const result = await AuthEmailService.sendPasswordChangeRequestEmail(
        "user@example.com",
        "Jane Smith",
        "confirm-token-abc"
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("user@example.com");
      expect(emailCall.subject).toBe(
        "Password Change Request - @Cloud Ministry"
      );
      expect(emailCall.html).toContain("Jane Smith");
      expect(emailCall.html).toContain(
        "/change-password/confirm/confirm-token-abc"
      );
      expect(emailCall.text).toContain("expires in 10 minutes");
    });
  });

  describe("sendPasswordResetSuccessEmail", () => {
    it("should send password reset success notification", async () => {
      // Act
      const result = await AuthEmailService.sendPasswordResetSuccessEmail(
        "user@example.com",
        "Bob Johnson"
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("user@example.com");
      expect(emailCall.subject).toBe(
        "Password Changed Successfully - @Cloud Ministry"
      );
      expect(emailCall.html).toContain("Bob Johnson");
      expect(emailCall.text).toContain("was changed successfully");
      expect(emailCall.text).toContain("contact support immediately");
    });

    it("should include current timestamp in email", async () => {
      // Arrange
      const beforeTime = new Date().getTime();

      // Act
      await AuthEmailService.sendPasswordResetSuccessEmail(
        "user@example.com",
        "User"
      );

      const afterTime = new Date().getTime();

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // Email should contain a date string (checking text contains date-like pattern)
      expect(emailCall.text).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/); // Date pattern
    });
  });

  describe("sendWelcomeEmail", () => {
    it("should send welcome email with dashboard link", async () => {
      // Act
      const result = await AuthEmailService.sendWelcomeEmail(
        "newuser@example.com",
        "Alice Wonder"
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("newuser@example.com");
      expect(emailCall.subject).toBe(
        "Welcome to @Cloud Ministry - Account Verified!"
      );
      expect(emailCall.html).toContain("Alice Wonder");
      expect(emailCall.html).toContain("/dashboard");
      expect(emailCall.text).toContain("Your account has been verified");
    });

    it("should use custom FRONTEND_URL for dashboard link", async () => {
      // Arrange
      process.env.FRONTEND_URL = "https://production.atcloud.com";

      // Act
      await AuthEmailService.sendWelcomeEmail("user@example.com", "User");

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain(
        "https://production.atcloud.com/dashboard"
      );
    });
  });

  describe("sendAccountDeactivationEmail", () => {
    it("should send account deactivation notification with admin info", async () => {
      // Arrange
      const deactivatedBy = {
        role: "Admin",
        firstName: "John",
        lastName: "Administrator",
      };

      // Act
      const result = await AuthEmailService.sendAccountDeactivationEmail(
        "user@example.com",
        "Deactivated User",
        deactivatedBy
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("user@example.com");
      expect(emailCall.subject).toBe("Account Deactivation Notification");
      expect(emailCall.html).toContain("Deactivated User");
      expect(emailCall.html).toContain("Admin");
      expect(emailCall.html).toContain("John Administrator");
      expect(emailCall.text).toContain(
        "your account has been deactivated by Admin John Administrator"
      );
      expect(emailCall.text).toContain("reach out to an Admin");
    });

    it("should handle missing actor first/last name gracefully", async () => {
      // Arrange
      const deactivatedBy = {
        role: "SuperAdmin",
        // No firstName or lastName
      };

      // Act
      await AuthEmailService.sendAccountDeactivationEmail(
        "user@example.com",
        "User",
        deactivatedBy
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("SuperAdmin");
      // Should handle empty name gracefully (just role shown)
      expect(emailCall.text).toContain("SuperAdmin");
    });

    it("should include proper HTML structure with styling", async () => {
      // Act
      await AuthEmailService.sendAccountDeactivationEmail(
        "user@example.com",
        "User",
        { role: "Admin", firstName: "Test", lastName: "Admin" }
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("<!DOCTYPE html>");
      expect(emailCall.html).toContain("<style>");
      expect(emailCall.html).toContain("background: linear-gradient");
      expect(emailCall.html).toContain("@Cloud Marketplace Ministry");
    });
  });

  describe("sendAccountReactivationEmail", () => {
    it("should send account reactivation notification with login link", async () => {
      // Arrange
      const reactivatedBy = {
        role: "Admin",
        firstName: "Sarah",
        lastName: "Manager",
      };

      // Act
      const result = await AuthEmailService.sendAccountReactivationEmail(
        "user@example.com",
        "Reactivated User",
        reactivatedBy
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("user@example.com");
      expect(emailCall.subject).toBe(
        "Your @Cloud Account Has Been Reactivated"
      );
      expect(emailCall.html).toContain("Reactivated User");
      expect(emailCall.html).toContain("Admin");
      expect(emailCall.html).toContain("Sarah Manager");
      expect(emailCall.html).toContain("/login");
      expect(emailCall.text).toContain("your account has been reactivated");
      expect(emailCall.text).toContain("Welcome back!");
    });

    it("should use correct FRONTEND_URL for login link", async () => {
      // Arrange
      process.env.FRONTEND_URL = "https://app.ministry.org";
      const reactivatedBy = { role: "Admin" };

      // Act
      await AuthEmailService.sendAccountReactivationEmail(
        "user@example.com",
        "User",
        reactivatedBy
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("https://app.ministry.org/login");
    });

    it("should include green gradient styling for positive message", async () => {
      // Act
      await AuthEmailService.sendAccountReactivationEmail(
        "user@example.com",
        "User",
        { role: "Admin" }
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("#28a745"); // Green color
      expect(emailCall.html).toContain("linear-gradient");
      expect(emailCall.html).toContain("button"); // Has login button
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle SMTP connection failures", async () => {
      // Arrange
      mockTransporter.sendMail.mockRejectedValue(
        new Error("Connection timeout")
      );

      // Act
      const result = await AuthEmailService.sendWelcomeEmail(
        "user@example.com",
        "User"
      );

      // Assert - EmailService catches errors and returns false
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        "❌ Email send failed:",
        expect.any(Error)
      );
    });

    it("should handle invalid email addresses gracefully", async () => {
      // Arrange
      mockTransporter.sendMail.mockRejectedValue(
        new Error("Invalid recipient")
      );

      // Act
      const result = await AuthEmailService.sendVerificationEmail(
        "not-an-email",
        "User",
        "token"
      );

      // Assert - EmailService catches errors and returns false
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        "❌ Email send failed:",
        expect.any(Error)
      );
    });

    it("should handle empty names gracefully", async () => {
      // Act
      const result = await AuthEmailService.sendWelcomeEmail(
        "user@example.com",
        ""
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      // Email should still be sent with empty name
    });

    it("should handle special characters in names", async () => {
      // Act
      const result = await AuthEmailService.sendWelcomeEmail(
        "user@example.com",
        "José O'Brien-García"
      );

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("José O'Brien-García");
    });
  });

  describe("Integration with EmailTransporter", () => {
    it("should properly initialize EmailTransporter on first use", async () => {
      // Act
      await AuthEmailService.sendWelcomeEmail("test@example.com", "Test");

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      // Transporter should be initialized with correct config
      expect(nodemailer.createTransport).toHaveBeenCalled();
    });

    it("should reuse EmailTransporter for multiple sends", async () => {
      // Act
      await AuthEmailService.sendWelcomeEmail("user1@example.com", "User 1");
      await AuthEmailService.sendWelcomeEmail("user2@example.com", "User 2");
      await AuthEmailService.sendWelcomeEmail("user3@example.com", "User 3");

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
      // Transporter should only be created once
      expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    });

    it("should fallback to localhost URL when FRONTEND_URL is not set", async () => {
      // Arrange - clear FRONTEND_URL to trigger fallback
      delete process.env.FRONTEND_URL;

      // Act
      await AuthEmailService.sendVerificationEmail(
        "test@example.com",
        "Test",
        "test-token-123"
      );

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // Should use fallback localhost URL
      expect(emailCall.html).toContain("http://localhost:5173");
      expect(emailCall.html).toContain("/verify-email/test-token-123");
    });
  });
});
