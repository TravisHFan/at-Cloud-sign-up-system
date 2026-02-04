import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import UserDeletionImpactController from "../../../../src/controllers/user-admin/UserDeletionImpactController";

// Mock dependencies
vi.mock("../../../../src/services/UserDeletionService", () => ({
  UserDeletionService: {
    getUserDeletionImpact: vi.fn(),
  },
}));

interface MockUser {
  id: string;
  role: string;
}

interface MockRequest {
  user?: MockUser;
  params: Record<string, string>;
}

describe("UserDeletionImpactController", () => {
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
      user: { id: "admin123", role: "Super Admin" },
      params: { id: "user456" },
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("getUserDeletionImpact", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await UserDeletionImpactController.getUserDeletionImpact(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
          }),
        );
      });
    });

    describe("Authorization", () => {
      it("should return 403 for Administrator role", async () => {
        mockReq.user = { id: "admin123", role: "Administrator" };

        await UserDeletionImpactController.getUserDeletionImpact(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            message: "Only Super Admin can view deletion impact.",
          }),
        );
      });

      it("should return 403 for Leader role", async () => {
        mockReq.user = { id: "leader123", role: "Leader" };

        await UserDeletionImpactController.getUserDeletionImpact(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(403);
      });

      it("should return 403 for Participant role", async () => {
        mockReq.user = { id: "user123", role: "Participant" };

        await UserDeletionImpactController.getUserDeletionImpact(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(403);
      });
    });

    describe("Successful Impact Analysis", () => {
      it("should return deletion impact for Super Admin", async () => {
        const { UserDeletionService } =
          await import("../../../../src/services/UserDeletionService");

        const mockImpact = {
          user: {
            email: "testuser@example.com",
            name: "Test User",
            role: "Participant",
            createdAt: new Date("2024-01-01"),
          },
          impact: {
            registrations: 5,
            eventsCreated: 2,
            eventOrganizations: 1,
            messageStates: 10,
            messagesCreated: 3,
            promoCodes: 0,
            programMentorships: 0,
            programClassReps: 0,
            programMentees: 0,
            shortLinks: 1,
            avatarFile: true,
            eventFlyerFiles: 2,
            affectedEvents: [
              { id: "event1", title: "Test Event", participantCount: 10 },
            ],
          },
          risks: ["User has active registrations"],
        };

        vi.mocked(UserDeletionService.getUserDeletionImpact).mockResolvedValue(
          mockImpact,
        );

        await UserDeletionImpactController.getUserDeletionImpact(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(UserDeletionService.getUserDeletionImpact).toHaveBeenCalledWith(
          "user456",
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: mockImpact,
            message: "Deletion impact analysis completed.",
          }),
        );
      });

      it("should return empty impact when user has no data", async () => {
        const { UserDeletionService } =
          await import("../../../../src/services/UserDeletionService");

        const emptyImpact = {
          user: {
            email: "emptyuser@example.com",
            name: "Empty User",
            role: "Participant",
            createdAt: new Date("2024-06-01"),
          },
          impact: {
            registrations: 0,
            eventsCreated: 0,
            eventOrganizations: 0,
            messageStates: 0,
            messagesCreated: 0,
            promoCodes: 0,
            programMentorships: 0,
            programClassReps: 0,
            programMentees: 0,
            shortLinks: 0,
            avatarFile: false,
            eventFlyerFiles: 0,
            affectedEvents: [],
          },
          risks: [],
        };

        vi.mocked(UserDeletionService.getUserDeletionImpact).mockResolvedValue(
          emptyImpact,
        );

        await UserDeletionImpactController.getUserDeletionImpact(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on service error", async () => {
        const { UserDeletionService } =
          await import("../../../../src/services/UserDeletionService");

        vi.mocked(UserDeletionService.getUserDeletionImpact).mockRejectedValue(
          new Error("Service error"),
        );

        await UserDeletionImpactController.getUserDeletionImpact(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
          }),
        );
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it("should log error details", async () => {
        const { UserDeletionService } =
          await import("../../../../src/services/UserDeletionService");

        const testError = new Error("Test error");
        vi.mocked(UserDeletionService.getUserDeletionImpact).mockRejectedValue(
          testError,
        );

        await UserDeletionImpactController.getUserDeletionImpact(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Get deletion impact error:",
          testError,
        );
      });
    });
  });
});
