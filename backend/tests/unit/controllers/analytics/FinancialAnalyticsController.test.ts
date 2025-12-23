import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Response } from "express";
import FinancialAnalyticsController from "../../../../src/controllers/analytics/FinancialAnalyticsController";

// Mock dependencies
vi.mock("../../../../src/models/Purchase", () => ({
  default: {
    find: vi.fn(),
  },
}));

vi.mock("../../../../src/services/DonationService", () => ({
  default: {
    getAdminDonationStats: vi.fn(),
  },
}));

import Purchase from "../../../../src/models/Purchase";
import DonationService from "../../../../src/services/DonationService";

interface MockRequest {
  user?: {
    _id: string;
    id: string;
    role: string;
    email: string;
  };
}

describe("FinancialAnalyticsController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: any;

  const mockDonationStats = {
    totalRevenue: 500000, // $5000 in cents
    totalDonations: 50,
    uniqueDonors: 25,
    activeRecurringRevenue: 10000,
    last30Days: {
      revenue: 100000,
      donations: 10,
    },
  };

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

  describe("getFinancialSummary", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await FinancialAnalyticsController.getFinancialSummary(
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

        await FinancialAnalyticsController.getFinancialSummary(
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

        await FinancialAnalyticsController.getFinancialSummary(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(403);
      });

      it("should allow Super Admin access", async () => {
        mockReq.user!.role = "Super Admin";
        vi.mocked(Purchase.find).mockResolvedValue([]);
        vi.mocked(DonationService.getAdminDonationStats).mockResolvedValue(
          mockDonationStats
        );

        await FinancialAnalyticsController.getFinancialSummary(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should allow Administrator access", async () => {
        mockReq.user!.role = "Administrator";
        vi.mocked(Purchase.find).mockResolvedValue([]);
        vi.mocked(DonationService.getAdminDonationStats).mockResolvedValue(
          mockDonationStats
        );

        await FinancialAnalyticsController.getFinancialSummary(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should allow Leader access", async () => {
        mockReq.user!.role = "Leader";
        vi.mocked(Purchase.find).mockResolvedValue([]);
        vi.mocked(DonationService.getAdminDonationStats).mockResolvedValue(
          mockDonationStats
        );

        await FinancialAnalyticsController.getFinancialSummary(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("Success", () => {
      it("should return financial summary with empty data", async () => {
        vi.mocked(Purchase.find).mockResolvedValue([]);
        vi.mocked(DonationService.getAdminDonationStats).mockResolvedValue({
          totalRevenue: 0,
          totalDonations: 0,
          uniqueDonors: 0,
          activeRecurringRevenue: 0,
          last30Days: { revenue: 0, donations: 0 },
        });

        await FinancialAnalyticsController.getFinancialSummary(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.data.totalRevenue).toBe(0);
        expect(response.data.totalTransactions).toBe(0);
      });

      it("should calculate combined totals correctly", async () => {
        const mockPurchases = [
          { userId: "user1", finalPrice: 10000, status: "completed" },
          { userId: "user2", finalPrice: 20000, status: "completed" },
          { userId: "user1", finalPrice: 15000, status: "completed" },
        ];

        vi.mocked(Purchase.find).mockResolvedValue(mockPurchases as any);
        vi.mocked(DonationService.getAdminDonationStats).mockResolvedValue(
          mockDonationStats
        );

        await FinancialAnalyticsController.getFinancialSummary(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);

        // Program revenue: 10000 + 20000 + 15000 = 45000
        // Donation revenue: 500000
        // Total: 545000
        expect(response.data.totalRevenue).toBe(545000);
        expect(response.data.totalTransactions).toBe(53); // 3 purchases + 50 donations
        expect(response.data.programs.revenue).toBe(45000);
        expect(response.data.programs.purchases).toBe(3);
        expect(response.data.programs.uniqueBuyers).toBe(2);
      });

      it("should return properly structured response", async () => {
        vi.mocked(Purchase.find).mockResolvedValue([]);
        vi.mocked(DonationService.getAdminDonationStats).mockResolvedValue(
          mockDonationStats
        );

        await FinancialAnalyticsController.getFinancialSummary(
          mockReq as any,
          mockRes as Response
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data).toHaveProperty("totalRevenue");
        expect(response.data).toHaveProperty("totalTransactions");
        expect(response.data).toHaveProperty("uniqueParticipants");
        expect(response.data).toHaveProperty("growthRate");
        expect(response.data).toHaveProperty("last30Days");
        expect(response.data).toHaveProperty("programs");
        expect(response.data).toHaveProperty("donations");
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(Purchase.find).mockRejectedValue(new Error("Database error"));

        await FinancialAnalyticsController.getFinancialSummary(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to fetch financial summary",
        });
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it("should return 500 on donation service error", async () => {
        vi.mocked(Purchase.find).mockResolvedValue([]);
        vi.mocked(DonationService.getAdminDonationStats).mockRejectedValue(
          new Error("Donation service error")
        );

        await FinancialAnalyticsController.getFinancialSummary(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });
  });
});
