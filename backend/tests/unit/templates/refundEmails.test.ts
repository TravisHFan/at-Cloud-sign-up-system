/**
 * Unit tests for refund email templates
 */
import { describe, it, expect } from "vitest";
import {
  generateRefundCompletedEmail,
  RefundCompletedEmailData,
} from "../../../src/templates/email/refundCompletedEmail";
import {
  generateRefundInitiatedEmail,
  RefundInitiatedEmailData,
} from "../../../src/templates/email/refundInitiatedEmail";
import {
  generateRefundFailedEmail,
  RefundFailedEmailData,
} from "../../../src/templates/email/refundFailedEmail";
import {
  generateAdminRefundNotificationEmail,
  AdminRefundNotificationEmailData,
} from "../../../src/templates/email/adminRefundNotificationEmail";

describe("Refund Email Templates", () => {
  describe("generateRefundCompletedEmail", () => {
    it("should generate email with all required fields", () => {
      const data: RefundCompletedEmailData = {
        userName: "John Doe",
        orderNumber: "ORD-12345",
        programTitle: "Sunday Service",
        refundAmount: 5000, // $50.00
        refundDate: new Date("2025-11-12"),
      };

      const result = generateRefundCompletedEmail(data);

      expect(result).toContain("<!DOCTYPE html>");
      expect(result).toContain("Refund Completed");
      expect(result).toContain("John Doe");
      expect(result).toContain("ORD-12345");
      expect(result).toContain("Sunday Service");
      expect(result).toContain("$50.00");
    });

    it("should format refund amount correctly (cents to dollars)", () => {
      const data: RefundCompletedEmailData = {
        userName: "Jane Smith",
        orderNumber: "ORD-67890",
        programTitle: "Bible Study",
        refundAmount: 12599, // $125.99
        refundDate: new Date("2025-11-15"),
      };

      const result = generateRefundCompletedEmail(data);

      expect(result).toContain("$125.99");
    });

    it("should format date correctly", () => {
      const data: RefundCompletedEmailData = {
        userName: "Test User",
        orderNumber: "ORD-111",
        programTitle: "Workshop",
        refundAmount: 1000,
        refundDate: new Date("2025-12-25"),
      };

      const result = generateRefundCompletedEmail(data);

      expect(result).toContain("December");
      expect(result).toContain("2025");
    });

    it("should include refund processing information", () => {
      const data: RefundCompletedEmailData = {
        userName: "User",
        orderNumber: "ORD-222",
        programTitle: "Event",
        refundAmount: 2500,
        refundDate: new Date("2025-11-12"),
      };

      const result = generateRefundCompletedEmail(data);

      expect(result).toContain("5-10 business days");
      expect(result).toContain("original payment method");
    });

    it("should include success icon and styling", () => {
      const data: RefundCompletedEmailData = {
        userName: "User",
        orderNumber: "ORD-333",
        programTitle: "Program",
        refundAmount: 3000,
        refundDate: new Date("2025-11-12"),
      };

      const result = generateRefundCompletedEmail(data);

      expect(result).toContain("✓");
      expect(result).toContain("✅");
      expect(result).toContain("success-icon");
      expect(result).toContain("#10b981"); // Green color
    });

    it("should include contact information", () => {
      const data: RefundCompletedEmailData = {
        userName: "User",
        orderNumber: "ORD-444",
        programTitle: "Program",
        refundAmount: 4000,
        refundDate: new Date("2025-11-12"),
      };

      const result = generateRefundCompletedEmail(data);

      expect(result).toContain("@Cloud Ministry");
      expect(result).toContain("atcloudministry@gmail.com");
    });

    it("should handle zero amount refund", () => {
      const data: RefundCompletedEmailData = {
        userName: "User",
        orderNumber: "ORD-555",
        programTitle: "Free Event",
        refundAmount: 0,
        refundDate: new Date("2025-11-12"),
      };

      const result = generateRefundCompletedEmail(data);

      expect(result).toContain("$0.00");
    });

    it("should handle large refund amounts", () => {
      const data: RefundCompletedEmailData = {
        userName: "User",
        orderNumber: "ORD-666",
        programTitle: "Premium Package",
        refundAmount: 999999, // $9,999.99
        refundDate: new Date("2025-11-12"),
      };

      const result = generateRefundCompletedEmail(data);

      expect(result).toContain("$9999.99");
    });
  });

  describe("generateRefundInitiatedEmail", () => {
    it("should generate email with all required fields", () => {
      const data: RefundInitiatedEmailData = {
        userName: "Alice Johnson",
        orderNumber: "ORD-INIT-001",
        programTitle: "Youth Conference",
        refundAmount: 7500, // $75.00
        purchaseDate: new Date("2025-10-15"),
      };

      const result = generateRefundInitiatedEmail(data);

      expect(result).toContain("<!DOCTYPE html>");
      expect(result).toContain("Refund Request Received");
      expect(result).toContain("Alice Johnson");
      expect(result).toContain("ORD-INIT-001");
      expect(result).toContain("Youth Conference");
      expect(result).toContain("$75.00");
    });

    it("should format purchase date correctly", () => {
      const data: RefundInitiatedEmailData = {
        userName: "User",
        orderNumber: "ORD-INIT-002",
        programTitle: "Program",
        refundAmount: 5000,
        purchaseDate: new Date("2025-01-15T12:00:00.000Z"),
      };

      const result = generateRefundInitiatedEmail(data);

      // Date should be formatted in US locale (Month Day, Year)
      expect(result).toContain("January 15, 2025");
    });

    it("should include what happens next information", () => {
      const data: RefundInitiatedEmailData = {
        userName: "User",
        orderNumber: "ORD-INIT-003",
        programTitle: "Program",
        refundAmount: 3000,
        purchaseDate: new Date("2025-11-12"),
      };

      const result = generateRefundInitiatedEmail(data);

      expect(result).toContain("What happens next?");
      expect(result).toContain("being processed");
      expect(result).toContain("confirmation email");
      expect(result).toContain("5-10 business days");
    });

    it("should use appropriate styling for initiated status", () => {
      const data: RefundInitiatedEmailData = {
        userName: "User",
        orderNumber: "ORD-INIT-004",
        programTitle: "Program",
        refundAmount: 2000,
        purchaseDate: new Date("2025-11-12"),
      };

      const result = generateRefundInitiatedEmail(data);

      expect(result).toContain("#667eea"); // Purple color
      expect(result).toContain("notice");
      expect(result).toContain("#ffc107"); // Warning yellow
    });

    it("should include support contact information", () => {
      const data: RefundInitiatedEmailData = {
        userName: "User",
        orderNumber: "ORD-INIT-005",
        programTitle: "Program",
        refundAmount: 1000,
        purchaseDate: new Date("2025-11-12"),
      };

      const result = generateRefundInitiatedEmail(data);

      expect(result).toContain("support team");
      expect(result).toContain("@Cloud Ministry");
      expect(result).toContain("atcloudministry@gmail.com");
    });

    it("should format small amounts correctly", () => {
      const data: RefundInitiatedEmailData = {
        userName: "User",
        orderNumber: "ORD-INIT-006",
        programTitle: "Program",
        refundAmount: 150, // $1.50
        purchaseDate: new Date("2025-11-12"),
      };

      const result = generateRefundInitiatedEmail(data);

      expect(result).toContain("$1.50");
    });
  });

  describe("generateRefundFailedEmail", () => {
    it("should generate email with all required fields", () => {
      const data: RefundFailedEmailData = {
        userName: "Bob Williams",
        orderNumber: "ORD-FAIL-001",
        programTitle: "Prayer Meeting",
        failureReason: "Payment method no longer valid",
      };

      const result = generateRefundFailedEmail(data);

      expect(result).toContain("<!DOCTYPE html>");
      expect(result).toContain("Refund Request Failed");
      expect(result).toContain("Bob Williams");
      expect(result).toContain("ORD-FAIL-001");
      expect(result).toContain("Prayer Meeting");
      expect(result).toContain("Payment method no longer valid");
    });

    it("should display the failure reason prominently", () => {
      const data: RefundFailedEmailData = {
        userName: "User",
        orderNumber: "ORD-FAIL-002",
        programTitle: "Program",
        failureReason: "Card expired or invalid",
      };

      const result = generateRefundFailedEmail(data);

      expect(result).toContain("Reason:");
      expect(result).toContain("Card expired or invalid");
      expect(result).toContain("error-box");
    });

    it("should include error styling", () => {
      const data: RefundFailedEmailData = {
        userName: "User",
        orderNumber: "ORD-FAIL-003",
        programTitle: "Program",
        failureReason: "Bank declined transaction",
      };

      const result = generateRefundFailedEmail(data);

      expect(result).toContain("❌");
      expect(result).toContain("⚠️");
      expect(result).toContain("error-icon");
      expect(result).toContain("#ef4444"); // Red color
      expect(result).toContain("#fee2e2"); // Light red background
    });

    it("should include actionable next steps", () => {
      const data: RefundFailedEmailData = {
        userName: "User",
        orderNumber: "ORD-FAIL-004",
        programTitle: "Program",
        failureReason: "Insufficient funds",
      };

      const result = generateRefundFailedEmail(data);

      expect(result).toContain("What should I do next?");
      expect(result).toContain("try requesting a refund again");
      expect(result).toContain("contact our support team");
      expect(result).toContain("Purchase History");
    });

    it("should include contact support button", () => {
      const data: RefundFailedEmailData = {
        userName: "User",
        orderNumber: "ORD-FAIL-005",
        programTitle: "Program",
        failureReason: "Technical error",
      };

      const result = generateRefundFailedEmail(data);

      expect(result).toContain("Contact Support");
      expect(result).toContain("mailto:atcloudministry@gmail.com");
      expect(result).toContain("button");
    });

    it("should handle long failure reasons", () => {
      const data: RefundFailedEmailData = {
        userName: "User",
        orderNumber: "ORD-FAIL-006",
        programTitle: "Program",
        failureReason:
          "The refund could not be processed because the original payment method is no longer available. Please contact support to update your payment information and try again.",
      };

      const result = generateRefundFailedEmail(data);

      expect(result).toContain(data.failureReason);
      expect(result.length).toBeGreaterThan(1000); // Ensure it's a full HTML email
    });

    it("should include support contact information", () => {
      const data: RefundFailedEmailData = {
        userName: "User",
        orderNumber: "ORD-FAIL-007",
        programTitle: "Program",
        failureReason: "Error",
      };

      const result = generateRefundFailedEmail(data);

      expect(result).toContain("@Cloud Ministry");
      expect(result).toContain("atcloudministry@gmail.com");
      expect(result).toContain("Questions?");
    });

    it("should handle special characters in failure reason", () => {
      const data: RefundFailedEmailData = {
        userName: "User",
        orderNumber: "ORD-FAIL-008",
        programTitle: "Program",
        failureReason: "Error: Payment processor returned <invalid response>",
      };

      const result = generateRefundFailedEmail(data);

      expect(result).toContain(data.failureReason);
    });
  });

  describe("Email Template Common Features", () => {
    it("all templates should be valid HTML", () => {
      const completedEmail = generateRefundCompletedEmail({
        userName: "Test",
        orderNumber: "TEST-001",
        programTitle: "Test Program",
        refundAmount: 1000,
        refundDate: new Date(),
      });

      const initiatedEmail = generateRefundInitiatedEmail({
        userName: "Test",
        orderNumber: "TEST-002",
        programTitle: "Test Program",
        refundAmount: 1000,
        purchaseDate: new Date(),
      });

      const failedEmail = generateRefundFailedEmail({
        userName: "Test",
        orderNumber: "TEST-003",
        programTitle: "Test Program",
        failureReason: "Test reason",
      });

      [completedEmail, initiatedEmail, failedEmail].forEach((email) => {
        expect(email).toContain("<!DOCTYPE html>");
        expect(email).toContain("<html>");
        expect(email).toContain("</html>");
        expect(email).toContain("<body>");
        expect(email).toContain("</body>");
      });
    });

    it("all templates should include responsive meta tags", () => {
      const completedEmail = generateRefundCompletedEmail({
        userName: "Test",
        orderNumber: "TEST-001",
        programTitle: "Test Program",
        refundAmount: 1000,
        refundDate: new Date(),
      });

      const initiatedEmail = generateRefundInitiatedEmail({
        userName: "Test",
        orderNumber: "TEST-002",
        programTitle: "Test Program",
        refundAmount: 1000,
        purchaseDate: new Date(),
      });

      const failedEmail = generateRefundFailedEmail({
        userName: "Test",
        orderNumber: "TEST-003",
        programTitle: "Test Program",
        failureReason: "Test reason",
      });

      [completedEmail, initiatedEmail, failedEmail].forEach((email) => {
        expect(email).toContain('charset="utf-8"');
        expect(email).toContain("viewport");
        expect(email).toContain("width=device-width");
      });
    });

    it("all templates should include branding", () => {
      const completedEmail = generateRefundCompletedEmail({
        userName: "Test",
        orderNumber: "TEST-001",
        programTitle: "Test Program",
        refundAmount: 1000,
        refundDate: new Date(),
      });

      const initiatedEmail = generateRefundInitiatedEmail({
        userName: "Test",
        orderNumber: "TEST-002",
        programTitle: "Test Program",
        refundAmount: 1000,
        purchaseDate: new Date(),
      });

      const failedEmail = generateRefundFailedEmail({
        userName: "Test",
        orderNumber: "TEST-003",
        programTitle: "Test Program",
        failureReason: "Test reason",
      });

      [completedEmail, initiatedEmail, failedEmail].forEach((email) => {
        expect(email).toContain("@Cloud Ministry");
        expect(email).toContain("atcloudministry@gmail.com");
      });
    });
  });

  describe("generateAdminRefundNotificationEmail", () => {
    it("should generate admin notification email with all required fields", () => {
      const data: AdminRefundNotificationEmailData = {
        userName: "John Customer",
        userEmail: "customer@example.com",
        orderNumber: "ORD-ADMIN-001",
        programTitle: "Leadership Training",
        refundAmount: 7500, // $75.00
        purchaseDate: new Date("2025-10-01"),
        refundInitiatedAt: new Date("2025-11-12T14:30:00"),
      };

      const result = generateAdminRefundNotificationEmail(data);

      expect(result).toContain("<!DOCTYPE html>");
      expect(result).toContain("Refund Request Notification");
      expect(result).toContain("John Customer");
      expect(result).toContain("customer@example.com");
      expect(result).toContain("ORD-ADMIN-001");
      expect(result).toContain("Leadership Training");
      expect(result).toContain("$75.00");
    });

    it("should format refund amount correctly in admin notification", () => {
      const data: AdminRefundNotificationEmailData = {
        userName: "Jane Admin",
        userEmail: "admin@example.com",
        orderNumber: "ORD-ADMIN-002",
        programTitle: "Bible Study Course",
        refundAmount: 14999, // $149.99
        purchaseDate: new Date("2025-09-15"),
        refundInitiatedAt: new Date("2025-11-13"),
      };

      const result = generateAdminRefundNotificationEmail(data);

      expect(result).toContain("$149.99");
    });

    it("should format purchase date and refund initiated date", () => {
      const data: AdminRefundNotificationEmailData = {
        userName: "Test Admin User",
        userEmail: "test@admin.com",
        orderNumber: "ORD-TEST-001",
        programTitle: "Workshop",
        refundAmount: 5000,
        purchaseDate: new Date("2025-08-20"),
        refundInitiatedAt: new Date("2025-11-15T10:45:00"),
      };

      const result = generateAdminRefundNotificationEmail(data);

      // Check purchase date formatting
      expect(result).toContain("August");
      expect(result).toContain("20");
      expect(result).toContain("2025");

      // Check refund initiated date formatting (includes time)
      expect(result).toContain("November");
      expect(result).toContain("15");
    });

    it("should include automated notification disclaimer", () => {
      const data: AdminRefundNotificationEmailData = {
        userName: "User",
        userEmail: "user@example.com",
        orderNumber: "ORD-333",
        programTitle: "Event",
        refundAmount: 2500,
        purchaseDate: new Date("2025-10-01"),
        refundInitiatedAt: new Date("2025-11-12"),
      };

      const result = generateAdminRefundNotificationEmail(data);

      expect(result).toContain("automated notification");
      expect(result).toContain("processed with Stripe");
      expect(result).toContain("confirmation emails");
    });

    it("should include user information section", () => {
      const data: AdminRefundNotificationEmailData = {
        userName: "Sarah Smith",
        userEmail: "sarah.smith@example.com",
        orderNumber: "ORD-444",
        programTitle: "Conference",
        refundAmount: 10000,
        purchaseDate: new Date("2025-09-01"),
        refundInitiatedAt: new Date("2025-11-12"),
      };

      const result = generateAdminRefundNotificationEmail(data);

      expect(result).toContain("User Information:");
      expect(result).toContain("Name:");
      expect(result).toContain("Sarah Smith");
      expect(result).toContain("Email:");
      expect(result).toContain("sarah.smith@example.com");
    });

    it("should include purchase information section", () => {
      const data: AdminRefundNotificationEmailData = {
        userName: "Mike Johnson",
        userEmail: "mike@example.com",
        orderNumber: "ORD-555",
        programTitle: "Youth Ministry Program",
        refundAmount: 3500,
        purchaseDate: new Date("2025-07-15"),
        refundInitiatedAt: new Date("2025-11-12"),
      };

      const result = generateAdminRefundNotificationEmail(data);

      expect(result).toContain("Purchase Information:");
      expect(result).toContain("Order Number:");
      expect(result).toContain("ORD-555");
      expect(result).toContain("Program:");
      expect(result).toContain("Youth Ministry Program");
      expect(result).toContain("Purchase Date:");
    });

    it("should include refund information section", () => {
      const data: AdminRefundNotificationEmailData = {
        userName: "Alice Brown",
        userEmail: "alice@example.com",
        orderNumber: "ORD-666",
        programTitle: "Mentorship Circle",
        refundAmount: 8000,
        purchaseDate: new Date("2025-06-01"),
        refundInitiatedAt: new Date("2025-11-12T16:20:00"),
      };

      const result = generateAdminRefundNotificationEmail(data);

      expect(result).toContain("Refund Information:");
      expect(result).toContain("Refund Amount:");
      expect(result).toContain("$80.00");
      expect(result).toContain("Refund Initiated:");
    });

    it("should handle zero-cent amounts correctly", () => {
      const data: AdminRefundNotificationEmailData = {
        userName: "Free User",
        userEmail: "free@example.com",
        orderNumber: "ORD-000",
        programTitle: "Free Program",
        refundAmount: 0,
        purchaseDate: new Date("2025-11-01"),
        refundInitiatedAt: new Date("2025-11-12"),
      };

      const result = generateAdminRefundNotificationEmail(data);

      expect(result).toContain("$0.00");
    });

    it("should include admin notification footer", () => {
      const data: AdminRefundNotificationEmailData = {
        userName: "User",
        userEmail: "user@example.com",
        orderNumber: "ORD-777",
        programTitle: "Event",
        refundAmount: 5000,
        purchaseDate: new Date("2025-10-01"),
        refundInitiatedAt: new Date("2025-11-12"),
      };

      const result = generateAdminRefundNotificationEmail(data);

      expect(result).toContain("@Cloud Ministry Admin Notifications");
      expect(result).toContain("record-keeping purposes");
    });
  });
});
