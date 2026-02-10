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
  Purchase: {
    findOne: vi.fn(),
  },
}));

vi.mock("../../../../src/utils/privacy", () => ({
  sanitizeMentors: vi.fn((mentors, canView) => {
    if (canView) return mentors;
    // Remove sensitive contact info when canView is false
    return mentors.map((m: any) => ({
      ...m,
      email: undefined,
      phone: undefined,
    }));
  }),
}));

import { sanitizeMentors } from "../../../../src/utils/privacy";
import { Purchase } from "../../../../src/models";

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
          mockRes as Response,
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
          mockRes as Response,
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
        const mockProgramData = {
          _id: programId,
          title: "Test Program",
          description: "Test description",
          programType: "Workshop",
        };
        const mockProgram = {
          ...mockProgramData,
          toObject: vi.fn().mockReturnValue(mockProgramData),
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);

        await RetrievalController.getById(
          mockReq as Request,
          mockRes as Response,
        );

        expect(Program.findById).toHaveBeenCalledWith(programId.toString());
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockProgramData,
        });
      });

      it("should return complete program with all fields", async () => {
        const mockProgramData = {
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
        const mockProgram = {
          ...mockProgramData,
          toObject: vi.fn().mockReturnValue(mockProgramData),
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);

        await RetrievalController.getById(
          mockReq as Request,
          mockRes as Response,
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.data).toEqual(mockProgramData);
      });

      it("should handle program with no optional fields", async () => {
        const mockProgramData = {
          _id: programId,
          title: "Minimal Program",
        };
        const mockProgram = {
          ...mockProgramData,
          toObject: vi.fn().mockReturnValue(mockProgramData),
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);

        await RetrievalController.getById(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockProgramData,
        });
      });
    });

    describe("error handling", () => {
      it("should handle database errors", async () => {
        vi.mocked(Program.findById).mockRejectedValue(
          new Error("Database error"),
        );

        await RetrievalController.getById(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to get program.",
        });
      });

      it("should handle unexpected errors gracefully", async () => {
        vi.mocked(Program.findById).mockRejectedValue(
          new Error("Unexpected error"),
        );

        await RetrievalController.getById(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to get program.",
        });
      });
    });

    describe("mentor contact visibility", () => {
      const mentorId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      it("should allow admin to view mentor contacts", async () => {
        mockReq.user = {
          _id: userId,
          role: "Super Admin",
        };

        const mockProgramData = {
          _id: programId,
          title: "Test Program",
          mentors: [
            {
              userId: mentorId,
              email: "mentor@example.com",
              phone: "555-1234",
            },
          ],
        };
        const mockProgram = {
          ...mockProgramData,
          toObject: vi.fn().mockReturnValue(mockProgramData),
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);

        await RetrievalController.getById(
          mockReq as Request,
          mockRes as Response,
        );

        expect(sanitizeMentors).toHaveBeenCalledWith(
          mockProgramData.mentors,
          true, // canViewMentorContact should be true for admin
        );
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should allow Administrator to view mentor contacts", async () => {
        mockReq.user = {
          _id: userId,
          role: "Administrator",
        };

        const mockProgramData = {
          _id: programId,
          title: "Test Program",
          mentors: [
            {
              userId: mentorId,
              email: "mentor@example.com",
            },
          ],
        };
        const mockProgram = {
          ...mockProgramData,
          toObject: vi.fn().mockReturnValue(mockProgramData),
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);

        await RetrievalController.getById(
          mockReq as Request,
          mockRes as Response,
        );

        expect(sanitizeMentors).toHaveBeenCalledWith(
          mockProgramData.mentors,
          true,
        );
      });

      it("should allow mentor to view their own program contacts", async () => {
        mockReq.user = {
          _id: mentorId, // User is the mentor
          role: "Leader",
        };

        const mockProgramData = {
          _id: programId,
          title: "Test Program",
          mentors: [
            {
              userId: mentorId,
              email: "mentor@example.com",
            },
          ],
        };
        const mockProgram = {
          ...mockProgramData,
          toObject: vi.fn().mockReturnValue(mockProgramData),
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);

        await RetrievalController.getById(
          mockReq as Request,
          mockRes as Response,
        );

        expect(sanitizeMentors).toHaveBeenCalledWith(
          mockProgramData.mentors,
          true, // Mentor viewing their own program
        );
      });

      it("should allow enrolled user (via purchase) to view mentor contacts", async () => {
        mockReq.user = {
          _id: userId,
          role: "Participant",
        };

        const mockProgramData = {
          _id: programId,
          title: "Test Program",
          isFree: false,
          mentors: [
            {
              userId: mentorId,
              email: "mentor@example.com",
            },
          ],
          adminEnrollments: {
            mentees: [],
            classReps: [],
          },
        };
        const mockProgram = {
          ...mockProgramData,
          toObject: vi.fn().mockReturnValue(mockProgramData),
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
        vi.mocked(Purchase.findOne).mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          status: "completed",
        } as any);

        await RetrievalController.getById(
          mockReq as Request,
          mockRes as Response,
        );

        expect(Purchase.findOne).toHaveBeenCalledWith({
          userId: userId,
          programId: programId,
          status: "completed",
        });
        expect(sanitizeMentors).toHaveBeenCalledWith(
          mockProgramData.mentors,
          true, // User has purchased
        );
      });

      it("should allow free program user to view mentor contacts", async () => {
        mockReq.user = {
          _id: userId,
          role: "Participant",
        };

        const mockProgramData = {
          _id: programId,
          title: "Free Program",
          isFree: true,
          mentors: [
            {
              userId: mentorId,
              email: "mentor@example.com",
            },
          ],
        };
        const mockProgram = {
          ...mockProgramData,
          toObject: vi.fn().mockReturnValue(mockProgramData),
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);

        await RetrievalController.getById(
          mockReq as Request,
          mockRes as Response,
        );

        // Free program - no purchase check needed
        expect(Purchase.findOne).not.toHaveBeenCalled();
        expect(sanitizeMentors).toHaveBeenCalledWith(
          mockProgramData.mentors,
          true, // Free program user is considered enrolled
        );
      });

      it("should allow admin-enrolled mentee to view mentor contacts", async () => {
        mockReq.user = {
          _id: userId,
          role: "Participant",
        };

        const mockProgramData = {
          _id: programId,
          title: "Test Program",
          isFree: false,
          mentors: [
            {
              userId: mentorId,
              email: "mentor@example.com",
            },
          ],
          adminEnrollments: {
            mentees: [userId],
            classReps: [],
          },
        };
        const mockProgram = {
          ...mockProgramData,
          toObject: vi.fn().mockReturnValue(mockProgramData),
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
        vi.mocked(Purchase.findOne).mockResolvedValue(null); // No purchase

        await RetrievalController.getById(
          mockReq as Request,
          mockRes as Response,
        );

        expect(sanitizeMentors).toHaveBeenCalledWith(
          mockProgramData.mentors,
          true, // Admin enrolled mentee
        );
      });

      it("should allow admin-enrolled class rep to view mentor contacts", async () => {
        mockReq.user = {
          _id: userId,
          role: "Participant",
        };

        const mockProgramData = {
          _id: programId,
          title: "Test Program",
          isFree: false,
          mentors: [
            {
              userId: mentorId,
              email: "mentor@example.com",
            },
          ],
          adminEnrollments: {
            mentees: [],
            classReps: [userId],
          },
        };
        const mockProgram = {
          ...mockProgramData,
          toObject: vi.fn().mockReturnValue(mockProgramData),
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
        vi.mocked(Purchase.findOne).mockResolvedValue(null); // No purchase

        await RetrievalController.getById(
          mockReq as Request,
          mockRes as Response,
        );

        expect(sanitizeMentors).toHaveBeenCalledWith(
          mockProgramData.mentors,
          true, // Admin enrolled class rep
        );
      });

      it("should hide mentor contacts from non-enrolled users", async () => {
        mockReq.user = {
          _id: userId,
          role: "Participant",
        };

        const mockProgramData = {
          _id: programId,
          title: "Test Program",
          isFree: false,
          mentors: [
            {
              userId: mentorId,
              email: "mentor@example.com",
            },
          ],
          adminEnrollments: {
            mentees: [],
            classReps: [],
          },
        };
        const mockProgram = {
          ...mockProgramData,
          toObject: vi.fn().mockReturnValue(mockProgramData),
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
        vi.mocked(Purchase.findOne).mockResolvedValue(null); // No purchase

        await RetrievalController.getById(
          mockReq as Request,
          mockRes as Response,
        );

        // Check that sanitizeMentors was called with canView = false
        expect(sanitizeMentors).toHaveBeenCalled();
        const calls = vi.mocked(sanitizeMentors).mock.calls;
        expect(calls[0][1]).toBe(false); // canViewMentorContact should be false
      });

      it("should hide mentor contacts from unauthenticated users", async () => {
        mockReq.user = undefined;

        const mockProgramData = {
          _id: programId,
          title: "Test Program",
          mentors: [
            {
              userId: mentorId,
              email: "mentor@example.com",
            },
          ],
        };
        const mockProgram = {
          ...mockProgramData,
          toObject: vi.fn().mockReturnValue(mockProgramData),
        };

        vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);

        await RetrievalController.getById(
          mockReq as Request,
          mockRes as Response,
        );

        // Check that sanitizeMentors was called with canView = false
        expect(sanitizeMentors).toHaveBeenCalled();
        const calls = vi.mocked(sanitizeMentors).mock.calls;
        expect(calls[0][1]).toBe(false); // canViewMentorContact should be false
      });
    });
  });
});
