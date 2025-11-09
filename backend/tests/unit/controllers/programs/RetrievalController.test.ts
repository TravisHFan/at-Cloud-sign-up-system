import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import RetrievalController from "../../../../src/controllers/programs/RetrievalController";
import { Program } from "../../../../src/models";
import mongoose from "mongoose";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  Program: {
    findById: vi.fn(),
  },
}));

describe("RetrievalController", () => {
  let mockReq: any;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  const programId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      params: { id: programId.toString() },
    };

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };
  });

  describe("getById", () => {
    describe("validation", () => {
      it("should return 400 for invalid program ID", async () => {
        mockReq.params.id = "invalid-id";

        await RetrievalController.getById(
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
        vi.mocked(Program.findById).mockResolvedValue(null);

        await RetrievalController.getById(
          mockReq as Request,
          mockRes as Response
        );

        expect(Program.findById).toHaveBeenCalledWith(programId.toString());
        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Program not found.",
        });
      });
    });

    describe("program retrieval", () => {
      it("should return program when found", async () => {
        const mockProgram = {
          _id: programId,
          title: "Test Program",
          description: "Test description",
          programType: "Workshop",
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);

        await RetrievalController.getById(
          mockReq as Request,
          mockRes as Response
        );

        expect(Program.findById).toHaveBeenCalledWith(programId.toString());
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockProgram,
        });
      });

      it("should return complete program with all fields", async () => {
        const mockProgram = {
          _id: programId,
          title: "Complete Program",
          description: "Full description",
          programType: "Course",
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-12-31"),
          price: 99.99,
          capacity: 50,
          adminEnrollments: {
            mentees: [],
            classReps: [],
          },
          createdAt: new Date("2023-12-01"),
          updatedAt: new Date("2024-01-15"),
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);

        await RetrievalController.getById(
          mockReq as Request,
          mockRes as Response
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.data).toEqual(mockProgram);
      });

      it("should handle program with no optional fields", async () => {
        const mockProgram = {
          _id: programId,
          title: "Minimal Program",
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);

        await RetrievalController.getById(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockProgram,
        });
      });
    });

    describe("error handling", () => {
      it("should handle database errors", async () => {
        vi.mocked(Program.findById).mockRejectedValue(
          new Error("Database error")
        );

        await RetrievalController.getById(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to get program.",
        });
      });

      it("should handle unexpected errors gracefully", async () => {
        vi.mocked(Program.findById).mockRejectedValue(
          new Error("Unexpected error")
        );

        await RetrievalController.getById(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to get program.",
        });
      });
    });
  });
});
