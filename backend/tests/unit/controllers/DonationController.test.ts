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
} from "../../../src/services/stripeService";

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

        await DonationController.createDonation(mockReq as any, mockRes as Response);

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

        await DonationController.createDonation(mockReq as any, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Amount and type are required.",
        });
      });

      it("should return 400 if type is missing", async () => {
        mockReq.body = { amount: 5000 };

        await DonationController.createDonation(mockReq as any, mockRes as Response);

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
          mockDonation as any
        );
        vi.mocked(createDonationCheckoutSession).mockResolvedValue({
          url: "https://checkout.stripe.com/session123",
          customer: "cus_123",
        } as any);

        await DonationController.createDonation(mockReq as any, mockRes as Response);

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
          mockDonation as any
        );
        vi.mocked(createDonationSubscription).mockResolvedValue({
          checkoutUrl: "https://checkout.stripe.com/sub123",
        } as any);

        await DonationController.createDonation(mockReq as any, mockRes as Response);

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
          new Error("Service error")
        );

        await DonationController.createDonation(mockReq as any, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock.mock.calls[0][0].success).toBe(false);

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
          mockRes as Response
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
          mockRes as Response
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
          mockRes as Response
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
  });

  describe("getMyDonations", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await DonationController.getMyDonations(mockReq as any, mockRes as Response);

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
          mockResult as any
        );

        await DonationController.getMyDonations(mockReq as any, mockRes as Response);

        expect(DonationService.getUserDonationHistory).toHaveBeenCalledWith(
          mockUserId,
          1,
          20,
          "giftDate",
          "desc"
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
          {} as any
        );

        await DonationController.getMyDonations(mockReq as any, mockRes as Response);

        expect(DonationService.getUserDonationHistory).toHaveBeenCalledWith(
          mockUserId,
          2,
          10,
          "amount",
          "asc"
        );
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on service error", async () => {
        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        vi.mocked(DonationService.getUserDonationHistory).mockRejectedValue(
          new Error("Database error")
        );

        await DonationController.getMyDonations(mockReq as any, mockRes as Response);

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
          mockRes as Response
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
          mockDonations as any
        );

        await DonationController.getMyScheduledDonations(
          mockReq as any,
          mockRes as Response
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
          new Error("Service error")
        );

        await DonationController.getMyScheduledDonations(
          mockReq as any,
          mockRes as Response
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
          mockStats as any
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
          new Error("Stats error")
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
});
