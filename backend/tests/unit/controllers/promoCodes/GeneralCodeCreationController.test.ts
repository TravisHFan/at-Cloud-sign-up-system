import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import GeneralCodeCreationController from "../../../../src/controllers/promoCodes/GeneralCodeCreationController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  PromoCode: {
    generateUniqueCode: vi.fn(),
    create: vi.fn(),
  },
}));

import { PromoCode } from "../../../../src/models";

interface MockRequest {
  body: Record<string, unknown>;
  user?: {
    _id: string;
    id: string;
    role: string;
    email: string;
    username?: string;
  };
}

describe("GeneralCodeCreationController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: any;

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
      body: {},
      user: {
        _id: "admin123",
        id: "admin123",
        role: "Administrator",
        email: "admin@test.com",
        username: "admin",
      },
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe("createGeneralStaffCode", () => {
    describe("authentication", () => {
      it("should return 401 when user is not authenticated", async () => {
        mockReq.user = undefined;

        await GeneralCodeCreationController.createGeneralStaffCode(
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
      it("should return 400 when description is missing", async () => {
        mockReq.body = { discountPercent: 50 };

        await GeneralCodeCreationController.createGeneralStaffCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Description is required.",
        });
      });

      it("should return 400 when description is not a string", async () => {
        mockReq.body = { description: 123, discountPercent: 50 };

        await GeneralCodeCreationController.createGeneralStaffCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Description is required.",
        });
      });

      it("should return 400 when discountPercent is missing", async () => {
        mockReq.body = { description: "Test code" };

        await GeneralCodeCreationController.createGeneralStaffCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Discount percent must be between 0 and 100.",
        });
      });

      it("should return 400 when discountPercent is below 0", async () => {
        mockReq.body = { description: "Test code", discountPercent: -10 };

        await GeneralCodeCreationController.createGeneralStaffCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Discount percent must be between 0 and 100.",
        });
      });

      it("should return 400 when discountPercent is above 100", async () => {
        mockReq.body = { description: "Test code", discountPercent: 150 };

        await GeneralCodeCreationController.createGeneralStaffCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Discount percent must be between 0 and 100.",
        });
      });

      it("should return 400 when expiresAt is in the past", async () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);
        mockReq.body = {
          description: "Test code",
          discountPercent: 50,
          expiresAt: pastDate.toISOString(),
        };

        await GeneralCodeCreationController.createGeneralStaffCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Expiration date must be in the future.",
        });
      });

      it("should return 400 when expiresAt is invalid date", async () => {
        mockReq.body = {
          description: "Test code",
          discountPercent: 50,
          expiresAt: "invalid-date",
        };

        await GeneralCodeCreationController.createGeneralStaffCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Expiration date must be in the future.",
        });
      });
    });

    describe("successful creation", () => {
      it("should create general staff code without expiration", async () => {
        mockReq.body = {
          description: "Staff discount code",
          discountPercent: 25,
        };

        const mockPromoCode = {
          _id: "code123",
          code: "STAFF25ABC",
          type: "staff_access",
          description: "Staff discount code",
          discountPercent: 25,
          expiresAt: null,
          isActive: true,
          createdAt: new Date(),
          createdBy: "admin",
        };

        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("STAFF25ABC");
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);

        await GeneralCodeCreationController.createGeneralStaffCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.generateUniqueCode).toHaveBeenCalled();
        expect(PromoCode.create).toHaveBeenCalledWith({
          code: "STAFF25ABC",
          type: "staff_access",
          description: "Staff discount code",
          discountPercent: 25,
          expiresAt: undefined,
          createdBy: "admin",
          isGeneral: true,
        });
        expect(statusMock).toHaveBeenCalledWith(201);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "General staff promo code created successfully.",
          data: {
            code: expect.objectContaining({
              code: "STAFF25ABC",
              type: "staff_access",
              discountPercent: 25,
              isGeneral: true,
            }),
          },
        });
      });

      it("should create general staff code with expiration", async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);

        mockReq.body = {
          description: "Limited time code",
          discountPercent: 50,
          expiresAt: futureDate.toISOString(),
        };

        const mockPromoCode = {
          _id: "code456",
          code: "LTD50XYZ",
          type: "staff_access",
          description: "Limited time code",
          discountPercent: 50,
          expiresAt: futureDate,
          isActive: true,
          createdAt: new Date(),
          createdBy: "admin",
        };

        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("LTD50XYZ");
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);

        await GeneralCodeCreationController.createGeneralStaffCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.create).toHaveBeenCalledWith(
          expect.objectContaining({
            expiresAt: expect.any(Date),
          })
        );
        expect(statusMock).toHaveBeenCalledWith(201);
      });

      it("should use email as createdBy when username not available", async () => {
        mockReq.user = {
          _id: "admin123",
          id: "admin123",
          role: "Administrator",
          email: "admin@test.com",
          username: undefined,
        };
        mockReq.body = {
          description: "Test code",
          discountPercent: 10,
        };

        const mockPromoCode = {
          _id: "code789",
          code: "TEST10",
          type: "staff_access",
          description: "Test code",
          discountPercent: 10,
          expiresAt: null,
          isActive: true,
          createdAt: new Date(),
          createdBy: "admin@test.com",
        };

        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("TEST10");
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);

        await GeneralCodeCreationController.createGeneralStaffCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.create).toHaveBeenCalledWith(
          expect.objectContaining({
            createdBy: "admin@test.com",
          })
        );
      });
    });

    describe("error handling", () => {
      it("should return 500 on database error", async () => {
        mockReq.body = {
          description: "Test code",
          discountPercent: 50,
        };

        vi.mocked(PromoCode.generateUniqueCode).mockRejectedValue(
          new Error("Database error")
        );

        await GeneralCodeCreationController.createGeneralStaffCode(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to create general staff promo code.",
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Error creating general staff promo code:",
          expect.any(Error)
        );
      });
    });
  });
});
