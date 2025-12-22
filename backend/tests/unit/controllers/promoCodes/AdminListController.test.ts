import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import mongoose from "mongoose";
import AdminListController from "../../../../src/controllers/promoCodes/AdminListController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  PromoCode: {
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
  User: {
    find: vi.fn(),
  },
}));

import { PromoCode, User } from "../../../../src/models";

interface MockRequest extends Partial<Request> {
  query: Record<string, string>;
  user?: {
    _id: string;
    id: string;
    role: string;
    email: string;
  };
}

describe("AdminListController", () => {
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
        _id: "admin123",
        id: "admin123",
        role: "Administrator",
        email: "admin@test.com",
      },
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe("getAllPromoCodes", () => {
    const mockPromoCodeWithChain = () => {
      const chainMock = {
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(PromoCode.find).mockReturnValue(chainMock as any);
      return chainMock;
    };

    describe("successful retrieval", () => {
      it("should return empty list when no promo codes exist", async () => {
        const chainMock = mockPromoCodeWithChain();
        chainMock.limit.mockResolvedValue([]);
        vi.mocked(PromoCode.countDocuments).mockResolvedValue(0);

        await AdminListController.getAllPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          codes: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
          },
        });
      });

      it("should return promo codes with populated owner data", async () => {
        const ownerId = new mongoose.Types.ObjectId();
        const programId = new mongoose.Types.ObjectId();
        const mockCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "TEST123",
          type: "bundle_discount",
          applicableToType: "program",
          discountAmount: 50,
          discountPercent: null,
          isGeneral: false,
          ownerId: {
            _id: ownerId,
            email: "owner@test.com",
            firstName: "John",
            lastName: "Doe",
            username: "johndoe",
          },
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
          createdBy: "admin123",
        };

        const chainMock = mockPromoCodeWithChain();
        chainMock.limit.mockResolvedValue([mockCode]);
        vi.mocked(PromoCode.countDocuments).mockResolvedValue(1);

        await AdminListController.getAllPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            codes: expect.arrayContaining([
              expect.objectContaining({
                code: "TEST123",
                ownerEmail: "owner@test.com",
                ownerName: "John Doe",
              }),
            ]),
          })
        );
      });

      it("should return promo code with username when firstName/lastName are missing", async () => {
        const ownerId = new mongoose.Types.ObjectId();
        const mockCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "CODE456",
          type: "staff_access",
          applicableToType: "event",
          discountAmount: null,
          discountPercent: 25,
          isGeneral: true,
          ownerId: {
            _id: ownerId,
            email: "user@test.com",
            firstName: "",
            lastName: "",
            username: "testuser",
          },
          isActive: true,
          isUsed: false,
          isExpired: false,
          isValid: true,
          expiresAt: null,
          usedAt: null,
          usedForProgramId: null,
          excludedProgramId: null,
          allowedProgramIds: null,
          allowedEventIds: null,
          createdAt: new Date(),
          createdBy: "admin123",
        };

        const chainMock = mockPromoCodeWithChain();
        chainMock.limit.mockResolvedValue([mockCode]);
        vi.mocked(PromoCode.countDocuments).mockResolvedValue(1);

        await AdminListController.getAllPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            codes: expect.arrayContaining([
              expect.objectContaining({
                ownerName: "testuser",
              }),
            ]),
          })
        );
      });

      it("should handle non-populated ownerId", async () => {
        const ownerId = new mongoose.Types.ObjectId();
        const mockCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "RAWID",
          type: "bundle_discount",
          applicableToType: "program",
          discountAmount: 100,
          discountPercent: null,
          isGeneral: false,
          ownerId: ownerId, // Not populated - just an ObjectId
          isActive: true,
          isUsed: false,
          isExpired: false,
          isValid: true,
          expiresAt: null,
          usedAt: null,
          usedForProgramId: null,
          excludedProgramId: null,
          allowedProgramIds: null,
          allowedEventIds: null,
          createdAt: new Date(),
          createdBy: "admin123",
        };

        const chainMock = mockPromoCodeWithChain();
        chainMock.limit.mockResolvedValue([mockCode]);
        vi.mocked(PromoCode.countDocuments).mockResolvedValue(1);

        await AdminListController.getAllPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            codes: expect.arrayContaining([
              expect.objectContaining({
                ownerId: ownerId,
                ownerEmail: undefined,
                ownerName: undefined,
              }),
            ]),
          })
        );
      });
    });

    describe("type filtering", () => {
      it("should filter by bundle_discount type", async () => {
        const chainMock = mockPromoCodeWithChain();
        chainMock.limit.mockResolvedValue([]);
        vi.mocked(PromoCode.countDocuments).mockResolvedValue(0);

        mockReq.query.type = "bundle_discount";

        await AdminListController.getAllPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.find).toHaveBeenCalledWith(
          expect.objectContaining({ type: "bundle_discount" })
        );
      });

      it("should filter by staff_access type", async () => {
        const chainMock = mockPromoCodeWithChain();
        chainMock.limit.mockResolvedValue([]);
        vi.mocked(PromoCode.countDocuments).mockResolvedValue(0);

        mockReq.query.type = "staff_access";

        await AdminListController.getAllPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.find).toHaveBeenCalledWith(
          expect.objectContaining({ type: "staff_access" })
        );
      });

      it('should not filter type when "all" is specified', async () => {
        const chainMock = mockPromoCodeWithChain();
        chainMock.limit.mockResolvedValue([]);
        vi.mocked(PromoCode.countDocuments).mockResolvedValue(0);

        mockReq.query.type = "all";

        await AdminListController.getAllPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.find).toHaveBeenCalledWith(
          expect.not.objectContaining({ type: expect.anything() })
        );
      });

      it("should not filter type when invalid type provided", async () => {
        const chainMock = mockPromoCodeWithChain();
        chainMock.limit.mockResolvedValue([]);
        vi.mocked(PromoCode.countDocuments).mockResolvedValue(0);

        mockReq.query.type = "invalid_type";

        await AdminListController.getAllPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.find).toHaveBeenCalledWith(
          expect.not.objectContaining({ type: expect.anything() })
        );
      });
    });

    describe("status filtering", () => {
      it("should filter active codes correctly", async () => {
        const chainMock = mockPromoCodeWithChain();
        chainMock.limit.mockResolvedValue([]);
        vi.mocked(PromoCode.countDocuments).mockResolvedValue(0);

        mockReq.query.status = "active";

        await AdminListController.getAllPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.find).toHaveBeenCalledWith(
          expect.objectContaining({
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
        const chainMock = mockPromoCodeWithChain();
        chainMock.limit.mockResolvedValue([]);
        vi.mocked(PromoCode.countDocuments).mockResolvedValue(0);

        mockReq.query.status = "expired";

        await AdminListController.getAllPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.find).toHaveBeenCalledWith(
          expect.objectContaining({
            expiresAt: { $lte: expect.any(Date) },
            isUsed: false,
          })
        );
      });

      it("should filter used codes correctly", async () => {
        const chainMock = mockPromoCodeWithChain();
        chainMock.limit.mockResolvedValue([]);
        vi.mocked(PromoCode.countDocuments).mockResolvedValue(0);

        mockReq.query.status = "used";

        await AdminListController.getAllPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.find).toHaveBeenCalledWith(
          expect.objectContaining({ isUsed: true })
        );
      });
    });

    describe("search functionality", () => {
      it("should search by code and user fields", async () => {
        const chainMock = mockPromoCodeWithChain();
        chainMock.limit.mockResolvedValue([]);
        vi.mocked(PromoCode.countDocuments).mockResolvedValue(0);

        const mockUserId = new mongoose.Types.ObjectId();
        vi.mocked(User.find).mockReturnValue({
          select: vi.fn().mockResolvedValue([{ _id: mockUserId }]),
        } as any);

        mockReq.query.search = "test";

        await AdminListController.getAllPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(User.find).toHaveBeenCalledWith({
          $or: [
            { username: expect.any(RegExp) },
            { email: expect.any(RegExp) },
            { firstName: expect.any(RegExp) },
            { lastName: expect.any(RegExp) },
          ],
        });

        expect(PromoCode.find).toHaveBeenCalledWith(
          expect.objectContaining({
            $or: expect.arrayContaining([
              { code: expect.any(RegExp) },
              { ownerId: { $in: [mockUserId] } },
            ]),
          })
        );
      });

      it("should not search when search term is empty", async () => {
        const chainMock = mockPromoCodeWithChain();
        chainMock.limit.mockResolvedValue([]);
        vi.mocked(PromoCode.countDocuments).mockResolvedValue(0);

        mockReq.query.search = "   ";

        await AdminListController.getAllPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(User.find).not.toHaveBeenCalled();
      });
    });

    describe("pagination", () => {
      it("should use default pagination values", async () => {
        const chainMock = mockPromoCodeWithChain();
        chainMock.limit.mockResolvedValue([]);
        vi.mocked(PromoCode.countDocuments).mockResolvedValue(0);

        await AdminListController.getAllPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(chainMock.skip).toHaveBeenCalledWith(0);
        expect(chainMock.limit).toHaveBeenCalledWith(20);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            pagination: expect.objectContaining({
              page: 1,
              limit: 20,
            }),
          })
        );
      });

      it("should handle custom page and limit", async () => {
        const chainMock = mockPromoCodeWithChain();
        chainMock.limit.mockResolvedValue([]);
        vi.mocked(PromoCode.countDocuments).mockResolvedValue(50);

        mockReq.query.page = "3";
        mockReq.query.limit = "10";

        await AdminListController.getAllPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(chainMock.skip).toHaveBeenCalledWith(20); // (3-1) * 10
        expect(chainMock.limit).toHaveBeenCalledWith(10);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            pagination: expect.objectContaining({
              page: 3,
              limit: 10,
              total: 50,
              totalPages: 5,
            }),
          })
        );
      });

      it("should cap limit at 100", async () => {
        const chainMock = mockPromoCodeWithChain();
        chainMock.limit.mockResolvedValue([]);
        vi.mocked(PromoCode.countDocuments).mockResolvedValue(0);

        mockReq.query.limit = "500";

        await AdminListController.getAllPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(chainMock.limit).toHaveBeenCalledWith(100);
      });

      it("should use minimum page of 1", async () => {
        const chainMock = mockPromoCodeWithChain();
        chainMock.limit.mockResolvedValue([]);
        vi.mocked(PromoCode.countDocuments).mockResolvedValue(0);

        mockReq.query.page = "-5";

        await AdminListController.getAllPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(chainMock.skip).toHaveBeenCalledWith(0);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            pagination: expect.objectContaining({
              page: 1,
            }),
          })
        );
      });

      it("should default to 20 when limit is 0", async () => {
        const chainMock = mockPromoCodeWithChain();
        chainMock.limit.mockResolvedValue([]);
        vi.mocked(PromoCode.countDocuments).mockResolvedValue(0);

        mockReq.query.limit = "0";

        await AdminListController.getAllPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        // parseInt('0', 10) || 20 = 20 (0 is falsy)
        expect(chainMock.limit).toHaveBeenCalledWith(20);
      });
    });

    describe("populated program and event data", () => {
      it("should extract and return usedForProgramTitle when populated", async () => {
        const programId = new mongoose.Types.ObjectId();
        const mockCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "USEDCODE",
          type: "bundle_discount",
          applicableToType: "program",
          discountAmount: 50,
          discountPercent: null,
          isGeneral: false,
          ownerId: null,
          isActive: false,
          isUsed: true,
          isExpired: false,
          isValid: false,
          expiresAt: null,
          usedAt: new Date(),
          usedForProgramId: {
            _id: programId,
            title: "Applied Program",
          },
          excludedProgramId: null,
          allowedProgramIds: null,
          allowedEventIds: null,
          createdAt: new Date(),
          createdBy: "admin123",
        };

        const chainMock = mockPromoCodeWithChain();
        chainMock.limit.mockResolvedValue([mockCode]);
        vi.mocked(PromoCode.countDocuments).mockResolvedValue(1);

        await AdminListController.getAllPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            codes: expect.arrayContaining([
              expect.objectContaining({
                usedForProgramId: programId,
                usedForProgramTitle: "Applied Program",
              }),
            ]),
          })
        );
      });

      it("should extract allowedEventTitles when populated", async () => {
        const eventId = new mongoose.Types.ObjectId();
        const mockCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "EVENTCODE",
          type: "staff_access",
          applicableToType: "event",
          discountAmount: null,
          discountPercent: 100,
          isGeneral: false,
          ownerId: null,
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
          createdBy: "admin123",
        };

        const chainMock = mockPromoCodeWithChain();
        chainMock.limit.mockResolvedValue([mockCode]);
        vi.mocked(PromoCode.countDocuments).mockResolvedValue(1);

        await AdminListController.getAllPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            codes: expect.arrayContaining([
              expect.objectContaining({
                allowedEventIds: [eventId.toString()],
                allowedEventTitles: ["Special Event"],
              }),
            ]),
          })
        );
      });
    });

    describe("error handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(PromoCode.find).mockImplementation(() => {
          throw new Error("Database connection failed");
        });

        await AdminListController.getAllPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to fetch promo codes.",
        });
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe("query chain verification", () => {
      it("should call populate, sort, skip, and limit in order", async () => {
        const chainMock = mockPromoCodeWithChain();
        chainMock.limit.mockResolvedValue([]);
        vi.mocked(PromoCode.countDocuments).mockResolvedValue(0);

        await AdminListController.getAllPromoCodes(
          mockReq as Request,
          mockRes as Response
        );

        expect(chainMock.populate).toHaveBeenCalledWith(
          "ownerId",
          "username email firstName lastName"
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
        expect(chainMock.skip).toHaveBeenCalled();
        expect(chainMock.limit).toHaveBeenCalled();
      });
    });
  });
});
