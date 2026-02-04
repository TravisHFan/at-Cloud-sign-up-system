import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import LegacyMessageCleanupController from "../../../../src/controllers/message/LegacyMessageCleanupController";

// Mock dependencies
vi.mock("../../../../src/models/Message", () => ({
  default: {
    updateMany: vi.fn(),
  },
}));

import Message from "../../../../src/models/Message";

describe("LegacyMessageCleanupController", () => {
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

  describe("cleanupExpiredItems", () => {
    describe("Successful Cleanup", () => {
      it("should clean up expired messages successfully", async () => {
        vi.mocked(Message.updateMany).mockResolvedValue({
          acknowledged: true,
          modifiedCount: 3,
          matchedCount: 3,
          upsertedCount: 0,
          upsertedId: null,
        });

        await LegacyMessageCleanupController.cleanupExpiredItems(
          mockReq as Request,
          mockRes as Response,
        );

        expect(Message.updateMany).toHaveBeenCalledWith(
          {
            isActive: true,
            expiresAt: { $lt: expect.any(Date) },
          },
          {
            $set: { isActive: false },
          },
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Cleanup completed",
          data: {
            expiredMessages: 3,
          },
        });
      });

      it("should return zero when no messages are expired", async () => {
        vi.mocked(Message.updateMany).mockResolvedValue({
          acknowledged: true,
          modifiedCount: 0,
          matchedCount: 0,
          upsertedCount: 0,
          upsertedId: null,
        });

        await LegacyMessageCleanupController.cleanupExpiredItems(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Cleanup completed",
          data: {
            expiredMessages: 0,
          },
        });
      });

      it("should handle large number of expired messages", async () => {
        vi.mocked(Message.updateMany).mockResolvedValue({
          acknowledged: true,
          modifiedCount: 500,
          matchedCount: 500,
          upsertedCount: 0,
          upsertedId: null,
        });

        await LegacyMessageCleanupController.cleanupExpiredItems(
          mockReq as Request,
          mockRes as Response,
        );

        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            data: {
              expiredMessages: 500,
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

        await LegacyMessageCleanupController.cleanupExpiredItems(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to cleanup expired items",
        });
      });

      it("should log error details on failure", async () => {
        const testError = new Error("Test database error");
        vi.mocked(Message.updateMany).mockRejectedValue(testError);

        await LegacyMessageCleanupController.cleanupExpiredItems(
          mockReq as Request,
          mockRes as Response,
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Error cleaning up expired items:",
          testError,
        );
      });
    });
  });
});
