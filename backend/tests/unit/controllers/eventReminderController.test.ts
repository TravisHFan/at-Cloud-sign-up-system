import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import { EmailNotificationController } from "../../../src/controllers/emailNotificationController";
import { EmailRecipientUtils } from "../../../src/utils/emailRecipientUtils";
import { EmailService } from "../../../src/services/infrastructure/emailService";

// Mock dependencies
vi.mock("../../../src/utils/emailRecipientUtils");
vi.mock("../../../src/services/infrastructure/emailService");

describe("EmailNotificationController - Event Reminders", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      body: {},
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  describe("sendEventReminderNotification", () => {
    const validEventReminderData = {
      eventId: "507f1f77bcf86cd799439011",
      eventData: {
        title: "Morning Prayer Service",
        date: "March 15, 2024",
        time: "8:00 AM",
        location: "Main Sanctuary",
        zoomLink: "https://zoom.us/j/123456789",
        format: "hybrid",
      },
      reminderType: "24h",
    };

    it("should send event reminder successfully", async () => {
      const mockParticipants = [
        { email: "participant1@test.com", firstName: "John", lastName: "Doe" },
        {
          email: "participant2@test.com",
          firstName: "Jane",
          lastName: "Smith",
        },
      ];

      // Mock successful responses
      vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue(
        mockParticipants
      );
      vi.mocked(EmailService.sendEventReminderEmail).mockResolvedValue(true);

      mockRequest.body = validEventReminderData;

      await EmailNotificationController.sendEventReminderNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(EmailRecipientUtils.getEventParticipants).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011"
      );
      expect(EmailService.sendEventReminderEmail).toHaveBeenCalledTimes(2);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Event reminder notification sent to 2 recipient(s)",
        recipientCount: 2,
      });
    });

    it("should handle missing eventId", async () => {
      mockRequest.body = { ...validEventReminderData, eventId: undefined };

      await EmailNotificationController.sendEventReminderNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: "Event ID and event data are required",
      });
    });

    it("should handle missing eventData", async () => {
      mockRequest.body = { ...validEventReminderData, eventData: undefined };

      await EmailNotificationController.sendEventReminderNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: "Event ID and event data are required",
      });
    });

    it("should handle missing eventData.title", async () => {
      mockRequest.body = {
        ...validEventReminderData,
        eventData: { ...validEventReminderData.eventData, title: undefined },
      };

      await EmailNotificationController.sendEventReminderNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: "Event ID and event data are required",
      });
    });

    it("should handle invalid reminder type", async () => {
      mockRequest.body = { ...validEventReminderData, reminderType: "invalid" };

      await EmailNotificationController.sendEventReminderNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid reminder type. Must be '1h', '24h', or '1week'",
      });
    });

    it("should handle no participants found", async () => {
      vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue([]);

      mockRequest.body = validEventReminderData;

      await EmailNotificationController.sendEventReminderNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Event reminder notification sent to 0 recipient(s)",
        recipientCount: 0,
      });
    });

    it("should handle email sending failure", async () => {
      const mockParticipants = [
        { email: "participant1@test.com", firstName: "John", lastName: "Doe" },
      ];

      vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue(
        mockParticipants
      );
      vi.mocked(EmailService.sendEventReminderEmail).mockResolvedValue(false);

      mockRequest.body = validEventReminderData;

      await EmailNotificationController.sendEventReminderNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Event reminder notification sent to 0 recipient(s)",
        recipientCount: 0,
      });
    });

    it("should handle database errors", async () => {
      vi.mocked(EmailRecipientUtils.getEventParticipants).mockRejectedValue(
        new Error("Database connection failed")
      );

      mockRequest.body = validEventReminderData;

      await EmailNotificationController.sendEventReminderNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to send event reminder notifications",
        error: "Database connection failed",
      });
    });

    it("should use default reminderType when not provided", async () => {
      const mockParticipants = [
        { email: "participant1@test.com", firstName: "John", lastName: "Doe" },
      ];

      vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue(
        mockParticipants
      );
      vi.mocked(EmailService.sendEventReminderEmail).mockResolvedValue(true);

      mockRequest.body = {
        ...validEventReminderData,
        reminderType: undefined,
      };

      await EmailNotificationController.sendEventReminderNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(EmailService.sendEventReminderEmail).toHaveBeenCalledWith(
        "participant1@test.com",
        "John Doe",
        expect.any(Object),
        "24h" // Default value
      );
    });

    it("should use default values for missing event data fields", async () => {
      const mockParticipants = [
        { email: "participant1@test.com", firstName: "John", lastName: "Doe" },
      ];

      vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue(
        mockParticipants
      );
      vi.mocked(EmailService.sendEventReminderEmail).mockResolvedValue(true);

      mockRequest.body = {
        eventId: "507f1f77bcf86cd799439011",
        eventData: {
          title: "Test Event",
          // Missing date, time, location, format
        },
        reminderType: "24h",
      };

      await EmailNotificationController.sendEventReminderNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(EmailService.sendEventReminderEmail).toHaveBeenCalledWith(
        "participant1@test.com",
        "John Doe",
        {
          title: "Test Event",
          date: "TBD",
          time: "TBD",
          location: "TBD",
          zoomLink: undefined,
          format: "in-person",
        },
        "24h"
      );
    });

    it("should work with different reminder types", async () => {
      const mockParticipants = [
        { email: "participant1@test.com", firstName: "John", lastName: "Doe" },
      ];

      vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue(
        mockParticipants
      );
      vi.mocked(EmailService.sendEventReminderEmail).mockResolvedValue(true);

      const reminderTypes = ["1h", "24h", "1week"];

      for (const reminderType of reminderTypes) {
        vi.clearAllMocks();
        vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue(
          mockParticipants
        );
        vi.mocked(EmailService.sendEventReminderEmail).mockResolvedValue(true);

        mockRequest.body = {
          ...validEventReminderData,
          reminderType,
        };

        await EmailNotificationController.sendEventReminderNotification(
          mockRequest as Request,
          mockResponse as Response
        );

        expect(EmailService.sendEventReminderEmail).toHaveBeenCalledWith(
          "participant1@test.com",
          "John Doe",
          expect.any(Object),
          reminderType
        );
      }
    });
  });
});
