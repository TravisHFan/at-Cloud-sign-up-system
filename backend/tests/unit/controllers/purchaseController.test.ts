/**
 * Unit tests for PurchaseController facade
 * Tests delegation to sub-controllers
 */
import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { Request, Response } from "express";
import { PurchaseController } from "../../../src/controllers/purchaseController";

// Mock all sub-controllers
vi.mock("../../../src/controllers/purchase/PurchaseCheckoutController", () => ({
  default: { createCheckoutSession: vi.fn() },
}));
vi.mock(
  "../../../src/controllers/purchase/PurchaseVerificationController",
  () => ({
    default: { verifySession: vi.fn() },
  }),
);
vi.mock("../../../src/controllers/purchase/PurchaseHistoryController", () => ({
  default: { getMyPurchases: vi.fn() },
}));
vi.mock("../../../src/controllers/purchase/PurchasePendingController", () => ({
  default: { getMyPendingPurchases: vi.fn() },
}));
vi.mock(
  "../../../src/controllers/purchase/PurchaseRetrievalController",
  () => ({
    default: { getPurchaseById: vi.fn() },
  }),
);
vi.mock("../../../src/controllers/purchase/PurchaseReceiptController", () => ({
  default: { getPurchaseReceipt: vi.fn() },
}));
vi.mock("../../../src/controllers/purchase/PurchaseAccessController", () => ({
  default: { checkProgramAccess: vi.fn() },
}));
vi.mock("../../../src/controllers/purchase/PurchaseRetryController", () => ({
  default: { retryPendingPurchase: vi.fn() },
}));
vi.mock(
  "../../../src/controllers/purchase/PurchaseCancellationController",
  () => ({
    default: { cancelPendingPurchase: vi.fn() },
  }),
);
vi.mock("../../../src/controllers/purchase/PurchaseAdminController", () => ({
  default: { getAllPurchasesAdmin: vi.fn() },
}));
vi.mock("../../../src/controllers/purchase/PurchaseStatsController", () => ({
  default: { getPaymentStats: vi.fn() },
}));
vi.mock("../../../src/controllers/purchase/PurchaseRefundController", () => ({
  default: { checkRefundEligibility: vi.fn(), initiateRefund: vi.fn() },
}));

