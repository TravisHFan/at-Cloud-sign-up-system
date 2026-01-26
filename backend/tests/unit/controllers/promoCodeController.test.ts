/**
 * Unit tests for PromoCodeController facade
 * Tests delegation to sub-controllers
 */
import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { Request, Response } from "express";
import { PromoCodeController } from "../../../src/controllers/promoCodeController";

// Mock all sub-controllers
vi.mock("../../../src/controllers/promoCodes/UserCodesController", () => ({
  default: { getMyPromoCodes: vi.fn() },
}));
vi.mock("../../../src/controllers/promoCodes/ValidationController", () => ({
  default: { validatePromoCode: vi.fn() },
}));
vi.mock("../../../src/controllers/promoCodes/AdminListController", () => ({
  default: { getAllPromoCodes: vi.fn() },
}));
vi.mock("../../../src/controllers/promoCodes/UsageHistoryController", () => ({
  default: { getPromoCodeUsageHistory: vi.fn() },
}));
vi.mock(
  "../../../src/controllers/promoCodes/StaffCodeCreationController",
  () => ({
    default: { createStaffCode: vi.fn() },
  }),
);
vi.mock(
  "../../../src/controllers/promoCodes/GeneralCodeCreationController",
  () => ({
    default: { createGeneralStaffCode: vi.fn() },
  }),
);
vi.mock(
  "../../../src/controllers/promoCodes/RewardCodeCreationController",
  () => ({
    default: { createRewardCode: vi.fn() },
  }),
);
vi.mock("../../../src/controllers/promoCodes/BundleConfigController", () => ({
  default: { getBundleConfig: vi.fn(), updateBundleConfig: vi.fn() },
}));
vi.mock("../../../src/controllers/promoCodes/DeactivationController", () => ({
  default: { deactivatePromoCode: vi.fn() },
}));
vi.mock("../../../src/controllers/promoCodes/ReactivationController", () => ({
  default: { reactivatePromoCode: vi.fn() },
}));
vi.mock("../../../src/controllers/promoCodes/DeletionController", () => ({
  default: { deletePromoCode: vi.fn() },
}));

