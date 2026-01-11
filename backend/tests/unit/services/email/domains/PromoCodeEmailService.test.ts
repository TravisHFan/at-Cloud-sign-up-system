/**
 * PromoCodeEmailService Domain Test Suite
 *
 * Tests for all promo code-related email notifications:
 * - Staff promo code assignment (new codes granted to users)
 * - Promo code deactivation (code disabled by admin)
 * - Promo code reactivation (code re-enabled by admin)
 *
 * Tests the domain service directly without going through the facade.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock nodemailer to avoid external dependencies (must be before importing PromoCodeEmailService)
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
import { PromoCodeEmailService } from "../../../../../src/services/email/domains/PromoCodeEmailService";
import { EmailTransporter } from "../../../../../src/services/email/EmailTransporter";

describe("PromoCodeEmailService - Promo Code Email Operations", () => {
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

  describe("sendStaffPromoCodeEmail", () => {
    it("should send staff promo code with full details", async () => {
      // Arrange
      const params = {
        recipientEmail: "staff@example.com",
        recipientName: "Staff Member",
        promoCode: "STAFF20",
        discountPercent: 20,
        allowedPrograms: "Leadership Training",
        expiresAt: "2025-12-31",
        createdBy: "Admin User",
      };

      // Act
      const result = await PromoCodeEmailService.sendStaffPromoCodeEmail(
        params
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("staff@example.com");
      expect(emailCall.subject).toContain("Staff Access Code");
      expect(emailCall.html).toContain("Staff Member");
      expect(emailCall.html).toContain("STAFF20");
      expect(emailCall.html).toContain("20");
      expect(emailCall.html).toContain("Leadership Training");
      expect(emailCall.html).toContain("Admin User");
    });

    it("should handle promo code without expiration date", async () => {
      // Arrange
      const params = {
        recipientEmail: "user@example.com",
        recipientName: "Test User",
        promoCode: "NOEXPIRE",
        discountPercent: 15,
        createdBy: "Admin",
      };

      // Act
      await PromoCodeEmailService.sendStaffPromoCodeEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("never expires");
    });

    it("should handle promo code for all programs", async () => {
      // Arrange
      const params = {
        recipientEmail: "user@example.com",
        recipientName: "Test User",
        promoCode: "ALLPROGRAMS",
        discountPercent: 25,
        // allowedPrograms is optional
        createdBy: "Admin",
      };

      // Act
      await PromoCodeEmailService.sendStaffPromoCodeEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("all programs");
    });

    it("should include promo codes dashboard link", async () => {
      // Arrange
      const params = {
        recipientEmail: "user@example.com",
        recipientName: "Test User",
        promoCode: "TEST123",
        discountPercent: 10,
        createdBy: "Admin",
      };

      // Act
      await PromoCodeEmailService.sendStaffPromoCodeEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("/dashboard/promo-codes");
      expect(emailCall.html).toContain("http://localhost:5173");
    });

    it("should display promo code prominently", async () => {
      // Arrange
      const params = {
        recipientEmail: "user@example.com",
        recipientName: "Test User",
        promoCode: "BIGCODE2025",
        discountPercent: 30,
        createdBy: "Admin",
      };

      // Act
      await PromoCodeEmailService.sendStaffPromoCodeEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // Code should be in a styled code block
      expect(emailCall.html).toContain("BIGCODE2025");
      expect(emailCall.html).toContain("code");
    });

    it("should handle email sending failures", async () => {
      // Arrange
      mockTransporter.sendMail.mockRejectedValue(new Error("SMTP Error"));
      const params = {
        recipientEmail: "user@example.com",
        recipientName: "Test User",
        promoCode: "FAIL",
        discountPercent: 10,
        createdBy: "Admin",
      };

      // Act
      const result = await PromoCodeEmailService.sendStaffPromoCodeEmail(
        params
      );

      // Assert
      expect(result).toBe(false);
    });

    it("should send reward promo code with correct branding", async () => {
      // Arrange
      const params = {
        recipientEmail: "reward@example.com",
        recipientName: "Reward Recipient",
        promoCode: "REWARD10",
        discountPercent: 10,
        allowedPrograms: "All Programs",
        expiresAt: "2025-12-31",
        createdBy: "Admin User",
        codeType: "reward" as const,
      };

      // Act
      const result = await PromoCodeEmailService.sendStaffPromoCodeEmail(
        params
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("reward@example.com");
      expect(emailCall.subject).toContain("Reward Discount Code");
      expect(emailCall.html).toContain("Reward Discount Code");
      expect(emailCall.html).toContain("Reward Recipient");
      expect(emailCall.html).toContain("REWARD10");
      expect(emailCall.html).toContain("10");
    });

    it("should fallback to localhost URL when FRONTEND_URL is not set", async () => {
      // Arrange - Remove FRONTEND_URL to test fallback
      delete process.env.FRONTEND_URL;
      const params = {
        recipientEmail: "test@example.com",
        recipientName: "Test User",
        promoCode: "TEST20",
        discountPercent: 20,
        allowedPrograms: "Leadership Training",
        expiresAt: "2025-12-31",
        createdBy: "Admin User",
        codeType: "staff" as const,
      };

      // Act
      await PromoCodeEmailService.sendStaffPromoCodeEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("http://localhost:3000");
    });

    it("should fallback to 'All programs' when allowedPrograms is not set", async () => {
      // Arrange - No allowedPrograms in params
      const params = {
        recipientEmail: "test@example.com",
        recipientName: "Test User",
        promoCode: "ALLPROG20",
        discountPercent: 20,
        expiresAt: "2025-12-31",
        createdBy: "Admin User",
        codeType: "staff" as const,
      };

      // Act
      await PromoCodeEmailService.sendStaffPromoCodeEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("All programs");
      expect(emailCall.text).toContain("All programs");
    });
  });

  describe("sendPromoCodeDeactivatedEmail", () => {
    it("should send deactivation notification with full details", async () => {
      // Arrange
      const params = {
        recipientEmail: "user@example.com",
        recipientName: "Code Owner",
        promoCode: "DEACTIVATED20",
        discountPercent: 20,
        deactivatedBy: "Security Admin",
      };

      // Act
      const result = await PromoCodeEmailService.sendPromoCodeDeactivatedEmail(
        params
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("user@example.com");
      expect(emailCall.subject).toContain("Has Been Deactivated");
      expect(emailCall.html).toContain("Code Owner");
      expect(emailCall.html).toContain("DEACTIVATED20");
      expect(emailCall.html).toContain("Security Admin");
    });

    it("should handle deactivation without reason", async () => {
      // Arrange
      const params = {
        recipientEmail: "user@example.com",
        recipientName: "User",
        promoCode: "NOREASON",
        discountPercent: 15,
        // reason is optional
        deactivatedBy: "Admin",
      };

      // Act
      await PromoCodeEmailService.sendPromoCodeDeactivatedEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("NOREASON");
      // Should not crash without reason
      expect(emailCall.html).not.toContain("undefined");
    });

    it("should use warning styling for deactivation emails", async () => {
      // Arrange
      const params = {
        recipientEmail: "user@example.com",
        recipientName: "User",
        promoCode: "WARNING",
        discountPercent: 10,
        deactivatedBy: "Admin",
      };

      // Act
      await PromoCodeEmailService.sendPromoCodeDeactivatedEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // Should have warning/alert styling
      expect(emailCall.html).toContain("deactivated");
    });

    it("should handle email sending failures", async () => {
      // Arrange
      mockTransporter.sendMail.mockRejectedValue(
        new Error("Connection timeout")
      );
      const params = {
        recipientEmail: "user@example.com",
        recipientName: "User",
        promoCode: "FAIL",
        discountPercent: 10,
        deactivatedBy: "Admin",
      };

      // Act
      const result = await PromoCodeEmailService.sendPromoCodeDeactivatedEmail(
        params
      );

      // Assert
      expect(result).toBe(false);
    });

    it("should fallback to localhost URL when FRONTEND_URL is not set", async () => {
      // Arrange - Remove FRONTEND_URL to test fallback
      delete process.env.FRONTEND_URL;
      const params = {
        recipientEmail: "user@example.com",
        recipientName: "User",
        promoCode: "DEACT20",
        discountPercent: 20,
        deactivatedBy: "Admin",
      };

      // Act
      await PromoCodeEmailService.sendPromoCodeDeactivatedEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("http://localhost:3000");
    });
  });

  describe("sendPromoCodeReactivatedEmail", () => {
    it("should send reactivation notification with full details", async () => {
      // Arrange
      const params = {
        recipientEmail: "user@example.com",
        recipientName: "Code Owner",
        promoCode: "REACTIVATED20",
        discountPercent: 20,
        reactivatedBy: "Super Admin",
        expiresAt: "2025-12-31",
      };

      // Act
      const result = await PromoCodeEmailService.sendPromoCodeReactivatedEmail(
        params
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("user@example.com");
      expect(emailCall.subject).toContain("Has Been Reactivated");
      expect(emailCall.html).toContain("Code Owner");
      expect(emailCall.html).toContain("REACTIVATED20");
      expect(emailCall.html).toContain("Super Admin");
      expect(emailCall.html).toContain("2025");
    });

    it("should handle reactivation without new expiry date", async () => {
      // Arrange
      const params = {
        recipientEmail: "user@example.com",
        recipientName: "User",
        promoCode: "NOEXPIRY",
        discountPercent: 10,
        reactivatedBy: "Admin",
        // expiresAt is optional
      };

      // Act
      await PromoCodeEmailService.sendPromoCodeReactivatedEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("NOEXPIRY");
      // Should handle missing expiry gracefully
      expect(emailCall.html).toContain("reactivated");
    });

    it("should use positive styling for reactivation emails", async () => {
      // Arrange
      const params = {
        recipientEmail: "user@example.com",
        recipientName: "User",
        promoCode: "POSITIVE",
        discountPercent: 15,
        reactivatedBy: "Admin",
      };

      // Act
      await PromoCodeEmailService.sendPromoCodeReactivatedEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // Should have positive messaging
      expect(emailCall.html).toContain("reactivated");
      expect(emailCall.html).toContain("POSITIVE");
    });

    it("should include dashboard link for code management", async () => {
      // Arrange
      const params = {
        recipientEmail: "user@example.com",
        recipientName: "User",
        promoCode: "DASHBOARD",
        discountPercent: 10,
        reactivatedBy: "Admin",
      };

      // Act
      await PromoCodeEmailService.sendPromoCodeReactivatedEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("/dashboard");
    });

    it("should handle email sending failures", async () => {
      // Arrange
      mockTransporter.sendMail.mockRejectedValue(new Error("Network error"));
      const params = {
        recipientEmail: "user@example.com",
        recipientName: "User",
        promoCode: "FAIL",
        discountPercent: 10,
        reactivatedBy: "Admin",
      };

      // Act
      const result = await PromoCodeEmailService.sendPromoCodeReactivatedEmail(
        params
      );

      // Assert
      expect(result).toBe(false);
    });

    it("should fallback to localhost URL when FRONTEND_URL is not set", async () => {
      // Arrange - Remove FRONTEND_URL to test fallback
      delete process.env.FRONTEND_URL;
      const params = {
        recipientEmail: "user@example.com",
        recipientName: "User",
        promoCode: "REACT20",
        discountPercent: 20,
        reactivatedBy: "Admin",
      };

      // Act
      await PromoCodeEmailService.sendPromoCodeReactivatedEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("http://localhost:3000");
    });
  });

  describe("Integration with EmailTransporter", () => {
    it("should properly initialize EmailTransporter on first use", async () => {
      // Arrange
      const params = {
        recipientEmail: "user@example.com",
        recipientName: "User",
        promoCode: "INIT",
        discountPercent: 10,
        createdBy: "Admin",
      };

      // Act
      await PromoCodeEmailService.sendStaffPromoCodeEmail(params);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      const anyMailer: any = nodemailer as any;
      expect(anyMailer.createTransport).toHaveBeenCalled();
    });

    it("should reuse EmailTransporter for multiple promo code emails", async () => {
      // Arrange & Act
      await PromoCodeEmailService.sendStaffPromoCodeEmail({
        recipientEmail: "user1@example.com",
        recipientName: "User 1",
        promoCode: "CODE1",
        discountPercent: 10,
        createdBy: "Admin",
      });
      await PromoCodeEmailService.sendPromoCodeDeactivatedEmail({
        recipientEmail: "user2@example.com",
        recipientName: "User 2",
        promoCode: "CODE2",
        discountPercent: 15,
        deactivatedBy: "Admin",
      });
      await PromoCodeEmailService.sendPromoCodeReactivatedEmail({
        recipientEmail: "user3@example.com",
        recipientName: "User 3",
        promoCode: "CODE3",
        discountPercent: 20,
        reactivatedBy: "Admin",
      });

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
      // createTransport should only be called once (transporter reused)
      const anyMailer: any = nodemailer as any;
      expect(anyMailer.createTransport).toHaveBeenCalledTimes(1);
    });
  });
});
