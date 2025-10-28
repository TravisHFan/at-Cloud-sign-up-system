/**
 * PurchaseEmailService Test Suite
 *
 * Tests purchase-related email notifications:
 * - Purchase confirmation emails
 * - Receipt and payment information
 * - Discount handling (Class Rep, Early Bird)
 * - Price calculations and formatting
 *
 * Testing Strategy:
 * - Spy on PurchaseEmailService methods to test actual business logic
 * - Mock only external dependencies (EmailTransporter)
 * - Verify email content includes all purchase details correctly
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
import { PurchaseEmailService } from "../../../../../src/services/email/domains/PurchaseEmailService";

describe("PurchaseEmailService - Purchase Email Operations", () => {
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

  describe("sendPurchaseConfirmationEmail", () => {
    it("should send purchase confirmation with full details", async () => {
      // Arrange
      const params = {
        email: "buyer@example.com",
        name: "John Buyer",
        orderNumber: "ORD-2025-001",
        programTitle: "Leadership Training Program",
        programType: "Online Course",
        purchaseDate: new Date("2025-01-15"),
        fullPrice: 29900, // $299.00 in cents
        finalPrice: 29900,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        isClassRep: false,
        isEarlyBird: false,
        receiptUrl: "https://example.com/receipt/abc123",
      };

      // Act
      const result = await PurchaseEmailService.sendPurchaseConfirmationEmail(
        params
      );

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe("buyer@example.com");
      expect(emailCall.subject).toContain("Enrollment Confirmed");
      expect(emailCall.html).toContain("John Buyer");
      expect(emailCall.html).toContain("ORD-2025-001");
      expect(emailCall.html).toContain("Leadership Training Program");
      expect(emailCall.html).toContain("Online Course");
      expect(emailCall.html).toContain("$299.00");
    });

    it("should apply and display Class Rep discount correctly", async () => {
      // Arrange
      const params = {
        email: "classrep@example.com",
        name: "Jane ClassRep",
        orderNumber: "ORD-2025-002",
        programTitle: "Workshop Series",
        programType: "In-Person Workshop",
        purchaseDate: new Date("2025-01-15"),
        fullPrice: 15000, // $150.00
        finalPrice: 13500, // $135.00 after 10% discount
        classRepDiscount: 1500, // $15.00 discount
        earlyBirdDiscount: 0,
        isClassRep: true,
        isEarlyBird: false,
        receiptUrl: "https://example.com/receipt/def456",
      };

      // Act
      const result = await PurchaseEmailService.sendPurchaseConfirmationEmail(
        params
      );

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("$150.00"); // Full price
      expect(emailCall.html).toContain("$135.00"); // Final price
      expect(emailCall.html).toContain("$15.00"); // Discount amount
      expect(emailCall.html).toContain("Class Rep"); // Badge or label
    });

    it("should apply and display Early Bird discount correctly", async () => {
      // Arrange
      const params = {
        email: "earlybird@example.com",
        name: "Bob EarlyBird",
        orderNumber: "ORD-2025-003",
        programTitle: "Advanced Training",
        programType: "Online Course",
        purchaseDate: new Date("2025-01-10"),
        fullPrice: 20000, // $200.00
        finalPrice: 16000, // $160.00 after 20% early bird
        classRepDiscount: 0,
        earlyBirdDiscount: 4000, // $40.00 discount
        isClassRep: false,
        isEarlyBird: true,
        receiptUrl: "https://example.com/receipt/ghi789",
      };

      // Act
      const result = await PurchaseEmailService.sendPurchaseConfirmationEmail(
        params
      );

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("$200.00"); // Full price
      expect(emailCall.html).toContain("$160.00"); // Final price
      expect(emailCall.html).toContain("$40.00"); // Discount amount
      expect(emailCall.html).toContain("Early Bird"); // Badge or label
    });

    it("should apply both Class Rep and Early Bird discounts when applicable", async () => {
      // Arrange
      const params = {
        email: "both@example.com",
        name: "Alice Saver",
        orderNumber: "ORD-2025-004",
        programTitle: "Premium Package",
        programType: "Bundle",
        purchaseDate: new Date("2025-01-05"),
        fullPrice: 50000, // $500.00
        finalPrice: 40000, // $400.00 after both discounts
        classRepDiscount: 5000, // $50.00
        earlyBirdDiscount: 5000, // $50.00
        isClassRep: true,
        isEarlyBird: true,
        receiptUrl: "https://example.com/receipt/jkl012",
      };

      // Act
      const result = await PurchaseEmailService.sendPurchaseConfirmationEmail(
        params
      );

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("$500.00"); // Full price
      expect(emailCall.html).toContain("$400.00"); // Final price
      expect(emailCall.html).toContain("$100.00"); // Total savings
      expect(emailCall.html).toContain("Class Rep");
      expect(emailCall.html).toContain("Early Bird");
    });

    it("should include receipt URL link", async () => {
      // Arrange
      const params = {
        email: "test@example.com",
        name: "Test User",
        orderNumber: "ORD-TEST",
        programTitle: "Test Program",
        programType: "Test Type",
        purchaseDate: new Date(),
        fullPrice: 10000,
        finalPrice: 10000,
        isClassRep: false,
        isEarlyBird: false,
        receiptUrl: "https://stripe.com/receipt/test123",
      };

      // Act
      await PurchaseEmailService.sendPurchaseConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("https://stripe.com/receipt/test123");
      expect(emailCall.html).toContain("View Receipt");
    });

    it("should format purchase date correctly", async () => {
      // Arrange
      const specificDate = new Date("2025-03-15T10:30:00Z");
      const params = {
        email: "test@example.com",
        name: "Test User",
        orderNumber: "ORD-DATE-TEST",
        programTitle: "Date Test Program",
        programType: "Test",
        purchaseDate: specificDate,
        fullPrice: 10000,
        finalPrice: 10000,
        isClassRep: false,
        isEarlyBird: false,
        receiptUrl: "https://example.com/receipt",
      };

      // Act
      await PurchaseEmailService.sendPurchaseConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      // Should contain formatted date like "March 15, 2025"
      expect(emailCall.html).toMatch(/March.*15.*2025/);
    });

    it("should format currency amounts correctly", async () => {
      // Arrange
      const params = {
        email: "test@example.com",
        name: "Test User",
        orderNumber: "ORD-CENTS",
        programTitle: "Currency Test",
        programType: "Test",
        purchaseDate: new Date(),
        fullPrice: 12345, // $123.45
        finalPrice: 12345,
        isClassRep: false,
        isEarlyBird: false,
        receiptUrl: "https://example.com/receipt",
      };

      // Act
      await PurchaseEmailService.sendPurchaseConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("$123.45");
    });

    it("should include proper HTML structure and styling", async () => {
      // Arrange
      const params = {
        email: "test@example.com",
        name: "Test User",
        orderNumber: "ORD-HTML",
        programTitle: "HTML Test",
        programType: "Test",
        purchaseDate: new Date(),
        fullPrice: 10000,
        finalPrice: 10000,
        isClassRep: false,
        isEarlyBird: false,
        receiptUrl: "https://example.com/receipt",
      };

      // Act
      await PurchaseEmailService.sendPurchaseConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("<!DOCTYPE html>");
      expect(emailCall.html).toContain("<style>");
      expect(emailCall.html).toContain("background: linear-gradient");
      expect(emailCall.html).toContain("@Cloud Ministry");
    });

    it("should include all expected content sections", async () => {
      // Arrange
      process.env.FRONTEND_URL = "https://production.atcloud.com";
      const params = {
        email: "test@example.com",
        name: "Test User",
        orderNumber: "ORD-URL",
        programTitle: "URL Test",
        programType: "Test",
        purchaseDate: new Date(),
        fullPrice: 10000,
        finalPrice: 10000,
        isClassRep: false,
        isEarlyBird: false,
        receiptUrl: "https://example.com/receipt",
      };

      // Act
      await PurchaseEmailService.sendPurchaseConfirmationEmail(params);

      // Assert - Verify email has all expected sections
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Thank You for Your Enrollment");
      expect(emailCall.html).toContain("Order Number");
      expect(emailCall.html).toContain("View Receipt");
      expect(emailCall.html).toContain("@Cloud Ministry");
    });

    it("should handle zero discounts gracefully", async () => {
      // Arrange
      const params = {
        email: "test@example.com",
        name: "Test User",
        orderNumber: "ORD-ZERO",
        programTitle: "Full Price Program",
        programType: "Test",
        purchaseDate: new Date(),
        fullPrice: 10000,
        finalPrice: 10000,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        isClassRep: false,
        isEarlyBird: false,
        receiptUrl: "https://example.com/receipt",
      };

      // Act
      const result = await PurchaseEmailService.sendPurchaseConfirmationEmail(
        params
      );

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("$100.00"); // Final price same as full price
    });

    it("should handle email sending failures", async () => {
      // Arrange
      mockTransporter.sendMail.mockRejectedValue(
        new Error("SMTP connection failed")
      );
      const params = {
        email: "test@example.com",
        name: "Test User",
        orderNumber: "ORD-FAIL",
        programTitle: "Test Program",
        programType: "Test",
        purchaseDate: new Date(),
        fullPrice: 10000,
        finalPrice: 10000,
        isClassRep: false,
        isEarlyBird: false,
        receiptUrl: "https://example.com/receipt",
      };

      // Act
      const result = await PurchaseEmailService.sendPurchaseConfirmationEmail(
        params
      );

      // Assert - EmailService catches errors and returns false
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        "❌ Email send failed:",
        expect.any(Error)
      );
    });

    it("should handle special characters in program title", async () => {
      // Arrange
      const params = {
        email: "test@example.com",
        name: "Test User",
        orderNumber: "ORD-SPECIAL",
        programTitle: "Advanced C++ & Design Patterns: The O'Reilly Guide",
        programType: "Online Course",
        purchaseDate: new Date(),
        fullPrice: 10000,
        finalPrice: 10000,
        isClassRep: false,
        isEarlyBird: false,
        receiptUrl: "https://example.com/receipt",
      };

      // Act
      const result = await PurchaseEmailService.sendPurchaseConfirmationEmail(
        params
      );

      // Assert
      expect(result).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("Advanced C++ & Design Patterns");
      expect(emailCall.html).toContain("O'Reilly");
    });

    it("should include order number prominently", async () => {
      // Arrange
      const params = {
        email: "test@example.com",
        name: "Test User",
        orderNumber: "ORD-2025-UNIQUE-12345",
        programTitle: "Test Program",
        programType: "Test",
        purchaseDate: new Date(),
        fullPrice: 10000,
        finalPrice: 10000,
        isClassRep: false,
        isEarlyBird: false,
        receiptUrl: "https://example.com/receipt",
      };

      // Act
      await PurchaseEmailService.sendPurchaseConfirmationEmail(params);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("ORD-2025-UNIQUE-12345");
      expect(emailCall.html).toContain("Order Number");
    });
  });

  describe("Integration with EmailTransporter", () => {
    it("should properly initialize EmailTransporter on first use", async () => {
      // Arrange
      const params = {
        email: "test@example.com",
        name: "Test",
        orderNumber: "ORD-TEST",
        programTitle: "Test",
        programType: "Test",
        purchaseDate: new Date(),
        fullPrice: 10000,
        finalPrice: 10000,
        isClassRep: false,
        isEarlyBird: false,
        receiptUrl: "https://example.com/receipt",
      };

      // Act
      await PurchaseEmailService.sendPurchaseConfirmationEmail(params);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      expect(nodemailer.createTransport).toHaveBeenCalled();
    });

    it("should reuse EmailTransporter for multiple purchases", async () => {
      // Arrange
      const params1 = {
        email: "buyer1@example.com",
        name: "Buyer 1",
        orderNumber: "ORD-001",
        programTitle: "Program 1",
        programType: "Course",
        purchaseDate: new Date(),
        fullPrice: 10000,
        finalPrice: 10000,
        isClassRep: false,
        isEarlyBird: false,
        receiptUrl: "https://example.com/receipt1",
      };

      const params2 = {
        ...params1,
        email: "buyer2@example.com",
        name: "Buyer 2",
        orderNumber: "ORD-002",
        receiptUrl: "https://example.com/receipt2",
      };

      const params3 = {
        ...params1,
        email: "buyer3@example.com",
        name: "Buyer 3",
        orderNumber: "ORD-003",
        receiptUrl: "https://example.com/receipt3",
      };

      // Act
      await PurchaseEmailService.sendPurchaseConfirmationEmail(params1);
      await PurchaseEmailService.sendPurchaseConfirmationEmail(params2);
      await PurchaseEmailService.sendPurchaseConfirmationEmail(params3);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
      // Transporter should only be created once
      expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    });
  });
});
