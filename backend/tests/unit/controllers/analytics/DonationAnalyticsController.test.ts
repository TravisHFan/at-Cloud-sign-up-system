import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Response } from "express";
import DonationAnalyticsController from "../../../../src/controllers/analytics/DonationAnalyticsController";

// Mock dependencies
vi.mock("../../../../src/models/Donation", () => ({
  default: {
    find: vi.fn(),
    aggregate: vi.fn(),
  },
}));

vi.mock("../../../../src/models/DonationTransaction", () => ({
  default: {
    find: vi.fn(),
  },
}));

import Donation from "../../../../src/models/Donation";
import DonationTransaction from "../../../../src/models/DonationTransaction";

interface MockRequest {
  user?: {
    _id: string;
    id: string;
    role: string;
    email: string;
  };
}

describe("DonationAnalyticsController", () => {
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
  });

  describe("getDonationAnalytics", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await DonationAnalyticsController.getDonationAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Authentication required",
        });
      });
    });

    describe("Authorization", () => {
      it("should return 403 for Member role", async () => {
        mockReq.user!.role = "Member";

        await DonationAnalyticsController.getDonationAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message:
            "Access restricted to Super Admin, Administrator, and Leader",
        });
      });

      it("should return 403 for Staff role", async () => {
        mockReq.user!.role = "Staff";

        await DonationAnalyticsController.getDonationAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(403);
      });

      it("should allow Super Admin access", async () => {
        mockReq.user!.role = "Super Admin";
        setupEmptyMocks();

        await DonationAnalyticsController.getDonationAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should allow Administrator access", async () => {
        mockReq.user!.role = "Administrator";
        setupEmptyMocks();

        await DonationAnalyticsController.getDonationAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should allow Leader access", async () => {
        mockReq.user!.role = "Leader";
        setupEmptyMocks();

        await DonationAnalyticsController.getDonationAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("Success", () => {
      it("should return analytics with empty data", async () => {
        setupEmptyMocks();

        await DonationAnalyticsController.getDonationAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.data.totalRevenue).toBe(0);
        expect(response.data.totalGifts).toBe(0);
        expect(response.data.uniqueDonors).toBe(0);
      });

      it("should calculate one-time and recurring breakdown correctly", async () => {
        const mockTransactions = [
          {
            userId: { toString: () => "user1" },
            type: "one-time",
            amount: 5000,
          },
          {
            userId: { toString: () => "user2" },
            type: "one-time",
            amount: 10000,
          },
          {
            userId: { toString: () => "user1" },
            type: "recurring",
            amount: 2500,
          },
          {
            userId: { toString: () => "user3" },
            type: "recurring",
            amount: 2500,
          },
        ];

        vi.mocked(DonationTransaction.find).mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockTransactions),
        } as any);
        vi.mocked(Donation.find).mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        } as any);
        vi.mocked(Donation.aggregate).mockResolvedValue([]);

        await DonationAnalyticsController.getDonationAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        const response = jsonMock.mock.calls[0][0];
        expect(response.data.oneTime.gifts).toBe(2);
        expect(response.data.oneTime.revenue).toBe(15000);
        expect(response.data.recurring.gifts).toBe(2);
        expect(response.data.recurring.revenue).toBe(5000);
        expect(response.data.totalRevenue).toBe(20000);
      });

      it("should calculate unique donors correctly", async () => {
        const mockTransactions = [
          {
            userId: { toString: () => "user1" },
            type: "one-time",
            amount: 5000,
          },
          {
            userId: { toString: () => "user1" },
            type: "one-time",
            amount: 5000,
          },
          {
            userId: { toString: () => "user2" },
            type: "one-time",
            amount: 5000,
          },
        ];

        vi.mocked(DonationTransaction.find).mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockTransactions),
        } as any);
        vi.mocked(Donation.find).mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        } as any);
        vi.mocked(Donation.aggregate).mockResolvedValue([]);

        await DonationAnalyticsController.getDonationAnalytics(
          mockReq as any,
          mockRes as Response
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.uniqueDonors).toBe(2);
      });

      it("should calculate retention rate correctly", async () => {
        // 3 donors, 2 with repeat donations
        const mockTransactions = [
          {
            userId: { toString: () => "user1" },
            type: "one-time",
            amount: 5000,
          },
          {
            userId: { toString: () => "user1" },
            type: "one-time",
            amount: 5000,
          },
          {
            userId: { toString: () => "user2" },
            type: "one-time",
            amount: 5000,
          },
          {
            userId: { toString: () => "user2" },
            type: "recurring",
            amount: 5000,
          },
          {
            userId: { toString: () => "user3" },
            type: "one-time",
            amount: 5000,
          },
        ];

        vi.mocked(DonationTransaction.find).mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockTransactions),
        } as any);
        vi.mocked(Donation.find).mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        } as any);
        vi.mocked(Donation.aggregate).mockResolvedValue([]);

        await DonationAnalyticsController.getDonationAnalytics(
          mockReq as any,
          mockRes as Response
        );

        const response = jsonMock.mock.calls[0][0];
        // 2 repeat donors out of 3 = 66.67%
        expect(response.data.retentionRate).toBeCloseTo(66.67, 1);
      });

      it("should include active, on-hold, and scheduled donations", async () => {
        vi.mocked(DonationTransaction.find).mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        } as any);

        // Mock Donation.find to return different results based on query
        vi.mocked(Donation.find)
          .mockReturnValueOnce({
            lean: vi.fn().mockResolvedValue([
              { amount: 5000, frequency: "monthly" },
              { amount: 10000, frequency: "weekly" },
            ]),
          } as any) // active recurring
          .mockReturnValueOnce({
            lean: vi.fn().mockResolvedValue([{ amount: 2500 }]),
          } as any) // scheduled one-time
          .mockReturnValueOnce({
            lean: vi.fn().mockResolvedValue([{ amount: 5000 }]),
          } as any); // on-hold

        vi.mocked(Donation.aggregate).mockResolvedValue([
          { _id: "monthly", count: 1, totalAmount: 5000 },
          { _id: "weekly", count: 1, totalAmount: 10000 },
        ]);

        await DonationAnalyticsController.getDonationAnalytics(
          mockReq as any,
          mockRes as Response
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.recurring.activeDonations).toBe(2);
        expect(response.data.recurring.scheduledDonations).toBe(1);
        expect(response.data.recurring.onHoldDonations).toBe(1);
      });

      it("should return frequency breakdown", async () => {
        vi.mocked(DonationTransaction.find).mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        } as any);
        vi.mocked(Donation.find).mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        } as any);
        vi.mocked(Donation.aggregate).mockResolvedValue([
          { _id: "monthly", count: 5, totalAmount: 25000 },
          { _id: "weekly", count: 3, totalAmount: 15000 },
        ]);

        await DonationAnalyticsController.getDonationAnalytics(
          mockReq as any,
          mockRes as Response
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.recurring.frequencyBreakdown).toHaveLength(2);
        expect(response.data.recurring.frequencyBreakdown[0]).toEqual({
          frequency: "monthly",
          count: 5,
          monthlyValue: 25000,
        });
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(DonationTransaction.find).mockReturnValue({
          lean: vi.fn().mockRejectedValue(new Error("Database error")),
        } as any);

        await DonationAnalyticsController.getDonationAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to fetch donation analytics",
        });
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });
  });

  // Helper function to set up empty mocks
  function setupEmptyMocks() {
    vi.mocked(DonationTransaction.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    } as any);
    vi.mocked(Donation.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    } as any);
    vi.mocked(Donation.aggregate).mockResolvedValue([]);
  }
});
