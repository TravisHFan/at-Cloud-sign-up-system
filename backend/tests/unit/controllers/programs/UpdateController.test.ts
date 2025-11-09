import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import UpdateController from "../../../../src/controllers/programs/UpdateController";
import { Program } from "../../../../src/models";
import { RoleUtils } from "../../../../src/utils/roleUtils";
import mongoose from "mongoose";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  Program: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.mock("../../../../src/utils/roleUtils", () => ({
  RoleUtils: {
    isAdmin: vi.fn(),
  },
}));

describe("UpdateController", () => {
  let mockReq: any;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  const programId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const mentorId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      params: { id: programId.toString() },
      body: { title: "Updated Title" },
      user: {
        _id: userId,
        role: "Super Admin",
      },
    };

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };
  });

  describe("update", () => {
    describe("authentication", () => {
      it("should return 401 if user not authenticated", async () => {
        mockReq.user = undefined;

        await UpdateController.update(mockReq as Request, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Authentication required.",
        });
      });
    });

    describe("validation", () => {
      it("should return 400 for invalid program ID", async () => {
        mockReq.params.id = "invalid-id";

        await UpdateController.update(mockReq as Request, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid program ID.",
        });
      });

      it("should return 404 if program not found", async () => {
        vi.mocked(Program.findById).mockResolvedValue(null);

        await UpdateController.update(mockReq as Request, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Program not found.",
        });
      });
    });

    describe("authorization", () => {
      it("should allow Super Admin to update any program", async () => {
        const mockProgram = {
          _id: programId,
          title: "Original Title",
          mentors: [],
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
        vi.mocked(RoleUtils.isAdmin).mockReturnValue(true);

        const updatedProgram = {
          ...mockProgram,
          title: "Updated Title",
        };

        vi.mocked(Program.findByIdAndUpdate).mockResolvedValue(
          updatedProgram as any
        );

        await UpdateController.update(mockReq as Request, mockRes as Response);

        expect(RoleUtils.isAdmin).toHaveBeenCalledWith("Super Admin");
        expect(Program.findByIdAndUpdate).toHaveBeenCalledWith(
          programId.toString(),
          mockReq.body,
          { new: true, runValidators: true }
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: updatedProgram,
        });
      });

      it("should allow Administrator to update any program", async () => {
        mockReq.user.role = "Administrator";

        const mockProgram = {
          _id: programId,
          title: "Original Title",
          mentors: [],
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
        vi.mocked(RoleUtils.isAdmin).mockReturnValue(true);

        const updatedProgram = {
          ...mockProgram,
          title: "Updated Title",
        };

        vi.mocked(Program.findByIdAndUpdate).mockResolvedValue(
          updatedProgram as any
        );

        await UpdateController.update(mockReq as Request, mockRes as Response);

        expect(RoleUtils.isAdmin).toHaveBeenCalledWith("Administrator");
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should allow assigned mentor to update their program", async () => {
        mockReq.user = {
          _id: mentorId,
          role: "Member",
        };

        const mockProgram = {
          _id: programId,
          title: "Original Title",
          mentors: [{ userId: mentorId }],
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
        vi.mocked(RoleUtils.isAdmin).mockReturnValue(false);

        const updatedProgram = {
          ...mockProgram,
          title: "Updated Title",
        };

        vi.mocked(Program.findByIdAndUpdate).mockResolvedValue(
          updatedProgram as any
        );

        await UpdateController.update(mockReq as Request, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should reject non-admin non-mentor users", async () => {
        mockReq.user = {
          _id: userId,
          role: "Member",
        };

        const mockProgram = {
          _id: programId,
          title: "Original Title",
          mentors: [{ userId: mentorId }], // Different mentor
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
        vi.mocked(RoleUtils.isAdmin).mockReturnValue(false);

        await UpdateController.update(mockReq as Request, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message:
            "You do not have permission to edit this program. Only Administrators and assigned mentors can edit programs.",
        });
      });

      it("should reject Leader role for programs they don't mentor", async () => {
        mockReq.user = {
          _id: userId,
          role: "Leader",
        };

        const mockProgram = {
          _id: programId,
          title: "Original Title",
          mentors: [],
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
        vi.mocked(RoleUtils.isAdmin).mockReturnValue(false);

        await UpdateController.update(mockReq as Request, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(403);
      });

      it("should handle program with no mentors array", async () => {
        mockReq.user = {
          _id: userId,
          role: "Member",
        };

        const mockProgram = {
          _id: programId,
          title: "Original Title",
          mentors: undefined,
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
        vi.mocked(RoleUtils.isAdmin).mockReturnValue(false);

        await UpdateController.update(mockReq as Request, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(403);
      });

      it("should handle program with empty mentors array", async () => {
        mockReq.user = {
          _id: userId,
          role: "Member",
        };

        const mockProgram = {
          _id: programId,
          title: "Original Title",
          mentors: [],
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
        vi.mocked(RoleUtils.isAdmin).mockReturnValue(false);

        await UpdateController.update(mockReq as Request, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(403);
      });
    });

    describe("update execution", () => {
      beforeEach(() => {
        const mockProgram = {
          _id: programId,
          title: "Original Title",
          mentors: [],
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
        vi.mocked(RoleUtils.isAdmin).mockReturnValue(true);
      });

      it("should update program with provided fields", async () => {
        mockReq.body = {
          title: "New Title",
          description: "New Description",
        };

        const updatedProgram = {
          _id: programId,
          title: "New Title",
          description: "New Description",
        };

        vi.mocked(Program.findByIdAndUpdate).mockResolvedValue(
          updatedProgram as any
        );

        await UpdateController.update(mockReq as Request, mockRes as Response);

        expect(Program.findByIdAndUpdate).toHaveBeenCalledWith(
          programId.toString(),
          mockReq.body,
          { new: true, runValidators: true }
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: updatedProgram,
        });
      });

      it("should return new: true for updated document", async () => {
        const updatedProgram = {
          _id: programId,
          title: "Updated Title",
        };

        vi.mocked(Program.findByIdAndUpdate).mockResolvedValue(
          updatedProgram as any
        );

        await UpdateController.update(mockReq as Request, mockRes as Response);

        const updateCall = vi.mocked(Program.findByIdAndUpdate).mock
          .calls[0] as any;
        expect(updateCall[2]).toEqual({ new: true, runValidators: true });
      });

      it("should run validators on update", async () => {
        vi.mocked(Program.findByIdAndUpdate).mockResolvedValue({
          _id: programId,
          title: "Updated",
        } as any);

        await UpdateController.update(mockReq as Request, mockRes as Response);

        const updateCall = vi.mocked(Program.findByIdAndUpdate).mock
          .calls[0] as any;
        expect(updateCall[2]?.runValidators).toBe(true);
      });

      it("should return 404 if program not found after update", async () => {
        vi.mocked(Program.findByIdAndUpdate).mockResolvedValue(null);

        await UpdateController.update(mockReq as Request, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Program not found.",
        });
      });
    });

    describe("error handling", () => {
      beforeEach(() => {
        const mockProgram = {
          _id: programId,
          title: "Original Title",
          mentors: [],
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
        vi.mocked(RoleUtils.isAdmin).mockReturnValue(true);
      });

      it("should handle validation errors", async () => {
        const validationError = new Error("Validation failed");

        vi.mocked(Program.findByIdAndUpdate).mockRejectedValue(validationError);

        await UpdateController.update(mockReq as Request, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Validation failed",
        });
      });

      it("should handle database errors", async () => {
        vi.mocked(Program.findByIdAndUpdate).mockRejectedValue(
          new Error("Database error")
        );

        await UpdateController.update(mockReq as Request, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Database error",
        });
      });

      it("should handle errors during permission check", async () => {
        vi.mocked(Program.findById).mockRejectedValue(
          new Error("Database error")
        );

        await UpdateController.update(mockReq as Request, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Database error",
        });
      });
    });
  });
});
