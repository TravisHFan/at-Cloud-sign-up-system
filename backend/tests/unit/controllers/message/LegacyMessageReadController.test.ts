import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import LegacyMessageReadController from "../../../../src/controllers/message/LegacyMessageReadController";

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

describe("LegacyMessageReadController", () => {
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

  describe("markAsRead", () => {
    describe("Validation", () => {
      it("should return 400 if messageId is invalid", async () => {
        mockReq.params.messageId = "invalid-id";

        await LegacyMessageReadController.markAsRead(
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

        await LegacyMessageReadController.markAsRead(
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

    describe("Successful Read", () => {
      it("should mark message as read and emit socket events", async () => {
        const mockMessage = {
          _id: "507f1f77bcf86cd799439011",
          markAsReadEverywhere: vi.fn(),
          save: vi.fn().mockResolvedValue(true),
        };
        vi.mocked(Message.findById).mockResolvedValue(mockMessage);

        await LegacyMessageReadController.markAsRead(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(mockMessage.markAsReadEverywhere).toHaveBeenCalledWith(
          "user123"
        );
        expect(mockMessage.save).toHaveBeenCalled();
        expect(socketService.emitSystemMessageUpdate).toHaveBeenCalledWith(
          "user123",
          "message_read",
          expect.objectContaining({
            messageId: "507f1f77bcf86cd799439011",
            isRead: true,
          })
        );
        expect(socketService.emitBellNotificationUpdate).toHaveBeenCalledWith(
          "user123",
          "notification_read",
          expect.objectContaining({
            messageId: "507f1f77bcf86cd799439011",
            isRead: true,
          })
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Message marked as read",
        });
      });

      it("should emit unread count update", async () => {
        const mockMessage = {
          _id: "507f1f77bcf86cd799439011",
          markAsReadEverywhere: vi.fn(),
          save: vi.fn().mockResolvedValue(true),
        };
        vi.mocked(Message.findById).mockResolvedValue(mockMessage);
        (Message as any).getUnreadCountsForUser.mockResolvedValue({
          bellNotifications: 3,
          systemMessages: 5,
          total: 8,
        });

        await LegacyMessageReadController.markAsRead(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(socketService.emitUnreadCountUpdate).toHaveBeenCalledWith(
          "user123",
          { bellNotifications: 3, systemMessages: 5, total: 8 }
        );
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on error", async () => {
        vi.mocked(Message.findById).mockRejectedValue(
          new Error("Database error")
        );

        await LegacyMessageReadController.markAsRead(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to mark message as read",
        });
      });
    });
  });
});
