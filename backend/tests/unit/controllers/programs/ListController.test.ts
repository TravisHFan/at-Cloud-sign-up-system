import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import ListController from "../../../../src/controllers/programs/ListController";
import { Program } from "../../../../src/models";
import mongoose from "mongoose";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  Program: {
    find: vi.fn(),
  },
}));

describe("ListController", () => {
  let mockReq: any;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      query: {},
    };

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };
  });

  describe("list", () => {
    const programId1 = new mongoose.Types.ObjectId();
    const programId2 = new mongoose.Types.ObjectId();

    it("should return empty array when no programs exist", async () => {
      const mockFind = vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      });

      vi.mocked(Program.find).mockImplementation(mockFind);

      await ListController.list(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it("should return all programs when no filters provided", async () => {
      const mockPrograms = [
        {
          _id: programId1,
          title: "Program 1",
          programType: "Workshop",
        },
        {
          _id: programId2,
          title: "Program 2",
          programType: "Course",
        },
      ];

      const mockFind = vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockPrograms),
        }),
      });

      vi.mocked(Program.find).mockImplementation(mockFind);

      await ListController.list(mockReq as Request, mockRes as Response);

      expect(Program.find).toHaveBeenCalledWith({});
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: programId1.toString(),
            title: "Program 1",
            programType: "Workshop",
          },
          {
            id: programId2.toString(),
            title: "Program 2",
            programType: "Course",
          },
        ],
      });
    });

    it("should filter by program type", async () => {
      mockReq.query = { type: "Workshop" };

      const mockPrograms = [
        {
          _id: programId1,
          title: "Workshop Program",
          programType: "Workshop",
        },
      ];

      const mockFind = vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockPrograms),
        }),
      });

      vi.mocked(Program.find).mockImplementation(mockFind);

      await ListController.list(mockReq as Request, mockRes as Response);

      expect(Program.find).toHaveBeenCalledWith({ programType: "Workshop" });
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should search by title using regex", async () => {
      mockReq.query = { q: "React" };

      const mockPrograms = [
        {
          _id: programId1,
          title: "React Fundamentals",
        },
      ];

      const mockFind = vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockPrograms),
        }),
      });

      vi.mocked(Program.find).mockImplementation(mockFind);

      await ListController.list(mockReq as Request, mockRes as Response);

      expect(Program.find).toHaveBeenCalledWith({
        title: { $regex: "React", $options: "i" },
      });
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should filter by both type and search query", async () => {
      mockReq.query = { type: "Course", q: "Python" };

      const mockPrograms = [
        {
          _id: programId1,
          title: "Python Basics",
          programType: "Course",
        },
      ];

      const mockFind = vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockPrograms),
        }),
      });

      vi.mocked(Program.find).mockImplementation(mockFind);

      await ListController.list(mockReq as Request, mockRes as Response);

      expect(Program.find).toHaveBeenCalledWith({
        programType: "Course",
        title: { $regex: "Python", $options: "i" },
      });
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should sort programs by createdAt descending", async () => {
      const mockFind = vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      });

      vi.mocked(Program.find).mockImplementation(mockFind);

      await ListController.list(mockReq as Request, mockRes as Response);

      const sortCall = mockFind.mock.results[0].value.sort;
      expect(sortCall).toHaveBeenCalledWith({ createdAt: -1 });
    });

    it("should transform _id to id in response", async () => {
      const mockPrograms = [
        {
          _id: programId1,
          title: "Test Program",
        },
      ];

      const mockFind = vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockPrograms),
        }),
      });

      vi.mocked(Program.find).mockImplementation(mockFind);

      await ListController.list(mockReq as Request, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];
      expect(response.data[0]).toHaveProperty("id", programId1.toString());
      expect(response.data[0]).not.toHaveProperty("_id");
    });

    it("should handle case-insensitive search", async () => {
      mockReq.query = { q: "javascript" };

      const mockFind = vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      });

      vi.mocked(Program.find).mockImplementation(mockFind);

      await ListController.list(mockReq as Request, mockRes as Response);

      expect(Program.find).toHaveBeenCalledWith({
        title: { $regex: "javascript", $options: "i" },
      });
    });

    it("should handle database errors", async () => {
      const mockFind = vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockRejectedValue(new Error("Database error")),
        }),
      });

      vi.mocked(Program.find).mockImplementation(mockFind);

      await ListController.list(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to list programs.",
      });
    });
  });
});
