import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import mongoose from "mongoose";
import ReactivationController from "../../../../src/controllers/promoCodes/ReactivationController";

// Mock dependencies
vi.mock("../../../../src/models/PromoCode");
vi.mock("../../../../src/services", () => ({
  EmailService: {
    sendPromoCodeReactivatedEmail: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("../../../../src/controllers/unifiedMessageController", () => ({
  UnifiedMessageController: {
    createTargetedSystemMessage: vi.fn().mockResolvedValue({}),
  },
}));

import PromoCode from "../../../../src/models/PromoCode";
import { EmailService } from "../../../../src/services";

interface MockRequest {
  params: Record<string, string>;
  user?: {
    id: string;
    _id: string;
    role: string;
    email: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    gender?: string;
    roleInAtCloud?: string;
  };
}

describe("ReactivationController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

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
        username: "admin",
        firstName: "Admin",
        lastName: "User",
      },
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe("reactivatePromoCode", () => {
    describe("validation", () => {
      it("should return 400 when id is missing", async () => {
        mockReq.params = {};

        await ReactivationController.reactivatePromoCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Valid promo code ID is required.",
        });
      });

      it("should return 400 when id is invalid", async () => {
        mockReq.params.id = "not-a-valid-id";

        await ReactivationController.reactivatePromoCode(
          mockReq as Request,
          mockRes as Response,
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

        await ReactivationController.reactivatePromoCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(PromoCode.findById).toHaveBeenCalledWith(validId);
        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Promo code not found.",
        });
      });

      it("should return 400 when promo code is already active", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;

        const mockPromoCode = {
          _id: validId,
          code: "ACTIVETEST",
          isActive: true,
        };
        const populateMock = vi.fn().mockResolvedValue(mockPromoCode);
        vi.mocked(PromoCode.findById).mockReturnValue({
          populate: populateMock,
        } as any);

        await ReactivationController.reactivatePromoCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Promo code is already active.",
        });
      });
    });

    describe("successful reactivation", () => {
      it("should reactivate promo code and send notifications", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        const ownerId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;

        const reactivateMock = vi.fn().mockResolvedValue(undefined);
        const expiresAt = new Date("2025-12-31");
        const mockPromoCode = {
          _id: validId,
          code: "REACTIVATE20",
          isActive: false,
          discountPercent: 20,
          expiresAt,
          ownerId: {
            _id: ownerId,
            email: "owner@test.com",
            firstName: "John",
            lastName: "Doe",
            username: "johndoe",
          },
          allowedProgramIds: null,
          populate: vi.fn().mockResolvedValue(undefined),
          reactivate: reactivateMock,
        };
        const populateMock = vi.fn().mockResolvedValue(mockPromoCode);
        vi.mocked(PromoCode.findById).mockReturnValue({
          populate: populateMock,
        } as any);

        await ReactivationController.reactivatePromoCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(reactivateMock).toHaveBeenCalled();
        expect(EmailService.sendPromoCodeReactivatedEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            recipientEmail: "owner@test.com",
            recipientName: "John Doe",
            promoCode: "REACTIVATE20",
            discountPercent: 20,
            expiresAt: expiresAt.toISOString(),
            reactivatedBy: "Administrator Admin User",
          }),
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Promo code reactivated successfully.",
          code: expect.objectContaining({
            _id: validId,
            code: "REACTIVATE20",
          }),
        });
      });

      it("should use username when firstName/lastName not available", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        const ownerId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;

        const mockPromoCode = {
          _id: validId,
          code: "NONAME",
          isActive: false,
          discountPercent: null,
          expiresAt: null,
          ownerId: {
            _id: ownerId,
            email: "user@test.com",
            firstName: undefined,
            lastName: undefined,
            username: "justuser",
          },
          allowedProgramIds: null,
          populate: vi.fn().mockResolvedValue(undefined),
          reactivate: vi.fn().mockResolvedValue(undefined),
        };
        const populateMock = vi.fn().mockResolvedValue(mockPromoCode);
        vi.mocked(PromoCode.findById).mockReturnValue({
          populate: populateMock,
        } as any);

        await ReactivationController.reactivatePromoCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(EmailService.sendPromoCodeReactivatedEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            recipientName: "justuser",
            discountPercent: 100, // Default when null
            expiresAt: undefined, // null?.toISOString() = undefined
          }),
        );
      });

      it("should populate and include allowed programs in notification", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        const ownerId = new mongoose.Types.ObjectId().toString();
        const programId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;

        const mockPromoCode = {
          _id: validId,
          code: "WITHPROGRAMS",
          isActive: false,
          discountPercent: 75,
          expiresAt: null,
          ownerId: {
            _id: ownerId,
            email: "owner@test.com",
            firstName: "Test",
            lastName: "Owner",
            username: "testowner",
          },
          allowedProgramIds: [{ _id: programId, title: "Gold Membership" }],
          populate: vi.fn().mockResolvedValue(undefined),
          reactivate: vi.fn().mockResolvedValue(undefined),
        };
        const populateMock = vi.fn().mockResolvedValue(mockPromoCode);
        vi.mocked(PromoCode.findById).mockReturnValue({
          populate: populateMock,
        } as any);

        await ReactivationController.reactivatePromoCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(mockPromoCode.populate).toHaveBeenCalledWith(
          "allowedProgramIds",
          "title",
        );
        expect(EmailService.sendPromoCodeReactivatedEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            allowedPrograms: "Gold Membership",
          }),
        );
      });
    });

    describe("notification handling", () => {
      it("should warn when req.user is missing", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;
        mockReq.user = undefined;

        const mockPromoCode = {
          _id: validId,
          code: "NOUSERCODE",
          isActive: false,
          discountPercent: 50,
          expiresAt: null,
          ownerId: null,
          allowedProgramIds: null,
          populate: vi.fn().mockResolvedValue(undefined),
          reactivate: vi.fn().mockResolvedValue(undefined),
        };
        const populateMock = vi.fn().mockResolvedValue(mockPromoCode);
        vi.mocked(PromoCode.findById).mockReturnValue({
          populate: populateMock,
        } as any);

        await ReactivationController.reactivatePromoCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          "No user found in request, skipping notifications",
        );
        expect(
          EmailService.sendPromoCodeReactivatedEmail,
        ).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should continue with success even if notifications fail", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        const ownerId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;

        const mockPromoCode = {
          _id: validId,
          code: "FAILNOTIFY",
          isActive: false,
          discountPercent: 30,
          expiresAt: null,
          ownerId: {
            _id: ownerId,
            email: "owner@test.com",
            firstName: "Test",
            lastName: "User",
            username: "testuser",
          },
          allowedProgramIds: null,
          populate: vi.fn().mockResolvedValue(undefined),
          reactivate: vi.fn().mockResolvedValue(undefined),
        };
        const populateMock = vi.fn().mockResolvedValue(mockPromoCode);
        vi.mocked(PromoCode.findById).mockReturnValue({
          populate: populateMock,
        } as any);

        vi.mocked(EmailService.sendPromoCodeReactivatedEmail).mockRejectedValue(
          new Error("Email service unavailable"),
        );

        await ReactivationController.reactivatePromoCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Failed to send reactivation notifications:",
          expect.any(Error),
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
          }),
        );
      });
    });

    describe("error handling", () => {
      it("should return 500 on database error", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;

        vi.mocked(PromoCode.findById).mockImplementation(() => {
          throw new Error("Database error");
        });

        await ReactivationController.reactivatePromoCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to reactivate promo code.",
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Error reactivating promo code:",
          expect.any(Error),
        );
      });
    });

    describe("Actor display formatting", () => {
      it("should use admin username when admin firstName/lastName not available", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        const ownerId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;
        // Admin user without firstName/lastName
        mockReq.user = {
          id: "admin123",
          _id: "admin123",
          role: "Super Admin",
          email: "admin@test.com",
          username: "adminuser",
          firstName: undefined,
          lastName: undefined,
        };

        const mockPromoCode = {
          _id: validId,
          code: "TESTCODE",
          isActive: false,
          discountPercent: 25,
          expiresAt: null,
          ownerId: {
            _id: ownerId,
            email: "owner@test.com",
            firstName: "Owner",
            lastName: "User",
          },
          allowedProgramIds: null,
          populate: vi.fn().mockResolvedValue(undefined),
          reactivate: vi.fn().mockResolvedValue(undefined),
        };
        const populateMock = vi.fn().mockResolvedValue(mockPromoCode);
        vi.mocked(PromoCode.findById).mockReturnValue({
          populate: populateMock,
        } as any);

        await ReactivationController.reactivatePromoCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(EmailService.sendPromoCodeReactivatedEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            reactivatedBy: "Super Admin adminuser",
          }),
        );
      });
    });
  });
});
