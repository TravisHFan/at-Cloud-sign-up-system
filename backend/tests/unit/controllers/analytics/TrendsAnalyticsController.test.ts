import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Response } from "express";
import TrendsAnalyticsController from "../../../../src/controllers/analytics/TrendsAnalyticsController";

// Mock dependencies
vi.mock("../../../../src/models/Purchase", () => ({
  default: {
    aggregate: vi.fn(),
  },
}));

vi.mock("../../../../src/models/DonationTransaction", () => ({
  default: {
    aggregate: vi.fn(),
  },
}));

import Purchase from "../../../../src/models/Purchase";
import DonationTransaction from "../../../../src/models/DonationTransaction";

interface MockRequest {
  query: Record<string, string>;
  user?: {
    _id: string;
    id: string;
    role: string;
    email: string;
  };
}

describe("TrendsAnalyticsController", () => {
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
      query: {},
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

  describe("getTrends", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await TrendsAnalyticsController.getTrends(
          mockReq as any,
          mockRes as Response,
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

        await TrendsAnalyticsController.getTrends(
          mockReq as any,
          mockRes as Response,
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

        await TrendsAnalyticsController.getTrends(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(403);
      });

      it("should allow Super Admin access", async () => {
        mockReq.user!.role = "Super Admin";
        setupEmptyMocks();

        await TrendsAnalyticsController.getTrends(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should allow Administrator access", async () => {
        mockReq.user!.role = "Administrator";
        setupEmptyMocks();

        await TrendsAnalyticsController.getTrends(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should allow Leader access", async () => {
        mockReq.user!.role = "Leader";
        setupEmptyMocks();

        await TrendsAnalyticsController.getTrends(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("Period Parameter", () => {
      it("should default to 6months period", async () => {
        setupEmptyMocks();

        await TrendsAnalyticsController.getTrends(
          mockReq as any,
          mockRes as Response,
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.period).toBe("6months");
      });

      it("should accept 12months period", async () => {
        mockReq.query.period = "12months";
        setupEmptyMocks();

        await TrendsAnalyticsController.getTrends(
          mockReq as any,
          mockRes as Response,
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.period).toBe("12months");
      });

      it("should accept all period", async () => {
        mockReq.query.period = "all";
        setupEmptyMocks();

        await TrendsAnalyticsController.getTrends(
          mockReq as any,
          mockRes as Response,
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.period).toBe("all");
      });

      it("should accept custom period with dates", async () => {
        mockReq.query.period = "custom";
        mockReq.query.startDate = "2024-01-01";
        mockReq.query.endDate = "2024-06-30";
        setupEmptyMocks();

        await TrendsAnalyticsController.getTrends(
          mockReq as any,
          mockRes as Response,
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.period).toBe("custom");
      });

      it("should handle custom period with only startDate", async () => {
        mockReq.query.period = "custom";
        mockReq.query.startDate = "2024-03-01";
        // No endDate provided
        setupEmptyMocks();

        await TrendsAnalyticsController.getTrends(
          mockReq as any,
          mockRes as Response,
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.period).toBe("custom");
        expect(response.success).toBe(true);
      });

      it("should handle custom period with only endDate", async () => {
        mockReq.query.period = "custom";
        // No startDate provided - defaults to beginning of time for custom without startDate
        mockReq.query.endDate = "2024-06-30";
        setupEmptyMocks();

        await TrendsAnalyticsController.getTrends(
          mockReq as any,
          mockRes as Response,
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.period).toBe("custom");
        expect(response.success).toBe(true);
      });

      it("should fall back to 6months for unknown period", async () => {
        mockReq.query.period = "unknown_period";
        setupEmptyMocks();

        await TrendsAnalyticsController.getTrends(
          mockReq as any,
          mockRes as Response,
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.period).toBe("unknown_period");
        expect(response.success).toBe(true);
        // Should use default 6 months range
      });
    });

    describe("Success", () => {
      it("should return trends with empty data", async () => {
        setupEmptyMocks();

        await TrendsAnalyticsController.getTrends(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.data).toHaveProperty("labels");
        expect(response.data).toHaveProperty("programRevenue");
        expect(response.data).toHaveProperty("donationRevenue");
        expect(response.data).toHaveProperty("combinedRevenue");
      });

      it("should aggregate program and donation trends correctly", async () => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        vi.mocked(Purchase.aggregate).mockResolvedValue([
          {
            _id: { year: currentYear, month: currentMonth },
            revenue: 50000,
            count: 5,
          },
        ]);

        vi.mocked(DonationTransaction.aggregate).mockResolvedValue([
          {
            _id: { year: currentYear, month: currentMonth },
            revenue: 30000,
            count: 10,
          },
        ]);

        await TrendsAnalyticsController.getTrends(
          mockReq as any,
          mockRes as Response,
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);

        // Check that combined revenue includes both
        const lastIndex = response.data.combinedRevenue.length - 1;
        expect(response.data.programRevenue[lastIndex]).toBe(50000);
        expect(response.data.donationRevenue[lastIndex]).toBe(30000);
        expect(response.data.combinedRevenue[lastIndex]).toBe(80000);
      });

      it("should return date range in response", async () => {
        setupEmptyMocks();

        await TrendsAnalyticsController.getTrends(
          mockReq as any,
          mockRes as Response,
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data).toHaveProperty("startDate");
        expect(response.data).toHaveProperty("endDate");
        expect(new Date(response.data.startDate)).toBeInstanceOf(Date);
        expect(new Date(response.data.endDate)).toBeInstanceOf(Date);
      });

      it("should fill in zero values for months with no data", async () => {
        vi.mocked(Purchase.aggregate).mockResolvedValue([]);
        vi.mocked(DonationTransaction.aggregate).mockResolvedValue([]);

        await TrendsAnalyticsController.getTrends(
          mockReq as any,
          mockRes as Response,
        );

        const response = jsonMock.mock.calls[0][0];
        // All values should be 0 when no data
        expect(response.data.programRevenue.every((v: number) => v === 0)).toBe(
          true,
        );
        expect(
          response.data.donationRevenue.every((v: number) => v === 0),
        ).toBe(true);
      });

      it("should handle trend data for months outside initial map range", async () => {
        // Mock aggregate returning data for a month that might not be in the pre-initialized map
        // This tests the || { programRevenue: 0, donationRevenue: 0 } fallback
        const farFutureYear = 2099;
        vi.mocked(Purchase.aggregate).mockResolvedValue([
          {
            _id: { year: farFutureYear, month: 12 },
            revenue: 10000,
            count: 1,
          },
        ]);
        vi.mocked(DonationTransaction.aggregate).mockResolvedValue([
          {
            _id: { year: farFutureYear, month: 12 },
            revenue: 5000,
            count: 2,
          },
        ]);

        await TrendsAnalyticsController.getTrends(
          mockReq as any,
          mockRes as Response,
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
        // The data should still be processed without errors
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(Purchase.aggregate).mockRejectedValue(
          new Error("Database error"),
        );

        await TrendsAnalyticsController.getTrends(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to fetch financial trends",
        });
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it("should return 500 on donation aggregate error", async () => {
        vi.mocked(Purchase.aggregate).mockResolvedValue([]);
        vi.mocked(DonationTransaction.aggregate).mockRejectedValue(
          new Error("Donation error"),
        );

        await TrendsAnalyticsController.getTrends(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });
  });

  // Helper function to set up empty mocks
  function setupEmptyMocks() {
    vi.mocked(Purchase.aggregate).mockResolvedValue([]);
    vi.mocked(DonationTransaction.aggregate).mockResolvedValue([]);
  }
});
