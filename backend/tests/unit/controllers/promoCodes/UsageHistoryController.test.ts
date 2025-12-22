import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import mongoose from "mongoose";
import UsageHistoryController from "../../../../src/controllers/promoCodes/UsageHistoryController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  PromoCode: {
    findById: vi.fn(),
  },
}));

import { PromoCode } from "../../../../src/models";

interface MockRequest extends Partial<Request> {
  params: Record<string, string>;
  user?: {
    id: string;
    _id: string;
    role: string;
    email: string;
  };
}

describe("UsageHistoryController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock,
      json: jsonMock,
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
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe("getPromoCodeUsageHistory", () => {
    const mockFindByIdWithPopulate = (result: unknown) => {
      // Create a proper chain mock that supports multiple .populate() calls
      const chainMock = {
        populate: vi.fn(),
      };
      // Each populate call returns the chain, final one resolves to result
      chainMock.populate
        .mockReturnValueOnce(chainMock) // First populate returns chain
        .mockResolvedValueOnce(result); // Second populate resolves to result
      vi.mocked(PromoCode.findById).mockReturnValue(chainMock as any);
      return chainMock;
    };

    describe("authentication", () => {
      it("should return 401 when user is not authenticated", async () => {
        mockReq.user = undefined;

        await UsageHistoryController.getPromoCodeUsageHistory(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Authentication required.",
        });
      });
    });

    describe("validation", () => {
      it("should return 400 when id is invalid", async () => {
        mockReq.params.id = "invalid-id";

        await UsageHistoryController.getPromoCodeUsageHistory(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid promo code ID.",
        });
      });
    });

    describe("promo code lookup", () => {
      it("should return 404 when promo code not found", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;

        mockFindByIdWithPopulate(null);

        await UsageHistoryController.getPromoCodeUsageHistory(
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

    describe("successful retrieval", () => {
      it("should return usage history with populated data", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        const userId = new mongoose.Types.ObjectId().toString();
        const programId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;

        const usedAt = new Date();
        const mockPromoCode = {
          _id: validId,
          code: "HISTORY20",
          type: "bundle_discount",
          isGeneral: false,
          description: "Test discount code",
          usageHistory: [
            {
              userId: {
                _id: userId,
                firstName: "John",
                lastName: "Doe",
                email: "john@test.com",
                username: "johndoe",
              },
              programId: {
                _id: programId,
                title: "Test Program",
              },
              usedAt,
            },
          ],
        };

        const chainMock = mockFindByIdWithPopulate(mockPromoCode);

        await UsageHistoryController.getPromoCodeUsageHistory(
          mockReq as Request,
          mockRes as Response
        );

        expect(chainMock.populate).toHaveBeenCalledWith(
          "usageHistory.userId",
          "firstName lastName email username"
        );
        expect(chainMock.populate).toHaveBeenCalledWith(
          "usageHistory.programId",
          "title"
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: {
            code: "HISTORY20",
            type: "bundle_discount",
            isGeneral: false,
            description: "Test discount code",
            usageHistory: mockPromoCode.usageHistory,
            usageCount: 1,
          },
        });
      });

      it("should return empty usage history when no usage exists", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;

        const mockPromoCode = {
          _id: validId,
          code: "UNUSED50",
          type: "staff_access",
          isGeneral: true,
          description: null,
          usageHistory: [],
        };

        mockFindByIdWithPopulate(mockPromoCode);

        await UsageHistoryController.getPromoCodeUsageHistory(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: {
            code: "UNUSED50",
            type: "staff_access",
            isGeneral: true,
            description: null,
            usageHistory: [],
            usageCount: 0,
          },
        });
      });

      it("should handle promo code with undefined usageHistory", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;

        const mockPromoCode = {
          _id: validId,
          code: "NOHISTORY",
          type: "bundle_discount",
          isGeneral: undefined,
          description: undefined,
          usageHistory: undefined,
        };

        mockFindByIdWithPopulate(mockPromoCode);

        await UsageHistoryController.getPromoCodeUsageHistory(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: {
            code: "NOHISTORY",
            type: "bundle_discount",
            isGeneral: false,
            description: undefined,
            usageHistory: [],
            usageCount: 0,
          },
        });
      });

      it("should handle multiple usage records", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;

        const mockPromoCode = {
          _id: validId,
          code: "MULTIUSE",
          type: "bundle_discount",
          isGeneral: true,
          description: "Multi-use code",
          usageHistory: [
            {
              userId: { _id: "u1" },
              programId: { _id: "p1" },
              usedAt: new Date(),
            },
            {
              userId: { _id: "u2" },
              programId: { _id: "p1" },
              usedAt: new Date(),
            },
            {
              userId: { _id: "u3" },
              programId: { _id: "p2" },
              usedAt: new Date(),
            },
          ],
        };

        mockFindByIdWithPopulate(mockPromoCode);

        await UsageHistoryController.getPromoCodeUsageHistory(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              usageCount: 3,
            }),
          })
        );
      });
    });

    describe("error handling", () => {
      it("should return 500 on database error", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;

        vi.mocked(PromoCode.findById).mockImplementation(() => {
          throw new Error("Database connection failed");
        });

        await UsageHistoryController.getPromoCodeUsageHistory(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to fetch usage history.",
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Error fetching promo code usage history:",
          expect.any(Error)
        );
      });
    });
  });
});
