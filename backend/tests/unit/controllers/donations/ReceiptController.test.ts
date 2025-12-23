import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Response } from "express";
import ReceiptController from "../../../../src/controllers/donations/ReceiptController";

// Mock dependencies
vi.mock("../../../../src/models/DonationTransaction", () => ({
  default: {
    find: vi.fn(),
  },
}));

vi.mock("../../../../src/models/User", () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock("../../../../src/services/LoggerService", () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
  }),
}));

import DonationTransaction from "../../../../src/models/DonationTransaction";
import User from "../../../../src/models/User";

interface MockRequest {
  query: Record<string, string>;
  user?: {
    _id: string;
    id: string;
  };
}

describe("ReceiptController", () => {
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
      query: {},
      user: {
        _id: mockUserId,
        id: mockUserId,
      },
    };
  });

  describe("getReceipt", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await ReceiptController.getReceipt(mockReq as any, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Authentication required.",
        });
      });
    });

    describe("User Validation", () => {
      it("should return 404 if user not found", async () => {
        vi.mocked(User.findById).mockReturnValue({
          select: vi.fn().mockResolvedValue(null),
        } as any);

        await ReceiptController.getReceipt(mockReq as any, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "User not found.",
        });
      });
    });

    describe("Success", () => {
      it("should return receipt data for current year by default", async () => {
        vi.mocked(User.findById).mockReturnValue({
          select: vi.fn().mockResolvedValue({
            firstName: "John",
            lastName: "Doe",
            email: "john@test.com",
          }),
        } as any);

        vi.mocked(DonationTransaction.find).mockReturnValue({
          sort: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([
              {
                _id: "txn1",
                amount: 5000,
                type: "one-time",
                status: "completed",
                createdAt: new Date(),
              },
            ]),
          }),
        } as any);

        await ReceiptController.getReceipt(mockReq as any, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.data.user.name).toBe("John Doe");
        expect(response.data.user.email).toBe("john@test.com");
        expect(response.data.summary).toBeDefined();
      });

      it("should filter by specified years", async () => {
        mockReq.query = { years: "2024,2023" };

        vi.mocked(User.findById).mockReturnValue({
          select: vi.fn().mockResolvedValue({
            firstName: "John",
            lastName: "Doe",
            email: "john@test.com",
          }),
        } as any);

        const mockTransactions = [
          {
            _id: "txn1",
            amount: 5000,
            type: "one-time",
            status: "completed",
            createdAt: new Date("2024-06-01"),
          },
          {
            _id: "txn2",
            amount: 3000,
            type: "recurring",
            status: "completed",
            createdAt: new Date("2023-06-01"),
          },
          {
            _id: "txn3",
            amount: 2000,
            type: "one-time",
            status: "completed",
            createdAt: new Date("2022-06-01"), // Should be filtered out
          },
        ];

        vi.mocked(DonationTransaction.find).mockReturnValue({
          sort: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockTransactions),
          }),
        } as any);

        await ReceiptController.getReceipt(mockReq as any, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        const response = jsonMock.mock.calls[0][0];
        expect(response.data.selectedYears).toEqual([2024, 2023]);
        expect(response.data.summary.grandTotal).toBe(8000); // 5000 + 3000, excluding 2022
      });

      it("should handle empty transactions", async () => {
        vi.mocked(User.findById).mockReturnValue({
          select: vi.fn().mockResolvedValue({
            firstName: "John",
            lastName: "Doe",
            email: "john@test.com",
          }),
        } as any);

        vi.mocked(DonationTransaction.find).mockReturnValue({
          sort: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        } as any);

        await ReceiptController.getReceipt(mockReq as any, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        const response = jsonMock.mock.calls[0][0];
        expect(response.data.summary.grandTotal).toBe(0);
        expect(response.data.summary.totalTransactions).toBe(0);
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(User.findById).mockReturnValue({
          select: vi.fn().mockRejectedValue(new Error("Database error")),
        } as any);

        await ReceiptController.getReceipt(mockReq as any, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to generate receipt.",
        });
      });
    });
  });

  describe("getAvailableYears", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await ReceiptController.getAvailableYears(
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
      it("should return available years sorted descending", async () => {
        const mockTransactions = [
          { createdAt: new Date("2024-06-01") },
          { createdAt: new Date("2023-06-01") },
          { createdAt: new Date("2024-03-01") }, // Duplicate year
          { createdAt: new Date("2022-06-01") },
        ];

        vi.mocked(DonationTransaction.find).mockReturnValue({
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockTransactions),
          }),
        } as any);

        await ReceiptController.getAvailableYears(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.data.years).toEqual([2024, 2023, 2022]);
      });

      it("should return empty array when no transactions", async () => {
        vi.mocked(DonationTransaction.find).mockReturnValue({
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        } as any);

        await ReceiptController.getAvailableYears(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        const response = jsonMock.mock.calls[0][0];
        expect(response.data.years).toEqual([]);
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(DonationTransaction.find).mockReturnValue({
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockRejectedValue(new Error("Database error")),
          }),
        } as any);

        await ReceiptController.getAvailableYears(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to fetch available years.",
        });
      });
    });
  });
});
