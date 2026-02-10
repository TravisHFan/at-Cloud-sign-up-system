import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import AtCloudRoleChangeController from "../../../../src/controllers/emailNotifications/AtCloudRoleChangeController";

// Mock dependencies
vi.mock("../../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendAtCloudRoleChangeToUser: vi.fn(),
    sendAtCloudRoleChangeToAdmins: vi.fn(),
  },
}));

vi.mock("../../../../src/utils/emailRecipientUtils", () => ({
  EmailRecipientUtils: {
    getSystemAuthorizationChangeRecipients: vi.fn(),
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

vi.mock("../../../../src/services/LoggerService", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";
import { EmailRecipientUtils } from "../../../../src/utils/emailRecipientUtils";

interface MockRequest {
  body: {
    userData?: {
      _id?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      oldRoleInAtCloud?: string;
      newRoleInAtCloud?: string;
    };
  };
}

describe("AtCloudRoleChangeController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: any;
  let consoleLogSpy: any;

  const validUserData = {
    _id: "user123",
    email: "user@test.com",
    firstName: "Test",
    lastName: "User",
    oldRoleInAtCloud: "Ministry Leader",
    newRoleInAtCloud: "Developer",
  };

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
      body: {
        userData: validUserData,
      },
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe("sendAtCloudRoleChangeNotification", () => {
    describe("Validation", () => {
      it("should return 400 if userData is missing", async () => {
        mockReq.body.userData = undefined;

        await AtCloudRoleChangeController.sendAtCloudRoleChangeNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message:
            "User data with ID, old roleInAtCloud, and new roleInAtCloud is required",
        });
      });

      it("should return 400 if _id is missing", async () => {
        mockReq.body.userData = { ...validUserData, _id: undefined };

        await AtCloudRoleChangeController.sendAtCloudRoleChangeNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it("should return 400 if oldRoleInAtCloud is missing", async () => {
        mockReq.body.userData = {
          ...validUserData,
          oldRoleInAtCloud: undefined,
        };

        await AtCloudRoleChangeController.sendAtCloudRoleChangeNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it("should return 400 if newRoleInAtCloud is missing", async () => {
        mockReq.body.userData = {
          ...validUserData,
          newRoleInAtCloud: undefined,
        };

        await AtCloudRoleChangeController.sendAtCloudRoleChangeNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });
    });

    describe("No Change", () => {
      it("should return success with 0 recipients if role unchanged", async () => {
        mockReq.body.userData = {
          ...validUserData,
          newRoleInAtCloud: validUserData.oldRoleInAtCloud,
        };

        await AtCloudRoleChangeController.sendAtCloudRoleChangeNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "@Cloud role has not changed, no notification sent",
          recipientCount: 0,
        });
      });
    });

    describe("Successful Notification", () => {
      it("should send notification to user and admins", async () => {
        vi.mocked(EmailService.sendAtCloudRoleChangeToUser).mockResolvedValue(
          true,
        );
        vi.mocked(
          EmailRecipientUtils.getSystemAuthorizationChangeRecipients,
        ).mockResolvedValue([
          {
            email: "admin1@test.com",
            firstName: "Admin",
            lastName: "One",
            role: "Administrator",
          },
          {
            email: "admin2@test.com",
            firstName: "Admin",
            lastName: "Two",
            role: "Administrator",
          },
        ]);
        vi.mocked(EmailService.sendAtCloudRoleChangeToAdmins).mockResolvedValue(
          true,
        );

        await AtCloudRoleChangeController.sendAtCloudRoleChangeNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(EmailService.sendAtCloudRoleChangeToUser).toHaveBeenCalledWith(
          "user@test.com",
          validUserData,
        );
        expect(
          EmailRecipientUtils.getSystemAuthorizationChangeRecipients,
        ).toHaveBeenCalledWith("user123");
        expect(
          EmailService.sendAtCloudRoleChangeToAdmins,
        ).toHaveBeenCalledTimes(2);
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "@Cloud role change notification sent to 3 recipient(s)",
          recipientCount: 3,
        });
      });

      it("should count recipients correctly when user email fails", async () => {
        vi.mocked(EmailService.sendAtCloudRoleChangeToUser).mockResolvedValue(
          false,
        );
        vi.mocked(
          EmailRecipientUtils.getSystemAuthorizationChangeRecipients,
        ).mockResolvedValue([
          {
            email: "admin@test.com",
            firstName: "Admin",
            lastName: "User",
            role: "Administrator",
          },
        ]);
        vi.mocked(EmailService.sendAtCloudRoleChangeToAdmins).mockResolvedValue(
          true,
        );

        await AtCloudRoleChangeController.sendAtCloudRoleChangeNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "@Cloud role change notification sent to 1 recipient(s)",
          recipientCount: 1,
        });
      });

      it("should handle no admin recipients", async () => {
        vi.mocked(EmailService.sendAtCloudRoleChangeToUser).mockResolvedValue(
          true,
        );
        vi.mocked(
          EmailRecipientUtils.getSystemAuthorizationChangeRecipients,
        ).mockResolvedValue([]);

        await AtCloudRoleChangeController.sendAtCloudRoleChangeNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "@Cloud role change notification sent to 1 recipient(s)",
          recipientCount: 1,
        });
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on error", async () => {
        vi.mocked(EmailService.sendAtCloudRoleChangeToUser).mockRejectedValue(
          new Error("Email failed"),
        );

        await AtCloudRoleChangeController.sendAtCloudRoleChangeNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to send @Cloud role change notifications",
          error: "Email failed",
        });
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it("should return Unknown error for non-Error throws", async () => {
        vi.mocked(EmailService.sendAtCloudRoleChangeToUser).mockRejectedValue(
          "string error",
        );

        await AtCloudRoleChangeController.sendAtCloudRoleChangeNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to send @Cloud role change notifications",
          error: "Unknown error",
        });
      });
    });
  });
});
