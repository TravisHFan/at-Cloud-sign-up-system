import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import mongoose from "mongoose";
import StaffCodeCreationController from "../../../../src/controllers/promoCodes/StaffCodeCreationController";
import PromoCode from "../../../../src/models/PromoCode";
import User from "../../../../src/models/User";
import { EmailService } from "../../../../src/services";

// Mock dependencies
vi.mock("../../../../src/models/PromoCode");
vi.mock("../../../../src/models/User");
vi.mock("../../../../src/services");
vi.mock("../../../../src/controllers/unifiedMessageController", () => ({
  UnifiedMessageController: {
    createTargetedSystemMessage: vi.fn().mockResolvedValue({}),
  },
}));

interface MockRequest extends Partial<Request> {
  user?: {
    _id: string;
    id: string;
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

describe("StaffCodeCreationController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let testUserId: string;
  let isValidSpy: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    testUserId = new mongoose.Types.ObjectId().toString();

    // Spy on mongoose.Types.ObjectId.isValid
    isValidSpy = vi.spyOn(mongoose.Types.ObjectId, "isValid");

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
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
        firstName: "Admin",
        lastName: "User",
      },
    };
  });

  afterEach(() => {
    isValidSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe("createStaffCode", () => {
    describe("authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Authentication required.",
        });
      });
    });

    describe("userId validation", () => {
      it("should return 400 if userId is missing", async () => {
        mockReq.body = { discountPercent: 50 };

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Valid user ID is required.",
        });
      });

      it("should return 400 if userId is invalid", async () => {
        mockReq.body = { userId: "invalid-id", discountPercent: 50 };
        isValidSpy.mockReturnValue(false);

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Valid user ID is required.",
        });
      });

      it("should return 404 if user does not exist", async () => {
        mockReq.body = { userId: testUserId, discountPercent: 50 };
        isValidSpy.mockReturnValue(true);
        vi.mocked(User.findById).mockResolvedValue(null);

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "User not found.",
        });
      });
    });

    describe("discountPercent validation", () => {
      beforeEach(() => {
        isValidSpy.mockReturnValue(true);
        vi.mocked(User.findById).mockResolvedValue({
          _id: testUserId,
          email: "user@test.com",
          username: "testuser",
        } as any);
      });

      it("should return 400 if discountPercent is not a number", async () => {
        mockReq.body = { userId: testUserId, discountPercent: "50" };

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Discount percent must be between 0 and 100.",
        });
      });

      it("should return 400 if discountPercent is negative", async () => {
        mockReq.body = { userId: testUserId, discountPercent: -10 };

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Discount percent must be between 0 and 100.",
        });
      });

      it("should return 400 if discountPercent exceeds 100", async () => {
        mockReq.body = { userId: testUserId, discountPercent: 101 };

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Discount percent must be between 0 and 100.",
        });
      });

      it("should accept 0 as valid discountPercent", async () => {
        mockReq.body = { userId: testUserId, discountPercent: 0 };

        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("STAFF123");
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "STAFF123",
          type: "staff_access",
          discountPercent: 0,
          ownerId: testUserId,
          isActive: true,
          createdBy: "admin",
          populate: vi.fn().mockReturnThis(),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);
        vi.mocked(EmailService.sendStaffPromoCodeEmail).mockResolvedValue(
          undefined,
        );

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(201);
      });

      it("should accept 100 as valid discountPercent", async () => {
        mockReq.body = { userId: testUserId, discountPercent: 100 };

        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("STAFF123");
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "STAFF123",
          type: "staff_access",
          discountPercent: 100,
          ownerId: testUserId,
          isActive: true,
          createdBy: "admin",
          populate: vi.fn().mockReturnThis(),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);
        vi.mocked(EmailService.sendStaffPromoCodeEmail).mockResolvedValue(
          undefined,
        );

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(201);
      });
    });

    describe("allowedProgramIds validation", () => {
      beforeEach(() => {
        isValidSpy.mockReturnValue(true);
        vi.mocked(User.findById).mockResolvedValue({
          _id: testUserId,
          email: "user@test.com",
          username: "testuser",
        } as any);
      });

      it("should accept empty allowedProgramIds array", async () => {
        mockReq.body = {
          userId: testUserId,
          discountPercent: 50,
          allowedProgramIds: [],
        };

        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("STAFF123");
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "STAFF123",
          type: "staff_access",
          discountPercent: 50,
          ownerId: testUserId,
          isActive: true,
          createdBy: "admin",
          populate: vi.fn().mockReturnThis(),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);
        vi.mocked(EmailService.sendStaffPromoCodeEmail).mockResolvedValue(
          undefined,
        );

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(PromoCode.create).toHaveBeenCalledWith(
          expect.objectContaining({
            allowedProgramIds: undefined,
          }),
        );
      });

      it("should return 400 if allowedProgramIds contains invalid ID", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        mockReq.body = {
          userId: testUserId,
          discountPercent: 50,
          allowedProgramIds: [validId, "invalid-id"],
        };

        isValidSpy.mockImplementation((id: string) => {
          return id === validId || id === testUserId;
        });

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid program ID in allowedProgramIds.",
        });
      });

      it("should accept valid allowedProgramIds", async () => {
        const programId1 = new mongoose.Types.ObjectId().toString();
        const programId2 = new mongoose.Types.ObjectId().toString();
        mockReq.body = {
          userId: testUserId,
          discountPercent: 50,
          allowedProgramIds: [programId1, programId2],
        };

        isValidSpy.mockReturnValue(true);
        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("STAFF123");
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "STAFF123",
          type: "staff_access",
          discountPercent: 50,
          ownerId: testUserId,
          allowedProgramIds: [{ title: "Program 1" }, { title: "Program 2" }],
          isActive: true,
          createdBy: "admin",
          populate: vi.fn().mockReturnThis(),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);
        vi.mocked(EmailService.sendStaffPromoCodeEmail).mockResolvedValue(
          undefined,
        );

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(201);
        expect(PromoCode.create).toHaveBeenCalledWith(
          expect.objectContaining({
            allowedProgramIds: expect.arrayContaining([
              expect.any(mongoose.Types.ObjectId),
              expect.any(mongoose.Types.ObjectId),
            ]),
          }),
        );
      });

      it("should handle non-array allowedProgramIds", async () => {
        mockReq.body = {
          userId: testUserId,
          discountPercent: 50,
          allowedProgramIds: "not-an-array",
        };

        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("STAFF123");
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "STAFF123",
          type: "staff_access",
          discountPercent: 50,
          ownerId: testUserId,
          isActive: true,
          createdBy: "admin",
          populate: vi.fn().mockReturnThis(),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);
        vi.mocked(EmailService.sendStaffPromoCodeEmail).mockResolvedValue(
          undefined,
        );

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        // Should be treated as undefined
        expect(PromoCode.create).toHaveBeenCalledWith(
          expect.objectContaining({
            allowedProgramIds: undefined,
          }),
        );
      });
    });

    describe("allowedEventIds validation", () => {
      beforeEach(() => {
        isValidSpy.mockReturnValue(true);
        vi.mocked(User.findById).mockResolvedValue({
          _id: testUserId,
          email: "user@test.com",
          username: "testuser",
        } as any);
      });

      it("should return 400 if allowedEventIds contains invalid ID", async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        mockReq.body = {
          userId: testUserId,
          discountPercent: 50,
          allowedEventIds: [validId, "invalid-id"],
        };

        // Make isValid return false for the invalid ID
        isValidSpy.mockImplementation((id: string) => {
          return id !== "invalid-id";
        });

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid event ID in allowedEventIds.",
        });
      });

      it("should accept valid allowedEventIds", async () => {
        const eventId1 = new mongoose.Types.ObjectId().toString();
        const eventId2 = new mongoose.Types.ObjectId().toString();
        mockReq.body = {
          userId: testUserId,
          discountPercent: 50,
          allowedEventIds: [eventId1, eventId2],
        };

        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("STAFF123");
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "STAFF123",
          type: "staff_access",
          discountPercent: 50,
          ownerId: testUserId,
          allowedEventIds: [{ title: "Event 1" }, { title: "Event 2" }],
          isActive: true,
          createdBy: "admin",
          populate: vi.fn().mockReturnThis(),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);
        vi.mocked(EmailService.sendStaffPromoCodeEmail).mockResolvedValue(
          undefined,
        );

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(PromoCode.create).toHaveBeenCalledWith(
          expect.objectContaining({
            allowedEventIds: expect.arrayContaining([
              expect.any(mongoose.Types.ObjectId),
            ]),
          }),
        );
      });

      it("should accept empty allowedEventIds array", async () => {
        mockReq.body = {
          userId: testUserId,
          discountPercent: 50,
          allowedEventIds: [],
        };

        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("STAFF123");
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "STAFF123",
          type: "staff_access",
          discountPercent: 50,
          ownerId: testUserId,
          isActive: true,
          createdBy: "admin",
          populate: vi.fn().mockReturnThis(),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);
        vi.mocked(EmailService.sendStaffPromoCodeEmail).mockResolvedValue(
          undefined,
        );

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(PromoCode.create).toHaveBeenCalledWith(
          expect.objectContaining({
            allowedEventIds: undefined,
          }),
        );
      });
    });

    describe("expiresAt validation", () => {
      beforeEach(() => {
        isValidSpy.mockReturnValue(true);
        vi.mocked(User.findById).mockResolvedValue({
          _id: testUserId,
          email: "user@test.com",
          username: "testuser",
        } as any);
      });

      it("should return 400 if expiresAt is in the past", async () => {
        const pastDate = new Date("2020-01-01");
        mockReq.body = {
          userId: testUserId,
          discountPercent: 50,
          expiresAt: pastDate.toISOString(),
        };

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Expiration date must be in the future.",
        });
      });

      it("should return 400 if expiresAt is invalid date", async () => {
        mockReq.body = {
          userId: testUserId,
          discountPercent: 50,
          expiresAt: "invalid-date",
        };

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Expiration date must be in the future.",
        });
      });

      it("should accept future expiresAt date", async () => {
        const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        mockReq.body = {
          userId: testUserId,
          discountPercent: 50,
          expiresAt: futureDate.toISOString(),
        };

        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("STAFF123");
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "STAFF123",
          type: "staff_access",
          discountPercent: 50,
          ownerId: testUserId,
          expiresAt: futureDate,
          isActive: true,
          createdBy: "admin",
          populate: vi.fn().mockReturnThis(),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);
        vi.mocked(EmailService.sendStaffPromoCodeEmail).mockResolvedValue(
          undefined,
        );

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(201);
        expect(PromoCode.create).toHaveBeenCalledWith(
          expect.objectContaining({
            expiresAt: expect.any(Date),
          }),
        );
      });

      it("should accept undefined expiresAt", async () => {
        mockReq.body = {
          userId: testUserId,
          discountPercent: 50,
        };

        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("STAFF123");
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "STAFF123",
          type: "staff_access",
          discountPercent: 50,
          ownerId: testUserId,
          isActive: true,
          createdBy: "admin",
          populate: vi.fn().mockReturnThis(),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);
        vi.mocked(EmailService.sendStaffPromoCodeEmail).mockResolvedValue(
          undefined,
        );

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(PromoCode.create).toHaveBeenCalledWith(
          expect.objectContaining({
            expiresAt: undefined,
          }),
        );
      });
    });

    describe("code creation", () => {
      beforeEach(() => {
        isValidSpy.mockReturnValue(true);
        vi.mocked(User.findById).mockResolvedValue({
          _id: testUserId,
          email: "user@test.com",
          username: "testuser",
          firstName: "Test",
          lastName: "User",
        } as any);
      });

      it("should generate unique code", async () => {
        mockReq.body = { userId: testUserId, discountPercent: 50 };

        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("UNIQUE123");
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "UNIQUE123",
          type: "staff_access",
          discountPercent: 50,
          ownerId: {
            _id: testUserId,
            email: "user@test.com",
            username: "testuser",
          },
          isActive: true,
          createdBy: "admin",
          populate: vi.fn().mockReturnThis(),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);
        vi.mocked(EmailService.sendStaffPromoCodeEmail).mockResolvedValue(
          undefined,
        );

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(PromoCode.generateUniqueCode).toHaveBeenCalled();
        expect(PromoCode.create).toHaveBeenCalledWith(
          expect.objectContaining({
            code: "UNIQUE123",
          }),
        );
      });

      it("should create promo code with correct type", async () => {
        mockReq.body = { userId: testUserId, discountPercent: 50 };

        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("STAFF123");
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "STAFF123",
          type: "staff_access",
          discountPercent: 50,
          ownerId: {
            _id: testUserId,
            email: "user@test.com",
            username: "testuser",
          },
          isActive: true,
          createdBy: "admin",
          populate: vi.fn().mockReturnThis(),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);
        vi.mocked(EmailService.sendStaffPromoCodeEmail).mockResolvedValue(
          undefined,
        );

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(PromoCode.create).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "staff_access",
          }),
        );
      });

      it("should set createdBy from user username", async () => {
        mockReq.body = { userId: testUserId, discountPercent: 50 };

        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("STAFF123");
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "STAFF123",
          type: "staff_access",
          discountPercent: 50,
          ownerId: {
            _id: testUserId,
            email: "user@test.com",
            username: "testuser",
          },
          isActive: true,
          createdBy: "admin",
          populate: vi.fn().mockReturnThis(),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);
        vi.mocked(EmailService.sendStaffPromoCodeEmail).mockResolvedValue(
          undefined,
        );

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(PromoCode.create).toHaveBeenCalledWith(
          expect.objectContaining({
            createdBy: "admin",
          }),
        );
      });

      it("should fallback to email if username is missing", async () => {
        mockReq.user = {
          _id: "admin123",
          id: "admin123",
          role: "Administrator",
          email: "admin@test.com",
        };
        mockReq.body = { userId: testUserId, discountPercent: 50 };

        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("STAFF123");
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "STAFF123",
          type: "staff_access",
          discountPercent: 50,
          ownerId: {
            _id: testUserId,
            email: "user@test.com",
            username: "testuser",
          },
          isActive: true,
          createdBy: "admin@test.com",
          populate: vi.fn().mockReturnThis(),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);
        vi.mocked(EmailService.sendStaffPromoCodeEmail).mockResolvedValue(
          undefined,
        );

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(PromoCode.create).toHaveBeenCalledWith(
          expect.objectContaining({
            createdBy: "admin@test.com",
          }),
        );
      });
    });

    describe("notifications", () => {
      beforeEach(() => {
        isValidSpy.mockReturnValue(true);
        vi.mocked(User.findById).mockResolvedValue({
          _id: testUserId,
          email: "user@test.com",
          username: "testuser",
          firstName: "Test",
          lastName: "User",
        } as any);
      });

      it("should send email notification", async () => {
        mockReq.body = { userId: testUserId, discountPercent: 75 };

        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("NOTIFY123");
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "NOTIFY123",
          type: "staff_access",
          discountPercent: 75,
          ownerId: {
            _id: testUserId,
            email: "user@test.com",
            username: "testuser",
            firstName: "Test",
            lastName: "User",
          },
          isActive: true,
          createdBy: "admin",
          populate: vi.fn().mockReturnThis(),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);
        vi.mocked(EmailService.sendStaffPromoCodeEmail).mockResolvedValue(
          undefined,
        );

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(EmailService.sendStaffPromoCodeEmail).toHaveBeenCalledWith({
          recipientEmail: "user@test.com",
          recipientName: "Test User",
          promoCode: "NOTIFY123",
          discountPercent: 75,
          allowedPrograms: undefined,
          expiresAt: undefined,
          createdBy: "admin",
        });
      });

      it("should continue if email notification fails", async () => {
        mockReq.body = { userId: testUserId, discountPercent: 50 };

        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("STAFF123");
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "STAFF123",
          type: "staff_access",
          discountPercent: 50,
          ownerId: {
            _id: testUserId,
            email: "user@test.com",
            username: "testuser",
          },
          isActive: true,
          createdBy: "admin",
          populate: vi.fn().mockReturnThis(),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);
        vi.mocked(EmailService.sendStaffPromoCodeEmail).mockRejectedValue(
          new Error("Email service down"),
        );

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(201);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Failed to send notifications for staff promo code:",
          expect.any(Error),
        );
      });
    });

    describe("response", () => {
      beforeEach(() => {
        isValidSpy.mockReturnValue(true);
        vi.mocked(User.findById).mockResolvedValue({
          _id: testUserId,
          email: "user@test.com",
          username: "testuser",
          firstName: "Test",
          lastName: "User",
        } as any);
      });

      it("should return 201 with created code data", async () => {
        mockReq.body = { userId: testUserId, discountPercent: 60 };

        const codeId = new mongoose.Types.ObjectId();
        const createdAt = new Date();
        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue(
          "RESPONSE123",
        );
        const mockPromoCode = {
          _id: codeId,
          code: "RESPONSE123",
          type: "staff_access",
          discountPercent: 60,
          ownerId: {
            _id: testUserId,
            email: "user@test.com",
            username: "testuser",
            firstName: "Test",
            lastName: "User",
          },
          isActive: true,
          createdBy: "admin",
          createdAt,
          populate: vi.fn().mockReturnThis(),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);
        vi.mocked(EmailService.sendStaffPromoCodeEmail).mockResolvedValue(
          undefined,
        );

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(201);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Staff promo code created successfully.",
          data: {
            code: {
              _id: codeId,
              code: "RESPONSE123",
              type: "staff_access",
              discountPercent: 60,
              ownerId: testUserId,
              ownerEmail: "user@test.com",
              ownerName: "Test User",
              allowedProgramIds: undefined,
              expiresAt: undefined,
              isActive: true,
              createdAt,
              createdBy: "admin",
            },
          },
        });
      });

      it("should use username if firstName/lastName are missing", async () => {
        mockReq.body = { userId: testUserId, discountPercent: 50 };

        vi.mocked(User.findById).mockResolvedValue({
          _id: testUserId,
          email: "user@test.com",
          username: "testuser",
        } as any);

        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("STAFF123");
        const mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "STAFF123",
          type: "staff_access",
          discountPercent: 50,
          ownerId: {
            _id: testUserId,
            email: "user@test.com",
            username: "testuser",
          },
          isActive: true,
          createdBy: "admin",
          populate: vi.fn().mockReturnThis(),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);
        vi.mocked(EmailService.sendStaffPromoCodeEmail).mockResolvedValue(
          undefined,
        );

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              code: expect.objectContaining({
                ownerName: "testuser",
              }),
            }),
          }),
        );
      });
    });

    describe("error handling", () => {
      beforeEach(() => {
        isValidSpy.mockReturnValue(true);
        vi.mocked(User.findById).mockResolvedValue({
          _id: testUserId,
          email: "user@test.com",
          username: "testuser",
        } as any);
      });

      it("should return 500 on code generation error", async () => {
        mockReq.body = { userId: testUserId, discountPercent: 50 };

        vi.mocked(PromoCode.generateUniqueCode).mockRejectedValue(
          new Error("Generation failed"),
        );

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to create staff promo code.",
        });
      });

      it("should return 500 on database error", async () => {
        mockReq.body = { userId: testUserId, discountPercent: 50 };

        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("STAFF123");
        vi.mocked(PromoCode.create).mockRejectedValue(new Error("DB error"));

        await StaffCodeCreationController.createStaffCode(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to create staff promo code.",
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Error creating staff promo code:",
          expect.any(Error),
        );
      });
    });
  });
});
