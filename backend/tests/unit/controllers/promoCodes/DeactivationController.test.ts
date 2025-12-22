import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import mongoose from "mongoose";
import DeactivationController from "../../../../src/controllers/promoCodes/DeactivationController";

// Mock dependencies
vi.mock("../../../../src/models/PromoCode");
vi.mock("../../../../src/services", () => ({
  EmailService: {
    sendPromoCodeDeactivatedEmail: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("../../../../src/controllers/unifiedMessageController", () => ({
  UnifiedMessageController: {
    createTargetedSystemMessage: vi.fn().mockResolvedValue({}),
  },
}));

import PromoCode from "../../../../src/models/PromoCode";
import { EmailService } from "../../../../src/services";

interface MockRequest extends Partial<Request> {
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

describe("DeactivationController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

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

  describe("deactivatePromoCode", () => {
    describe("validation", () => {
      it("should return 400 when id is missing", async () => {
        mockReq.params = {};

        await DeactivationController.deactivatePromoCode(
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
        mockReq.params.id = "invalid-id";

        await DeactivationController.deactivatePromoCode(
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

        await DeactivationController.deactivatePromoCode(
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

      it("should return 400 when promo code is already deactivated", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;

        const mockPromoCode = {
          _id: validId,
          code: "TESTCODE",
          isActive: false,
        };
        const populateMock = vi.fn().mockResolvedValue(mockPromoCode);
        vi.mocked(PromoCode.findById).mockReturnValue({
          populate: populateMock,
        } as any);

        await DeactivationController.deactivatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Promo code is already deactivated.",
        });
      });
    });

    describe("successful deactivation", () => {
      it("should deactivate promo code and send notifications", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        const ownerId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;

        const deactivateMock = vi.fn().mockResolvedValue(undefined);
        const mockPromoCode = {
          _id: validId,
          code: "DISCOUNT20",
          isActive: true,
          discountPercent: 20,
          ownerId: {
            _id: ownerId,
            email: "owner@test.com",
            firstName: "John",
            lastName: "Doe",
            username: "johndoe",
          },
          allowedProgramIds: null,
          populate: vi.fn().mockResolvedValue(undefined),
          deactivate: deactivateMock,
        };
        const populateMock = vi.fn().mockResolvedValue(mockPromoCode);
        vi.mocked(PromoCode.findById).mockReturnValue({
          populate: populateMock,
        } as any);

        await DeactivationController.deactivatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(deactivateMock).toHaveBeenCalled();
        expect(EmailService.sendPromoCodeDeactivatedEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            recipientEmail: "owner@test.com",
            recipientName: "John Doe",
            promoCode: "DISCOUNT20",
            discountPercent: 20,
            deactivatedBy: "Administrator Admin User",
          })
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Promo code deactivated successfully.",
          code: {
            _id: validId,
            code: "DISCOUNT20",
            isActive: true, // Still true in mock - real code sets it in deactivate()
          },
        });
      });

      it("should use username when firstName/lastName not available", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        const ownerId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;

        const mockPromoCode = {
          _id: validId,
          code: "CODE123",
          isActive: true,
          discountPercent: null,
          ownerId: {
            _id: ownerId,
            email: "owner@test.com",
            firstName: undefined,
            lastName: undefined,
            username: "owneruser",
          },
          allowedProgramIds: null,
          populate: vi.fn().mockResolvedValue(undefined),
          deactivate: vi.fn().mockResolvedValue(undefined),
        };
        const populateMock = vi.fn().mockResolvedValue(mockPromoCode);
        vi.mocked(PromoCode.findById).mockReturnValue({
          populate: populateMock,
        } as any);

        await DeactivationController.deactivatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(EmailService.sendPromoCodeDeactivatedEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            recipientName: "owneruser",
            discountPercent: 100, // Default when null
          })
        );
      });

      it("should populate and include allowed programs in notification", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        const ownerId = new mongoose.Types.ObjectId().toString();
        const programId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;

        const mockPromoCode = {
          _id: validId,
          code: "PROGRAMCODE",
          isActive: true,
          discountPercent: 50,
          ownerId: {
            _id: ownerId,
            email: "owner@test.com",
            firstName: "Jane",
            lastName: "Smith",
            username: "janesmith",
          },
          allowedProgramIds: [{ _id: programId, title: "Premium Program" }],
          populate: vi.fn().mockResolvedValue(undefined),
          deactivate: vi.fn().mockResolvedValue(undefined),
        };
        const populateMock = vi.fn().mockResolvedValue(mockPromoCode);
        vi.mocked(PromoCode.findById).mockReturnValue({
          populate: populateMock,
        } as any);

        await DeactivationController.deactivatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(mockPromoCode.populate).toHaveBeenCalledWith(
          "allowedProgramIds",
          "title"
        );
        expect(EmailService.sendPromoCodeDeactivatedEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            allowedPrograms: "Premium Program",
          })
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
          code: "NOUSER",
          isActive: true,
          discountPercent: 25,
          ownerId: null,
          allowedProgramIds: null,
          populate: vi.fn().mockResolvedValue(undefined),
          deactivate: vi.fn().mockResolvedValue(undefined),
        };
        const populateMock = vi.fn().mockResolvedValue(mockPromoCode);
        vi.mocked(PromoCode.findById).mockReturnValue({
          populate: populateMock,
        } as any);

        await DeactivationController.deactivatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          "No user found in request, skipping notifications"
        );
        expect(
          EmailService.sendPromoCodeDeactivatedEmail
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
          isActive: true,
          discountPercent: 30,
          ownerId: {
            _id: ownerId,
            email: "owner@test.com",
            firstName: "Test",
            lastName: "User",
            username: "testuser",
          },
          allowedProgramIds: null,
          populate: vi.fn().mockResolvedValue(undefined),
          deactivate: vi.fn().mockResolvedValue(undefined),
        };
        const populateMock = vi.fn().mockResolvedValue(mockPromoCode);
        vi.mocked(PromoCode.findById).mockReturnValue({
          populate: populateMock,
        } as any);

        vi.mocked(EmailService.sendPromoCodeDeactivatedEmail).mockRejectedValue(
          new Error("Email service down")
        );

        await DeactivationController.deactivatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Failed to send deactivation notifications:",
          expect.any(Error)
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
          })
        );
      });

      it("should use email when username not available for actor display", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        const ownerId = new mongoose.Types.ObjectId().toString();
        mockReq.params.id = validId;
        mockReq.user = {
          id: "admin123",
          _id: "admin123",
          role: "Moderator",
          email: "mod@test.com",
          username: undefined,
          firstName: undefined,
          lastName: undefined,
        };

        const mockPromoCode = {
          _id: validId,
          code: "ACTORTEST",
          isActive: true,
          discountPercent: 15,
          ownerId: {
            _id: ownerId,
            email: "owner@test.com",
            firstName: "Owner",
            lastName: "Person",
            username: "ownerperson",
          },
          allowedProgramIds: null,
          populate: vi.fn().mockResolvedValue(undefined),
          deactivate: vi.fn().mockResolvedValue(undefined),
        };
        const populateMock = vi.fn().mockResolvedValue(mockPromoCode);
        vi.mocked(PromoCode.findById).mockReturnValue({
          populate: populateMock,
        } as any);

        await DeactivationController.deactivatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(EmailService.sendPromoCodeDeactivatedEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            deactivatedBy: "Moderator mod@test.com",
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

        await DeactivationController.deactivatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to deactivate promo code.",
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Error deactivating promo code:",
          expect.any(Error)
        );
      });
    });
  });
});
