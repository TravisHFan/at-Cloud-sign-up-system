import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import mongoose from "mongoose";
import ValidationController from "../../../../src/controllers/promoCodes/ValidationController";
import { PromoCode } from "../../../../src/models";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  PromoCode: {
    findOne: vi.fn().mockImplementation(() => ({
      populate: vi.fn().mockReturnThis(),
    })),
  },
}));

describe("ValidationController", () => {
  let mockReq: any;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let testUserId: mongoose.Types.ObjectId;
  let testProgramId: string;
  let isValidSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    testUserId = new mongoose.Types.ObjectId();
    testProgramId = new mongoose.Types.ObjectId().toString();

    // Spy on mongoose.Types.ObjectId.isValid
    isValidSpy = vi.spyOn(mongoose.Types.ObjectId, "isValid");

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };

    mockReq = {
      body: {},
      user: {
        _id: testUserId,
        role: "User",
        email: "user@test.com",
      },
    };
  });

  afterEach(() => {
    isValidSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe("validatePromoCode", () => {
    describe("authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await ValidationController.validatePromoCode(
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

    describe("input validation", () => {
      it("should return 400 if code is missing", async () => {
        mockReq.body = { programId: testProgramId };

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          valid: false,
          message: "Promo code is required.",
        });
      });

      it("should return 400 if code is not a string", async () => {
        mockReq.body = { code: 123, programId: testProgramId };

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          valid: false,
          message: "Promo code is required.",
        });
      });

      it("should return 400 if programId is missing", async () => {
        mockReq.body = { code: "TESTCODE" };

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          valid: false,
          message: "Valid program ID is required.",
        });
      });

      it("should return 400 if programId is invalid", async () => {
        mockReq.body = { code: "TESTCODE", programId: "invalid-id" };
        isValidSpy.mockReturnValue(false);

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          valid: false,
          message: "Valid program ID is required.",
        });
      });
    });

    describe("promo code lookup", () => {
      beforeEach(() => {
        isValidSpy.mockReturnValue(true);
      });

      it("should convert code to uppercase when searching", async () => {
        mockReq.body = { code: "testcode", programId: testProgramId };

        vi.mocked(PromoCode.findOne).mockReturnValue({
          populate: vi.fn().mockResolvedValue(null),
        } as any);

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.findOne).toHaveBeenCalledWith({
          code: "TESTCODE",
        });
      });

      it("should return valid=false if promo code does not exist", async () => {
        mockReq.body = { code: "NONEXISTENT", programId: testProgramId };

        vi.mocked(PromoCode.findOne).mockReturnValue({
          populate: vi.fn().mockResolvedValue(null),
        } as any);

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          valid: false,
          message: "Invalid promo code.",
        });
      });
    });

    describe("promo code validation rules", () => {
      beforeEach(() => {
        isValidSpy.mockReturnValue(true);
        mockReq.body = { code: "VALIDCODE", programId: testProgramId };
      });

      it("should reject inactive promo code", async () => {
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "VALIDCODE",
          isActive: false,
          isUsed: false,
          isExpired: false,
          isGeneral: true,
          canBeUsedForProgram: vi.fn().mockReturnValue({ valid: false }),
        };

        vi.mocked(PromoCode.findOne).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPromoCode),
        } as any);

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          valid: false,
          message: "This promo code has been deactivated.",
        });
      });

      it("should reject already used promo code", async () => {
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "VALIDCODE",
          isActive: true,
          isUsed: true,
          isExpired: false,
          isGeneral: true,
          canBeUsedForProgram: vi.fn().mockReturnValue({ valid: false }),
        };

        vi.mocked(PromoCode.findOne).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPromoCode),
        } as any);

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          valid: false,
          message: "This promo code has already been used.",
        });
      });

      it("should reject expired promo code", async () => {
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "VALIDCODE",
          isActive: true,
          isUsed: false,
          isExpired: true,
          isGeneral: true,
          canBeUsedForProgram: vi.fn().mockReturnValue({ valid: false }),
        };

        vi.mocked(PromoCode.findOne).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPromoCode),
        } as any);

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          valid: false,
          message: "This promo code has expired.",
        });
      });

      it("should reject bundle code for excluded program", async () => {
        const excludedProgramId = new mongoose.Types.ObjectId(testProgramId);
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "BUNDLECODE",
          isActive: true,
          isUsed: false,
          isExpired: false,
          isGeneral: true,
          excludedProgramId: {
            _id: excludedProgramId,
            name: "Excluded Program",
          },
          canBeUsedForProgram: vi.fn().mockReturnValue({ valid: false }),
        };

        vi.mocked(PromoCode.findOne).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPromoCode),
        } as any);

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          valid: false,
          message:
            "This bundle code cannot be used for the program you purchased (Excluded Program).",
        });
      });

      it("should reject staff code not allowed for program", async () => {
        const otherProgramId = new mongoose.Types.ObjectId();
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "STAFFCODE",
          isActive: true,
          isUsed: false,
          isExpired: false,
          isGeneral: true,
          allowedProgramIds: [otherProgramId],
          canBeUsedForProgram: vi.fn().mockReturnValue({ valid: false }),
        };

        vi.mocked(PromoCode.findOne).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPromoCode),
        } as any);

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          valid: false,
          message: "This staff code is not valid for this program.",
        });
      });

      it("should reject generic error for other invalid cases", async () => {
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "VALIDCODE",
          isActive: true,
          isUsed: false,
          isExpired: false,
          isGeneral: true,
          canBeUsedForProgram: vi.fn().mockReturnValue({ valid: false }),
        };

        vi.mocked(PromoCode.findOne).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPromoCode),
        } as any);

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          valid: false,
          message: "This promo code cannot be used for this program.",
        });
      });
    });

    describe("ownership validation", () => {
      beforeEach(() => {
        isValidSpy.mockReturnValue(true);
        mockReq.body = { code: "PERSONALCODE", programId: testProgramId };
      });

      it("should reject personal code belonging to another user", async () => {
        const otherUserId = new mongoose.Types.ObjectId();
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "PERSONALCODE",
          isGeneral: false,
          ownerId: otherUserId,
          isActive: true,
          isUsed: false,
          isExpired: false,
          canBeUsedForProgram: vi.fn().mockReturnValue({ valid: true }),
        };

        vi.mocked(PromoCode.findOne).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPromoCode),
        } as any);

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          valid: false,
          message: "This promo code belongs to another user.",
        });
      });

      it("should reject personal code without owner", async () => {
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "PERSONALCODE",
          isGeneral: false,
          ownerId: null,
          isActive: true,
          isUsed: false,
          isExpired: false,
          canBeUsedForProgram: vi.fn().mockReturnValue({ valid: true }),
        };

        vi.mocked(PromoCode.findOne).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPromoCode),
        } as any);

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          valid: false,
          message: "This promo code belongs to another user.",
        });
      });

      it("should allow personal code for owner", async () => {
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "PERSONALCODE",
          type: "staff_access",
          isGeneral: false,
          ownerId: testUserId,
          isActive: true,
          isUsed: false,
          isExpired: false,
          discountPercent: 50,
          discountAmount: null,
          expiresAt: new Date("2025-12-31"),
          canBeUsedForProgram: vi.fn().mockReturnValue({ valid: true }),
        };

        vi.mocked(PromoCode.findOne).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPromoCode),
        } as any);

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          valid: true,
          message: "Promo code is valid.",
          discount: {
            type: "percent",
            value: 50,
          },
          code: {
            _id: mockPromoCode._id,
            code: "PERSONALCODE",
            type: "staff_access",
            discountAmount: null,
            discountPercent: 50,
            expiresAt: mockPromoCode.expiresAt,
          },
        });
      });

      it("should allow general code for any user", async () => {
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "GENERALCODE",
          type: "staff_access",
          isGeneral: true,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: true,
          isUsed: false,
          isExpired: false,
          discountPercent: 30,
          discountAmount: null,
          expiresAt: new Date("2025-12-31"),
          canBeUsedForProgram: vi.fn().mockReturnValue({ valid: true }),
        };

        vi.mocked(PromoCode.findOne).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPromoCode),
        } as any);

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          valid: true,
          message: "Promo code is valid.",
          discount: {
            type: "percent",
            value: 30,
          },
          code: expect.objectContaining({
            code: "GENERALCODE",
            discountPercent: 30,
          }),
        });
      });
    });

    describe("discount type detection", () => {
      beforeEach(() => {
        isValidSpy.mockReturnValue(true);
        mockReq.body = { code: "DISCOUNTCODE", programId: testProgramId };
      });

      it("should return amount discount type when discountAmount is set", async () => {
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "DISCOUNTCODE",
          type: "bundle_discount",
          isGeneral: true,
          isActive: true,
          isUsed: false,
          isExpired: false,
          discountAmount: 100,
          discountPercent: null,
          expiresAt: new Date("2025-12-31"),
          canBeUsedForProgram: vi.fn().mockReturnValue({ valid: true }),
        };

        vi.mocked(PromoCode.findOne).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPromoCode),
        } as any);

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          valid: true,
          message: "Promo code is valid.",
          discount: {
            type: "amount",
            value: 100,
          },
          code: expect.objectContaining({
            discountAmount: 100,
          }),
        });
      });

      it("should return percent discount type when discountPercent is set", async () => {
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "DISCOUNTCODE",
          type: "staff_access",
          isGeneral: true,
          isActive: true,
          isUsed: false,
          isExpired: false,
          discountAmount: null,
          discountPercent: 75,
          expiresAt: new Date("2025-12-31"),
          canBeUsedForProgram: vi.fn().mockReturnValue({ valid: true }),
        };

        vi.mocked(PromoCode.findOne).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPromoCode),
        } as any);

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          valid: true,
          message: "Promo code is valid.",
          discount: {
            type: "percent",
            value: 75,
          },
          code: expect.objectContaining({
            discountPercent: 75,
          }),
        });
      });

      it("should default to 0 if neither discount is set", async () => {
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "DISCOUNTCODE",
          type: "staff_access",
          isGeneral: true,
          isActive: true,
          isUsed: false,
          isExpired: false,
          discountAmount: null,
          discountPercent: null,
          expiresAt: new Date("2025-12-31"),
          canBeUsedForProgram: vi.fn().mockReturnValue({ valid: true }),
        };

        vi.mocked(PromoCode.findOne).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPromoCode),
        } as any);

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            discount: {
              type: "percent",
              value: 0,
            },
          })
        );
      });
    });

    describe("error handling", () => {
      beforeEach(() => {
        isValidSpy.mockReturnValue(true);
        mockReq.body = { code: "TESTCODE", programId: testProgramId };
      });

      it("should return 500 on database error", async () => {
        vi.mocked(PromoCode.findOne).mockReturnValue({
          populate: vi.fn().mockRejectedValue(new Error("Database error")),
        } as any);

        const consoleErrorSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          valid: false,
          message: "Failed to validate promo code.",
        });

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Error validating promo code:",
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
      });

      it("should handle unexpected errors gracefully", async () => {
        vi.mocked(PromoCode.findOne).mockImplementation(() => {
          throw new Error("Unexpected error");
        });

        const consoleErrorSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          valid: false,
          message: "Failed to validate promo code.",
        });

        consoleErrorSpy.mockRestore();
      });
    });

    describe("edge cases", () => {
      beforeEach(() => {
        isValidSpy.mockReturnValue(true);
      });

      it("should handle empty string code", async () => {
        mockReq.body = { code: "", programId: testProgramId };

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          valid: false,
          message: "Promo code is required.",
        });
      });

      it("should handle whitespace-only code", async () => {
        mockReq.body = { code: "   ", programId: testProgramId };

        vi.mocked(PromoCode.findOne).mockReturnValue({
          populate: vi.fn().mockResolvedValue(null),
        } as any);

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        // Code gets trimmed and uppercased, so should search for empty string
        expect(PromoCode.findOne).toHaveBeenCalledWith({
          code: "   ",
        });
      });

      it("should handle very long code", async () => {
        const longCode = "A".repeat(1000);
        mockReq.body = { code: longCode, programId: testProgramId };

        vi.mocked(PromoCode.findOne).mockReturnValue({
          populate: vi.fn().mockResolvedValue(null),
        } as any);

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.findOne).toHaveBeenCalledWith({
          code: longCode.toUpperCase(),
        });
      });

      it("should handle code with special characters", async () => {
        const specialCode = "TEST-CODE_2024!";
        mockReq.body = { code: specialCode, programId: testProgramId };

        vi.mocked(PromoCode.findOne).mockReturnValue({
          populate: vi.fn().mockResolvedValue(null),
        } as any);

        await ValidationController.validatePromoCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.findOne).toHaveBeenCalledWith({
          code: specialCode.toUpperCase(),
        });
      });
    });
  });
});
