import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Response } from "express";
import DonationController from "../../../src/controllers/DonationController";

// Mock dependencies
vi.mock("../../../src/services/DonationService", () => ({
  default: {
    createDonation: vi.fn(),
    getUserDonationHistory: vi.fn(),
    getUserScheduledDonations: vi.fn(),
    getUserDonationStats: vi.fn(),
    updateDonation: vi.fn(),
    holdDonation: vi.fn(),
    resumeDonation: vi.fn(),
    cancelDonation: vi.fn(),
    getAllDonations: vi.fn(),
    getAdminDonationStats: vi.fn(),
  },
}));

vi.mock("../../../src/models/Donation", () => ({
  default: {
    findOne: vi.fn(),
  },
  DonationFrequency: {},
  DonationType: {},
}));

vi.mock("../../../src/services/stripeService", () => ({
  createDonationCheckoutSession: vi.fn(),
  createDonationSubscription: vi.fn(),
  updateDonationSubscription: vi.fn(),
  pauseDonationSubscription: vi.fn(),
  resumeDonationSubscription: vi.fn(),
  cancelDonationSubscription: vi.fn(),
}));

vi.mock("../../../src/services/LoggerService", () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
  }),
}));

import DonationService from "../../../src/services/DonationService";
import Donation from "../../../src/models/Donation";
import {
  createDonationCheckoutSession,
  createDonationSubscription,
  updateDonationSubscription,
  pauseDonationSubscription,
  resumeDonationSubscription,
  cancelDonationSubscription,
} from "../../../src/services/stripeService";
import { ValidationError, NotFoundError } from "../../../src/utils/errors";

interface MockRequest {
  user?: {
    _id: string;
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  body: Record<string, unknown>;
  params: Record<string, string>;
  query: Record<string, string>;
}

describe("DonationController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  const mockUserId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };

    mockReq = {
      user: {
        _id: mockUserId,
        id: mockUserId,
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      },
      body: {},
      params: {},
      query: {},
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createDonation", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await DonationController.createDonation(
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
      it("should return 400 if amount is missing", async () => {
        mockReq.body = { type: "one-time" };

        await DonationController.createDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Amount and type are required.",
        });
      });

