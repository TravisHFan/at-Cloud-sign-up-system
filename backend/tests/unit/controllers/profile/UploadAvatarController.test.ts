import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import UploadAvatarController from "../../../../src/controllers/profile/UploadAvatarController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  User: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.mock("../../../../src/models/Program", () => ({
  default: {
    updateMany: vi.fn(),
  },
}));

vi.mock("../../../../src/models/Message", () => ({
  default: {
    updateMany: vi.fn(),
  },
}));

vi.mock("../../../../src/middleware/upload", () => ({
  getFileUrl: vi.fn().mockReturnValue("http://localhost/avatars/newavatar.jpg"),
}));

vi.mock("../../../../src/utils/avatarCleanup", () => ({
  cleanupOldAvatar: vi.fn(),
}));

vi.mock("../../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitUserUpdate: vi.fn(),
  },
}));

vi.mock("../../../../src/services/LoggerService", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

import { User } from "../../../../src/models";
import Program from "../../../../src/models/Program";
import Message from "../../../../src/models/Message";
import { getFileUrl } from "../../../../src/middleware/upload";
import { cleanupOldAvatar } from "../../../../src/utils/avatarCleanup";
import { socketService } from "../../../../src/services/infrastructure/SocketService";

interface MockRequest {
  user?: {
    _id: string;
    id: string;
    role: string;
    email: string;
  };
  file?: {
    filename: string;
    path: string;
  };
}

describe("UploadAvatarController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock as unknown as Response["status"],
      json: jsonMock as unknown as Response["json"],
    };

    mockReq = {
      user: {
        _id: "user123",
        id: "user123",
        role: "Participant",
        email: "user@test.com",
      },
      file: {
        filename: "newavatar.jpg",
        path: "/uploads/avatars/newavatar.jpg",
      },
    };

    vi.mocked(cleanupOldAvatar).mockResolvedValue(true);
    vi.mocked(Program.updateMany).mockResolvedValue({
      modifiedCount: 0,
    } as any);
    vi.mocked(Message.updateMany).mockResolvedValue({
      modifiedCount: 0,
    } as any);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe("uploadAvatar", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await UploadAvatarController.uploadAvatar(
          mockReq as unknown as Request,
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
      it("should return 400 if no file uploaded", async () => {
        mockReq.file = undefined;

        await UploadAvatarController.uploadAvatar(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "No file uploaded.",
        });
      });

      it("should return 404 if current user not found", async () => {
        vi.mocked(User.findById).mockResolvedValue(null);

        await UploadAvatarController.uploadAvatar(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "User not found.",
        });
      });
    });

    describe("Successful Upload", () => {
      const mockCurrentUser = {
        _id: "user123",
        avatar: "/old-avatar.jpg",
      };

      const mockUpdatedUser = {
        _id: "user123",
        username: "testuser",
        email: "user@test.com",
        firstName: "Test",
        lastName: "User",
        role: "Participant",
        avatar: "http://localhost/avatars/newavatar.jpg",
        phone: "123456789",
        isAtCloudLeader: false,
        roleInAtCloud: null,
        isActive: true,
      };

      beforeEach(() => {
        vi.mocked(User.findById).mockResolvedValue(mockCurrentUser);
        vi.mocked(User.findByIdAndUpdate).mockResolvedValue(mockUpdatedUser);
      });

      it("should upload avatar successfully", async () => {
        await UploadAvatarController.uploadAvatar(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
          "user123",
          {
            avatar: expect.stringContaining(
              "http://localhost/avatars/newavatar.jpg"
            ),
          },
          { new: true, select: "-password" }
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: "Avatar uploaded successfully.",
          })
        );
      });

      it("should generate avatar URL with cache-busting timestamp", async () => {
        await UploadAvatarController.uploadAvatar(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
          "user123",
          { avatar: expect.stringMatching(/\?t=\d+$/) },
          expect.any(Object)
        );
      });

      it("should update denormalized avatar in Program mentors", async () => {
        await UploadAvatarController.uploadAvatar(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(Program.updateMany).toHaveBeenCalledWith(
          { "mentors.userId": "user123" },
          { $set: { "mentors.$[elem].avatar": expect.any(String) } },
          { arrayFilters: [{ "elem.userId": "user123" }] }
        );
      });

      it("should update denormalized avatar in Message creators", async () => {
        await UploadAvatarController.uploadAvatar(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(Message.updateMany).toHaveBeenCalledWith(
          { "creator.id": "user123" },
          { $set: { "creator.avatar": expect.any(String) } }
        );
      });

      it("should cleanup old avatar file", async () => {
        await UploadAvatarController.uploadAvatar(
          mockReq as unknown as Request,
          mockRes as Response
        );

        // Wait for async cleanup
        await vi.waitFor(
          () => {
            expect(cleanupOldAvatar).toHaveBeenCalledWith(
              "user123",
              "/old-avatar.jpg"
            );
          },
          { timeout: 100 }
        );
      });

      it("should not cleanup if no old avatar", async () => {
        vi.mocked(User.findById).mockResolvedValue({
          _id: "user123",
          avatar: null, // No old avatar
        });

        await UploadAvatarController.uploadAvatar(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(cleanupOldAvatar).not.toHaveBeenCalled();
      });

      it("should emit socket update after avatar change", async () => {
        await UploadAvatarController.uploadAvatar(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(socketService.emitUserUpdate).toHaveBeenCalledWith(
          "user123",
          expect.objectContaining({
            type: "profile_edited",
            changes: { avatar: true },
          })
        );
      });

      it("should succeed even if avatar cleanup fails", async () => {
        vi.mocked(cleanupOldAvatar).mockRejectedValue(
          new Error("Cleanup failed")
        );

        await UploadAvatarController.uploadAvatar(
          mockReq as unknown as Request,
          mockRes as Response
        );

        await vi.waitFor(
          () => {
            expect(consoleErrorSpy).toHaveBeenCalledWith(
              "Failed to cleanup old avatar:",
              expect.any(Error)
            );
          },
          { timeout: 100 }
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("Error Handling", () => {
      it("should return 404 if user update fails", async () => {
        vi.mocked(User.findById).mockResolvedValue({ _id: "user123" });
        vi.mocked(User.findByIdAndUpdate).mockResolvedValue(null);

        await UploadAvatarController.uploadAvatar(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "User not found.",
        });
      });

      it("should return 500 on database error", async () => {
        vi.mocked(User.findById).mockRejectedValue(new Error("Database error"));

        await UploadAvatarController.uploadAvatar(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to upload avatar.",
        });
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });
  });
});
