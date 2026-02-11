import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Response } from "express";
import GuestManageLinkController from "../../../../src/controllers/guest/GuestManageLinkController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  GuestRegistration: {
    findById: vi.fn(),
  },
  Event: {
    findById: vi.fn(),
  },
}));

vi.mock("../../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendGuestConfirmationEmail: vi.fn(),
  },
}));

vi.mock("../../../../src/services/CorrelatedLogger", () => ({
  CorrelatedLogger: {
    fromRequest: vi.fn().mockReturnValue({
      error: vi.fn(),
    }),
  },
}));

import { CorrelatedLogger } from "../../../../src/services/CorrelatedLogger";

vi.mock("../../../../src/services/LoggerService", () => ({
  createLogger: vi.fn().mockReturnValue({
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));

import { GuestRegistration, Event } from "../../../../src/models";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

interface MockRequest {
  params: Record<string, string>;
  body?: Record<string, unknown>;
}

describe("GuestManageLinkController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: any;

  const mockRegistrationId = "507f1f77bcf86cd799439011";
  const mockEventId = "507f1f77bcf86cd799439012";

  beforeEach(() => {
    vi.clearAllMocks();

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };

    mockReq = {
      params: { id: mockRegistrationId },
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("resendManageLink", () => {
    describe("Validation", () => {
      it("should return 404 if guest registration not found", async () => {
        vi.mocked(GuestRegistration.findById).mockResolvedValue(null);

        await GuestManageLinkController.resendManageLink(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Guest registration not found",
        });
      });

      it("should return 400 if registration is cancelled", async () => {
        const mockDoc = {
          _id: mockRegistrationId,
          status: "cancelled",
          eventId: mockEventId,
        };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockDoc);

        await GuestManageLinkController.resendManageLink(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Cannot re-send link for cancelled registration",
        });
      });
    });

    describe("Success", () => {
      it("should resend manage link successfully", async () => {
        const mockDoc = {
          _id: mockRegistrationId,
          status: "pending",
          eventId: mockEventId,
          email: "guest@test.com",
          fullName: "Test Guest",
          eventSnapshot: { roleName: "Speaker" },
          generateManageToken: vi.fn().mockReturnValue("new-token-123"),
          save: vi.fn().mockResolvedValue(undefined),
        };

        const mockEvent = {
          _id: mockEventId,
          title: "Test Event",
          date: new Date(),
          location: "Test Location",
          organizerDetails: [],
        };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockDoc);
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        vi.mocked(EmailService.sendGuestConfirmationEmail).mockResolvedValue(
          true,
        );

        await GuestManageLinkController.resendManageLink(
          mockReq as any,
          mockRes as Response,
        );

        expect(mockDoc.generateManageToken).toHaveBeenCalled();
        expect(mockDoc.save).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Manage link re-sent successfully",
        });
      });

      it("should resend manage link with createdBy populated", async () => {
        const mockDoc = {
          _id: mockRegistrationId,
          status: "pending",
          eventId: mockEventId,
          email: "guest@test.com",
          fullName: "Test Guest",
          eventSnapshot: { roleName: "Speaker" },
          generateManageToken: vi.fn().mockReturnValue("new-token-123"),
          save: vi.fn().mockResolvedValue(undefined),
        };

        const mockEvent = {
          _id: mockEventId,
          title: "Test Event",
          date: new Date(),
          location: "Test Location",
          organizerDetails: [
            {
              name: "Host",
              role: "Organizer",
              email: "host@test.com",
              phone: "555-1234",
            },
          ],
          createdBy: {
            firstName: "John",
            lastName: "Doe",
            username: "johndoe",
            email: "john@test.com",
            phone: "555-5678",
            avatar: "avatar.jpg",
            gender: "male",
          },
        };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockDoc);
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        vi.mocked(EmailService.sendGuestConfirmationEmail).mockResolvedValue(
          true,
        );

        await GuestManageLinkController.resendManageLink(
          mockReq as any,
          mockRes as Response,
        );

        expect(mockDoc.generateManageToken).toHaveBeenCalled();
        expect(mockDoc.save).toHaveBeenCalled();
        expect(EmailService.sendGuestConfirmationEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            guestEmail: "guest@test.com",
            guestName: "Test Guest",
            event: expect.objectContaining({
              createdBy: expect.objectContaining({
                firstName: "John",
                lastName: "Doe",
                email: "john@test.com",
              }),
            }),
          }),
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Manage link re-sent successfully",
        });
      });

      it("should handle email failure gracefully", async () => {
        const mockDoc = {
          _id: mockRegistrationId,
          status: "pending",
          eventId: mockEventId,
          email: "guest@test.com",
          fullName: "Test Guest",
          eventSnapshot: { roleName: "Speaker" },
          generateManageToken: vi.fn().mockReturnValue("new-token-123"),
          save: vi.fn().mockResolvedValue(undefined),
        };

        const mockEvent = {
          _id: mockEventId,
          title: "Test Event",
          date: new Date(),
        };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockDoc);
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        vi.mocked(EmailService.sendGuestConfirmationEmail).mockRejectedValue(
          new Error("Email failed"),
        );

        await GuestManageLinkController.resendManageLink(
          mockReq as any,
          mockRes as Response,
        );

        // Should still succeed even if email fails
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Manage link re-sent successfully",
        });
      });

      it("should handle missing generateManageToken gracefully", async () => {
        const mockDoc = {
          _id: mockRegistrationId,
          status: "pending",
          eventId: mockEventId,
          email: "guest@test.com",
          fullName: "Test Guest",
          eventSnapshot: { roleName: "Speaker" },
          // No generateManageToken method
          save: vi.fn().mockResolvedValue(undefined),
        };

        const mockEvent = {
          _id: mockEventId,
          title: "Test Event",
          date: new Date(),
        };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockDoc);
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        vi.mocked(EmailService.sendGuestConfirmationEmail).mockResolvedValue(
          true,
        );

        await GuestManageLinkController.resendManageLink(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(GuestRegistration.findById).mockRejectedValue(
          new Error("Database error"),
        );

        await GuestManageLinkController.resendManageLink(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to re-send manage link",
        });
      });

      it("should handle CorrelatedLogger.fromRequest throwing on email failure", async () => {
        const mockDoc = {
          _id: mockRegistrationId,
          status: "pending",
          eventId: mockEventId,
          email: "guest@test.com",
          fullName: "Test Guest",
          eventSnapshot: { roleName: "Speaker" },
          generateManageToken: vi.fn().mockReturnValue("new-token-123"),
          save: vi.fn().mockResolvedValue(undefined),
        };

        const mockEvent = {
          _id: mockEventId,
          title: "Test Event",
          date: new Date(),
        };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockDoc);
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        vi.mocked(EmailService.sendGuestConfirmationEmail).mockRejectedValue(
          new Error("Email failed"),
        );
        vi.mocked(CorrelatedLogger.fromRequest).mockImplementation(() => {
          throw new Error("Logger construction failed");
        });

        await GuestManageLinkController.resendManageLink(
          mockReq as any,
          mockRes as Response,
        );

        // Should still succeed - the inner catch ignores the logger failure
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Manage link re-sent successfully",
        });
      });

      it("should handle CorrelatedLogger.fromRequest throwing on outer error", async () => {
        vi.mocked(GuestRegistration.findById).mockRejectedValue(
          new Error("Database error"),
        );
        vi.mocked(CorrelatedLogger.fromRequest).mockImplementation(() => {
          throw new Error("Logger construction failed");
        });

        await GuestManageLinkController.resendManageLink(
          mockReq as any,
          mockRes as Response,
        );

        // Should still return 500 - the inner catch ignores the logger failure
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to re-send manage link",
        });
      });
    });
  });
});
