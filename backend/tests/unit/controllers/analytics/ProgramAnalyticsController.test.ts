import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Response } from "express";
import ProgramAnalyticsController from "../../../../src/controllers/analytics/ProgramAnalyticsController";

// Mock dependencies
vi.mock("../../../../src/models/Purchase", () => ({
  default: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
  },
}));

vi.mock("../../../../src/models/Program", () => ({
  default: {
    find: vi.fn(),
  },
}));

import Purchase from "../../../../src/models/Purchase";
import Program from "../../../../src/models/Program";

interface MockRequest {
  user?: {
    _id: string;
    id: string;
    role: string;
    email: string;
  };
}

describe("ProgramAnalyticsController", () => {
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

  describe("getProgramAnalytics", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await ProgramAnalyticsController.getProgramAnalytics(
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

        await ProgramAnalyticsController.getProgramAnalytics(
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

        await ProgramAnalyticsController.getProgramAnalytics(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(403);
      });

      it("should allow Super Admin access", async () => {
        mockReq.user!.role = "Super Admin";
        setupEmptyMocks();

        await ProgramAnalyticsController.getProgramAnalytics(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should allow Administrator access", async () => {
        mockReq.user!.role = "Administrator";
        setupEmptyMocks();

        await ProgramAnalyticsController.getProgramAnalytics(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should allow Leader access", async () => {
        mockReq.user!.role = "Leader";
        setupEmptyMocks();

        await ProgramAnalyticsController.getProgramAnalytics(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("Success", () => {
      it("should return analytics with empty data", async () => {
        setupEmptyMocks();

        await ProgramAnalyticsController.getProgramAnalytics(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.data.totalRevenue).toBe(0);
        expect(response.data.totalPurchases).toBe(0);
        expect(response.data.uniqueBuyers).toBe(0);
      });

      it("should calculate totals correctly", async () => {
        const mockPurchases = [
          {
            userId: { toString: () => "user1" },
            programId: { programType: "Course" },
            finalPrice: 10000,
            isClassRep: false,
            promoCode: "",
            isEarlyBird: false,
            purchaseDate: new Date(),
          },
          {
            userId: { toString: () => "user2" },
            programId: { programType: "Course" },
            finalPrice: 15000,
            isClassRep: true,
            promoCode: "SAVE10",
            isEarlyBird: true,
            purchaseDate: new Date(),
          },
          {
            userId: { toString: () => "user1" },
            programId: { programType: "Workshop" },
            finalPrice: 5000,
            isClassRep: false,
            promoCode: "",
            isEarlyBird: false,
            purchaseDate: new Date(),
          },
        ];

        vi.mocked(Program.find).mockReturnValue({
          select: vi.fn().mockResolvedValue([]),
        } as any);
        vi.mocked(Purchase.find).mockReturnValue({
          populate: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockPurchases),
          }),
        } as any);
        vi.mocked(Purchase.countDocuments).mockResolvedValue(0);
        vi.mocked(Purchase.aggregate).mockResolvedValue([]);

        await ProgramAnalyticsController.getProgramAnalytics(
          mockReq as any,
          mockRes as Response,
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.totalRevenue).toBe(30000);
        expect(response.data.totalPurchases).toBe(3);
        expect(response.data.uniqueBuyers).toBe(2);
        expect(response.data.classRepPurchases).toBe(1);
        expect(response.data.classRepRevenue).toBe(15000);
        expect(response.data.promoCodePurchases).toBe(1);
        expect(response.data.earlyBirdPurchases).toBe(1);
      });

      it("should calculate program type breakdown correctly", async () => {
        const mockPurchases = [
          {
            userId: { toString: () => "user1" },
            programId: { programType: "Course" },
            finalPrice: 10000,
            isClassRep: false,
            promoCode: "",
            isEarlyBird: false,
            purchaseDate: new Date(),
          },
          {
            userId: { toString: () => "user2" },
            programId: { programType: "Course" },
            finalPrice: 15000,
            isClassRep: false,
            promoCode: "",
            isEarlyBird: false,
            purchaseDate: new Date(),
          },
          {
            userId: { toString: () => "user3" },
            programId: { programType: "Workshop" },
            finalPrice: 5000,
            isClassRep: false,
            promoCode: "",
            isEarlyBird: false,
            purchaseDate: new Date(),
          },
        ];

        vi.mocked(Program.find).mockReturnValue({
          select: vi.fn().mockResolvedValue([]),
        } as any);
        vi.mocked(Purchase.find).mockReturnValue({
          populate: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockPurchases),
          }),
        } as any);
        vi.mocked(Purchase.countDocuments).mockResolvedValue(0);
        vi.mocked(Purchase.aggregate).mockResolvedValue([]);

        await ProgramAnalyticsController.getProgramAnalytics(
          mockReq as any,
          mockRes as Response,
        );

        const response = jsonMock.mock.calls[0][0];
        const breakdown = response.data.programTypeBreakdown;

        const courseStats = breakdown.find(
          (b: any) => b.programType === "Course",
        );
        expect(courseStats.revenue).toBe(25000);
        expect(courseStats.purchases).toBe(2);
        expect(courseStats.uniqueBuyers).toBe(2);

        const workshopStats = breakdown.find(
          (b: any) => b.programType === "Workshop",
        );
        expect(workshopStats.revenue).toBe(5000);
        expect(workshopStats.purchases).toBe(1);
      });

      it("should include pending, failed, and refunded counts", async () => {
        vi.mocked(Program.find).mockReturnValue({
          select: vi.fn().mockResolvedValue([]),
        } as any);
        vi.mocked(Purchase.find).mockReturnValue({
          populate: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        } as any);
        vi.mocked(Purchase.countDocuments)
          .mockResolvedValueOnce(5) // pending
          .mockResolvedValueOnce(2) // failed
          .mockResolvedValueOnce(3); // refunded
        vi.mocked(Purchase.aggregate)
          .mockResolvedValueOnce([{ _id: null, total: 50000 }]) // pending revenue
          .mockResolvedValueOnce([{ _id: null, total: 20000 }]) // failed revenue
          .mockResolvedValueOnce([{ _id: null, total: 30000 }]); // refunded revenue

        await ProgramAnalyticsController.getProgramAnalytics(
          mockReq as any,
          mockRes as Response,
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.pendingPurchases).toBe(5);
        expect(response.data.pendingRevenue).toBe(50000);
        expect(response.data.failedPurchases).toBe(2);
        expect(response.data.failedRevenue).toBe(20000);
        expect(response.data.refundedPurchases).toBe(3);
        expect(response.data.refundedRevenue).toBe(30000);
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(Program.find).mockReturnValue({
          select: vi.fn().mockRejectedValue(new Error("Database error")),
        } as any);

        await ProgramAnalyticsController.getProgramAnalytics(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to fetch program analytics",
        });
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe("Program Mapping", () => {
      it("should map program IDs to types and titles from database", async () => {
        const programId1 = "507f1f77bcf86cd799439011";
        const programId2 = "507f1f77bcf86cd799439012";

        const mockPrograms = [
          {
            _id: { toString: () => programId1 },
            title: "Course A",
            programType: "Course",
          },
          {
            _id: { toString: () => programId2 },
            title: "Workshop B",
            programType: "Workshop",
          },
        ];

        const mockPurchases = [
          {
            userId: { toString: () => "user1" },
            programId: { programType: "Course" },
            finalPrice: 10000,
            isClassRep: false,
            promoCode: "",
            isEarlyBird: false,
            purchaseDate: new Date(),
          },
        ];

        vi.mocked(Program.find).mockReturnValue({
          select: vi.fn().mockResolvedValue(mockPrograms),
        } as any);
        vi.mocked(Purchase.find).mockReturnValue({
          populate: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockPurchases),
          }),
        } as any);
        vi.mocked(Purchase.countDocuments).mockResolvedValue(0);
        vi.mocked(Purchase.aggregate).mockResolvedValue([]);

        await ProgramAnalyticsController.getProgramAnalytics(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.data.totalPurchases).toBe(1);
      });
    });
  });

  // Helper function to set up empty mocks
  function setupEmptyMocks() {
    vi.mocked(Program.find).mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    } as any);
    vi.mocked(Purchase.find).mockReturnValue({
      populate: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    } as any);
    vi.mocked(Purchase.countDocuments).mockResolvedValue(0);
    vi.mocked(Purchase.aggregate).mockResolvedValue([]);
  }
});
