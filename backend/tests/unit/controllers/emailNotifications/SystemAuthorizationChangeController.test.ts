import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import SystemAuthorizationChangeController from "../../../../src/controllers/emailNotifications/SystemAuthorizationChangeController";

// Mock dependencies
vi.mock(
  "../../../../src/services/infrastructure/autoEmailNotificationService",
  () => ({
    AutoEmailNotificationService: {
      sendRoleChangeNotification: vi.fn(),
    },
  })
);

vi.mock("../../../../src/utils/roleUtils", () => ({
  RoleUtils: {
    isPromotion: vi.fn(),
    isDemotion: vi.fn(),
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

import { AutoEmailNotificationService } from "../../../../src/services/infrastructure/autoEmailNotificationService";
import { RoleUtils } from "../../../../src/utils/roleUtils";

interface MockRequest {
  body: {
    userData?: {
      _id?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      oldRole?: string;
      newRole?: string;
    };
    changedBy?: {
      firstName?: string;
      lastName?: string;
    };
  };
}

describe("SystemAuthorizationChangeController", () => {
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
    oldRole: "Viewer",
    newRole: "Editor",
  };

  const validChangedBy = {
    firstName: "Admin",
    lastName: "User",
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

    mockReq = { body: { userData: validUserData, changedBy: validChangedBy } };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe("sendSystemAuthorizationChangeNotification", () => {
    describe("Validation", () => {
      it("should return 400 if userData is missing", async () => {
        mockReq.body.userData = undefined;

        await SystemAuthorizationChangeController.sendSystemAuthorizationChangeNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "User data with ID, old role, and new role is required",
        });
      });

      it("should return 400 if _id is missing", async () => {
        mockReq.body.userData = { ...validUserData, _id: undefined };

        await SystemAuthorizationChangeController.sendSystemAuthorizationChangeNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it("should return 400 if oldRole is missing", async () => {
        mockReq.body.userData = { ...validUserData, oldRole: undefined };

        await SystemAuthorizationChangeController.sendSystemAuthorizationChangeNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it("should return 400 if newRole is missing", async () => {
        mockReq.body.userData = { ...validUserData, newRole: undefined };

        await SystemAuthorizationChangeController.sendSystemAuthorizationChangeNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });
    });

    describe("No Role Change", () => {
      it("should return success with no notification when role unchanged", async () => {
        mockReq.body.userData = {
          ...validUserData,
          newRole: validUserData.oldRole,
        };

        await SystemAuthorizationChangeController.sendSystemAuthorizationChangeNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Role has not changed, no notification sent",
          emailsSent: 0,
          messagesCreated: 0,
        });
      });
    });

    describe("Successful Notification - Promotion", () => {
      it("should send promotion notification when role is promoted", async () => {
        vi.mocked(RoleUtils.isPromotion).mockReturnValue(true);
        vi.mocked(RoleUtils.isDemotion).mockReturnValue(false);
        vi.mocked(
          AutoEmailNotificationService.sendRoleChangeNotification
        ).mockResolvedValue({
          emailsSent: 1,
          messagesCreated: 1,
          success: true,
        });

        await SystemAuthorizationChangeController.sendSystemAuthorizationChangeNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(RoleUtils.isPromotion).toHaveBeenCalledWith("Viewer", "Editor");
        expect(
          AutoEmailNotificationService.sendRoleChangeNotification
        ).toHaveBeenCalledWith({
          userData: validUserData,
          changedBy: validChangedBy,
          isPromotion: true,
        });
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message:
            "🎉 Promotion notification sent with email, system message, and bell notification",
          emailsSent: 1,
          messagesCreated: 1,
          changeType: "promotion",
          unifiedMessaging: true,
        });
      });
    });

    describe("Successful Notification - Demotion", () => {
      it("should send demotion notification when role is demoted", async () => {
        mockReq.body.userData = {
          ...validUserData,
          oldRole: "Editor",
          newRole: "Viewer",
        };
        vi.mocked(RoleUtils.isPromotion).mockReturnValue(false);
        vi.mocked(RoleUtils.isDemotion).mockReturnValue(true);
        vi.mocked(
          AutoEmailNotificationService.sendRoleChangeNotification
        ).mockResolvedValue({
          emailsSent: 1,
          messagesCreated: 1,
          success: true,
        });

        await SystemAuthorizationChangeController.sendSystemAuthorizationChangeNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            changeType: "demotion",
            message:
              "📋 Role change notification sent with email, system message, and bell notification",
          })
        );
      });
    });

    describe("Successful Notification - Lateral Change", () => {
      it("should send change notification when role is laterally moved", async () => {
        vi.mocked(RoleUtils.isPromotion).mockReturnValue(false);
        vi.mocked(RoleUtils.isDemotion).mockReturnValue(false);
        vi.mocked(
          AutoEmailNotificationService.sendRoleChangeNotification
        ).mockResolvedValue({
          emailsSent: 1,
          messagesCreated: 1,
          success: true,
        });

        await SystemAuthorizationChangeController.sendSystemAuthorizationChangeNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            changeType: "change",
            message:
              "📋 Role change notification sent with email, system message, and bell notification",
          })
        );
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on error", async () => {
        vi.mocked(RoleUtils.isPromotion).mockReturnValue(true);
        vi.mocked(
          AutoEmailNotificationService.sendRoleChangeNotification
        ).mockRejectedValue(new Error("Notification failed"));

        await SystemAuthorizationChangeController.sendSystemAuthorizationChangeNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to send system authorization change notifications",
          error: "Notification failed",
        });
      });
    });
  });
});
