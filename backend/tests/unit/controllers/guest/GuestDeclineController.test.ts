import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Response } from "express";
import GuestDeclineController from "../../../../src/controllers/guest/GuestDeclineController";

// Mock the dynamic import for token verification
const mockVerifyToken = vi.fn();
vi.mock("../../../../src/utils/guestInvitationDeclineToken", () => ({
  verifyGuestInvitationDeclineToken: mockVerifyToken,
}));

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  GuestRegistration: {
    findById: vi.fn(),
  },
  Event: {
    findById: vi.fn(),
  },
  User: {
    findById: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    }),
  },
}));

vi.mock("../../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendGuestDeclineNotification: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock(
  "../../../../src/services/notifications/TrioNotificationService",
  () => ({
    TrioNotificationService: {
      createTrio: vi.fn().mockResolvedValue(undefined),
    },
  }),
);

vi.mock("../../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitEventUpdate: vi.fn(),
  },
}));

vi.mock("../../../../src/services/LoggerService", () => ({
  createLogger: vi.fn().mockReturnValue({
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));

import { GuestRegistration, Event, User } from "../../../../src/models";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";
import { TrioNotificationService } from "../../../../src/services/notifications/TrioNotificationService";
import { socketService } from "../../../../src/services/infrastructure/SocketService";

interface MockRequest {
  params: Record<string, string>;
  body?: Record<string, unknown>;
}

describe("GuestDeclineController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: any;

  const mockRegistrationId = "507f1f77bcf86cd799439011";
  const mockEventId = "507f1f77bcf86cd799439012";
  const mockToken = "valid-token-12345";

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
      params: { token: mockToken },
      body: {},
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("getDeclineTokenInfo", () => {
    describe("Token Validation", () => {
      it("should return 400 for invalid token", async () => {
        mockVerifyToken.mockReturnValue({
          valid: false,
          reason: "invalid",
        });

        await GuestDeclineController.getDeclineTokenInfo(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid decline link",
          reason: "invalid",
        });
      });

      it("should return 410 for expired token", async () => {
        mockVerifyToken.mockReturnValue({
          valid: false,
          reason: "expired",
        });

        await GuestDeclineController.getDeclineTokenInfo(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(410);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Decline link has expired",
          reason: "expired",
        });
      });

      it("should return 400 for wrong_type token", async () => {
        mockVerifyToken.mockReturnValue({
          valid: false,
          reason: "wrong_type",
        });

        await GuestDeclineController.getDeclineTokenInfo(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid decline link",
          reason: "wrong_type",
        });
      });
    });

    describe("Registration Validation", () => {
      it("should return 404 if registration not found", async () => {
        mockVerifyToken.mockReturnValue({
          valid: true,
          payload: { registrationId: mockRegistrationId },
        });

        vi.mocked(GuestRegistration.findById).mockResolvedValue(null);

        await GuestDeclineController.getDeclineTokenInfo(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Registration not found",
        });
      });

      it("should return 409 if registration already cancelled", async () => {
        mockVerifyToken.mockReturnValue({
          valid: true,
          payload: { registrationId: mockRegistrationId },
        });

        vi.mocked(GuestRegistration.findById).mockResolvedValue({
          _id: mockRegistrationId,
          status: "cancelled",
        });

        await GuestDeclineController.getDeclineTokenInfo(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(409);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invitation already declined or cancelled",
        });
      });

      it("should return 409 if registration already declined", async () => {
        mockVerifyToken.mockReturnValue({
          valid: true,
          payload: { registrationId: mockRegistrationId },
        });

        vi.mocked(GuestRegistration.findById).mockResolvedValue({
          _id: mockRegistrationId,
          status: "pending",
          declinedAt: new Date(),
        });

        await GuestDeclineController.getDeclineTokenInfo(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(409);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invitation already declined or cancelled",
        });
      });
    });

    describe("Success", () => {
      it("should return decline summary for valid token", async () => {
        mockVerifyToken.mockReturnValue({
          valid: true,
          payload: { registrationId: mockRegistrationId },
        });

        const mockDoc = {
          _id: mockRegistrationId,
          status: "pending",
          eventId: mockEventId,
          fullName: "Test Guest",
          eventSnapshot: {
            title: "Test Event",
            roleName: "Speaker",
            date: new Date(),
            location: "Test Location",
          },
        };

        const mockEvent = {
          _id: mockEventId,
          title: "Test Event",
          date: new Date(),
          location: "Test Location",
        };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockDoc);
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);

        await GuestDeclineController.getDeclineTokenInfo(
          mockReq as any,
          mockRes as Response,
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.data.registrationId).toBe(mockRegistrationId);
        expect(response.data.guestName).toBe("Test Guest");
        expect(response.data.roleName).toBe("Speaker");
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on unexpected error", async () => {
        mockVerifyToken.mockImplementation(() => {
          throw new Error("Unexpected error");
        });

        await GuestDeclineController.getDeclineTokenInfo(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Server error",
        });
      });
    });
  });

  describe("submitDecline", () => {
    describe("Token Validation", () => {
      it("should return 400 for invalid token", async () => {
        mockVerifyToken.mockReturnValue({
          valid: false,
          reason: "invalid",
        });

        await GuestDeclineController.submitDecline(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid decline link",
          reason: "invalid",
        });
      });

      it("should return 410 for expired token", async () => {
        mockVerifyToken.mockReturnValue({
          valid: false,
          reason: "expired",
        });

        await GuestDeclineController.submitDecline(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(410);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Decline link has expired",
          reason: "expired",
        });
      });
    });

    describe("Registration Validation", () => {
      it("should return 404 if registration not found", async () => {
        mockVerifyToken.mockReturnValue({
          valid: true,
          payload: { registrationId: mockRegistrationId },
        });

        vi.mocked(GuestRegistration.findById).mockResolvedValue(null);

        await GuestDeclineController.submitDecline(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Registration not found",
        });
      });

      it("should return 409 if registration already declined", async () => {
        mockVerifyToken.mockReturnValue({
          valid: true,
          payload: { registrationId: mockRegistrationId },
        });

        vi.mocked(GuestRegistration.findById).mockResolvedValue({
          _id: mockRegistrationId,
          status: "cancelled",
        });

        await GuestDeclineController.submitDecline(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(409);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invitation already declined or cancelled",
        });
      });
    });

    describe("Success", () => {
      it("should decline invitation successfully", async () => {
        mockVerifyToken.mockReturnValue({
          valid: true,
          payload: { registrationId: mockRegistrationId },
        });

        const mockDoc: Record<string, any> = {
          _id: mockRegistrationId,
          status: "pending",
          eventId: mockEventId,
          fullName: "Test Guest",
          email: "guest@test.com",
          roleId: "role123",
          eventSnapshot: {
            title: "Test Event",
            roleName: "Speaker",
          },
          save: vi.fn().mockResolvedValue(undefined),
        };

        const mockEvent = {
          _id: mockEventId,
          title: "Test Event",
          organizerDetails: [],
        };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockDoc);
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);

        await GuestDeclineController.submitDecline(
          mockReq as any,
          mockRes as Response,
        );

        expect(mockDoc.save).toHaveBeenCalled();
        expect(mockDoc.status).toBe("cancelled");
        expect(mockDoc.migrationStatus).toBe("declined");
        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.message).toBe("Invitation declined successfully");
      });

      it("should save decline reason when provided", async () => {
        mockVerifyToken.mockReturnValue({
          valid: true,
          payload: { registrationId: mockRegistrationId },
        });

        mockReq.body = { reason: "I cannot attend due to scheduling conflict" };

        const mockDoc: Record<string, any> = {
          _id: mockRegistrationId,
          status: "pending",
          eventId: mockEventId,
          fullName: "Test Guest",
          email: "guest@test.com",
          roleId: "role123",
          eventSnapshot: {
            title: "Test Event",
            roleName: "Speaker",
          },
          save: vi.fn().mockResolvedValue(undefined),
        };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockDoc);
        vi.mocked(Event.findById).mockResolvedValue({
          _id: mockEventId,
          organizerDetails: [],
        });

        await GuestDeclineController.submitDecline(
          mockReq as any,
          mockRes as Response,
        );

        expect(mockDoc.declineReason).toBe(
          "I cannot attend due to scheduling conflict",
        );
        expect(mockDoc.save).toHaveBeenCalled();
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on unexpected error", async () => {
        mockVerifyToken.mockImplementation(() => {
          throw new Error("Unexpected error");
        });

        await GuestDeclineController.submitDecline(
          mockReq as any,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Server error",
        });
      });
    });
    describe("Notification Flows", () => {
      it("should send organizer email notification for self-registered guest (no invitedBy)", async () => {
        mockVerifyToken.mockReturnValue({
          valid: true,
          payload: { registrationId: mockRegistrationId },
        });

        const mockDoc: Record<string, any> = {
          _id: mockRegistrationId,
          status: "pending",
          eventId: mockEventId,
          fullName: "Test Guest",
          email: "guest@test.com",
          roleId: "role123",
          invitedBy: undefined, // Self-registered
          eventSnapshot: {
            title: "Test Event",
            roleName: "Speaker",
            date: new Date(),
          },
          save: vi.fn().mockResolvedValue(undefined),
        };

        const mockEvent = {
          _id: mockEventId,
          title: "Test Event",
          date: new Date(),
          organizerDetails: [
            { email: "organizer1@test.com" },
            { email: "organizer2@test.com" },
          ],
        };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockDoc);
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);

        await GuestDeclineController.submitDecline(
          mockReq as any,
          mockRes as Response,
        );

        expect(EmailService.sendGuestDeclineNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            organizerEmails: ["organizer1@test.com", "organizer2@test.com"],
            guest: { name: "Test Guest", email: "guest@test.com" },
          }),
        );
      });

      it("should skip organizer notification when guest was invited by authenticated user", async () => {
        mockVerifyToken.mockReturnValue({
          valid: true,
          payload: { registrationId: mockRegistrationId },
        });

        const mockDoc: Record<string, any> = {
          _id: mockRegistrationId,
          status: "pending",
          eventId: mockEventId,
          fullName: "Test Guest",
          email: "guest@test.com",
          roleId: "role123",
          invitedBy: "user123", // Was invited by an authenticated user
          eventSnapshot: {
            title: "Test Event",
            roleName: "Speaker",
          },
          save: vi.fn().mockResolvedValue(undefined),
        };

        const mockEvent = {
          _id: mockEventId,
          title: "Test Event",
          organizerDetails: [{ email: "organizer@test.com" }],
        };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockDoc);
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        vi.mocked(User.findById).mockReturnValue({
          lean: vi.fn().mockResolvedValue(null), // No user found
        } as any);

        await GuestDeclineController.submitDecline(
          mockReq as any,
          mockRes as Response,
        );

        // Should NOT call organizer notification
        expect(
          EmailService.sendGuestDeclineNotification,
        ).not.toHaveBeenCalled();
      });

      it("should emit socket event on decline", async () => {
        mockVerifyToken.mockReturnValue({
          valid: true,
          payload: { registrationId: mockRegistrationId },
        });

        const mockDoc: Record<string, any> = {
          _id: mockRegistrationId,
          status: "pending",
          eventId: mockEventId,
          fullName: "Test Guest",
          email: "guest@test.com",
          roleId: "role123",
          eventSnapshot: {
            title: "Test Event",
            roleName: "Speaker",
          },
          save: vi.fn().mockResolvedValue(undefined),
        };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockDoc);
        vi.mocked(Event.findById).mockResolvedValue({
          _id: mockEventId,
          organizerDetails: [],
        });

        await GuestDeclineController.submitDecline(
          mockReq as any,
          mockRes as Response,
        );

        expect(socketService.emitEventUpdate).toHaveBeenCalledWith(
          mockEventId,
          "guest_declined",
          { roleId: "role123", guestName: "Test Guest" },
        );
      });

      it("should send system notification to inviter user", async () => {
        mockVerifyToken.mockReturnValue({
          valid: true,
          payload: { registrationId: mockRegistrationId },
        });

        const inviterId = "inviter-user-id-123";
        const mockDoc: Record<string, any> = {
          _id: mockRegistrationId,
          status: "pending",
          eventId: mockEventId,
          fullName: "Test Guest",
          email: "guest@test.com",
          roleId: "role123",
          invitedBy: inviterId,
          eventSnapshot: {
            title: "Test Event",
            roleName: "Speaker",
          },
          save: vi.fn().mockResolvedValue(undefined),
        };

        const mockEvent = {
          _id: mockEventId,
          title: "Test Event",
          organizerDetails: [],
        };

        const mockInviterUser = {
          _id: inviterId,
          firstName: "John",
          lastName: "Doe",
          username: "johndoe",
          email: "inviter@test.com",
          role: "Facilitator",
        };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockDoc);
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        vi.mocked(User.findById).mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockInviterUser),
        } as any);

        await GuestDeclineController.submitDecline(
          mockReq as any,
          mockRes as Response,
        );

        expect(TrioNotificationService.createTrio).toHaveBeenCalledWith(
          expect.objectContaining({
            recipients: [inviterId],
            systemMessage: expect.objectContaining({
              title: "Guest Invitation Declined",
              type: "event_role_change",
            }),
          }),
        );
      });

      it("should use event createdBy as fallback for notification recipient", async () => {
        mockVerifyToken.mockReturnValue({
          valid: true,
          payload: { registrationId: mockRegistrationId },
        });

        const creatorId = "creator-user-id-456";
        const mockDoc: Record<string, any> = {
          _id: mockRegistrationId,
          status: "pending",
          eventId: mockEventId,
          fullName: "Test Guest",
          email: "guest@test.com",
          roleId: "role123",
          invitedBy: undefined, // No inviter
          eventSnapshot: {
            title: "Test Event",
            roleName: "Speaker",
          },
          save: vi.fn().mockResolvedValue(undefined),
        };

        const mockEvent = {
          _id: mockEventId,
          title: "Test Event",
          organizerDetails: [],
          createdBy: { _id: creatorId }, // Event has a creator
        };

        const mockCreatorUser = {
          _id: creatorId,
          firstName: "Jane",
          lastName: "Smith",
          username: "janesmith",
          email: "creator@test.com",
          role: "Administrator",
        };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockDoc);
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        vi.mocked(User.findById).mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockCreatorUser),
        } as any);

        await GuestDeclineController.submitDecline(
          mockReq as any,
          mockRes as Response,
        );

        expect(TrioNotificationService.createTrio).toHaveBeenCalledWith(
          expect.objectContaining({
            recipients: [creatorId],
          }),
        );
      });

      it("should continue successfully if socket emit fails", async () => {
        mockVerifyToken.mockReturnValue({
          valid: true,
          payload: { registrationId: mockRegistrationId },
        });

        const mockDoc: Record<string, any> = {
          _id: mockRegistrationId,
          status: "pending",
          eventId: mockEventId,
          fullName: "Test Guest",
          email: "guest@test.com",
          roleId: "role123",
          eventSnapshot: {
            title: "Test Event",
            roleName: "Speaker",
          },
          save: vi.fn().mockResolvedValue(undefined),
        };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockDoc);
        vi.mocked(Event.findById).mockResolvedValue({
          _id: mockEventId,
          organizerDetails: [],
        });
        vi.mocked(socketService.emitEventUpdate).mockImplementation(() => {
          throw new Error("Socket error");
        });

        await GuestDeclineController.submitDecline(
          mockReq as any,
          mockRes as Response,
        );

        // Should still return success
        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
      });

      it("should continue successfully if notification email fails", async () => {
        mockVerifyToken.mockReturnValue({
          valid: true,
          payload: { registrationId: mockRegistrationId },
        });

        const mockDoc: Record<string, any> = {
          _id: mockRegistrationId,
          status: "pending",
          eventId: mockEventId,
          fullName: "Test Guest",
          email: "guest@test.com",
          roleId: "role123",
          invitedBy: undefined,
          eventSnapshot: {
            title: "Test Event",
            roleName: "Speaker",
          },
          save: vi.fn().mockResolvedValue(undefined),
        };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockDoc);
        vi.mocked(Event.findById).mockResolvedValue({
          _id: mockEventId,
          organizerDetails: [{ email: "org@test.com" }],
        });
        vi.mocked(EmailService.sendGuestDeclineNotification).mockRejectedValue(
          new Error("Email service error"),
        );

        await GuestDeclineController.submitDecline(
          mockReq as any,
          mockRes as Response,
        );

        // Should still return success
        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
      });

      it("should truncate long decline reason to 500 characters", async () => {
        mockVerifyToken.mockReturnValue({
          valid: true,
          payload: { registrationId: mockRegistrationId },
        });

        const longReason = "A".repeat(600); // 600 chars, should be truncated to 500
        mockReq.body = { reason: longReason };

        const mockDoc: Record<string, any> = {
          _id: mockRegistrationId,
          status: "pending",
          eventId: mockEventId,
          fullName: "Test Guest",
          email: "guest@test.com",
          roleId: "role123",
          eventSnapshot: {
            title: "Test Event",
            roleName: "Speaker",
          },
          save: vi.fn().mockResolvedValue(undefined),
        };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockDoc);
        vi.mocked(Event.findById).mockResolvedValue({
          _id: mockEventId,
          organizerDetails: [],
        });

        await GuestDeclineController.submitDecline(
          mockReq as any,
          mockRes as Response,
        );

        expect(mockDoc.declineReason).toBe("A".repeat(500));
      });

      it("should handle createdBy as string ID", async () => {
        mockVerifyToken.mockReturnValue({
          valid: true,
          payload: { registrationId: mockRegistrationId },
        });

        const creatorId = "string-creator-id-789";
        const mockDoc: Record<string, any> = {
          _id: mockRegistrationId,
          status: "pending",
          eventId: mockEventId,
          fullName: "Test Guest",
          email: "guest@test.com",
          roleId: "role123",
          invitedBy: undefined,
          eventSnapshot: {
            title: "Test Event",
            roleName: "Speaker",
          },
          save: vi.fn().mockResolvedValue(undefined),
        };

        const mockEvent = {
          _id: mockEventId,
          title: "Test Event",
          organizerDetails: [],
          createdBy: creatorId, // String ID, not object
        };

        const mockCreatorUser = {
          _id: creatorId,
          firstName: "Bob",
          lastName: "Creator",
          email: "bob@test.com",
        };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockDoc);
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        vi.mocked(User.findById).mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockCreatorUser),
        } as any);

        await GuestDeclineController.submitDecline(
          mockReq as any,
          mockRes as Response,
        );

        expect(TrioNotificationService.createTrio).toHaveBeenCalledWith(
          expect.objectContaining({
            recipients: [creatorId],
          }),
        );
      });

      it("should use 'Role' and 'Event' fallbacks when eventSnapshot is missing", async () => {
        mockVerifyToken.mockReturnValue({
          valid: true,
          payload: { registrationId: mockRegistrationId },
        });

        const creatorId = "507f1f77bcf86cd799439013";
        const mockDoc: Record<string, any> = {
          _id: mockRegistrationId,
          status: "pending",
          eventId: mockEventId,
          fullName: "Test Guest",
          email: "guest@test.com",
          roleId: "role123",
          invitedBy: undefined,
          // eventSnapshot missing roleName and title
          eventSnapshot: {},
          save: vi.fn().mockResolvedValue(undefined),
        };

        const mockEvent = {
          _id: mockEventId,
          // title also missing
          organizerDetails: [],
          createdBy: creatorId,
        };

        const mockCreatorUser = {
          _id: creatorId,
          firstName: "Bob",
          lastName: "Creator",
          email: "bob@test.com",
        };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockDoc);
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        vi.mocked(User.findById).mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockCreatorUser),
        } as any);

        await GuestDeclineController.submitDecline(
          mockReq as any,
          mockRes as Response,
        );

        expect(TrioNotificationService.createTrio).toHaveBeenCalledWith(
          expect.objectContaining({
            systemMessage: expect.objectContaining({
              content: expect.stringContaining('role "Role"'),
            }),
          }),
        );
        expect(TrioNotificationService.createTrio).toHaveBeenCalledWith(
          expect.objectContaining({
            systemMessage: expect.objectContaining({
              content: expect.stringContaining('event "Event"'),
            }),
          }),
        );
      });

      it("should include declineReason in system message content", async () => {
        mockVerifyToken.mockReturnValue({
          valid: true,
          payload: { registrationId: mockRegistrationId },
        });

        const creatorId = "507f1f77bcf86cd799439013";
        mockReq.body = { reason: "I have a conflict" };

        const mockDoc: Record<string, any> = {
          _id: mockRegistrationId,
          status: "pending",
          eventId: mockEventId,
          fullName: "Test Guest",
          email: "guest@test.com",
          roleId: "role123",
          invitedBy: undefined,
          eventSnapshot: {
            title: "Test Event",
            roleName: "Speaker",
          },
          save: vi.fn().mockResolvedValue(undefined),
        };

        const mockEvent = {
          _id: mockEventId,
          title: "Test Event",
          organizerDetails: [],
          createdBy: creatorId,
        };

        const mockCreatorUser = {
          _id: creatorId,
          firstName: "Bob",
          lastName: "Creator",
          email: "bob@test.com",
        };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockDoc);
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        vi.mocked(User.findById).mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockCreatorUser),
        } as any);

        await GuestDeclineController.submitDecline(
          mockReq as any,
          mockRes as Response,
        );

        expect(TrioNotificationService.createTrio).toHaveBeenCalledWith(
          expect.objectContaining({
            systemMessage: expect.objectContaining({
              content: expect.stringContaining("Reason: I have a conflict"),
            }),
          }),
        );
      });

      it("should handle TrioNotificationService.createTrio error gracefully", async () => {
        mockVerifyToken.mockReturnValue({
          valid: true,
          payload: { registrationId: mockRegistrationId },
        });

        const creatorId = "507f1f77bcf86cd799439013";
        const mockDoc: Record<string, any> = {
          _id: mockRegistrationId,
          status: "pending",
          eventId: mockEventId,
          fullName: "Test Guest",
          email: "guest@test.com",
          roleId: "role123",
          invitedBy: undefined,
          eventSnapshot: {
            title: "Test Event",
            roleName: "Speaker",
          },
          save: vi.fn().mockResolvedValue(undefined),
        };

        const mockEvent = {
          _id: mockEventId,
          title: "Test Event",
          organizerDetails: [],
          createdBy: creatorId,
        };

        const mockCreatorUser = {
          _id: creatorId,
          firstName: "Bob",
          lastName: "Creator",
          email: "bob@test.com",
        };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockDoc);
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        vi.mocked(User.findById).mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockCreatorUser),
        } as any);
        vi.mocked(TrioNotificationService.createTrio).mockRejectedValueOnce(
          new Error("Notification service error"),
        );

        await GuestDeclineController.submitDecline(
          mockReq as any,
          mockRes as Response,
        );

        // Should still succeed even if createTrio fails
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: "Invitation declined successfully",
          }),
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Failed to create system message for guest decline",
          expect.any(Error),
        );
      });
    });
  });
});
