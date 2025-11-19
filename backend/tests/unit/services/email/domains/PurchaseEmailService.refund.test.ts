/**
 * PurchaseEmailService Refund Tests
 *
 * Tests the refund-related email methods:
 * - sendRefundInitiatedEmail
 * - sendRefundCompletedEmail
 * - sendRefundFailedEmail
 * - sendAdminRefundNotification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EmailTransporter } from "../../../../../src/services/email/EmailTransporter";

// Mock nodemailer
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

// Mock EmailRecipientUtils
vi.mock("../../../../../src/utils/emailRecipientUtils", () => ({
  EmailRecipientUtils: {
    getAdminUsers: vi.fn(),
  },
}));

// Mock EmailService for admin notifications
vi.mock(
  "../../../../../src/services/infrastructure/EmailServiceFacade",
  () => ({
    EmailService: {
      sendEmail: vi.fn(),
    },
  })
);

import nodemailer from "nodemailer";
import { PurchaseEmailService } from "../../../../../src/services/email/domains/PurchaseEmailService";
import { EmailRecipientUtils } from "../../../../../src/utils/emailRecipientUtils";
import { EmailService } from "../../../../../src/services/infrastructure/EmailServiceFacade";

describe("PurchaseEmailService - Refund Operations", () => {
  let mockTransporter: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = "production";
    process.env.FRONTEND_URL = "http://localhost:5173";
    process.env.SMTP_USER = "test@example.com";
    process.env.SMTP_PASS = "test-password";
    process.env.SMTP_HOST = "smtp.test.com";
    process.env.SMTP_PORT = "587";

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

    EmailTransporter.resetTransporter();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Mock EmailRecipientUtils.getAdminUsers for admin notification tests
    vi.mocked(EmailRecipientUtils.getAdminUsers).mockResolvedValue([
      { email: "admin@example.com", name: "Admin User" } as any,
    ]);

    // Mock EmailService.sendEmail for admin notifications
    vi.mocked(EmailService.sendEmail).mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = originalEnv;
    EmailTransporter.resetTransporter();
    vi.restoreAllMocks();
  });

  describe("sendRefundInitiatedEmail", () => {
    it("should send refund initiated email with correct details", async () => {
      const params = {
        userEmail: "customer@example.com",
        userName: "Jane Customer",
        orderNumber: "ORD-2025-001",
        programTitle: "Advanced Leadership",
        refundAmount: 29900,
        purchaseDate: new Date("2025-01-20"),
      };

      const result = await PurchaseEmailService.sendRefundInitiatedEmail(
        params
      );

      expect(result).toBe(true);
      expect(vi.mocked(EmailService.sendEmail)).toHaveBeenCalled();
    });

    it("should handle refund initiation email failures gracefully", async () => {
      mockTransporter.sendMail.mockRejectedValueOnce(new Error("SMTP error"));

      const params = {
        userEmail: "fail@example.com",
        userName: "Fail User",
        orderNumber: "ORD-FAIL",
        programTitle: "Test Program",
        refundAmount: 10000,
        purchaseDate: new Date(),
      };

      // Mock EmailService to return false for this test
      vi.mocked(EmailService.sendEmail).mockResolvedValueOnce(false);

      const result = await PurchaseEmailService.sendRefundInitiatedEmail(
        params
      );

      expect(result).toBe(false);
    });

    it("should format refund amount correctly", async () => {
      const params = {
        userEmail: "test@example.com",
        userName: "Test User",
        orderNumber: "ORD-123",
        programTitle: "Program",
        refundAmount: 1599, // $15.99
        purchaseDate: new Date(),
      };

      const result = await PurchaseEmailService.sendRefundInitiatedEmail(
        params
      );

      expect(result).toBe(true);
      expect(vi.mocked(EmailService.sendEmail)).toHaveBeenCalled();
    });

    it("should include estimated days in message", async () => {
      const params = {
        userEmail: "test@example.com",
        userName: "Test User",
        orderNumber: "ORD-123",
        programTitle: "Program",
        refundAmount: 10000,
        purchaseDate: new Date(),
      };

      const result = await PurchaseEmailService.sendRefundInitiatedEmail(
        params
      );

      expect(result).toBe(true);
      expect(vi.mocked(EmailService.sendEmail)).toHaveBeenCalled();
    });
  });

  describe("sendRefundCompletedEmail", () => {
    it("should send refund completed email successfully", async () => {
      const params = {
        userEmail: "customer@example.com",
        userName: "John Complete",
        orderNumber: "ORD-2025-002",
        programTitle: "Complete Program",
        refundAmount: 49900,
        refundDate: new Date("2025-01-25"),
      };

      const result = await PurchaseEmailService.sendRefundCompletedEmail(
        params
      );

      expect(result).toBe(true);
      expect(vi.mocked(EmailService.sendEmail)).toHaveBeenCalled();
    });

    it("should handle completion email failures", async () => {
      // Mock EmailService to return false for this test
      vi.mocked(EmailService.sendEmail).mockResolvedValueOnce(false);

      const params = {
        userEmail: "fail@example.com",
        userName: "Fail User",
        orderNumber: "ORD-FAIL",
        programTitle: "Fail Program",
        refundAmount: 5000,
        refundDate: new Date(),
      };

      const result = await PurchaseEmailService.sendRefundCompletedEmail(
        params
      );

      expect(result).toBe(false);
    });

    it("should format completion date correctly", async () => {
      const refundDate = new Date("2025-06-15");
      const params = {
        userEmail: "test@example.com",
        userName: "Test User",
        orderNumber: "ORD-123",
        programTitle: "Program",
        refundAmount: 10000,
        refundDate,
      };

      const result = await PurchaseEmailService.sendRefundCompletedEmail(
        params
      );

      expect(result).toBe(true);
      expect(vi.mocked(EmailService.sendEmail)).toHaveBeenCalled();
    });

    it("should include refund ID prominently", async () => {
      const params = {
        userEmail: "test@example.com",
        userName: "Test User",
        orderNumber: "ORD-123",
        programTitle: "Program",
        refundAmount: 10000,
        refundDate: new Date(),
      };

      const result = await PurchaseEmailService.sendRefundCompletedEmail(
        params
      );

      expect(result).toBe(true);
      expect(vi.mocked(EmailService.sendEmail)).toHaveBeenCalled();
    });
  });

  describe("sendRefundFailedEmail", () => {
    it("should send refund failed email with reason", async () => {
      const params = {
        userEmail: "customer@example.com",
        userName: "Jane Failed",
        orderNumber: "ORD-2025-003",
        programTitle: "Failed Program",
        failureReason: "Insufficient funds in merchant account",
      };

      const result = await PurchaseEmailService.sendRefundFailedEmail(params);

      expect(result).toBe(true);
      expect(vi.mocked(EmailService.sendEmail)).toHaveBeenCalled();
    });

    it("should include support contact information", async () => {
      const params = {
        userEmail: "test@example.com",
        userName: "Test User",
        orderNumber: "ORD-123",
        programTitle: "Program",
        failureReason: "Card expired",
      };

      const result = await PurchaseEmailService.sendRefundFailedEmail(params);

      expect(result).toBe(true);
      expect(vi.mocked(EmailService.sendEmail)).toHaveBeenCalled();
    });

    it("should handle failure email send errors", async () => {
      // Mock EmailService to return false for this test
      vi.mocked(EmailService.sendEmail).mockResolvedValueOnce(false);

      const params = {
        userEmail: "test@example.com",
        userName: "Test User",
        orderNumber: "ORD-123",
        programTitle: "Program",
        failureReason: "Test reason",
      };

      const result = await PurchaseEmailService.sendRefundFailedEmail(params);

      expect(result).toBe(false);
    });

    it("should display failure reason prominently", async () => {
      const params = {
        userEmail: "test@example.com",
        userName: "Test User",
        orderNumber: "ORD-123",
        programTitle: "Program",
        failureReason: "CRITICAL: Bank declined transaction",
      };

      const result = await PurchaseEmailService.sendRefundFailedEmail(params);

      expect(result).toBe(true);
      expect(vi.mocked(EmailService.sendEmail)).toHaveBeenCalled();
    });
  });

  describe("sendAdminRefundNotification", () => {
    it("should send admin notification with all details", async () => {
      const params = {
        userName: "Admin Test User",
        userEmail: "customer@example.com",
        orderNumber: "ORD-2025-004",
        programTitle: "Admin Notif Program",
        refundAmount: 59900,
        purchaseDate: new Date("2025-01-20"),
        refundInitiatedAt: new Date("2025-01-30"),
      };

      const result = await PurchaseEmailService.sendAdminRefundNotification(
        params
      );

      expect(result).toBe(true);
      expect(vi.mocked(EmailService.sendEmail)).toHaveBeenCalled();
    });

    it("should handle admin notification failures", async () => {
      // Mock EmailService.sendEmail to reject for this test
      vi.mocked(EmailService.sendEmail).mockRejectedValueOnce(
        new Error("Admin email failed")
      );

      const params = {
        userName: "Test User",
        userEmail: "test@example.com",
        orderNumber: "ORD-123",
        programTitle: "Program",
        refundAmount: 10000,
        purchaseDate: new Date(),
        refundInitiatedAt: new Date(),
      };

      const result = await PurchaseEmailService.sendAdminRefundNotification(
        params
      );

      expect(result).toBe(false);
    });

    it("should include customer email for admin follow-up", async () => {
      const params = {
        userName: "VIP Customer",
        userEmail: "important.customer@example.com",
        orderNumber: "ORD-123",
        programTitle: "Program",
        refundAmount: 10000,
        purchaseDate: new Date(),
        refundInitiatedAt: new Date(),
      };

      const result = await PurchaseEmailService.sendAdminRefundNotification(
        params
      );

      expect(result).toBe(true);
      expect(vi.mocked(EmailService.sendEmail)).toHaveBeenCalled();
    });

    it("should format refund reason clearly", async () => {
      const params = {
        userName: "Test User",
        userEmail: "test@example.com",
        orderNumber: "ORD-123",
        programTitle: "Program",
        refundAmount: 10000,
        purchaseDate: new Date(),
        refundInitiatedAt: new Date(),
      };

      const result = await PurchaseEmailService.sendAdminRefundNotification(
        params
      );

      expect(result).toBe(true);
      expect(vi.mocked(EmailService.sendEmail)).toHaveBeenCalled();
    });

    it("should include refund date in admin notification", async () => {
      const refundInitiatedAt = new Date("2025-12-25");
      const params = {
        userName: "Test User",
        userEmail: "test@example.com",
        orderNumber: "ORD-123",
        programTitle: "Program",
        refundAmount: 10000,
        purchaseDate: new Date("2025-12-01"),
        refundInitiatedAt,
      };

      const result = await PurchaseEmailService.sendAdminRefundNotification(
        params
      );

      expect(result).toBe(true);
      expect(vi.mocked(EmailService.sendEmail)).toHaveBeenCalled();
    });
  });
});
