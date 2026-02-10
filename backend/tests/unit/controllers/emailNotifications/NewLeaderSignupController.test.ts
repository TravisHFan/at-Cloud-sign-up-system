import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import NewLeaderSignupController from "../../../../src/controllers/emailNotifications/NewLeaderSignupController";

// Mock dependencies
vi.mock("../../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendNewLeaderSignupEmail: vi.fn(),
  },
}));

vi.mock("../../../../src/utils/emailRecipientUtils", () => ({
  EmailRecipientUtils: {
    getAdminUsers: vi.fn(),
  },
}));

vi.mock("../../../../src/controllers/unifiedMessageController", () => ({
  UnifiedMessageController: {
    createTargetedSystemMessage: vi.fn(),
  },
}));

vi.mock("../../../../src/models", () => ({
  User: {
    find: vi.fn(),
  },
}));

vi.mock("../../../../src/services/CorrelatedLogger", () => ({
  CorrelatedLogger: {
    fromRequest: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";
import { EmailRecipientUtils } from "../../../../src/utils/emailRecipientUtils";
import { UnifiedMessageController } from "../../../../src/controllers/unifiedMessageController";
import { User } from "../../../../src/models";

interface MockRequest {
  body: {
    userData?: {
      email?: string;
      firstName?: string;
      lastName?: string;
      roleInAtCloud?: string;
    };
  };
}

describe("NewLeaderSignupController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: any;
  let consoleLogSpy: any;
  let consoleWarnSpy: any;

  const validUserData = {
    email: "newleader@test.com",
    firstName: "New",
    lastName: "Leader",
    roleInAtCloud: "Ministry Leader",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock as unknown as Response["status"],
      json: jsonMock as unknown as Response["json"],
    };

    mockReq = { body: { userData: validUserData } };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe("sendNewLeaderSignupNotification", () => {
    describe("Validation", () => {
      it("should return 400 if userData is missing", async () => {
        mockReq.body.userData = undefined;

        await NewLeaderSignupController.sendNewLeaderSignupNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "User data with email and name is required",
        });
      });

      it("should return 400 if email is missing", async () => {
        mockReq.body.userData = { firstName: "Test" };

        await NewLeaderSignupController.sendNewLeaderSignupNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it("should return 400 if firstName is missing", async () => {
        mockReq.body.userData = { email: "test@test.com" };

        await NewLeaderSignupController.sendNewLeaderSignupNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });
    });

    describe("No Admin Recipients", () => {
      it("should return success with 0 recipients when no admins found", async () => {
        vi.mocked(EmailRecipientUtils.getAdminUsers).mockResolvedValue([]);

        await NewLeaderSignupController.sendNewLeaderSignupNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "New leader signup notification sent to 0 recipient(s)",
          recipientCount: 0,
        });
        expect(consoleWarnSpy).toHaveBeenCalled();
      });
    });

    describe("Successful Notification", () => {
      it("should send emails to all admins", async () => {
        const adminRecipients = [
          {
            email: "admin1@test.com",
            firstName: "Admin",
            lastName: "One",
            role: "Admin",
          },
          {
            email: "admin2@test.com",
            firstName: "Super",
            lastName: "Admin",
            role: "Super Admin",
          },
        ];
        vi.mocked(EmailRecipientUtils.getAdminUsers).mockResolvedValue(
          adminRecipients,
        );
        vi.mocked(EmailService.sendNewLeaderSignupEmail).mockResolvedValue(
          true,
        );
        vi.mocked(User.find).mockResolvedValue([
          { _id: "admin1" },
          { _id: "admin2" },
        ]);
        vi.mocked(
          UnifiedMessageController.createTargetedSystemMessage,
        ).mockResolvedValue({} as any);

        await NewLeaderSignupController.sendNewLeaderSignupNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(EmailService.sendNewLeaderSignupEmail).toHaveBeenCalledTimes(2);
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "New leader signup notification sent to 2 recipient(s)",
          recipientCount: 2,
        });
      });

      it("should count only successful emails", async () => {
        const adminRecipients = [
          {
            email: "admin1@test.com",
            firstName: "Admin",
            lastName: "One",
            role: "Admin",
          },
          {
            email: "admin2@test.com",
            firstName: "Super",
            lastName: "Admin",
            role: "Super Admin",
          },
        ];
        vi.mocked(EmailRecipientUtils.getAdminUsers).mockResolvedValue(
          adminRecipients,
        );
        vi.mocked(EmailService.sendNewLeaderSignupEmail)
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(false);
        vi.mocked(User.find).mockResolvedValue([]);

        await NewLeaderSignupController.sendNewLeaderSignupNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "New leader signup notification sent to 1 recipient(s)",
          recipientCount: 1,
        });
      });

      it("should create system message for admins", async () => {
        const adminRecipients = [
          {
            email: "admin@test.com",
            firstName: "Admin",
            lastName: "User",
            role: "Admin",
          },
        ];
        vi.mocked(EmailRecipientUtils.getAdminUsers).mockResolvedValue(
          adminRecipients,
        );
        vi.mocked(EmailService.sendNewLeaderSignupEmail).mockResolvedValue(
          true,
        );
        vi.mocked(User.find).mockResolvedValue([{ _id: "adminId1" }]);
        vi.mocked(
          UnifiedMessageController.createTargetedSystemMessage,
        ).mockResolvedValue({} as any);

        await NewLeaderSignupController.sendNewLeaderSignupNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(
          UnifiedMessageController.createTargetedSystemMessage,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "New Leader Registration",
            type: "admin_alert",
            priority: "medium",
          }),
          ["adminId1"],
          expect.any(Object),
        );
      });

      it("should use default role when roleInAtCloud not provided", async () => {
        mockReq.body.userData = { ...validUserData, roleInAtCloud: undefined };
        vi.mocked(EmailRecipientUtils.getAdminUsers).mockResolvedValue([
          {
            email: "admin@test.com",
            firstName: "Admin",
            lastName: "User",
            role: "Admin",
          },
        ]);
        vi.mocked(EmailService.sendNewLeaderSignupEmail).mockResolvedValue(
          true,
        );
        vi.mocked(User.find).mockResolvedValue([]);

        await NewLeaderSignupController.sendNewLeaderSignupNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(EmailService.sendNewLeaderSignupEmail).toHaveBeenCalledWith(
          "admin@test.com",
          "Admin User",
          expect.objectContaining({
            roleInAtCloud: "Leader",
          }),
        );
      });

      it("should continue if system message creation fails", async () => {
        vi.mocked(EmailRecipientUtils.getAdminUsers).mockResolvedValue([
          {
            email: "admin@test.com",
            firstName: "Admin",
            lastName: "User",
            role: "Admin",
          },
        ]);
        vi.mocked(EmailService.sendNewLeaderSignupEmail).mockResolvedValue(
          true,
        );
        vi.mocked(User.find).mockResolvedValue([{ _id: "adminId" }]);
        vi.mocked(
          UnifiedMessageController.createTargetedSystemMessage,
        ).mockRejectedValue(new Error("Message failed"));

        await NewLeaderSignupController.sendNewLeaderSignupNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(consoleWarnSpy).toHaveBeenCalled();
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on error", async () => {
        vi.mocked(EmailRecipientUtils.getAdminUsers).mockRejectedValue(
          new Error("Database error"),
        );

        await NewLeaderSignupController.sendNewLeaderSignupNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to send new leader signup notifications",
          error: "Database error",
        });
      });

      it("should return Unknown error for non-Error throws", async () => {
        vi.mocked(EmailRecipientUtils.getAdminUsers).mockRejectedValue(
          "string error",
        );

        await NewLeaderSignupController.sendNewLeaderSignupNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to send new leader signup notifications",
          error: "Unknown error",
        });
      });
    });
  });
});
