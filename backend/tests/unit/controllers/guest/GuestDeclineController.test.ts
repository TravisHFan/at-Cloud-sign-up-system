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
    findById: vi.fn(),
  },
}));

vi.mock("../../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendGuestDeclineNotification: vi.fn(),
  },
}));

vi.mock(
  "../../../../src/services/notifications/TrioNotificationService",
  () => ({
    TrioNotificationService: {
      createTrio: vi.fn(),
    },
  })
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

import { GuestRegistration, Event } from "../../../../src/models";

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
          mockRes as Response
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
          mockRes as Response
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
          mockRes as Response
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
          mockRes as Response
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
          mockRes as Response
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
          mockRes as Response
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
          mockRes as Response
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
          mockRes as Response
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
          mockRes as Response
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
          mockRes as Response
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
          mockRes as Response
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
          mockRes as Response
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
          mockRes as Response
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
          mockRes as Response
        );

        expect(mockDoc.declineReason).toBe(
          "I cannot attend due to scheduling conflict"
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
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Server error",
        });
      });
    });
  });
});
