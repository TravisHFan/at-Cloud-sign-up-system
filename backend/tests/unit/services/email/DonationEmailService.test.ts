/**
 * Unit tests for DonationEmailService
 *
 * Tests email functionality for donation receipts:
 * - One-time donation receipts
 * - Recurring donation receipts (first payment)
 * - Recurring donation receipts (subsequent payments)
 * - Email content and formatting
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { DonationEmailService } from "../../../../src/services/email/domains/DonationEmailService";

// Mock EmailServiceFacade
vi.mock("../../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendEmail: vi.fn().mockResolvedValue(true),
  },
}));

describe("DonationEmailService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendDonationReceipt - One-time Donations", () => {
    it("should send receipt email for one-time donation", async () => {
      const { EmailService } = await import(
        "../../../../src/services/infrastructure/EmailServiceFacade"
      );

      const result = await DonationEmailService.sendDonationReceipt({
        email: "donor@test.com",
        name: "John Doe",
        amount: 10000, // $100.00 in cents
        type: "one-time",
        transactionDate: new Date("2025-11-11T12:00:00Z"),
      });

      expect(result).toBe(true);
      expect(EmailService.sendEmail).toHaveBeenCalledOnce();

      const emailCall = vi.mocked(EmailService.sendEmail).mock.calls[0][0];
      expect(emailCall.to).toBe("donor@test.com");
      expect(emailCall.subject).toBe("Thank You for Your Donation!");
      expect(emailCall.html).toContain("Donation Received");
      expect(emailCall.html).toContain("One-time");
      expect(emailCall.html).toContain("$100.00");
      expect(emailCall.html).toContain(
        "Thank you for your generous one-time donation"
      );
      expect(emailCall.html).toContain("View Donation History");
      expect(emailCall.html).toContain("Tax Deductible");
    });

    it("should format amount correctly in email", async () => {
      const { EmailService } = await import(
        "../../../../src/services/infrastructure/EmailServiceFacade"
      );

      await DonationEmailService.sendDonationReceipt({
        email: "donor@test.com",
        name: "Jane Doe",
        amount: 2550, // $25.50 in cents
        type: "one-time",
        transactionDate: new Date(),
      });

      const emailCall = vi.mocked(EmailService.sendEmail).mock.calls[0][0];
      expect(emailCall.html).toContain("$25.50");
    });

    it("should include payment method details when provided", async () => {
      const { EmailService } = await import(
        "../../../../src/services/infrastructure/EmailServiceFacade"
      );

      await DonationEmailService.sendDonationReceipt({
        email: "donor@test.com",
        name: "Test Donor",
        amount: 5000,
        type: "one-time",
        transactionDate: new Date(),
        paymentMethod: {
          cardBrand: "visa",
          last4: "4242",
        },
      });

      const emailCall = vi.mocked(EmailService.sendEmail).mock.calls[0][0];
      expect(emailCall.html).toContain("Visa");
      expect(emailCall.html).toContain("4242");
    });
  });

  describe("sendDonationReceipt - Recurring Donations (First Payment)", () => {
    it("should send welcome email for first recurring payment", async () => {
      const { EmailService } = await import(
        "../../../../src/services/infrastructure/EmailServiceFacade"
      );

      const result = await DonationEmailService.sendDonationReceipt({
        email: "recurring@test.com",
        name: "Recurring Donor",
        amount: 2500, // $25.00
        type: "recurring",
        frequency: "weekly",
        transactionDate: new Date(),
        isFirstPayment: true,
      });

      expect(result).toBe(true);
      expect(EmailService.sendEmail).toHaveBeenCalledOnce();

      const emailCall = vi.mocked(EmailService.sendEmail).mock.calls[0][0];
      expect(emailCall.to).toBe("recurring@test.com");
      expect(emailCall.subject).toBe("Thank You for Your Recurring Donation!");
      expect(emailCall.html).toContain("Recurring Donation Started");
      expect(emailCall.html).toContain("weekly recurring donation");
      expect(emailCall.html).toContain("first gift has been processed");
      expect(emailCall.html).toContain("Recurring (Weekly)");
      expect(emailCall.html).toContain("$25.00");
    });

    it("should handle all frequency types for first payment", async () => {
      const { EmailService } = await import(
        "../../../../src/services/infrastructure/EmailServiceFacade"
      );
      const frequencies: Array<
        "weekly" | "biweekly" | "monthly" | "quarterly" | "annually"
      > = ["weekly", "biweekly", "monthly", "quarterly", "annually"];

      const expectedTexts: Record<string, string> = {
        weekly: "weekly recurring donation",
        biweekly: "bi-weekly recurring donation", // Note: formatted with hyphen
        monthly: "monthly recurring donation",
        quarterly: "quarterly recurring donation",
        annually: "annually recurring donation",
      };

      for (const frequency of frequencies) {
        vi.clearAllMocks();

        await DonationEmailService.sendDonationReceipt({
          email: "test@test.com",
          name: "Test",
          amount: 1000,
          type: "recurring",
          frequency,
          transactionDate: new Date(),
          isFirstPayment: true,
        });

        const emailCall = vi.mocked(EmailService.sendEmail).mock.calls[0][0];
        expect(emailCall.html).toContain(expectedTexts[frequency]);
      }
    });
  });

  describe("sendDonationReceipt - Recurring Donations (Subsequent Payments)", () => {
    it("should send payment confirmation for recurring payment", async () => {
      const { EmailService } = await import(
        "../../../../src/services/infrastructure/EmailServiceFacade"
      );

      const result = await DonationEmailService.sendDonationReceipt({
        email: "recurring@test.com",
        name: "Recurring Donor",
        amount: 2500,
        type: "recurring",
        frequency: "monthly",
        transactionDate: new Date(),
        isFirstPayment: false, // Subsequent payment
      });

      expect(result).toBe(true);
      expect(EmailService.sendEmail).toHaveBeenCalledOnce();

      const emailCall = vi.mocked(EmailService.sendEmail).mock.calls[0][0];
      expect(emailCall.to).toBe("recurring@test.com");
      expect(emailCall.subject).toBe("Recurring Donation Processed");
      expect(emailCall.html).toContain("Recurring Donation Payment");
      expect(emailCall.html).toContain("processed successfully");
      expect(emailCall.html).toContain("continued support");
      expect(emailCall.html).toContain("Recurring (Monthly)");
    });

    it("should differentiate between first and subsequent payments in email", async () => {
      const { EmailService } = await import(
        "../../../../src/services/infrastructure/EmailServiceFacade"
      );

      // First payment
      await DonationEmailService.sendDonationReceipt({
        email: "test@test.com",
        name: "Test",
        amount: 1000,
        type: "recurring",
        frequency: "weekly",
        transactionDate: new Date(),
        isFirstPayment: true,
      });

      const firstEmail = vi.mocked(EmailService.sendEmail).mock.calls[0][0];

      vi.clearAllMocks();

      // Subsequent payment
      await DonationEmailService.sendDonationReceipt({
        email: "test@test.com",
        name: "Test",
        amount: 1000,
        type: "recurring",
        frequency: "weekly",
        transactionDate: new Date(),
        isFirstPayment: false,
      });

      const subsequentEmail = vi.mocked(EmailService.sendEmail).mock
        .calls[0][0];

      // Verify different subjects
      expect(firstEmail.subject).toBe("Thank You for Your Recurring Donation!");
      expect(subsequentEmail.subject).toBe("Recurring Donation Processed");

      // Verify different messages
      expect(firstEmail.html).toContain("Recurring Donation Started");
      expect(subsequentEmail.html).toContain("Recurring Donation Payment");
    });
  });

  describe("Email Content and Formatting", () => {
    it("should include tax deductible notice", async () => {
      const { EmailService } = await import(
        "../../../../src/services/infrastructure/EmailServiceFacade"
      );

      await DonationEmailService.sendDonationReceipt({
        email: "test@test.com",
        name: "Test",
        amount: 1000,
        type: "one-time",
        transactionDate: new Date(),
      });

      const emailCall = vi.mocked(EmailService.sendEmail).mock.calls[0][0];
      expect(emailCall.html).toContain("Tax Deductible");
      expect(emailCall.html).toContain(
        "tax-deductible to the extent allowed by law"
      );
      expect(emailCall.html).toContain(
        "keep this receipt for your tax records"
      );
    });

    it("should include link to donation history", async () => {
      const { EmailService } = await import(
        "../../../../src/services/infrastructure/EmailServiceFacade"
      );

      await DonationEmailService.sendDonationReceipt({
        email: "test@test.com",
        name: "Test",
        amount: 1000,
        type: "one-time",
        transactionDate: new Date(),
      });

      const emailCall = vi.mocked(EmailService.sendEmail).mock.calls[0][0];
      expect(emailCall.html).toContain("View Donation History");
      expect(emailCall.html).toContain("/dashboard/donate");
      expect(emailCall.html).toContain(
        "For a detailed donation history for any year"
      );
    });

    it("should include both HTML and plain text versions", async () => {
      const { EmailService } = await import(
        "../../../../src/services/infrastructure/EmailServiceFacade"
      );

      await DonationEmailService.sendDonationReceipt({
        email: "test@test.com",
        name: "Test",
        amount: 5000,
        type: "one-time",
        transactionDate: new Date(),
      });

      const emailCall = vi.mocked(EmailService.sendEmail).mock.calls[0][0];
      expect(emailCall.html).toBeDefined();
      expect(emailCall.text).toBeDefined();

      // Check plain text version has key content
      expect(emailCall.text).toContain("DONATION RECEIPT");
      expect(emailCall.text).toContain("$50.00");
      expect(emailCall.text).toContain("TAX DEDUCTIBLE");
    });

    it("should format transaction date correctly", async () => {
      const { EmailService } = await import(
        "../../../../src/services/infrastructure/EmailServiceFacade"
      );

      const testDate = new Date("2025-11-11T15:30:00Z");

      await DonationEmailService.sendDonationReceipt({
        email: "test@test.com",
        name: "Test",
        amount: 1000,
        type: "one-time",
        transactionDate: testDate,
      });

      const emailCall = vi.mocked(EmailService.sendEmail).mock.calls[0][0];
      // Should contain formatted date (format depends on locale)
      expect(emailCall.html).toContain("Transaction Date:");
      expect(emailCall.html).toMatch(/November|Nov/); // Month should be formatted
      expect(emailCall.html).toContain("2025");
    });

    it("should handle missing payment method gracefully", async () => {
      const { EmailService } = await import(
        "../../../../src/services/infrastructure/EmailServiceFacade"
      );

      await DonationEmailService.sendDonationReceipt({
        email: "test@test.com",
        name: "Test",
        amount: 1000,
        type: "one-time",
        transactionDate: new Date(),
        // No paymentMethod provided
      });

      const emailCall = vi.mocked(EmailService.sendEmail).mock.calls[0][0];
      expect(emailCall.html).toContain("Card"); // Default payment method text
    });
  });

  describe("Error Handling", () => {
    it("should handle email send failure gracefully", async () => {
      const { EmailService } = await import(
        "../../../../src/services/infrastructure/EmailServiceFacade"
      );

      // Mock email service to fail
      vi.mocked(EmailService.sendEmail).mockResolvedValueOnce(false);

      const result = await DonationEmailService.sendDonationReceipt({
        email: "test@test.com",
        name: "Test",
        amount: 1000,
        type: "one-time",
        transactionDate: new Date(),
      });

      expect(result).toBe(false);
    });
  });
});