      it("should return 400 if type is missing", async () => {
        mockReq.body = { amount: 5000 };

        await DonationController.createDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Amount and type are required.",
        });
      });
    });

    describe("One-time donation", () => {
      it("should create a one-time donation successfully", async () => {
        mockReq.body = {
          amount: 5000,
          type: "one-time",
          giftDate: "2024-12-25",
        };

        const mockDonation = {
          _id: "donation123",
          save: vi.fn(),
        };

        vi.mocked(DonationService.createDonation).mockResolvedValue(
          mockDonation as any,
        );
        vi.mocked(createDonationCheckoutSession).mockResolvedValue({
          url: "https://checkout.stripe.com/session123",
          customer: "cus_123",
        } as any);

        await DonationController.createDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(DonationService.createDonation).toHaveBeenCalled();
        expect(createDonationCheckoutSession).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(201);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Donation created successfully.",
          data: {
            donationId: "donation123",
            checkoutUrl: "https://checkout.stripe.com/session123",
          },
        });
      });
    });

    describe("Recurring donation", () => {
      it("should create a recurring donation successfully", async () => {
        mockReq.body = {
          amount: 2500,
          type: "recurring",
          frequency: "monthly",
          startDate: "2024-01-01",
        };

        const mockDonation = {
          _id: "donation456",
          save: vi.fn(),
        };

        vi.mocked(DonationService.createDonation).mockResolvedValue(
          mockDonation as any,
        );
        vi.mocked(createDonationSubscription).mockResolvedValue({
          checkoutUrl: "https://checkout.stripe.com/sub123",
        } as any);

        await DonationController.createDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(DonationService.createDonation).toHaveBeenCalled();
        expect(createDonationSubscription).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(201);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Donation created successfully.",
          data: {
            donationId: "donation456",
            checkoutUrl: "https://checkout.stripe.com/sub123",
          },
        });
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on service error", async () => {
        mockReq.body = { amount: 5000, type: "one-time" };

        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        vi.mocked(DonationService.createDonation).mockRejectedValue(
          new Error("Service error"),
        );

        await DonationController.createDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock.mock.calls[0][0].success).toBe(false);

        consoleSpy.mockRestore();
      });

      it("should return default message on non-Error throw", async () => {
        mockReq.body = { amount: 5000, type: "one-time" };

        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        vi.mocked(DonationService.createDonation).mockRejectedValue(
          "string error",
        );

        await DonationController.createDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to create donation.",
        });

        consoleSpy.mockRestore();
      });
    });
  });

  describe("retryDonationCheckout", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await DonationController.retryDonationCheckout(
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
      it("should return 404 if donation not found", async () => {
        mockReq.params = { donationId: "invalid123" };

        vi.mocked(Donation.findOne).mockResolvedValue(null);

        await DonationController.retryDonationCheckout(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Pending donation not found.",
        });
      });
    });

    describe("Success", () => {
      it("should retry checkout successfully", async () => {
        mockReq.params = { donationId: "donation789" };

        const mockDonation = {
          _id: "donation789",
          userId: mockUserId,
          amount: 5000,
          giftDate: new Date("2024-12-25"),
        };

        vi.mocked(Donation.findOne).mockResolvedValue(mockDonation as any);
        vi.mocked(createDonationCheckoutSession).mockResolvedValue({
          url: "https://checkout.stripe.com/retry123",
        } as any);

        await DonationController.retryDonationCheckout(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: {
            checkoutUrl: "https://checkout.stripe.com/retry123",
          },
        });
      });
    });

    describe("Error Handling", () => {
      it("should return 500 with error message on Error instance", async () => {
        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        mockReq.params = { donationId: "donation789" };

        const mockDonation = {
          _id: "donation789",
          userId: mockUserId,
          amount: 5000,
          giftDate: new Date("2024-12-25"),
        };

        vi.mocked(Donation.findOne).mockResolvedValue(mockDonation as any);
        vi.mocked(createDonationCheckoutSession).mockRejectedValue(
          new Error("Stripe checkout failed"),
        );

        await DonationController.retryDonationCheckout(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Stripe checkout failed",
        });

        consoleSpy.mockRestore();
      });

      it("should return 500 with default message on non-Error throw", async () => {
        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        mockReq.params = { donationId: "donation789" };

        const mockDonation = {
          _id: "donation789",
          userId: mockUserId,
          amount: 5000,
          giftDate: new Date("2024-12-25"),
        };

        vi.mocked(Donation.findOne).mockResolvedValue(mockDonation as any);
        vi.mocked(createDonationCheckoutSession).mockRejectedValue(
          "string error",
        );

        await DonationController.retryDonationCheckout(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to retry donation checkout.",
        });

        consoleSpy.mockRestore();
      });
    });
  });

  describe("getMyDonations", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await DonationController.getMyDonations(
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

    describe("Success", () => {
      it("should return donation history with default pagination", async () => {
        const mockResult = {
          donations: [{ _id: "d1", amount: 5000 }],
          total: 1,
          page: 1,
          totalPages: 1,
        };

        vi.mocked(DonationService.getUserDonationHistory).mockResolvedValue(
          mockResult as any,
        );

        await DonationController.getMyDonations(
          mockReq as any,
          mockRes as Response,
        );

        expect(DonationService.getUserDonationHistory).toHaveBeenCalledWith(
          mockUserId,
          1,
          20,
          "giftDate",
          "desc",
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockResult,
        });
      });

      it("should handle custom pagination", async () => {
        mockReq.query = {
          page: "2",
          limit: "10",
          sortBy: "amount",
          sortOrder: "asc",
        };

        vi.mocked(DonationService.getUserDonationHistory).mockResolvedValue(
          {} as any,
        );

        await DonationController.getMyDonations(
          mockReq as any,
          mockRes as Response,
        );

        expect(DonationService.getUserDonationHistory).toHaveBeenCalledWith(
          mockUserId,
          2,
          10,
          "amount",
          "asc",
        );
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on service error", async () => {
        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        vi.mocked(DonationService.getUserDonationHistory).mockRejectedValue(
          new Error("Database error"),
        );

        await DonationController.getMyDonations(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to fetch donation history.",
        });

        consoleSpy.mockRestore();
      });
    });
  });

  describe("getMyScheduledDonations", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await DonationController.getMyScheduledDonations(
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

    describe("Success", () => {
      it("should return scheduled donations", async () => {
        const mockDonations = [
          { _id: "d1", frequency: "monthly", status: "active" },
        ];

        vi.mocked(DonationService.getUserScheduledDonations).mockResolvedValue(
          mockDonations as any,
        );

        await DonationController.getMyScheduledDonations(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: {
            scheduled: mockDonations,
          },
        });
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on service error", async () => {
        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        vi.mocked(DonationService.getUserScheduledDonations).mockRejectedValue(
          new Error("Service error"),
        );

        await DonationController.getMyScheduledDonations(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to fetch scheduled donations.",
        });

        consoleSpy.mockRestore();
      });
    });
  });

  describe("getStats", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await DonationController.getStats(mockReq as any, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Authentication required.",
        });
      });
    });

    describe("Success", () => {
      it("should return donation stats", async () => {
        const mockStats = {
          totalDonated: 25000,
          donationCount: 5,
          averageAmount: 5000,
        };

        vi.mocked(DonationService.getUserDonationStats).mockResolvedValue(
          mockStats as any,
        );

        await DonationController.getStats(mockReq as any, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockStats,
        });
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on service error", async () => {
        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        vi.mocked(DonationService.getUserDonationStats).mockRejectedValue(
          new Error("Stats error"),
        );

        await DonationController.getStats(mockReq as any, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to fetch donation stats.",
        });

        consoleSpy.mockRestore();
      });
    });
  });

  describe("editDonation", () => {
    beforeEach(() => {
      mockReq.params = { id: "donation123" };
      mockReq.body = { amount: 5000 };
    });

    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await DonationController.editDonation(
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

    describe("Success", () => {
      it("should update a one-time donation without Stripe updates", async () => {
        const mockDonation = {
          _id: "donation123",
          type: "one-time",
          amount: 5000,
        };

        vi.mocked(DonationService.updateDonation).mockResolvedValue(
          mockDonation as any,
        );

        await DonationController.editDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Donation updated successfully.",
          data: { donation: mockDonation },
        });
      });

      it("should update a recurring donation and update Stripe subscription", async () => {
        const mockDonation = {
          _id: "donation123",
          type: "recurring",
          stripeSubscriptionId: "sub_123",
          amount: 5000,
        };

        mockReq.body = { amount: 7500, frequency: "monthly" };

        vi.mocked(DonationService.updateDonation).mockResolvedValue(
          mockDonation as any,
        );
        vi.mocked(updateDonationSubscription).mockResolvedValue({} as any);

        await DonationController.editDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(updateDonationSubscription).toHaveBeenCalledWith({
          subscriptionId: "sub_123",
          amount: 750000, // 7500 * 100 cents
          frequency: "monthly",
        });
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should handle endDate updates for recurring donations", async () => {
        const mockDonation = {
          _id: "donation123",
          type: "recurring",
          stripeSubscriptionId: "sub_123",
        };

        const endDate = new Date("2027-01-01").toISOString();
        mockReq.body = { endDate };

        vi.mocked(DonationService.updateDonation).mockResolvedValue(
          mockDonation as any,
        );
        vi.mocked(updateDonationSubscription).mockResolvedValue({} as any);

        await DonationController.editDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(updateDonationSubscription).toHaveBeenCalledWith(
          expect.objectContaining({
            subscriptionId: "sub_123",
            endDate: expect.any(Date),
          }),
        );
      });

      it("should clear endDate when null is passed", async () => {
        const mockDonation = {
          _id: "donation123",
          type: "recurring",
          stripeSubscriptionId: "sub_123",
        };

        mockReq.body = { endDate: null };

        vi.mocked(DonationService.updateDonation).mockResolvedValue(
          mockDonation as any,
        );
        vi.mocked(updateDonationSubscription).mockResolvedValue({} as any);

        await DonationController.editDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(updateDonationSubscription).toHaveBeenCalledWith(
          expect.objectContaining({
            endDate: null,
          }),
        );
      });

      it("should handle all update fields", async () => {
        const mockDonation = {
          _id: "donation123",
          type: "one-time",
        };

        mockReq.body = {
          amount: 10000,
          frequency: "weekly",
          startDate: "2027-01-15",
          giftDate: "2027-01-20",
          endDate: "2027-12-31",
          endAfterOccurrences: 12,
        };

        vi.mocked(DonationService.updateDonation).mockResolvedValue(
          mockDonation as any,
        );

        await DonationController.editDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(DonationService.updateDonation).toHaveBeenCalledWith(
          "donation123",
          mockUserId,
          expect.objectContaining({
            amount: 1000000, // 10000 * 100 cents
            frequency: "weekly",
            endAfterOccurrences: 12,
          }),
        );
      });
    });

    describe("Error Handling", () => {
      it("should return 400 for ValidationError", async () => {
        vi.mocked(DonationService.updateDonation).mockRejectedValue(
          new ValidationError("Invalid amount"),
        );

        await DonationController.editDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid amount",
        });
      });

      it("should return 404 for NotFoundError", async () => {
        vi.mocked(DonationService.updateDonation).mockRejectedValue(
          new NotFoundError("Donation not found"),
        );

        await DonationController.editDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Donation not found",
        });
      });

      it("should return 500 for generic errors", async () => {
        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        vi.mocked(DonationService.updateDonation).mockRejectedValue(
          new Error("Database error"),
        );

        await DonationController.editDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Database error",
        });

        consoleSpy.mockRestore();
      });
    });
  });

  describe("holdDonation", () => {
    beforeEach(() => {
      mockReq.params = { id: "donation123" };
    });

    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await DonationController.holdDonation(
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

    describe("Success", () => {
      it("should hold a donation and pause Stripe subscription", async () => {
        const mockDonation = {
          _id: "donation123",
          status: "on-hold",
          stripeSubscriptionId: "sub_123",
        };

        vi.mocked(DonationService.holdDonation).mockResolvedValue(
          mockDonation as any,
        );
        vi.mocked(pauseDonationSubscription).mockResolvedValue({} as any);

        await DonationController.holdDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(DonationService.holdDonation).toHaveBeenCalledWith(
          "donation123",
          mockUserId,
        );
        expect(pauseDonationSubscription).toHaveBeenCalledWith("sub_123");
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Donation placed on hold.",
          data: { donation: mockDonation },
        });
      });

      it("should hold a donation without Stripe call if no subscription", async () => {
        const mockDonation = {
          _id: "donation123",
          status: "on-hold",
        };

        vi.mocked(DonationService.holdDonation).mockResolvedValue(
          mockDonation as any,
        );

        await DonationController.holdDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(pauseDonationSubscription).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("Error Handling", () => {
      it("should return 400 for ValidationError", async () => {
        vi.mocked(DonationService.holdDonation).mockRejectedValue(
          new ValidationError("Cannot hold this donation"),
        );

        await DonationController.holdDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it("should return 404 for NotFoundError", async () => {
        vi.mocked(DonationService.holdDonation).mockRejectedValue(
          new NotFoundError("Donation not found"),
        );

        await DonationController.holdDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(404);
      });

      it("should return 500 for generic errors", async () => {
        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        vi.mocked(DonationService.holdDonation).mockRejectedValue(
          new Error("Service error"),
        );

        await DonationController.holdDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);

        consoleSpy.mockRestore();
      });
    });
  });

  describe("resumeDonation", () => {
    beforeEach(() => {
      mockReq.params = { id: "donation123" };
    });

    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await DonationController.resumeDonation(
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

    describe("Success", () => {
      it("should resume a donation and resume Stripe subscription", async () => {
        const mockDonation = {
          _id: "donation123",
          status: "active",
          stripeSubscriptionId: "sub_123",
        };

        vi.mocked(DonationService.resumeDonation).mockResolvedValue(
          mockDonation as any,
        );
        vi.mocked(resumeDonationSubscription).mockResolvedValue({} as any);

        await DonationController.resumeDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(DonationService.resumeDonation).toHaveBeenCalledWith(
          "donation123",
          mockUserId,
        );
        expect(resumeDonationSubscription).toHaveBeenCalledWith("sub_123");
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Donation resumed.",
          data: { donation: mockDonation },
        });
      });

      it("should resume a donation without Stripe call if no subscription", async () => {
        const mockDonation = {
          _id: "donation123",
          status: "active",
        };

        vi.mocked(DonationService.resumeDonation).mockResolvedValue(
          mockDonation as any,
        );

        await DonationController.resumeDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(resumeDonationSubscription).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("Error Handling", () => {
      it("should return 400 for ValidationError", async () => {
        vi.mocked(DonationService.resumeDonation).mockRejectedValue(
          new ValidationError("Cannot resume this donation"),
        );

        await DonationController.resumeDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it("should return 404 for NotFoundError", async () => {
        vi.mocked(DonationService.resumeDonation).mockRejectedValue(
          new NotFoundError("Donation not found"),
        );

        await DonationController.resumeDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(404);
      });

      it("should return 500 for generic errors", async () => {
        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        vi.mocked(DonationService.resumeDonation).mockRejectedValue(
          new Error("Service error"),
        );

        await DonationController.resumeDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);

        consoleSpy.mockRestore();
      });
    });
  });

  describe("cancelDonation", () => {
    beforeEach(() => {
      mockReq.params = { id: "donation123" };
    });

    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await DonationController.cancelDonation(
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

    describe("Success", () => {
      it("should cancel a recurring donation and cancel Stripe subscription", async () => {
        const mockDonation = {
          _id: "donation123",
          type: "recurring",
          status: "cancelled",
          stripeSubscriptionId: "sub_123",
        };

        vi.mocked(DonationService.cancelDonation).mockResolvedValue(
          mockDonation as any,
        );
        vi.mocked(cancelDonationSubscription).mockResolvedValue({} as any);

        await DonationController.cancelDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(DonationService.cancelDonation).toHaveBeenCalledWith(
          "donation123",
          mockUserId,
        );
        expect(cancelDonationSubscription).toHaveBeenCalledWith("sub_123");
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Donation cancelled.",
          data: { donation: mockDonation },
        });
      });

      it("should cancel a one-time donation without Stripe call", async () => {
        const mockDonation = {
          _id: "donation123",
          type: "one-time",
          status: "cancelled",
        };

        vi.mocked(DonationService.cancelDonation).mockResolvedValue(
          mockDonation as any,
        );

        await DonationController.cancelDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(cancelDonationSubscription).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should cancel a recurring donation without Stripe call if no subscription", async () => {
        const mockDonation = {
          _id: "donation123",
          type: "recurring",
          status: "cancelled",
          // No stripeSubscriptionId
        };

        vi.mocked(DonationService.cancelDonation).mockResolvedValue(
          mockDonation as any,
        );

        await DonationController.cancelDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(cancelDonationSubscription).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("Error Handling", () => {
      it("should return 400 for ValidationError", async () => {
        vi.mocked(DonationService.cancelDonation).mockRejectedValue(
          new ValidationError("Cannot cancel this donation"),
        );

        await DonationController.cancelDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it("should return 404 for NotFoundError", async () => {
        vi.mocked(DonationService.cancelDonation).mockRejectedValue(
          new NotFoundError("Donation not found"),
        );

        await DonationController.cancelDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(404);
      });

      it("should return 500 for generic errors", async () => {
        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        vi.mocked(DonationService.cancelDonation).mockRejectedValue(
          new Error("Service error"),
        );

        await DonationController.cancelDonation(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);

        consoleSpy.mockRestore();
      });
    });
  });

  describe("getAllDonations", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await DonationController.getAllDonations(
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

    describe("Success", () => {
      it("should return all donations with default pagination", async () => {
        const mockResult = {
          donations: [{ _id: "d1" }, { _id: "d2" }],
          total: 2,
          page: 1,
          totalPages: 1,
        };

        vi.mocked(DonationService.getAllDonations).mockResolvedValue(
          mockResult as any,
        );

        await DonationController.getAllDonations(
          mockReq as any,
          mockRes as Response,
        );

        expect(DonationService.getAllDonations).toHaveBeenCalledWith(
          1,
          20,
          "",
          "all",
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockResult,
        });
      });

      it("should pass query parameters correctly", async () => {
        mockReq.query = {
          page: "2",
          limit: "50",
          search: "john",
          status: "completed",
        };

        const mockResult = {
          donations: [],
          total: 0,
          page: 2,
          totalPages: 0,
        };

        vi.mocked(DonationService.getAllDonations).mockResolvedValue(
          mockResult as any,
        );

        await DonationController.getAllDonations(
          mockReq as any,
          mockRes as Response,
        );

        expect(DonationService.getAllDonations).toHaveBeenCalledWith(
          2,
          50,
          "john",
          "completed",
        );
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on service error", async () => {
        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        vi.mocked(DonationService.getAllDonations).mockRejectedValue(
          new Error("Database error"),
        );

        await DonationController.getAllDonations(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to fetch donations.",
        });

        consoleSpy.mockRestore();
      });
    });
  });

  describe("getAdminStats", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await DonationController.getAdminStats(
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

    describe("Success", () => {
      it("should return admin donation statistics", async () => {
        const mockStats = {
          totalDonations: 100,
          totalAmount: 500000,
          activeRecurring: 25,
          monthlyRevenue: 50000,
        };

        vi.mocked(DonationService.getAdminDonationStats).mockResolvedValue(
          mockStats as any,
        );

        await DonationController.getAdminStats(
          mockReq as any,
          mockRes as Response,
        );

        expect(DonationService.getAdminDonationStats).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockStats,
        });
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on service error", async () => {
        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        vi.mocked(DonationService.getAdminDonationStats).mockRejectedValue(
          new Error("Stats error"),
        );

        await DonationController.getAdminStats(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to fetch donation statistics.",
        });

        consoleSpy.mockRestore();
      });
    });
  });
});
