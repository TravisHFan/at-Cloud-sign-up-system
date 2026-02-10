import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import EventCreatedController from "../../../../src/controllers/emailNotifications/EventCreatedController";

// Mock dependencies
vi.mock("../../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendEventCreatedEmail: vi.fn(),
  },
}));

vi.mock("../../../../src/utils/emailRecipientUtils", () => ({
  EmailRecipientUtils: {
    getActiveVerifiedUsers: vi.fn(),
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

interface MockRequest {
  body: {
    eventData?: {
      title?: string;
      date?: string;
      endDate?: string;
      time?: string;
      endTime?: string;
      location?: string;
      zoomLink?: string;
      organizerName?: string;
      purpose?: string;
      format?: string;
    };
    excludeEmail?: string;
  };
}

describe("EventCreatedController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: any;

  const validEventData = {
    title: "Test Event",
    date: "2024-06-15",
    time: "10:00 AM",
    location: "Test Venue",
    organizerName: "John Doe",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock as unknown as Response["status"],
      json: jsonMock as unknown as Response["json"],
    };

    mockReq = { body: { eventData: validEventData } };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("sendEventCreatedNotification", () => {
    describe("Validation", () => {
      it("should return 400 if eventData is missing", async () => {
        mockReq.body.eventData = undefined;

        await EventCreatedController.sendEventCreatedNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Event data is required with title and date",
        });
      });

      it("should return 400 if title is missing", async () => {
        mockReq.body.eventData = { date: "2024-06-15" };

        await EventCreatedController.sendEventCreatedNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it("should return 400 if date is missing", async () => {
        mockReq.body.eventData = { title: "Test Event" };

        await EventCreatedController.sendEventCreatedNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });
    });

    describe("No Recipients", () => {
      it("should return success with 0 recipients when no eligible users found", async () => {
        vi.mocked(EmailRecipientUtils.getActiveVerifiedUsers).mockResolvedValue(
          [],
        );

        await EventCreatedController.sendEventCreatedNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "No eligible recipients found",
          recipientCount: 0,
        });
      });
    });

    describe("Successful Notification", () => {
      it("should send emails to all recipients", async () => {
        const recipients = [
          { email: "user1@test.com", firstName: "User", lastName: "One" },
          { email: "user2@test.com", firstName: "User", lastName: "Two" },
        ];
        vi.mocked(EmailRecipientUtils.getActiveVerifiedUsers).mockResolvedValue(
          recipients,
        );
        vi.mocked(EmailService.sendEventCreatedEmail).mockResolvedValue(true);

        await EventCreatedController.sendEventCreatedNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(EmailService.sendEventCreatedEmail).toHaveBeenCalledTimes(2);
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Event creation notifications sent successfully",
          recipientCount: 2,
        });
      });

      it("should pass excludeEmail to getActiveVerifiedUsers", async () => {
        mockReq.body.excludeEmail = "organizer@test.com";
        vi.mocked(EmailRecipientUtils.getActiveVerifiedUsers).mockResolvedValue(
          [],
        );

        await EventCreatedController.sendEventCreatedNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(EmailRecipientUtils.getActiveVerifiedUsers).toHaveBeenCalledWith(
          "organizer@test.com",
        );
      });

      it("should transform eventData correctly for email service", async () => {
        mockReq.body.eventData = {
          ...validEventData,
          endDate: "2024-06-16",
          endTime: "5:00 PM",
          zoomLink: "https://zoom.us/test",
          purpose: "Team meeting",
          format: "hybrid",
        };
        const recipients = [
          { email: "user@test.com", firstName: "Test", lastName: "User" },
        ];
        vi.mocked(EmailRecipientUtils.getActiveVerifiedUsers).mockResolvedValue(
          recipients,
        );
        vi.mocked(EmailService.sendEventCreatedEmail).mockResolvedValue(true);

        await EventCreatedController.sendEventCreatedNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(EmailService.sendEventCreatedEmail).toHaveBeenCalledWith(
          "user@test.com",
          "Test User",
          expect.objectContaining({
            title: "Test Event",
            date: "2024-06-15",
            endDate: "2024-06-16",
            endTime: "5:00 PM",
            zoomLink: "https://zoom.us/test",
            purpose: "Team meeting",
            format: "hybrid",
          }),
        );
      });

      it("should handle individual email failures gracefully", async () => {
        const recipients = [
          { email: "user1@test.com", firstName: "User", lastName: "One" },
          { email: "user2@test.com", firstName: "User", lastName: "Two" },
        ];
        vi.mocked(EmailRecipientUtils.getActiveVerifiedUsers).mockResolvedValue(
          recipients,
        );
        vi.mocked(EmailService.sendEventCreatedEmail)
          .mockResolvedValueOnce(true)
          .mockRejectedValueOnce(new Error("Email failed"));

        await EventCreatedController.sendEventCreatedNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        // Should still return success with full recipient count
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Event creation notifications sent successfully",
          recipientCount: 2,
        });
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on error", async () => {
        vi.mocked(EmailRecipientUtils.getActiveVerifiedUsers).mockRejectedValue(
          new Error("Database error"),
        );

        await EventCreatedController.sendEventCreatedNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to send event creation notifications",
          error: "Database error",
        });
      });

      it("should return Unknown error for non-Error throws", async () => {
        vi.mocked(EmailRecipientUtils.getActiveVerifiedUsers).mockRejectedValue(
          "string error",
        );

        await EventCreatedController.sendEventCreatedNotification(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to send event creation notifications",
          error: "Unknown error",
        });
      });
    });
  });
});
