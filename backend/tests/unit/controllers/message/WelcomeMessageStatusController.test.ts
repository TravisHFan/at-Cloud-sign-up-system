import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import WelcomeMessageStatusController from "../../../../src/controllers/message/WelcomeMessageStatusController";

// Mock dependencies
vi.mock("../../../../src/models/User", () => ({
  default: {
    findById: vi.fn(),
  },
}));

import User from "../../../../src/models/User";

interface MockRequest {
  user?: { id: string };
}

describe("WelcomeMessageStatusController", () => {
  let mockReq: MockRequest;
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

    mockReq = {
      user: { id: "user123" },
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("checkWelcomeMessageStatus", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await WelcomeMessageStatusController.checkWelcomeMessageStatus(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Authentication required",
        });
      });

      it("should return 401 if user.id is undefined", async () => {
        mockReq.user = {} as { id: string };

        await WelcomeMessageStatusController.checkWelcomeMessageStatus(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Authentication required",
        });
      });
    });

    describe("Successful Status Check", () => {
      it("should return true when user has received welcome message", async () => {
        const mockSelect = vi.fn().mockResolvedValue({
          hasReceivedWelcomeMessage: true,
        });
        vi.mocked(User.findById).mockReturnValue({ select: mockSelect } as any);

        await WelcomeMessageStatusController.checkWelcomeMessageStatus(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(User.findById).toHaveBeenCalledWith("user123");
        expect(mockSelect).toHaveBeenCalledWith("hasReceivedWelcomeMessage");
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: {
            hasReceivedWelcomeMessage: true,
          },
        });
      });

      it("should return false when user has not received welcome message", async () => {
        const mockSelect = vi.fn().mockResolvedValue({
          hasReceivedWelcomeMessage: false,
        });
        vi.mocked(User.findById).mockReturnValue({ select: mockSelect } as any);

        await WelcomeMessageStatusController.checkWelcomeMessageStatus(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: {
            hasReceivedWelcomeMessage: false,
          },
        });
      });

      it("should return false when user not found", async () => {
        const mockSelect = vi.fn().mockResolvedValue(null);
        vi.mocked(User.findById).mockReturnValue({ select: mockSelect } as any);

        await WelcomeMessageStatusController.checkWelcomeMessageStatus(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: {
            hasReceivedWelcomeMessage: false,
          },
        });
      });

      it("should return false when hasReceivedWelcomeMessage field is undefined", async () => {
        const mockSelect = vi.fn().mockResolvedValue({});
        vi.mocked(User.findById).mockReturnValue({ select: mockSelect } as any);

        await WelcomeMessageStatusController.checkWelcomeMessageStatus(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: {
            hasReceivedWelcomeMessage: false,
          },
        });
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error", async () => {
        const mockSelect = vi
          .fn()
          .mockRejectedValue(new Error("Database connection failed"));
        vi.mocked(User.findById).mockReturnValue({ select: mockSelect } as any);

        await WelcomeMessageStatusController.checkWelcomeMessageStatus(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Internal server error",
        });
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it("should log error details on failure", async () => {
        const testError = new Error("Test error");
        const mockSelect = vi.fn().mockRejectedValue(testError);
        vi.mocked(User.findById).mockReturnValue({ select: mockSelect } as any);

        await WelcomeMessageStatusController.checkWelcomeMessageStatus(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Error in checkWelcomeMessageStatus:",
          testError,
        );
      });
    });
  });
});
