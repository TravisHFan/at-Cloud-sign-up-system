import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import CoOrganizerAssignedController from "../../../../src/controllers/emailNotifications/CoOrganizerAssignedController";

// Mock dependencies
vi.mock("../../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendCoOrganizerAssignedEmail: vi.fn(),
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

interface MockRequest {
  body: {
    assignedUser?: {
      email?: string;
      firstName?: string;
      lastName?: string;
    };
    eventData?: {
      title?: string;
      date?: string;
      time?: string;
      location?: string;
    };
    assignedBy?: {
      firstName?: string;
      lastName?: string;
    };
  };
}

describe("CoOrganizerAssignedController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: any;
  let consoleLogSpy: any;

  const validBody = {
    assignedUser: {
      email: "coorganizer@test.com",
      firstName: "Co",
      lastName: "Organizer",
    },
    eventData: {
      title: "Test Event",
      date: "2024-06-15",
      time: "10:00 AM",
      location: "Test Venue",
    },
    assignedBy: {
      firstName: "Main",
      lastName: "Organizer",
    },
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

    mockReq = { body: { ...validBody } };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe("sendCoOrganizerAssignedNotification", () => {
    describe("Validation", () => {
      it("should return 400 if assignedUser is missing", async () => {
        mockReq.body.assignedUser = undefined;

        await CoOrganizerAssignedController.sendCoOrganizerAssignedNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Assigned user and event data are required",
        });
      });

      it("should return 400 if assignedUser.email is missing", async () => {
        mockReq.body.assignedUser = { firstName: "Test" };

        await CoOrganizerAssignedController.sendCoOrganizerAssignedNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it("should return 400 if eventData is missing", async () => {
        mockReq.body.eventData = undefined;

        await CoOrganizerAssignedController.sendCoOrganizerAssignedNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it("should return 400 if eventData.title is missing", async () => {
        mockReq.body.eventData = { date: "2024-06-15" };

        await CoOrganizerAssignedController.sendCoOrganizerAssignedNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it("should return 400 if assignedBy is missing", async () => {
        mockReq.body.assignedBy = undefined;

        await CoOrganizerAssignedController.sendCoOrganizerAssignedNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Assigned by information is required",
        });
      });

      it("should return 400 if assignedBy.firstName is missing", async () => {
        mockReq.body.assignedBy = { lastName: "Organizer" };

        await CoOrganizerAssignedController.sendCoOrganizerAssignedNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });
    });

    describe("Successful Notification", () => {
      it("should send email to co-organizer and return success", async () => {
        vi.mocked(EmailService.sendCoOrganizerAssignedEmail).mockResolvedValue(
          true
        );

        await CoOrganizerAssignedController.sendCoOrganizerAssignedNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(EmailService.sendCoOrganizerAssignedEmail).toHaveBeenCalledWith(
          "coorganizer@test.com",
          { firstName: "Co", lastName: "Organizer" },
          {
            title: "Test Event",
            date: "2024-06-15",
            time: "10:00 AM",
            location: "Test Venue",
          },
          { firstName: "Main", lastName: "Organizer" }
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message:
            "Co-organizer assignment notification sent to 1 recipient(s)",
          recipientCount: 1,
        });
      });

      it("should return 0 recipients when email fails", async () => {
        vi.mocked(EmailService.sendCoOrganizerAssignedEmail).mockResolvedValue(
          false
        );

        await CoOrganizerAssignedController.sendCoOrganizerAssignedNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message:
            "Co-organizer assignment notification sent to 0 recipient(s)",
          recipientCount: 0,
        });
      });

      it("should handle missing lastName fields gracefully", async () => {
        mockReq.body.assignedUser = {
          email: "test@test.com",
          firstName: "John",
        };
        mockReq.body.assignedBy = { firstName: "Jane" };
        vi.mocked(EmailService.sendCoOrganizerAssignedEmail).mockResolvedValue(
          true
        );

        await CoOrganizerAssignedController.sendCoOrganizerAssignedNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(EmailService.sendCoOrganizerAssignedEmail).toHaveBeenCalledWith(
          "test@test.com",
          { firstName: "John", lastName: "" },
          expect.any(Object),
          { firstName: "Jane", lastName: "" }
        );
      });

      it("should use TBD for missing event details", async () => {
        mockReq.body.eventData = { title: "Test Event" };
        vi.mocked(EmailService.sendCoOrganizerAssignedEmail).mockResolvedValue(
          true
        );

        await CoOrganizerAssignedController.sendCoOrganizerAssignedNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(EmailService.sendCoOrganizerAssignedEmail).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Object),
          {
            title: "Test Event",
            date: "TBD",
            time: "TBD",
            location: "TBD",
          },
          expect.any(Object)
        );
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on error", async () => {
        vi.mocked(EmailService.sendCoOrganizerAssignedEmail).mockRejectedValue(
          new Error("Email failed")
        );

        await CoOrganizerAssignedController.sendCoOrganizerAssignedNotification(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to send co-organizer assignment notification",
          error: "Email failed",
        });
      });
    });
  });
});
