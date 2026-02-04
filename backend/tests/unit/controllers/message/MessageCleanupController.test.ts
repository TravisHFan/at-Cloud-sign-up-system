import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import MessageCleanupController from "../../../../src/controllers/message/MessageCleanupController";

// Mock dependencies
vi.mock("../../../../src/models/Message", () => ({
  default: {
    updateMany: vi.fn(),
  },
}));

vi.mock("../../../../src/services", () => ({
  CachePatterns: {
    invalidateAllUserCaches: vi.fn().mockResolvedValue(undefined),
  },
}));

import Message from "../../../../src/models/Message";
import { CachePatterns } from "../../../../src/services";

describe("MessageCleanupController", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    mockReq = {};
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("cleanupExpiredMessages", () => {
    describe("Successful Cleanup", () => {
      it("should clean up expired messages and invalidate cache", async () => {
        vi.mocked(Message.updateMany).mockResolvedValue({
          acknowledged: true,
          modifiedCount: 5,
          matchedCount: 5,
          upsertedCount: 0,
          upsertedId: null,
        });

        await MessageCleanupController.cleanupExpiredMessages(
          mockReq as Request,
          mockRes as Response,
        );

        expect(Message.updateMany).toHaveBeenCalledWith(
          {
            isActive: true,
            expiresAt: { $lte: expect.any(Date) },
          },
          {
            isActive: false,
          },
        );
        expect(CachePatterns.invalidateAllUserCaches).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Expired messages cleaned up",
          data: {
            expiredCount: 5,
          },
        });
      });

      it("should not invalidate cache when no messages are modified", async () => {
        vi.mocked(Message.updateMany).mockResolvedValue({
          acknowledged: true,
          modifiedCount: 0,
          matchedCount: 0,
          upsertedCount: 0,
          upsertedId: null,
        });

        await MessageCleanupController.cleanupExpiredMessages(
          mockReq as Request,
          mockRes as Response,
        );

        expect(CachePatterns.invalidateAllUserCaches).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Expired messages cleaned up",
          data: {
            expiredCount: 0,
          },
        });
      });

      it("should return correct count when many messages are cleaned up", async () => {
        vi.mocked(Message.updateMany).mockResolvedValue({
          acknowledged: true,
          modifiedCount: 100,
          matchedCount: 100,
          upsertedCount: 0,
          upsertedId: null,
        });

        await MessageCleanupController.cleanupExpiredMessages(
          mockReq as Request,
          mockRes as Response,
        );

        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            data: {
              expiredCount: 100,
            },
          }),
        );
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(Message.updateMany).mockRejectedValue(
          new Error("Database connection failed"),
        );

        await MessageCleanupController.cleanupExpiredMessages(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Internal server error",
        });
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it("should return 500 if cache invalidation fails", async () => {
        vi.mocked(Message.updateMany).mockResolvedValue({
          acknowledged: true,
          modifiedCount: 5,
          matchedCount: 5,
          upsertedCount: 0,
          upsertedId: null,
        });
        vi.mocked(CachePatterns.invalidateAllUserCaches).mockRejectedValue(
          new Error("Cache error"),
        );

        await MessageCleanupController.cleanupExpiredMessages(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it("should log error details on failure", async () => {
        const testError = new Error("Test error");
        vi.mocked(Message.updateMany).mockRejectedValue(testError);

        await MessageCleanupController.cleanupExpiredMessages(
          mockReq as Request,
          mockRes as Response,
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Error in cleanupExpiredMessages:",
          testError,
        );
      });
    });
  });
});
