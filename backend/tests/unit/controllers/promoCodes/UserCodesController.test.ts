import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import mongoose from "mongoose";
import UserCodesController from "../../../../src/controllers/promoCodes/UserCodesController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  PromoCode: {
    find: vi.fn(),
  },
}));

import { PromoCode } from "../../../../src/models";

interface MockRequest extends Partial<Request> {
  query: Record<string, string>;
  user?: {
    _id: string;
    id: string;
    role: string;
    email: string;
  };
}

describe("UserCodesController", () => {
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
      query: {},
      user: {
        _id: "user123",
        id: "user123",
        role: "Member",
        email: "user@test.com",
      },
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe("getMyPromoCodes", () => {
    const mockFindWithChain = (result: unknown[]) => {
      const chainMock = {
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockResolvedValue(result),
      };
      vi.mocked(PromoCode.find).mockReturnValue(chainMock as any);
      return chainMock;
    };

    describe("authentication", () => {
      it("should return 401 when user is not authenticated", async () => {
        mockReq.user = undefined;

        await UserCodesController.getMyPromoCodes(
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

    describe("successful retrieval", () => {
      it("should return empty list when user has no promo codes", async () => {
        mockFindWithChain([]);

        await UserCodesController.getMyPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.find).toHaveBeenCalledWith({ ownerId: "user123" });
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          codes: [],
        });
      });

      it("should return user's promo codes with populated data", async () => {
        const programId = new mongoose.Types.ObjectId();
        const mockCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "MYCODE20",
          type: "bundle_discount",
          applicableToType: "program",
          discountAmount: null,
          discountPercent: 20,
          isActive: true,
          isUsed: false,
          isExpired: false,
          isValid: true,
          expiresAt: null,
          usedAt: null,
          usedForProgramId: null,
          excludedProgramId: null,
          allowedProgramIds: [{ _id: programId, title: "Test Program" }],
          allowedEventIds: null,
          createdAt: new Date(),
        };

        mockFindWithChain([mockCode]);

        await UserCodesController.getMyPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          codes: [
            expect.objectContaining({
              code: "MYCODE20",
              discountPercent: 20,
              allowedProgramTitles: ["Test Program"],
              allowedProgramIds: [programId.toString()],
            }),
          ],
        });
      });

      it("should return promo code with usedForProgramTitle when used", async () => {
        const programId = new mongoose.Types.ObjectId();
        const usedAt = new Date();
        const mockCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "USEDCODE",
          type: "bundle_discount",
          applicableToType: "program",
          discountAmount: 50,
          discountPercent: null,
          isActive: false,
          isUsed: true,
          isExpired: false,
          isValid: false,
          expiresAt: null,
          usedAt,
          usedForProgramId: { _id: programId, title: "Used For Program" },
          excludedProgramId: null,
          allowedProgramIds: null,
          allowedEventIds: null,
          createdAt: new Date(),
        };

        mockFindWithChain([mockCode]);

        await UserCodesController.getMyPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          codes: [
            expect.objectContaining({
              code: "USEDCODE",
              usedForProgramTitle: "Used For Program",
              isUsed: true,
            }),
          ],
        });
      });

      it("should return codes with allowedEventTitles when populated", async () => {
        const eventId = new mongoose.Types.ObjectId();
        const mockCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "EVENTCODE",
          type: "staff_access",
          applicableToType: "event",
          discountAmount: null,
          discountPercent: 100,
          isActive: true,
          isUsed: false,
          isExpired: false,
          isValid: true,
          expiresAt: null,
          usedAt: null,
          usedForProgramId: null,
          excludedProgramId: null,
          allowedProgramIds: null,
          allowedEventIds: [{ _id: eventId, title: "Special Event" }],
          createdAt: new Date(),
        };

        mockFindWithChain([mockCode]);

        await UserCodesController.getMyPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          codes: [
            expect.objectContaining({
              code: "EVENTCODE",
              allowedEventIds: [eventId.toString()],
              allowedEventTitles: ["Special Event"],
            }),
          ],
        });
      });
    });

    describe("status filtering", () => {
      it("should filter active codes correctly", async () => {
        mockFindWithChain([]);
        mockReq.query.status = "active";

        await UserCodesController.getMyPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.find).toHaveBeenCalledWith(
          expect.objectContaining({
            ownerId: "user123",
            isActive: true,
            isUsed: false,
            $or: [
              { expiresAt: null },
              { expiresAt: { $gt: expect.any(Date) } },
            ],
          })
        );
      });

      it("should filter expired codes correctly", async () => {
        mockFindWithChain([]);
        mockReq.query.status = "expired";

        await UserCodesController.getMyPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.find).toHaveBeenCalledWith(
          expect.objectContaining({
            ownerId: "user123",
            expiresAt: { $lte: expect.any(Date) },
            isUsed: false,
          })
        );
      });

      it("should filter used codes correctly", async () => {
        mockFindWithChain([]);
        mockReq.query.status = "used";

        await UserCodesController.getMyPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.find).toHaveBeenCalledWith(
          expect.objectContaining({
            ownerId: "user123",
            isUsed: true,
          })
        );
      });

      it("should not add status filters when status is 'all'", async () => {
        mockFindWithChain([]);
        mockReq.query.status = "all";

        await UserCodesController.getMyPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.find).toHaveBeenCalledWith({ ownerId: "user123" });
      });
    });

    describe("query chain verification", () => {
      it("should call populate and sort in order", async () => {
        const chainMock = mockFindWithChain([]);

        await UserCodesController.getMyPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(chainMock.populate).toHaveBeenCalledWith(
          "usedForProgramId",
          "title"
        );
        expect(chainMock.populate).toHaveBeenCalledWith(
          "excludedProgramId",
          "title"
        );
        expect(chainMock.populate).toHaveBeenCalledWith(
          "allowedProgramIds",
          "title"
        );
        expect(chainMock.populate).toHaveBeenCalledWith(
          "allowedEventIds",
          "title"
        );
        expect(chainMock.sort).toHaveBeenCalledWith({ createdAt: -1 });
      });
    });

    describe("error handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(PromoCode.find).mockImplementation(() => {
          throw new Error("Database connection failed");
        });

        await UserCodesController.getMyPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to fetch promo codes.",
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Error fetching user promo codes:",
          expect.any(Error)
        );
      });
    });
  });
});
