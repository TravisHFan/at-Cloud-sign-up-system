import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Response } from "express";
import PurchaseRefundController from "../../../../src/controllers/purchase/PurchaseRefundController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  Purchase: {
    findById: vi.fn(),
  },
}));

vi.mock("../../../../src/services/stripeService", () => ({
  processRefund: vi.fn(),
}));

vi.mock("../../../../src/services/email/domains/PurchaseEmailService", () => ({
  PurchaseEmailService: {
    sendRefundInitiatedEmail: vi.fn(),
    sendRefundFailedEmail: vi.fn(),
  },
}));

import { Purchase } from "../../../../src/models";
import { processRefund } from "../../../../src/services/stripeService";
import { PurchaseEmailService } from "../../../../src/services/email/domains/PurchaseEmailService";

interface MockRequest {
  params: Record<string, string>;
  body: Record<string, unknown>;
  user?: {
    _id: { toString: () => string };
    id: string;
    role: string;
    email: string;
  };
}

describe("PurchaseRefundController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: any;

  const mockUserId = "507f1f77bcf86cd799439011";
  const mockPurchaseId = "507f1f77bcf86cd799439012";

  beforeEach(() => {
    vi.clearAllMocks();

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };

    mockReq = {
      params: { purchaseId: mockPurchaseId },
      body: {},
      user: {
        _id: { toString: () => mockUserId },
        id: mockUserId,
        role: "User",
        email: "user@test.com",
      },
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("checkRefundEligibility", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await PurchaseRefundController.checkRefundEligibility(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Authentication required.",
        });
      });
    });

    describe("Validation", () => {
      it("should return 400 for invalid purchase ID", async () => {
        mockReq.params.purchaseId = "invalid";

        await PurchaseRefundController.checkRefundEligibility(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid purchase ID.",
        });
      });

      it("should return 404 if purchase not found", async () => {
        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockResolvedValue(null),
        } as any);

        await PurchaseRefundController.checkRefundEligibility(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Purchase not found.",
        });
      });
    });

    describe("Authorization", () => {
      it("should return 403 if user doesn't own the purchase", async () => {
        const mockPurchase = {
          _id: mockPurchaseId,
          userId: { toString: () => "different-user-id" },
          status: "completed",
          purchaseDate: new Date(),
        };

        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        } as any);

        await PurchaseRefundController.checkRefundEligibility(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "You don't have permission to refund this purchase.",
        });
      });
    });

    describe("Success", () => {
      it("should return refund eligibility for a valid purchase within window", async () => {
        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - 5); // 5 days ago

        const mockPurchase = {
          _id: mockPurchaseId,
          userId: { toString: () => mockUserId },
          status: "completed",
          purchaseDate: recentDate,
        };

        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        } as any);

        await PurchaseRefundController.checkRefundEligibility(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.data.isEligible).toBe(true);
        expect(response.data.daysRemaining).toBeGreaterThan(0);
      });

      it("should return not eligible for purchase outside refund window", async () => {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 45); // 45 days ago

        const mockPurchase = {
          _id: mockPurchaseId,
          userId: { toString: () => mockUserId },
          status: "completed",
          purchaseDate: oldDate,
        };

        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        } as any);

        await PurchaseRefundController.checkRefundEligibility(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.data.isEligible).toBe(false);
        expect(response.data.reason).toContain("expired");
      });

      it("should return not eligible for pending purchase", async () => {
        const mockPurchase = {
          _id: mockPurchaseId,
          userId: { toString: () => mockUserId },
          status: "pending",
          purchaseDate: new Date(),
        };

        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        } as any);

        await PurchaseRefundController.checkRefundEligibility(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        const response = jsonMock.mock.calls[0][0];
        expect(response.data.isEligible).toBe(false);
        expect(response.data.reason).toContain("pending");
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockRejectedValue(new Error("Database error")),
        } as any);

        await PurchaseRefundController.checkRefundEligibility(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to check refund eligibility.",
        });
      });
    });
  });

  describe("initiateRefund", () => {
    beforeEach(() => {
      mockReq.body = { purchaseId: mockPurchaseId };
    });

    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await PurchaseRefundController.initiateRefund(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Authentication required.",
        });
      });
    });

    describe("Validation", () => {
      it("should return 400 for invalid purchase ID", async () => {
        mockReq.body = { purchaseId: "invalid" };

        await PurchaseRefundController.initiateRefund(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid purchase ID.",
        });
      });

      it("should return 400 if purchaseId not provided", async () => {
        mockReq.body = {};

        await PurchaseRefundController.initiateRefund(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid purchase ID.",
        });
      });

      it("should return 404 if purchase not found", async () => {
        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockResolvedValue(null),
        } as any);

        await PurchaseRefundController.initiateRefund(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Purchase not found.",
        });
      });
    });

    describe("Authorization", () => {
      it("should return 403 if user doesn't own the purchase", async () => {
        const mockPurchase = {
          _id: mockPurchaseId,
          userId: { toString: () => "different-user-id" },
          status: "completed",
          purchaseDate: new Date(),
        };

        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        } as any);

        await PurchaseRefundController.initiateRefund(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "You don't have permission to refund this purchase.",
        });
      });
    });

    describe("Refund Business Logic", () => {
      it("should return 400 if purchase is not eligible for refund", async () => {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 45);

        const mockPurchase = {
          _id: mockPurchaseId,
          userId: { toString: () => mockUserId },
          status: "completed",
          purchaseDate: oldDate,
        };

        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        } as any);

        await PurchaseRefundController.initiateRefund(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(false);
        expect(response.message).toContain("expired");
      });

      it("should return 400 if purchase is already refunding", async () => {
        const mockPurchase = {
          _id: mockPurchaseId,
          userId: { toString: () => mockUserId },
          status: "refund_processing",
          purchaseDate: new Date(),
        };

        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        } as any);

        await PurchaseRefundController.initiateRefund(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(false);
        expect(response.message).toContain("refund_processing");
      });

      it("should return 400 if purchase is already refunded", async () => {
        const mockPurchase = {
          _id: mockPurchaseId,
          userId: { toString: () => mockUserId },
          status: "refunded",
          purchaseDate: new Date(),
        };

        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        } as any);

        await PurchaseRefundController.initiateRefund(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(false);
        expect(response.message).toContain("refunded");
      });
    });

    describe("Success", () => {
      it("should successfully initiate refund", async () => {
        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - 5);

        const mockPurchase = {
          _id: { toString: () => mockPurchaseId },
          userId: { toString: () => mockUserId },
          status: "completed",
          purchaseDate: recentDate,
          finalPrice: 5000,
          stripePaymentIntentId: "pi_test123",
          orderNumber: "ORD-12345",
          programId: { title: "Test Program", programType: "membership" },
          billingInfo: { email: "user@test.com", fullName: "Test User" },
          save: vi.fn().mockResolvedValue(undefined),
        };

        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        } as any);

        vi.mocked(processRefund).mockResolvedValue({ id: "re_test123" } as any);
        vi.mocked(
          PurchaseEmailService.sendRefundInitiatedEmail
        ).mockResolvedValue(true);

        await PurchaseRefundController.initiateRefund(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.message).toContain("Refund initiated successfully");
        expect(response.data.refundId).toBe("re_test123");
        expect(mockPurchase.save).toHaveBeenCalled();
      });

      it("should handle email failure gracefully during refund initiation", async () => {
        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - 5);

        const mockPurchase = {
          _id: { toString: () => mockPurchaseId },
          userId: { toString: () => mockUserId },
          status: "completed",
          purchaseDate: recentDate,
          finalPrice: 5000,
          stripePaymentIntentId: "pi_test123",
          orderNumber: "ORD-12345",
          programId: { title: "Test Program" },
          billingInfo: { email: "user@test.com", fullName: "Test User" },
          save: vi.fn().mockResolvedValue(undefined),
        };

        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        } as any);

        vi.mocked(
          PurchaseEmailService.sendRefundInitiatedEmail
        ).mockRejectedValue(new Error("Email failed"));
        vi.mocked(processRefund).mockResolvedValue({ id: "re_test123" } as any);

        await PurchaseRefundController.initiateRefund(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(processRefund).toHaveBeenCalled();
      });
    });

    describe("Stripe Errors", () => {
      it("should handle Stripe refund failure", async () => {
        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - 5);

        const mockPurchase = {
          _id: { toString: () => mockPurchaseId },
          userId: { toString: () => mockUserId },
          status: "completed",
          purchaseDate: recentDate,
          finalPrice: 5000,
          stripePaymentIntentId: "pi_test123",
          orderNumber: "ORD-12345",
          programId: { title: "Test Program" },
          billingInfo: { email: "user@test.com", fullName: "Test User" },
          save: vi.fn().mockResolvedValue(undefined),
        };

        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        } as any);

        vi.mocked(
          PurchaseEmailService.sendRefundInitiatedEmail
        ).mockResolvedValue(true);
        vi.mocked(processRefund).mockRejectedValue(
          new Error("Insufficient funds for refund")
        );
        vi.mocked(PurchaseEmailService.sendRefundFailedEmail).mockResolvedValue(
          true
        );

        await PurchaseRefundController.initiateRefund(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(false);
        expect(response.message).toContain("Failed to process refund");
        expect(mockPurchase.status).toBe("refund_failed");
        expect(PurchaseEmailService.sendRefundFailedEmail).toHaveBeenCalled();
      });

      it("should throw error if no stripePaymentIntentId", async () => {
        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - 5);

        const mockPurchase = {
          _id: { toString: () => mockPurchaseId },
          userId: { toString: () => mockUserId },
          status: "completed",
          purchaseDate: recentDate,
          finalPrice: 5000,
          stripePaymentIntentId: null, // No payment intent
          orderNumber: "ORD-12345",
          programId: { title: "Test Program" },
          billingInfo: { email: "user@test.com", fullName: "Test User" },
          save: vi.fn().mockResolvedValue(undefined),
        };

        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        } as any);

        vi.mocked(
          PurchaseEmailService.sendRefundInitiatedEmail
        ).mockResolvedValue(true);
        vi.mocked(PurchaseEmailService.sendRefundFailedEmail).mockResolvedValue(
          true
        );

        await PurchaseRefundController.initiateRefund(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        const response = jsonMock.mock.calls[0][0];
        expect(response.error).toContain("No payment intent");
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockRejectedValue(new Error("Database error")),
        } as any);

        await PurchaseRefundController.initiateRefund(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to initiate refund.",
        });
      });
    });
  });
});
