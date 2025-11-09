import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import PurchaseAccessController from "../../../../src/controllers/purchase/PurchaseAccessController";
import { Purchase, Program } from "../../../../src/models";
import mongoose from "mongoose";

// Mock models
vi.mock("../../../../src/models", () => ({
  Purchase: {
    findOne: vi.fn(),
  },
  Program: {
    findById: vi.fn(),
  },
}));

describe("PurchaseAccessController", () => {
  let mockReq: Partial<Request> & { user?: any };
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup response mocks
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      params: {},
      user: undefined,
    };

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };

    // Mock console methods to reduce noise
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("checkProgramAccess", () => {
    const programId = new mongoose.Types.ObjectId().toString();
    const userId = new mongoose.Types.ObjectId();
    const mentorId = new mongoose.Types.ObjectId();

    it("should return 401 if user not authenticated", async () => {
      mockReq.user = undefined;
      mockReq.params = { programId };

      await PurchaseAccessController.checkProgramAccess(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should return 400 for invalid program ID", async () => {
      mockReq.user = { _id: userId, role: "Member" };
      mockReq.params = { programId: "invalid_id" };

      await PurchaseAccessController.checkProgramAccess(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid program ID.",
      });
    });

    it("should return 404 if program not found", async () => {
      mockReq.user = { _id: userId, role: "Member" };
      mockReq.params = { programId };

      vi.mocked(Program.findById).mockResolvedValue(null);

      await PurchaseAccessController.checkProgramAccess(
        mockReq as Request,
        mockRes as Response
      );

      expect(Program.findById).toHaveBeenCalledWith(programId);
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Program not found.",
      });
    });

    it("should grant access to Super Admin", async () => {
      mockReq.user = { _id: userId, role: "Super Admin" };
      mockReq.params = { programId };

      const mockProgram = {
        _id: programId,
        title: "Test Program",
        isFree: false,
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);

      await PurchaseAccessController.checkProgramAccess(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: { hasAccess: true, reason: "admin" },
      });
      // Should not check for purchase since admin has access
      expect(Purchase.findOne).not.toHaveBeenCalled();
    });

    it("should grant access to Administrator", async () => {
      mockReq.user = { _id: userId, role: "Administrator" };
      mockReq.params = { programId };

      const mockProgram = {
        _id: programId,
        title: "Test Program",
        isFree: false,
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);

      await PurchaseAccessController.checkProgramAccess(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: { hasAccess: true, reason: "admin" },
      });
      expect(Purchase.findOne).not.toHaveBeenCalled();
    });

    it("should grant access to program mentor", async () => {
      mockReq.user = { _id: mentorId, role: "Member" };
      mockReq.params = { programId };

      const mockProgram = {
        _id: programId,
        title: "Test Program",
        isFree: false,
        mentors: [
          { userId: mentorId, name: "Mentor User" },
          { userId: new mongoose.Types.ObjectId(), name: "Other Mentor" },
        ],
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);

      await PurchaseAccessController.checkProgramAccess(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: { hasAccess: true, reason: "mentor" },
      });
      expect(Purchase.findOne).not.toHaveBeenCalled();
    });

    it("should not grant access if user is not a mentor of the program", async () => {
      mockReq.user = { _id: userId, role: "Member" };
      mockReq.params = { programId };

      const mockProgram = {
        _id: programId,
        title: "Test Program",
        isFree: false,
        mentors: [{ userId: mentorId, name: "Mentor User" }],
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
      vi.mocked(Purchase.findOne).mockResolvedValue(null);

      await PurchaseAccessController.checkProgramAccess(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: { hasAccess: false, reason: "not_purchased" },
      });
    });

    it("should grant access if program is free", async () => {
      mockReq.user = { _id: userId, role: "Member" };
      mockReq.params = { programId };

      const mockProgram = {
        _id: programId,
        title: "Free Program",
        isFree: true,
        mentors: [],
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);

      await PurchaseAccessController.checkProgramAccess(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: { hasAccess: true, reason: "free" },
      });
      expect(Purchase.findOne).not.toHaveBeenCalled();
    });

    it("should grant access if user has completed purchase", async () => {
      mockReq.user = { _id: userId, role: "Member" };
      mockReq.params = { programId };

      const mockProgram = {
        _id: programId,
        title: "Paid Program",
        isFree: false,
        mentors: [],
      };

      const mockPurchase = {
        _id: "purchase123",
        userId,
        programId,
        status: "completed",
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
      vi.mocked(Purchase.findOne).mockResolvedValue(mockPurchase as any);

      await PurchaseAccessController.checkProgramAccess(
        mockReq as Request,
        mockRes as Response
      );

      expect(Purchase.findOne).toHaveBeenCalledWith({
        userId,
        programId: mockProgram._id,
        status: "completed",
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: { hasAccess: true, reason: "purchased" },
      });
    });

    it("should deny access if no completed purchase found", async () => {
      mockReq.user = { _id: userId, role: "Member" };
      mockReq.params = { programId };

      const mockProgram = {
        _id: programId,
        title: "Paid Program",
        isFree: false,
        mentors: [],
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
      vi.mocked(Purchase.findOne).mockResolvedValue(null);

      await PurchaseAccessController.checkProgramAccess(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: { hasAccess: false, reason: "not_purchased" },
      });
    });

    it("should deny access if purchase is pending", async () => {
      mockReq.user = { _id: userId, role: "Member" };
      mockReq.params = { programId };

      const mockProgram = {
        _id: programId,
        title: "Paid Program",
        isFree: false,
        mentors: [],
      };

      const mockPurchase = {
        _id: "purchase123",
        userId,
        programId,
        status: "pending", // Not completed
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
      // findOne should return null because we're querying for status: "completed"
      vi.mocked(Purchase.findOne).mockResolvedValue(null);

      await PurchaseAccessController.checkProgramAccess(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: { hasAccess: false, reason: "not_purchased" },
      });
    });

    it("should handle program with no mentors array", async () => {
      mockReq.user = { _id: userId, role: "Member" };
      mockReq.params = { programId };

      const mockProgram = {
        _id: programId,
        title: "Test Program",
        isFree: false,
        mentors: undefined, // No mentors
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
      vi.mocked(Purchase.findOne).mockResolvedValue(null);

      await PurchaseAccessController.checkProgramAccess(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: { hasAccess: false, reason: "not_purchased" },
      });
    });

    it("should handle program with empty mentors array", async () => {
      mockReq.user = { _id: userId, role: "Member" };
      mockReq.params = { programId };

      const mockProgram = {
        _id: programId,
        title: "Test Program",
        isFree: false,
        mentors: [],
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
      vi.mocked(Purchase.findOne).mockResolvedValue(null);

      await PurchaseAccessController.checkProgramAccess(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: { hasAccess: false, reason: "not_purchased" },
      });
    });

    it("should handle database errors during program fetch", async () => {
      mockReq.user = { _id: userId, role: "Member" };
      mockReq.params = { programId };

      const dbError = new Error("Database connection failed");
      vi.mocked(Program.findById).mockRejectedValue(dbError);

      await PurchaseAccessController.checkProgramAccess(
        mockReq as Request,
        mockRes as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error checking program access:",
        dbError
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to check program access.",
      });
    });

    it("should handle database errors during purchase fetch", async () => {
      mockReq.user = { _id: userId, role: "Member" };
      mockReq.params = { programId };

      const mockProgram = {
        _id: programId,
        title: "Paid Program",
        isFree: false,
        mentors: [],
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);

      const dbError = new Error("Purchase query failed");
      vi.mocked(Purchase.findOne).mockRejectedValue(dbError);

      await PurchaseAccessController.checkProgramAccess(
        mockReq as Request,
        mockRes as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error checking program access:",
        dbError
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to check program access.",
      });
    });

    it("should handle non-Error exceptions", async () => {
      mockReq.user = { _id: userId, role: "Member" };
      mockReq.params = { programId };

      vi.mocked(Program.findById).mockRejectedValue("Unexpected error");

      await PurchaseAccessController.checkProgramAccess(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to check program access.",
      });
    });

    it("should correctly compare ObjectIds for mentor check", async () => {
      const exactMentorId = new mongoose.Types.ObjectId();
      mockReq.user = { _id: exactMentorId, role: "Leader" };
      mockReq.params = { programId };

      const mockProgram = {
        _id: programId,
        title: "Test Program",
        isFree: false,
        mentors: [
          { userId: exactMentorId, name: "Exact Match" },
          { userId: new mongoose.Types.ObjectId(), name: "Other Mentor" },
        ],
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);

      await PurchaseAccessController.checkProgramAccess(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: { hasAccess: true, reason: "mentor" },
      });
    });
  });
});