describe("PromoCodeController", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      body: {},
      params: {},
      query: {},
      user: { _id: "user123", email: "test@example.com" },
    } as Partial<Request>;
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as Partial<Response>;
  });

  describe("getMyPromoCodes", () => {
    it("should delegate to UserCodesController.getMyPromoCodes", async () => {
      const UserCodesController = (
        await import("../../../src/controllers/promoCodes/UserCodesController")
      ).default;
      (UserCodesController.getMyPromoCodes as Mock).mockResolvedValue(
        undefined,
      );

      await PromoCodeController.getMyPromoCodes(
        mockReq as Request,
        mockRes as Response,
      );

      expect(UserCodesController.getMyPromoCodes).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });

  describe("validatePromoCode", () => {
    it("should delegate to ValidationController.validatePromoCode", async () => {
      const ValidationController = (
        await import("../../../src/controllers/promoCodes/ValidationController")
      ).default;
      (ValidationController.validatePromoCode as Mock).mockResolvedValue(
        undefined,
      );

      await PromoCodeController.validatePromoCode(
        mockReq as Request,
        mockRes as Response,
      );

      expect(ValidationController.validatePromoCode).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });

  describe("getAllPromoCodes", () => {
    it("should delegate to AdminListController.getAllPromoCodes", async () => {
      const AdminListController = (
        await import("../../../src/controllers/promoCodes/AdminListController")
      ).default;
      (AdminListController.getAllPromoCodes as Mock).mockResolvedValue(
        undefined,
      );

      await PromoCodeController.getAllPromoCodes(
        mockReq as Request,
        mockRes as Response,
      );

      expect(AdminListController.getAllPromoCodes).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });

  describe("getPromoCodeUsageHistory", () => {
    it("should delegate to UsageHistoryController.getPromoCodeUsageHistory", async () => {
      const UsageHistoryController = (
        await import("../../../src/controllers/promoCodes/UsageHistoryController")
      ).default;
      (
        UsageHistoryController.getPromoCodeUsageHistory as Mock
      ).mockResolvedValue(undefined);

      await PromoCodeController.getPromoCodeUsageHistory(
        mockReq as Request,
        mockRes as Response,
      );

      expect(
        UsageHistoryController.getPromoCodeUsageHistory,
      ).toHaveBeenCalledWith(mockReq, mockRes);
    });
  });

  describe("createStaffCode", () => {
    it("should delegate to StaffCodeCreationController.createStaffCode", async () => {
      const StaffCodeCreationController = (
        await import("../../../src/controllers/promoCodes/StaffCodeCreationController")
      ).default;
      (StaffCodeCreationController.createStaffCode as Mock).mockResolvedValue(
        undefined,
      );

      await PromoCodeController.createStaffCode(
        mockReq as Request,
        mockRes as Response,
      );

      expect(StaffCodeCreationController.createStaffCode).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });

  describe("createGeneralStaffCode", () => {
    it("should delegate to GeneralCodeCreationController.createGeneralStaffCode", async () => {
      const GeneralCodeCreationController = (
        await import("../../../src/controllers/promoCodes/GeneralCodeCreationController")
      ).default;
      (
        GeneralCodeCreationController.createGeneralStaffCode as Mock
      ).mockResolvedValue(undefined);

      await PromoCodeController.createGeneralStaffCode(
        mockReq as Request,
        mockRes as Response,
      );

      expect(
        GeneralCodeCreationController.createGeneralStaffCode,
      ).toHaveBeenCalledWith(mockReq, mockRes);
    });
  });

  describe("createRewardCode", () => {
    it("should delegate to RewardCodeCreationController.createRewardCode", async () => {
      const RewardCodeCreationController = (
        await import("../../../src/controllers/promoCodes/RewardCodeCreationController")
      ).default;
      (RewardCodeCreationController.createRewardCode as Mock).mockResolvedValue(
        undefined,
      );

      await PromoCodeController.createRewardCode(
        mockReq as Request,
        mockRes as Response,
      );

      expect(
        RewardCodeCreationController.createRewardCode,
      ).toHaveBeenCalledWith(mockReq, mockRes);
    });
  });

  describe("getBundleConfig", () => {
    it("should delegate to BundleConfigController.getBundleConfig", async () => {
      const BundleConfigController = (
        await import("../../../src/controllers/promoCodes/BundleConfigController")
      ).default;
      (BundleConfigController.getBundleConfig as Mock).mockResolvedValue(
        undefined,
      );

      await PromoCodeController.getBundleConfig(
        mockReq as Request,
        mockRes as Response,
      );

      expect(BundleConfigController.getBundleConfig).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });

  describe("updateBundleConfig", () => {
    it("should delegate to BundleConfigController.updateBundleConfig", async () => {
      const BundleConfigController = (
        await import("../../../src/controllers/promoCodes/BundleConfigController")
      ).default;
      (BundleConfigController.updateBundleConfig as Mock).mockResolvedValue(
        undefined,
      );

      await PromoCodeController.updateBundleConfig(
        mockReq as Request,
        mockRes as Response,
      );

      expect(BundleConfigController.updateBundleConfig).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });

  describe("deactivatePromoCode", () => {
    it("should delegate to DeactivationController.deactivatePromoCode", async () => {
      const DeactivationController = (
        await import("../../../src/controllers/promoCodes/DeactivationController")
      ).default;
      (DeactivationController.deactivatePromoCode as Mock).mockResolvedValue(
        undefined,
      );

      await PromoCodeController.deactivatePromoCode(
        mockReq as Request,
        mockRes as Response,
      );

      expect(DeactivationController.deactivatePromoCode).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });

  describe("reactivatePromoCode", () => {
    it("should delegate to ReactivationController.reactivatePromoCode", async () => {
      const ReactivationController = (
        await import("../../../src/controllers/promoCodes/ReactivationController")
      ).default;
      (ReactivationController.reactivatePromoCode as Mock).mockResolvedValue(
        undefined,
      );

      await PromoCodeController.reactivatePromoCode(
        mockReq as Request,
        mockRes as Response,
      );

      expect(ReactivationController.reactivatePromoCode).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });

  describe("deletePromoCode", () => {
    it("should delegate to DeletionController.deletePromoCode", async () => {
      const DeletionController = (
        await import("../../../src/controllers/promoCodes/DeletionController")
      ).default;
      (DeletionController.deletePromoCode as Mock).mockResolvedValue(undefined);

      await PromoCodeController.deletePromoCode(
        mockReq as Request,
        mockRes as Response,
      );

      expect(DeletionController.deletePromoCode).toHaveBeenCalledWith(
        mockReq,
        mockRes,
      );
    });
  });
});
