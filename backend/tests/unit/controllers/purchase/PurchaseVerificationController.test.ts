import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import PurchaseVerificationController from "../../../../src/controllers/purchase/PurchaseVerificationController";
import Purchase from "../../../../src/models/Purchase";

vi.mock("../../../../src/models/Purchase");

describe("PurchaseVerificationController", () => {
  let mockReq: Partial<Request> & { user?: any };
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  const userId = "user123";
  const sessionId = "cs_test_abc123";

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn(() => mockRes) as any;
    mockRes = {
      status: statusMock,
      json: jsonMock,
    } as any;
    mockReq = {
      params: {},
      user: undefined,
    };
    vi.clearAllMocks();
  });

  describe("verifySession", () => {
    it("should return 401 if user not authenticated", async () => {
      mockReq.user = undefined;
      mockReq.params = { sessionId };

      await PurchaseVerificationController.verifySession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should return 400 if sessionId is missing", async () => {
      mockReq.user = { _id: userId } as any;
      mockReq.params = {};

      await PurchaseVerificationController.verifySession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Session ID is required.",
      });
    });

    it("should return 400 if sessionId is empty string", async () => {
      mockReq.user = { _id: userId } as any;
      mockReq.params = { sessionId: "" };

      await PurchaseVerificationController.verifySession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Session ID is required.",
      });
    });

    it("should return 404 if purchase not found", async () => {
      mockReq.user = { _id: userId } as any;
      mockReq.params = { sessionId };

      const findOneMock = {
        populate: vi.fn().mockResolvedValue(null),
      };
      vi.mocked(Purchase.findOne).mockReturnValue(findOneMock as any);

      await PurchaseVerificationController.verifySession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Purchase not found. Please wait a moment and try again.",
      });
      expect(Purchase.findOne).toHaveBeenCalledWith({
        stripeSessionId: sessionId,
        userId: userId,
      });
    });

    it("should find purchase by sessionId and userId", async () => {
      mockReq.user = { _id: userId } as any;
      mockReq.params = { sessionId };

      const mockPurchase = {
        _id: "purchase123",
        orderNumber: "ORD-001",
        stripeSessionId: sessionId,
        userId: userId,
        status: "pending",
        programId: { title: "Test Program", programType: "workshop" },
      };

      const findOneMock = {
        populate: vi.fn().mockResolvedValue(mockPurchase),
      };
      vi.mocked(Purchase.findOne).mockReturnValue(findOneMock as any);

      await PurchaseVerificationController.verifySession(
        mockReq as Request,
        mockRes as Response
      );

      expect(Purchase.findOne).toHaveBeenCalledWith({
        stripeSessionId: sessionId,
        userId: userId,
      });
      expect(findOneMock.populate).toHaveBeenCalledWith(
        "programId",
        "title programType"
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockPurchase,
      });
    });

    it("should return pending purchase (webhook not processed yet)", async () => {
      mockReq.user = { _id: userId } as any;
      mockReq.params = { sessionId };

      const mockPurchase = {
        _id: "purchase123",
        orderNumber: "ORD-002",
        stripeSessionId: sessionId,
        userId: userId,
        status: "pending", // Still pending - webhook hasn't processed
        programId: { title: "Async Program", programType: "course" },
      };

      const findOneMock = {
        populate: vi.fn().mockResolvedValue(mockPurchase),
      };
      vi.mocked(Purchase.findOne).mockReturnValue(findOneMock as any);

      await PurchaseVerificationController.verifySession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockPurchase,
      });
    });

    it("should return completed purchase (webhook already processed)", async () => {
      mockReq.user = { _id: userId } as any;
      mockReq.params = { sessionId };

      const mockPurchase = {
        _id: "purchase456",
        orderNumber: "ORD-003",
        stripeSessionId: sessionId,
        userId: userId,
        status: "completed", // Already completed by webhook
        programId: { title: "Fast Program", programType: "bootcamp" },
      };

      const findOneMock = {
        populate: vi.fn().mockResolvedValue(mockPurchase),
      };
      vi.mocked(Purchase.findOne).mockReturnValue(findOneMock as any);

      await PurchaseVerificationController.verifySession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockPurchase,
      });
    });

    it("should verify populate is called with correct fields", async () => {
      mockReq.user = { _id: userId } as any;
      mockReq.params = { sessionId };

      const mockPurchase = {
        _id: "purchase789",
        orderNumber: "ORD-004",
        stripeSessionId: sessionId,
        userId: userId,
        status: "pending",
        programId: { title: "Verify Program", programType: "workshop" },
      };

      const findOneMock = {
        populate: vi.fn().mockResolvedValue(mockPurchase),
      };
      vi.mocked(Purchase.findOne).mockReturnValue(findOneMock as any);

      await PurchaseVerificationController.verifySession(
        mockReq as Request,
        mockRes as Response
      );

      expect(findOneMock.populate).toHaveBeenCalledWith(
        "programId",
        "title programType"
      );
      expect(findOneMock.populate).toHaveBeenCalledTimes(1);
    });

    it("should handle database errors", async () => {
      mockReq.user = { _id: userId } as any;
      mockReq.params = { sessionId };

      const findOneMock = {
        populate: vi.fn().mockRejectedValue(new Error("Database error")),
      };
      vi.mocked(Purchase.findOne).mockReturnValue(findOneMock as any);

      await PurchaseVerificationController.verifySession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to verify session.",
      });
    });

    it("should handle non-Error exceptions", async () => {
      mockReq.user = { _id: userId } as any;
      mockReq.params = { sessionId };

      const findOneMock = {
        populate: vi.fn().mockRejectedValue("String error"),
      };
      vi.mocked(Purchase.findOne).mockReturnValue(findOneMock as any);

      await PurchaseVerificationController.verifySession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to verify session.",
      });
    });

    it("should handle userId as ObjectId (populate scenarios)", async () => {
      mockReq.user = { _id: userId } as any;
      mockReq.params = { sessionId };

      // userId might be ObjectId in some scenarios
      const mockPurchase = {
        _id: "purchase999",
        orderNumber: "ORD-005",
        stripeSessionId: sessionId,
        userId: { _id: userId, username: "testuser" }, // Populated
        status: "completed",
        programId: { title: "ObjectId Program", programType: "course" },
      };

      const findOneMock = {
        populate: vi.fn().mockResolvedValue(mockPurchase),
      };
      vi.mocked(Purchase.findOne).mockReturnValue(findOneMock as any);

      await PurchaseVerificationController.verifySession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockPurchase,
      });
    });
  });
});