describe("PurchaseController", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      body: {},
      params: {
        id: "purchase123",
        sessionId: "session123",
        programId: "prog123",
        purchaseId: "purchase123",
      },
      query: {},
      user: { _id: "user123", email: "test@example.com" },
    } as Partial<Request>;
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as Partial<Response>;
  });

  describe("createCheckoutSession", () => {
    it("should delegate to PurchaseCheckoutController.createCheckoutSession", async () => {
      const PurchaseCheckoutController = (
        await import("../../../src/controllers/purchase/PurchaseCheckoutController")
      ).default;
      (
        PurchaseCheckoutController.createCheckoutSession as Mock
      ).mockResolvedValue(undefined);

      await PurchaseController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response,
      );

      expect(
        PurchaseCheckoutController.createCheckoutSession,
      ).toHaveBeenCalledWith(mockReq, mockRes);
    });
  });

  describe("verifySession", () => {
    it("should delegate to PurchaseVerificationController.verifySession", async () => {
      const PurchaseVerificationController = (
        await import("../../../src/controllers/purchase/PurchaseVerificationController")
      ).default;
      (PurchaseVerificationController.verifySession as Mock).mockResolvedValue(
        undefined,
      );

      await PurchaseController.verifySession(
        mockReq as Request,
        mockRes as Response,
      );

      expect(PurchaseVerificationController.verifySession).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });

  describe("getMyPurchases", () => {
    it("should delegate to PurchaseHistoryController.getMyPurchases", async () => {
      const PurchaseHistoryController = (
        await import("../../../src/controllers/purchase/PurchaseHistoryController")
      ).default;
      (PurchaseHistoryController.getMyPurchases as Mock).mockResolvedValue(
        undefined,
      );

      await PurchaseController.getMyPurchases(
        mockReq as Request,
        mockRes as Response,
      );

      expect(PurchaseHistoryController.getMyPurchases).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });

  describe("getMyPendingPurchases", () => {
    it("should delegate to PurchasePendingController.getMyPendingPurchases", async () => {
      const PurchasePendingController = (
        await import("../../../src/controllers/purchase/PurchasePendingController")
      ).default;
      (
        PurchasePendingController.getMyPendingPurchases as Mock
      ).mockResolvedValue(undefined);

      await PurchaseController.getMyPendingPurchases(
        mockReq as Request,
        mockRes as Response,
      );

      expect(
        PurchasePendingController.getMyPendingPurchases,
      ).toHaveBeenCalledWith(mockReq, mockRes);
    });
  });

  describe("getPurchaseById", () => {
    it("should delegate to PurchaseRetrievalController.getPurchaseById", async () => {
      const PurchaseRetrievalController = (
        await import("../../../src/controllers/purchase/PurchaseRetrievalController")
      ).default;
      (PurchaseRetrievalController.getPurchaseById as Mock).mockResolvedValue(
        undefined,
      );

      await PurchaseController.getPurchaseById(
        mockReq as Request,
        mockRes as Response,
      );

      expect(PurchaseRetrievalController.getPurchaseById).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });

  describe("getPurchaseReceipt", () => {
    it("should delegate to PurchaseReceiptController.getPurchaseReceipt", async () => {
      const PurchaseReceiptController = (
        await import("../../../src/controllers/purchase/PurchaseReceiptController")
      ).default;
      (PurchaseReceiptController.getPurchaseReceipt as Mock).mockResolvedValue(
        undefined,
      );

      await PurchaseController.getPurchaseReceipt(
        mockReq as Request,
        mockRes as Response,
      );

      expect(PurchaseReceiptController.getPurchaseReceipt).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });

  describe("checkProgramAccess", () => {
    it("should delegate to PurchaseAccessController.checkProgramAccess", async () => {
      const PurchaseAccessController = (
        await import("../../../src/controllers/purchase/PurchaseAccessController")
      ).default;
      (PurchaseAccessController.checkProgramAccess as Mock).mockResolvedValue(
        undefined,
      );

      await PurchaseController.checkProgramAccess(
        mockReq as Request,
        mockRes as Response,
      );

      expect(PurchaseAccessController.checkProgramAccess).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });

  describe("retryPendingPurchase", () => {
    it("should delegate to PurchaseRetryController.retryPendingPurchase", async () => {
      const PurchaseRetryController = (
        await import("../../../src/controllers/purchase/PurchaseRetryController")
      ).default;
      (PurchaseRetryController.retryPendingPurchase as Mock).mockResolvedValue(
        undefined,
      );

      await PurchaseController.retryPendingPurchase(
        mockReq as Request,
        mockRes as Response,
      );

      expect(PurchaseRetryController.retryPendingPurchase).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });

  describe("cancelPendingPurchase", () => {
    it("should delegate to PurchaseCancellationController.cancelPendingPurchase", async () => {
      const PurchaseCancellationController = (
        await import("../../../src/controllers/purchase/PurchaseCancellationController")
      ).default;
      (
        PurchaseCancellationController.cancelPendingPurchase as Mock
      ).mockResolvedValue(undefined);

      await PurchaseController.cancelPendingPurchase(
        mockReq as Request,
        mockRes as Response,
      );

      expect(
        PurchaseCancellationController.cancelPendingPurchase,
      ).toHaveBeenCalledWith(mockReq, mockRes);
    });
  });

  describe("getAllPurchasesAdmin", () => {
    it("should delegate to PurchaseAdminController.getAllPurchasesAdmin", async () => {
      const PurchaseAdminController = (
        await import("../../../src/controllers/purchase/PurchaseAdminController")
      ).default;
      (PurchaseAdminController.getAllPurchasesAdmin as Mock).mockResolvedValue(
        undefined,
      );

      await PurchaseController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response,
      );

      expect(PurchaseAdminController.getAllPurchasesAdmin).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });

  describe("getPaymentStats", () => {
    it("should delegate to PurchaseStatsController.getPaymentStats", async () => {
      const PurchaseStatsController = (
        await import("../../../src/controllers/purchase/PurchaseStatsController")
      ).default;
      (PurchaseStatsController.getPaymentStats as Mock).mockResolvedValue(
        undefined,
      );

      await PurchaseController.getPaymentStats(
        mockReq as Request,
        mockRes as Response,
      );

      expect(PurchaseStatsController.getPaymentStats).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });

  describe("checkRefundEligibility", () => {
    it("should delegate to PurchaseRefundController.checkRefundEligibility", async () => {
      const PurchaseRefundController = (
        await import("../../../src/controllers/purchase/PurchaseRefundController")
      ).default;
      (
        PurchaseRefundController.checkRefundEligibility as Mock
      ).mockResolvedValue(undefined);

      await PurchaseController.checkRefundEligibility(
        mockReq as Request,
        mockRes as Response,
      );

      expect(
        PurchaseRefundController.checkRefundEligibility,
      ).toHaveBeenCalledWith(mockReq, mockRes);
    });
  });

  describe("initiateRefund", () => {
    it("should delegate to PurchaseRefundController.initiateRefund", async () => {
      const PurchaseRefundController = (
        await import("../../../src/controllers/purchase/PurchaseRefundController")
      ).default;
      (PurchaseRefundController.initiateRefund as Mock).mockResolvedValue(
        undefined,
      );

      await PurchaseController.initiateRefund(
        mockReq as Request,
        mockRes as Response,
      );

      expect(PurchaseRefundController.initiateRefund).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });
});
