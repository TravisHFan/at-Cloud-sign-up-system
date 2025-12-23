import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Response } from "express";
import mongoose from "mongoose";
import PurchaseRetrievalController from "../../../../src/controllers/purchase/PurchaseRetrievalController";

// Mock dependencies
vi.mock("../../../../src/models/Purchase", () => ({
  default: {
    findById: vi.fn(),
  },
}));

import Purchase from "../../../../src/models/Purchase";

interface MockRequest {
  params: Record<string, string>;
  user?: {
    _id: mongoose.Types.ObjectId | string;
    id: string;
    role: string;
    email: string;
  };
}

describe("PurchaseRetrievalController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: any;
  let testPurchaseId: string;
  let testUserId: mongoose.Types.ObjectId;

  beforeEach(() => {
    vi.clearAllMocks();
    testPurchaseId = new mongoose.Types.ObjectId().toString();
    testUserId = new mongoose.Types.ObjectId();

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };

    mockReq = {
      params: { id: testPurchaseId },
      user: {
        _id: testUserId,
        id: testUserId.toString(),
        role: "Member",
        email: "user@test.com",
      },
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("getPurchaseById", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await PurchaseRetrievalController.getPurchaseById(
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
      it("should return 400 for invalid purchase ID", async () => {
        mockReq.params.id = "invalid-id";

        await PurchaseRetrievalController.getPurchaseById(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid purchase ID.",
        });
      });
    });

    describe("Not Found", () => {
      it("should return 404 if purchase is not found", async () => {
        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockResolvedValue(null),
        } as any);

        await PurchaseRetrievalController.getPurchaseById(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Purchase not found.",
        });
      });
    });

    describe("Authorization", () => {
      it("should return 403 if user is not owner, admin, or mentor", async () => {
        const otherUserId = new mongoose.Types.ObjectId();
        const mockPurchase = {
          _id: testPurchaseId,
          userId: otherUserId,
          programId: {
            title: "Test Program",
            programType: "Course",
            mentors: [],
          },
          finalPrice: 10000,
        };

        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        } as any);

        await PurchaseRetrievalController.getPurchaseById(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Access denied.",
        });
      });

      it("should allow purchase owner to view", async () => {
        const mockPurchase = {
          _id: testPurchaseId,
          userId: testUserId,
          programId: {
            title: "Test Program",
            programType: "Course",
            mentors: [],
          },
          finalPrice: 10000,
        };

        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        } as any);

        await PurchaseRetrievalController.getPurchaseById(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockPurchase,
        });
      });

      it("should allow Super Admin to view any purchase", async () => {
        mockReq.user!.role = "Super Admin";
        const otherUserId = new mongoose.Types.ObjectId();
        const mockPurchase = {
          _id: testPurchaseId,
          userId: otherUserId,
          programId: {
            title: "Test Program",
            programType: "Course",
            mentors: [],
          },
          finalPrice: 10000,
        };

        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        } as any);

        await PurchaseRetrievalController.getPurchaseById(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should allow Administrator to view any purchase", async () => {
        mockReq.user!.role = "Administrator";
        const otherUserId = new mongoose.Types.ObjectId();
        const mockPurchase = {
          _id: testPurchaseId,
          userId: otherUserId,
          programId: {
            title: "Test Program",
            programType: "Course",
            mentors: [],
          },
          finalPrice: 10000,
        };

        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        } as any);

        await PurchaseRetrievalController.getPurchaseById(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should allow mentor to view purchase", async () => {
        const otherUserId = new mongoose.Types.ObjectId();
        const mockPurchase = {
          _id: testPurchaseId,
          userId: otherUserId,
          programId: {
            title: "Test Program",
            programType: "Course",
            mentors: [{ userId: testUserId }],
          },
          finalPrice: 10000,
        };

        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        } as any);

        await PurchaseRetrievalController.getPurchaseById(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockRejectedValue(new Error("Database error")),
        } as any);

        await PurchaseRetrievalController.getPurchaseById(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to fetch purchase.",
        });
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });
  });
});
