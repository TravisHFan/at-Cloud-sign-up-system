import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";
import { PromoCodeEmailService } from "../../../../src/services/email/domains/PromoCodeEmailService";

vi.mock("../../../../src/services/email/domains/PromoCodeEmailService", () => ({
  PromoCodeEmailService: {
    sendPromoCodeDeactivatedEmail: vi.fn().mockResolvedValue(true),
    sendPromoCodeReactivatedEmail: vi.fn().mockResolvedValue(true),
    sendStaffPromoCodeEmail: vi.fn().mockResolvedValue(true),
  },
}));

describe("EmailServiceFacade - PromoCode methods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to default return values
    vi.mocked(
      PromoCodeEmailService.sendPromoCodeDeactivatedEmail,
    ).mockResolvedValue(true);
    vi.mocked(
      PromoCodeEmailService.sendPromoCodeReactivatedEmail,
    ).mockResolvedValue(true);
    vi.mocked(PromoCodeEmailService.sendStaffPromoCodeEmail).mockResolvedValue(
      true,
    );
  });

  describe("sendPromoCodeDeactivatedEmail", () => {
    it("should delegate to PromoCodeEmailService.sendPromoCodeDeactivatedEmail", async () => {
      const params = {
        recipientEmail: "user@example.com",
        recipientName: "John Doe",
        promoCode: "WINTER2024",
        discountPercent: 20,
        allowedPrograms: "All Programs",
        deactivatedBy: "Admin User",
      };

      const result = await EmailService.sendPromoCodeDeactivatedEmail(params);

      expect(result).toBe(true);
      expect(
        PromoCodeEmailService.sendPromoCodeDeactivatedEmail,
      ).toHaveBeenCalledWith(params);
    });

    it("should handle failure from underlying service", async () => {
      vi.mocked(
        PromoCodeEmailService.sendPromoCodeDeactivatedEmail,
      ).mockResolvedValueOnce(false);

      const params = {
        recipientEmail: "user@example.com",
        recipientName: "Jane Doe",
        promoCode: "EXPIRED",
        discountPercent: 10,
        deactivatedBy: "System",
      };

      const result = await EmailService.sendPromoCodeDeactivatedEmail(params);

      expect(result).toBe(false);
    });
  });

  describe("sendPromoCodeReactivatedEmail", () => {
    it("should delegate to PromoCodeEmailService.sendPromoCodeReactivatedEmail", async () => {
      const params = {
        recipientEmail: "user@example.com",
        recipientName: "John Doe",
        promoCode: "SUMMER2024",
        discountPercent: 15,
        allowedPrograms: "Workshop Programs",
        expiresAt: "2024-12-31",
        reactivatedBy: "Manager",
      };

      const result = await EmailService.sendPromoCodeReactivatedEmail(params);

      expect(result).toBe(true);
      expect(
        PromoCodeEmailService.sendPromoCodeReactivatedEmail,
      ).toHaveBeenCalledWith(params);
    });

    it("should handle missing optional params", async () => {
      const params = {
        recipientEmail: "user@example.com",
        recipientName: "Jane Doe",
        promoCode: "BASIC",
        discountPercent: 5,
        reactivatedBy: "Admin",
      };

      const result = await EmailService.sendPromoCodeReactivatedEmail(params);

      expect(result).toBe(true);
      expect(
        PromoCodeEmailService.sendPromoCodeReactivatedEmail,
      ).toHaveBeenCalledWith(params);
    });

    it("should handle failure from underlying service", async () => {
      vi.mocked(
        PromoCodeEmailService.sendPromoCodeReactivatedEmail,
      ).mockResolvedValueOnce(false);

      const params = {
        recipientEmail: "user@example.com",
        recipientName: "Test User",
        promoCode: "FAILED",
        discountPercent: 25,
        reactivatedBy: "Admin",
      };

      const result = await EmailService.sendPromoCodeReactivatedEmail(params);

      expect(result).toBe(false);
    });
  });

  describe("sendStaffPromoCodeEmail", () => {
    it("should delegate to PromoCodeEmailService.sendStaffPromoCodeEmail", async () => {
      const params = {
        recipientEmail: "staff@example.com",
        recipientName: "Staff User",
        promoCode: "STAFF2024",
        discountPercent: 30,
        allowedPrograms: "All Programs",
        expiresAt: "2024-12-31",
        createdBy: "Admin User",
        codeType: "staff" as const,
      };

      const result = await EmailService.sendStaffPromoCodeEmail(params);

      expect(result).toBe(true);
      expect(
        PromoCodeEmailService.sendStaffPromoCodeEmail,
      ).toHaveBeenCalledWith(params);
    });

    it("should handle reward code type", async () => {
      const params = {
        recipientEmail: "user@example.com",
        recipientName: "Reward User",
        promoCode: "REWARD2024",
        discountPercent: 15,
        createdBy: "System",
        codeType: "reward" as const,
      };

      const result = await EmailService.sendStaffPromoCodeEmail(params);

      expect(result).toBe(true);
      expect(
        PromoCodeEmailService.sendStaffPromoCodeEmail,
      ).toHaveBeenCalledWith(params);
    });

    it("should handle missing optional params", async () => {
      const params = {
        recipientEmail: "user@example.com",
        recipientName: "Minimal User",
        promoCode: "MINIMAL",
        discountPercent: 10,
        createdBy: "Admin",
      };

      const result = await EmailService.sendStaffPromoCodeEmail(params);

      expect(result).toBe(true);
      expect(
        PromoCodeEmailService.sendStaffPromoCodeEmail,
      ).toHaveBeenCalledWith(params);
    });

    it("should handle failure from underlying service", async () => {
      vi.mocked(
        PromoCodeEmailService.sendStaffPromoCodeEmail,
      ).mockResolvedValueOnce(false);

      const params = {
        recipientEmail: "fail@example.com",
        recipientName: "Fail User",
        promoCode: "FAIL",
        discountPercent: 5,
        createdBy: "Admin",
      };

      const result = await EmailService.sendStaffPromoCodeEmail(params);

      expect(result).toBe(false);
    });
  });
});
