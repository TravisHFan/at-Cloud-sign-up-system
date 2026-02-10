import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Response } from "express";
import RewardCodeCreationController from "../../../../src/controllers/promoCodes/RewardCodeCreationController";

// Mock dependencies
vi.mock("../../../../src/models/PromoCode", () => ({
  default: {
    generateUniqueCode: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("../../../../src/models/User", () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock("../../../../src/services", () => ({
  EmailService: {
    sendStaffPromoCodeEmail: vi.fn(),
  },
}));

vi.mock("../../../../src/controllers/unifiedMessageController", () => ({
  UnifiedMessageController: {
    createTargetedSystemMessage: vi.fn(),
  },
}));

import PromoCode from "../../../../src/models/PromoCode";
import User from "../../../../src/models/User";
import { EmailService } from "../../../../src/services";

interface MockRequest {
  body: Record<string, unknown>;
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

describe("RewardCodeCreationController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: any;
  let consoleLogSpy: any;

  const mockUserId = "507f1f77bcf86cd799439011";
  const mockProgramId = "507f1f77bcf86cd799439012";
  const mockEventId = "507f1f77bcf86cd799439013";

  beforeEach(() => {
    vi.clearAllMocks();

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };

    mockReq = {
      body: {
        userId: mockUserId,
        discountPercent: 25,
      },
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
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe("createRewardCode", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await RewardCodeCreationController.createRewardCode(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Authentication required.",
        });
      });
    });

    describe("Validation", () => {
      it("should return 400 for missing userId", async () => {
        mockReq.body = { discountPercent: 25 };

        await RewardCodeCreationController.createRewardCode(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Valid user ID is required.",
        });
      });

      it("should return 400 for invalid userId", async () => {
        mockReq.body = { userId: "invalid", discountPercent: 25 };

        await RewardCodeCreationController.createRewardCode(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Valid user ID is required.",
        });
      });

      it("should return 400 for discount percent below 10", async () => {
        mockReq.body = { userId: mockUserId, discountPercent: 5 };

        await RewardCodeCreationController.createRewardCode(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message:
            "Discount percent must be between 10 and 100 for reward codes.",
        });
      });

      it("should return 400 for discount percent above 100", async () => {
        mockReq.body = { userId: mockUserId, discountPercent: 150 };

        await RewardCodeCreationController.createRewardCode(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message:
            "Discount percent must be between 10 and 100 for reward codes.",
        });
      });

      it("should return 400 for non-number discount percent", async () => {
        mockReq.body = { userId: mockUserId, discountPercent: "25" };

        await RewardCodeCreationController.createRewardCode(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message:
            "Discount percent must be between 10 and 100 for reward codes.",
        });
      });

      it("should return 404 if user not found", async () => {
        vi.mocked(User.findById).mockResolvedValue(null);

        await RewardCodeCreationController.createRewardCode(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "User not found.",
        });
      });

      it("should return 400 for invalid program ID in allowedProgramIds", async () => {
        vi.mocked(User.findById).mockResolvedValue({ _id: mockUserId });
        mockReq.body = {
          userId: mockUserId,
          discountPercent: 25,
          allowedProgramIds: ["invalid-id"],
        };

        await RewardCodeCreationController.createRewardCode(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid program ID in allowedProgramIds.",
        });
      });

      it("should return 400 for invalid event ID in allowedEventIds", async () => {
        vi.mocked(User.findById).mockResolvedValue({ _id: mockUserId });
        mockReq.body = {
          userId: mockUserId,
          discountPercent: 25,
          allowedEventIds: ["invalid-id"],
        };

        await RewardCodeCreationController.createRewardCode(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid event ID in allowedEventIds.",
        });
      });

      it("should return 400 for past expiration date", async () => {
        vi.mocked(User.findById).mockResolvedValue({ _id: mockUserId });
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);
        mockReq.body = {
          userId: mockUserId,
          discountPercent: 25,
          expiresAt: pastDate.toISOString(),
        };

        await RewardCodeCreationController.createRewardCode(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Expiration date must be in the future.",
        });
      });

      it("should return 400 for invalid (non-parseable) expiration date", async () => {
        vi.mocked(User.findById).mockResolvedValue({ _id: mockUserId });
        mockReq.body = {
          userId: mockUserId,
          discountPercent: 25,
          expiresAt: "not-a-valid-date",
        };

        await RewardCodeCreationController.createRewardCode(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Expiration date must be in the future.",
        });
      });
    });

    describe("Success", () => {
      it("should create a basic reward code successfully", async () => {
        vi.mocked(User.findById).mockResolvedValue({
          _id: mockUserId,
          email: "user@test.com",
        });
        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("REWARD123");

        const mockPromoCode = {
          _id: "promo123",
          code: "REWARD123",
          type: "reward",
          ownerId: {
            _id: mockUserId,
            email: "user@test.com",
            firstName: "Test",
            lastName: "User",
            username: "testuser",
          },
          discountPercent: 25,
          populate: vi.fn().mockResolvedValue(undefined),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);
        vi.mocked(EmailService.sendStaffPromoCodeEmail).mockResolvedValue(true);

        await RewardCodeCreationController.createRewardCode(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(201);
        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.message).toBe("Reward code created successfully.");
      });

      it("should create reward code with allowedProgramIds", async () => {
        vi.mocked(User.findById).mockResolvedValue({ _id: mockUserId });
        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("REWARD123");

        const mockPromoCode = {
          _id: "promo123",
          code: "REWARD123",
          type: "reward",
          ownerId: {
            _id: mockUserId,
            email: "user@test.com",
            username: "testuser",
          },
          discountPercent: 25,
          allowedProgramIds: [{ title: "Test Program" }],
          populate: vi.fn().mockResolvedValue(undefined),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);
        vi.mocked(EmailService.sendStaffPromoCodeEmail).mockResolvedValue(true);

        mockReq.body = {
          userId: mockUserId,
          discountPercent: 25,
          allowedProgramIds: [mockProgramId],
        };

        await RewardCodeCreationController.createRewardCode(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(201);
        expect(PromoCode.create).toHaveBeenCalledWith(
          expect.objectContaining({
            applicableToType: "program",
          }),
        );
      });

      it("should create reward code with allowedEventIds", async () => {
        vi.mocked(User.findById).mockResolvedValue({ _id: mockUserId });
        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("REWARD123");

        const mockPromoCode = {
          _id: "promo123",
          code: "REWARD123",
          type: "reward",
          ownerId: {
            _id: mockUserId,
            email: "user@test.com",
            username: "testuser",
          },
          discountPercent: 25,
          allowedEventIds: [{ title: "Test Event" }],
          populate: vi.fn().mockResolvedValue(undefined),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);
        vi.mocked(EmailService.sendStaffPromoCodeEmail).mockResolvedValue(true);

        mockReq.body = {
          userId: mockUserId,
          discountPercent: 25,
          allowedEventIds: [mockEventId],
        };

        await RewardCodeCreationController.createRewardCode(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(201);
        expect(PromoCode.create).toHaveBeenCalledWith(
          expect.objectContaining({
            applicableToType: "event",
          }),
        );
      });

      it("should handle notification failure gracefully", async () => {
        vi.mocked(User.findById).mockResolvedValue({ _id: mockUserId });
        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("REWARD123");

        const mockPromoCode = {
          _id: "promo123",
          code: "REWARD123",
          type: "reward",
          ownerId: {
            _id: mockUserId,
            email: "user@test.com",
            username: "testuser",
          },
          discountPercent: 25,
          populate: vi.fn().mockResolvedValue(undefined),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);
        vi.mocked(EmailService.sendStaffPromoCodeEmail).mockRejectedValue(
          new Error("Email failed"),
        );

        await RewardCodeCreationController.createRewardCode(
          mockReq as any,
          mockRes as Response,
        );

        // Should still succeed even if email fails
        expect(statusMock).toHaveBeenCalledWith(201);
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(User.findById).mockRejectedValue(new Error("Database error"));

        await RewardCodeCreationController.createRewardCode(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to create reward code.",
        });
      });
    });

    describe("Creator Name Fallback", () => {
      it("should use username when firstName/lastName are missing", async () => {
        // Set up user without firstName/lastName
        mockReq.user = {
          _id: "admin123",
          id: "admin123",
          role: "Administrator",
          email: "admin@test.com",
          username: "adminuser",
          // No firstName or lastName
        } as any;

        vi.mocked(User.findById).mockResolvedValue({
          _id: mockUserId,
          email: "user@test.com",
        });
        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("REWARD456");

        const mockPromoCode = {
          _id: "promo456",
          code: "REWARD456",
          type: "reward",
          ownerId: {
            _id: mockUserId,
            email: "user@test.com",
          },
          discountPercent: 25,
          populate: vi.fn().mockResolvedValue(undefined),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);

        await RewardCodeCreationController.createRewardCode(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(201);
      });

      it("should use email when firstName/lastName and username are missing", async () => {
        // Set up user with only email
        mockReq.user = {
          _id: "admin123",
          id: "admin123",
          role: "Administrator",
          email: "adminonly@test.com",
          // No firstName, lastName, or username
        } as any;

        vi.mocked(User.findById).mockResolvedValue({
          _id: mockUserId,
          email: "user@test.com",
        });
        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("REWARD789");

        const mockPromoCode = {
          _id: "promo789",
          code: "REWARD789",
          type: "reward",
          ownerId: {
            _id: mockUserId,
            email: "user@test.com",
          },
          discountPercent: 25,
          populate: vi.fn().mockResolvedValue(undefined),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);

        await RewardCodeCreationController.createRewardCode(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(201);
      });

      it("should fall back to 'Administrator' when role is missing", async () => {
        // Set up user without role
        mockReq.user = {
          _id: "admin123",
          id: "admin123",
          // No role
          email: "admin@test.com",
          firstName: "Admin",
          lastName: "User",
        } as any;

        vi.mocked(User.findById).mockResolvedValue({
          _id: mockUserId,
          email: "user@test.com",
        });
        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("REWARD101");

        const mockPromoCode = {
          _id: "promo101",
          code: "REWARD101",
          type: "reward",
          ownerId: {
            _id: mockUserId,
            email: "user@test.com",
          },
          discountPercent: 25,
          populate: vi.fn().mockResolvedValue(undefined),
        };
        vi.mocked(PromoCode.create).mockResolvedValue(mockPromoCode as any);

        await RewardCodeCreationController.createRewardCode(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(201);
      });
    });
  });
});
