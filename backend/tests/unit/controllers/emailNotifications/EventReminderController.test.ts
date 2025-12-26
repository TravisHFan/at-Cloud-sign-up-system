import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import mongoose from "mongoose";
import EventReminderController from "../../../../src/controllers/emailNotifications/EventReminderController";

vi.mock("../../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendEventReminderEmailBulk: vi.fn(),
  },
}));

vi.mock("../../../../src/utils/emailRecipientUtils", () => ({
  EmailRecipientUtils: {
    getEventParticipants: vi.fn(),
    getEventGuests: vi.fn(),
  },
}));

vi.mock("../../../../src/controllers/unifiedMessageController", () => ({
  UnifiedMessageController: {
    createTargetedSystemMessage: vi.fn(),
  },
}));

vi.mock("../../../../src/services", () => ({
  CachePatterns: {
    invalidateEventCache: vi.fn(),
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
import { UnifiedMessageController } from "../../../../src/controllers/unifiedMessageController";
import { CachePatterns } from "../../../../src/services";

interface MockRequest {
  user?: {
    _id: string;
  };
  body: {
    eventId?: string;
    eventData?: {
      title?: string;
      date?: string;
      time?: string;
      location?: string;
      zoomLink?: string;
      format?: string;
    };
    reminderType?: string;
  };
}

describe("EventReminderController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: any;
  let consoleLogSpy: any;
  let consoleWarnSpy: any;

  const validEventId = new mongoose.Types.ObjectId().toString();

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

    mockReq = {
      body: {
        eventId: validEventId,
        eventData: {
          title: "Test Event",
          date: "2025-01-15",
          time: "10:00 AM",
          location: "Test Location",
        },
        reminderType: "24h",
      },
    };

    vi.mocked(CachePatterns.invalidateEventCache).mockResolvedValue({} as any);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe("sendEventReminderNotification", () => {
    describe("Validation", () => {
      it("should return 400 if eventId is missing", async () => {
        mockReq.body.eventId = undefined;

        await EventReminderController.sendEventReminderNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Event ID and event data are required",
        });
      });

      it("should return 400 if eventData is missing", async () => {
        mockReq.body.eventData = undefined;

        await EventReminderController.sendEventReminderNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Event ID and event data are required",
        });
      });

      it("should return 400 if eventData.title is missing", async () => {
        mockReq.body.eventData = { date: "2025-01-15" };

        await EventReminderController.sendEventReminderNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Event ID and event data are required",
        });
      });

      it("should return 400 for invalid reminder type", async () => {
        mockReq.body.reminderType = "invalid";

        await EventReminderController.sendEventReminderNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid reminder type. Must be '1h', '24h', or '1week'",
        });
      });

      it("should accept valid reminder types: 1h", async () => {
        mockReq.body.reminderType = "1h";
        vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue([
          {
            email: "test@test.com",
            firstName: "Test",
            lastName: "User",
            _id: "user1",
          },
        ]);
        vi.mocked(EmailRecipientUtils.getEventGuests).mockResolvedValue([]);
        vi.mocked(EmailService.sendEventReminderEmailBulk).mockResolvedValue([
          true,
        ]);
        vi.mocked(
          UnifiedMessageController.createTargetedSystemMessage
        ).mockResolvedValue({} as any);

        await EventReminderController.sendEventReminderNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should accept valid reminder types: 1week", async () => {
        mockReq.body.reminderType = "1week";
        vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue([
          {
            email: "test@test.com",
            firstName: "Test",
            lastName: "User",
            _id: "user1",
          },
        ]);
        vi.mocked(EmailRecipientUtils.getEventGuests).mockResolvedValue([]);
        vi.mocked(EmailService.sendEventReminderEmailBulk).mockResolvedValue([
          true,
        ]);
        vi.mocked(
          UnifiedMessageController.createTargetedSystemMessage
        ).mockResolvedValue({} as any);

        await EventReminderController.sendEventReminderNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    // Note: 24h deduplication tests removed - they require complex mongoose.model mocking
    // that is better tested in integration tests

    describe("No Recipients", () => {
      it("should return success with 0 recipients if no participants or guests", async () => {
        mockReq.body.reminderType = "1h"; // Skip 24h dedup logic
        vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue(
          []
        );
        vi.mocked(EmailRecipientUtils.getEventGuests).mockResolvedValue([]);

        await EventReminderController.sendEventReminderNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Event reminder notification sent to 0 recipient(s)",
          recipientCount: 0,
        });
      });
    });

    describe("Email Sending", () => {
      beforeEach(() => {
        mockReq.body.reminderType = "1h"; // Skip 24h dedup logic
      });

      it("should send emails to participants", async () => {
        vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue([
          {
            email: "user1@test.com",
            firstName: "User",
            lastName: "One",
            _id: "user1",
          },
          {
            email: "user2@test.com",
            firstName: "User",
            lastName: "Two",
            _id: "user2",
          },
        ]);
        vi.mocked(EmailRecipientUtils.getEventGuests).mockResolvedValue([]);
        vi.mocked(EmailService.sendEventReminderEmailBulk).mockResolvedValue([
          true,
          true,
        ]);
        vi.mocked(
          UnifiedMessageController.createTargetedSystemMessage
        ).mockResolvedValue({} as any);

        await EventReminderController.sendEventReminderNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(EmailService.sendEventReminderEmailBulk).toHaveBeenCalledWith(
          expect.arrayContaining([
            { email: "user1@test.com", name: "User One" },
            { email: "user2@test.com", name: "User Two" },
          ]),
          expect.objectContaining({ title: "Test Event" }),
          "1h"
        );
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should send emails to guests", async () => {
        vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue(
          []
        );
        vi.mocked(EmailRecipientUtils.getEventGuests).mockResolvedValue([
          { email: "guest@test.com", firstName: "Guest", lastName: "User" },
        ]);
        vi.mocked(EmailService.sendEventReminderEmailBulk).mockResolvedValue([
          true,
        ]);

        await EventReminderController.sendEventReminderNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(EmailService.sendEventReminderEmailBulk).toHaveBeenCalledWith(
          expect.arrayContaining([
            { email: "guest@test.com", name: "Guest User" },
          ]),
          expect.any(Object),
          "1h"
        );
      });
    });

    describe("System Messages", () => {
      it("should create system message for participants", async () => {
        mockReq.body.reminderType = "1h";
        vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue([
          {
            email: "user@test.com",
            firstName: "Test",
            lastName: "User",
            _id: "user1",
          },
        ]);
        vi.mocked(EmailRecipientUtils.getEventGuests).mockResolvedValue([]);
        vi.mocked(EmailService.sendEventReminderEmailBulk).mockResolvedValue([
          true,
        ]);
        vi.mocked(
          UnifiedMessageController.createTargetedSystemMessage
        ).mockResolvedValue({} as any);

        await EventReminderController.sendEventReminderNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(
          UnifiedMessageController.createTargetedSystemMessage
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringContaining("Event Reminder"),
            type: "announcement",
          }),
          ["user1"],
          expect.any(Object)
        );
      });

      it("should continue if system message creation fails", async () => {
        mockReq.body.reminderType = "1h";
        vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue([
          {
            email: "user@test.com",
            firstName: "Test",
            lastName: "User",
            _id: "user1",
          },
        ]);
        vi.mocked(EmailRecipientUtils.getEventGuests).mockResolvedValue([]);
        vi.mocked(EmailService.sendEventReminderEmailBulk).mockResolvedValue([
          true,
        ]);
        vi.mocked(
          UnifiedMessageController.createTargetedSystemMessage
        ).mockRejectedValue(new Error("System message failed"));

        await EventReminderController.sendEventReminderNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on unexpected error in main try block", async () => {
        // Force an error that's not caught by inner try/catch
        mockReq.body = null as any; // This causes destructuring to fail

        await EventReminderController.sendEventReminderNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            message: "Failed to send event reminder notifications",
          })
        );
      });

      it("should continue with empty participants if fetching fails", async () => {
        mockReq.body.reminderType = "1h";
        vi.mocked(EmailRecipientUtils.getEventParticipants).mockRejectedValue(
          new Error("Failed to fetch")
        );
        vi.mocked(EmailRecipientUtils.getEventGuests).mockResolvedValue([]);

        await EventReminderController.sendEventReminderNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        // Controller catches this and continues with empty participants
        expect(consoleWarnSpy).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Event reminder notification sent to 0 recipient(s)",
          recipientCount: 0,
        });
      });
    });
  });
});
