import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import mongoose from "mongoose";
import DeletionController from "../../../../src/controllers/promoCodes/DeletionController";

// Mock dependencies
vi.mock("../../../../src/models/PromoCode");
vi.mock("../../../../src/services/LoggerService", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import PromoCode from "../../../../src/models/PromoCode";

interface MockRequest {
  params: Record<string, string>;
  user?: {
    id: string;
    _id: string;
    role: string;
    email: string;
  };
}

describe("DeletionController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };

    mockReq = {
      params: {},
      user: {
        id: "admin123",
        _id: "admin123",
        role: "Administrator",
        email: "admin@test.com",
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("deletePromoCode", () => {
    describe("validation", () => {
      it("should return 400 when id is missing", async () => {
        mockReq.params = {};

        await DeletionController.deletePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Valid promo code ID is required.",
        });
      });

      it("should return 400 when id is invalid", async () => {
        mockReq.params.id = "invalid-mongo-id";

        await DeletionController.deletePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Valid promo code ID is required.",
        });
      });
    });

    describe("promo code lookup", () => {
      it("should return 404 when promo code not found", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;

        const populateMock = vi.fn().mockResolvedValue(null);
        vi.mocked(PromoCode.findById).mockReturnValue({
          populate: populateMock,
        } as any);

        await DeletionController.deletePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.findById).toHaveBeenCalledWith(validId);
        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Promo code not found.",
        });
      });
    });

    describe("successful deletion", () => {
      it("should delete promo code successfully", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        const ownerId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;

        const mockPromoCode = {
          _id: validId,
          code: "DELETE20",
          type: "bundle_discount",
          isUsed: false,
          isActive: true,
          ownerId: {
            _id: ownerId,
            email: "owner@test.com",
            firstName: "John",
            lastName: "Doe",
          },
        };
        const populateMock = vi.fn().mockResolvedValue(mockPromoCode);
        vi.mocked(PromoCode.findById).mockReturnValue({
          populate: populateMock,
        } as any);
        vi.mocked(PromoCode.findByIdAndDelete).mockResolvedValue(
          mockPromoCode as any
        );

        await DeletionController.deletePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.findByIdAndDelete).toHaveBeenCalledWith(validId);
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Promo code DELETE20 has been permanently deleted.",
        });
      });

      it("should delete used promo code successfully", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;

        const mockPromoCode = {
          _id: validId,
          code: "USEDCODE",
          type: "staff_access",
          isUsed: true,
          isActive: false,
          ownerId: null,
        };
        const populateMock = vi.fn().mockResolvedValue(mockPromoCode);
        vi.mocked(PromoCode.findById).mockReturnValue({
          populate: populateMock,
        } as any);
        vi.mocked(PromoCode.findByIdAndDelete).mockResolvedValue(
          mockPromoCode as any
        );

        await DeletionController.deletePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.findByIdAndDelete).toHaveBeenCalledWith(validId);
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Promo code USEDCODE has been permanently deleted.",
        });
      });
    });

    describe("error handling", () => {
      it("should return 500 on database error during findById", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;

        vi.mocked(PromoCode.findById).mockImplementation(() => {
          throw new Error("Database connection failed");
        });

        await DeletionController.deletePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to delete promo code. Please try again.",
        });
      });

      it("should return 500 on database error during delete", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;

        const mockPromoCode = {
          _id: validId,
          code: "DELETEFAIL",
          type: "bundle_discount",
          isUsed: false,
          isActive: true,
          ownerId: null,
        };
        const populateMock = vi.fn().mockResolvedValue(mockPromoCode);
        vi.mocked(PromoCode.findById).mockReturnValue({
          populate: populateMock,
        } as any);
        vi.mocked(PromoCode.findByIdAndDelete).mockRejectedValue(
          new Error("Deletion failed")
        );

        await DeletionController.deletePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to delete promo code. Please try again.",
        });
      });
    });
  });
});
