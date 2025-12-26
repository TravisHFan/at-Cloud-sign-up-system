import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import LegacyMessageDeletionController from "../../../../src/controllers/message/LegacyMessageDeletionController";

// Mock dependencies
vi.mock("../../../../src/models/Message", () => {
  const mockMessage = {
    findById: vi.fn(),
    getUnreadCountsForUser: vi.fn(),
  };
  return { default: mockMessage };
});

vi.mock("../../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitSystemMessageUpdate: vi.fn(),
    emitBellNotificationUpdate: vi.fn(),
    emitUnreadCountUpdate: vi.fn(),
  },
}));

import Message from "../../../../src/models/Message";
import { socketService } from "../../../../src/services/infrastructure/SocketService";

interface MockRequest {
  params: { messageId?: string };
  user?: { id: string };
}

describe("LegacyMessageDeletionController", () => {
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
      status: statusMock as unknown as Response["status"],
      json: jsonMock as unknown as Response["json"],
    };

    mockReq = {
      params: { messageId: "507f1f77bcf86cd799439011" },
      user: { id: "user123" },
    };

    (Message as any).getUnreadCountsForUser = vi.fn().mockResolvedValue({
      bellNotifications: 0,
      systemMessages: 0,
      total: 0,
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("deleteMessage", () => {
    describe("Validation", () => {
      it("should return 400 if messageId is invalid", async () => {
        mockReq.params.messageId = "invalid-id";

        await LegacyMessageDeletionController.deleteMessage(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid message ID",
        });
      });
    });

    describe("Not Found", () => {
      it("should return 404 if message is not found", async () => {
        vi.mocked(Message.findById).mockResolvedValue(null);

        await LegacyMessageDeletionController.deleteMessage(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Message not found",
        });
      });
    });

    describe("Successful Deletion", () => {
      it("should delete message and emit socket events", async () => {
        const mockMessage = {
          _id: "507f1f77bcf86cd799439011",
          getUserState: vi.fn().mockReturnValue({
            isReadInSystem: true,
            isReadInBell: true,
          }),
          deleteFromSystem: vi.fn(),
          save: vi.fn().mockResolvedValue(true),
        };
        vi.mocked(Message.findById).mockResolvedValue(mockMessage);

        await LegacyMessageDeletionController.deleteMessage(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(mockMessage.deleteFromSystem).toHaveBeenCalledWith("user123");
        expect(mockMessage.save).toHaveBeenCalled();
        expect(socketService.emitSystemMessageUpdate).toHaveBeenCalledWith(
          "user123",
          "message_deleted",
          { messageId: "507f1f77bcf86cd799439011" }
        );
        expect(socketService.emitBellNotificationUpdate).toHaveBeenCalledWith(
          "user123",
          "notification_removed",
          { messageId: "507f1f77bcf86cd799439011" }
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Message deleted from system messages",
        });
      });

      it("should update unread counts if message was unread in system", async () => {
        const mockMessage = {
          _id: "507f1f77bcf86cd799439011",
          getUserState: vi.fn().mockReturnValue({
            isReadInSystem: false,
            isReadInBell: true,
          }),
          deleteFromSystem: vi.fn(),
          save: vi.fn().mockResolvedValue(true),
        };
        vi.mocked(Message.findById).mockResolvedValue(mockMessage);

        await LegacyMessageDeletionController.deleteMessage(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(socketService.emitUnreadCountUpdate).toHaveBeenCalled();
      });

      it("should update unread counts if message was unread in bell", async () => {
        const mockMessage = {
          _id: "507f1f77bcf86cd799439011",
          getUserState: vi.fn().mockReturnValue({
            isReadInSystem: true,
            isReadInBell: false,
          }),
          deleteFromSystem: vi.fn(),
          save: vi.fn().mockResolvedValue(true),
        };
        vi.mocked(Message.findById).mockResolvedValue(mockMessage);

        await LegacyMessageDeletionController.deleteMessage(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(socketService.emitUnreadCountUpdate).toHaveBeenCalled();
      });

      it("should not update unread counts if message was already read", async () => {
        const mockMessage = {
          _id: "507f1f77bcf86cd799439011",
          getUserState: vi.fn().mockReturnValue({
            isReadInSystem: true,
            isReadInBell: true,
          }),
          deleteFromSystem: vi.fn(),
          save: vi.fn().mockResolvedValue(true),
        };
        vi.mocked(Message.findById).mockResolvedValue(mockMessage);

        await LegacyMessageDeletionController.deleteMessage(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(socketService.emitUnreadCountUpdate).not.toHaveBeenCalled();
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on error", async () => {
        vi.mocked(Message.findById).mockRejectedValue(
          new Error("Database error")
        );

        await LegacyMessageDeletionController.deleteMessage(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to delete message",
        });
      });
    });
  });
});
