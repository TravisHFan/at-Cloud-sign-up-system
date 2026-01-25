import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies BEFORE importing the service
vi.mock("../../../../src/models", () => ({
  User: {
    find: vi.fn(),
  },
}));

vi.mock("../../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendNewEventAnnouncementEmail: vi.fn().mockResolvedValue(undefined),
    sendCoOrganizerAssignedEmail: vi.fn().mockResolvedValue(undefined),
    sendEventCreatedEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../../src/controllers/unifiedMessageController", () => ({
  UnifiedMessageController: {
    createTargetedSystemMessage: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../../src/utils/emailRecipientUtils", () => ({
  EmailRecipientUtils: {
    getEventCoOrganizers: vi.fn().mockResolvedValue([]),
    getActiveVerifiedUsers: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../../src/services/ResponseBuilderService", () => ({
  ResponseBuilderService: {
    buildEventWithRegistrations: vi.fn().mockResolvedValue(null),
  },
}));

import { EventCreationNotificationService } from "../../../../src/services/event/EventCreationNotificationService";
import { User } from "../../../../src/models";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";
import { UnifiedMessageController } from "../../../../src/controllers/unifiedMessageController";
import { EmailRecipientUtils } from "../../../../src/utils/emailRecipientUtils";
import { ResponseBuilderService } from "../../../../src/services/ResponseBuilderService";

describe("EventCreationNotificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mock implementations
    (User.find as any).mockReset();
    (EmailRecipientUtils.getActiveVerifiedUsers as any).mockReset();

    (UnifiedMessageController.createTargetedSystemMessage as any).mockReset();
    (ResponseBuilderService.buildEventWithRegistrations as any).mockReset();
    (EmailService.sendCoOrganizerAssignedEmail as any).mockReset();
    (EmailService.sendEventCreatedEmail as any).mockReset();

    // Set up default mocks that always resolve
    (User.find as any).mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    });
    (EmailRecipientUtils.getActiveVerifiedUsers as any).mockResolvedValue([]);
    (EmailRecipientUtils.getEventCoOrganizers as any).mockResolvedValue([]);
    (
      UnifiedMessageController.createTargetedSystemMessage as any
    ).mockResolvedValue(undefined);
    (
      ResponseBuilderService.buildEventWithRegistrations as any
    ).mockResolvedValue(null);
    (EmailService.sendCoOrganizerAssignedEmail as any).mockResolvedValue(
      undefined,
    );
    (EmailService.sendEventCreatedEmail as any).mockResolvedValue(undefined);
  });

  const createMockEvent = (overrides = {}) =>
    ({
      _id: { toString: () => "event-123" },
      title: "Test Event",
      date: "2030-06-15",
      endDate: "2030-06-15",
      time: "10:00",
      endTime: "12:00",
      location: "Main Hall",
      organizer: "John Doe",
      purpose: "A test event for demonstration",
      format: "In-person" as const,
      timeZone: "America/New_York",
      zoomLink: undefined,
      ...overrides,
    }) as any;

  const createMockUser = (overrides = {}) => ({
    _id: { toString: () => "user-123" },
    firstName: "John",
    lastName: "Doe",
    username: "johnd",
    avatar: "avatar.jpg",
    gender: "male" as const,
    role: "Administrator",
    roleInAtCloud: "Leader",
    email: "john@example.com",
    ...overrides,
  });

  const createEventData = (overrides = {}) => ({
    title: "Test Event",
    date: "2030-06-15",
    endDate: "2030-06-15",
    time: "10:00",
    endTime: "12:00",
    location: "Main Hall",
    organizer: "John Doe",
    purpose: "A test event for demonstration",
    format: "In-person" as const,
    timeZone: "America/New_York",
    ...overrides,
  });

  describe("sendCoOrganizerNotifications", () => {
    it("should return false when no organizer details", async () => {
      (
        ResponseBuilderService.buildEventWithRegistrations as any
      ).mockResolvedValue({});

      const result =
        await EventCreationNotificationService.sendCoOrganizerNotifications(
          createMockEvent(),
          createMockUser(),
        );

      expect(result).toBe(false);
    });

    it("should return false when no co-organizers found", async () => {
      (
        ResponseBuilderService.buildEventWithRegistrations as any
      ).mockResolvedValue({
        organizerDetails: [{ email: "organizer@example.com" }],
      });
      (EmailRecipientUtils.getEventCoOrganizers as any).mockResolvedValue([]);

      const result =
        await EventCreationNotificationService.sendCoOrganizerNotifications(
          createMockEvent(),
          createMockUser(),
        );

      expect(result).toBe(false);
    });

    it("should send email and system message to co-organizers", async () => {
      const coOrganizers = [
        {
          _id: { toString: () => "co-org-1" },
          email: "coorg@example.com",
          firstName: "Jane",
          lastName: "Smith",
        },
      ];
      (
        ResponseBuilderService.buildEventWithRegistrations as any
      ).mockResolvedValue({
        organizerDetails: [
          { email: "organizer@example.com" },
          { email: "coorg@example.com" },
        ],
      });
      (EmailRecipientUtils.getEventCoOrganizers as any).mockResolvedValue(
        coOrganizers,
      );

      const result =
        await EventCreationNotificationService.sendCoOrganizerNotifications(
          createMockEvent(),
          createMockUser(),
        );

      expect(result).toBe(true);
      expect(EmailService.sendCoOrganizerAssignedEmail).toHaveBeenCalledWith(
        "coorg@example.com",
        { firstName: "Jane", lastName: "Smith" },
        expect.any(Object),
        { firstName: "John", lastName: "Doe" },
      );
      expect(
        UnifiedMessageController.createTargetedSystemMessage,
      ).toHaveBeenCalled();
    });

    it("should handle email sending errors gracefully", async () => {
      const coOrganizers = [
        {
          _id: { toString: () => "co-org-1" },
          email: "coorg@example.com",
          firstName: "Jane",
          lastName: "Smith",
        },
      ];
      (
        ResponseBuilderService.buildEventWithRegistrations as any
      ).mockResolvedValue({
        organizerDetails: [{ email: "coorg@example.com" }],
      });
      (EmailRecipientUtils.getEventCoOrganizers as any).mockResolvedValue(
        coOrganizers,
      );
      (EmailService.sendCoOrganizerAssignedEmail as any).mockRejectedValue(
        new Error("Email error"),
      );

      const result =
        await EventCreationNotificationService.sendCoOrganizerNotifications(
          createMockEvent(),
          createMockUser(),
        );

      // Should still return true (partial success)
      expect(result).toBe(true);
    });

    it("should use provided toIdString function", async () => {
      const customToIdString = vi.fn().mockReturnValue("custom-id");
      (
        ResponseBuilderService.buildEventWithRegistrations as any
      ).mockResolvedValue(null);

      await EventCreationNotificationService.sendCoOrganizerNotifications(
        createMockEvent(),
        createMockUser(),
        customToIdString,
      );

      expect(customToIdString).toHaveBeenCalled();
    });

    it("should fallback to raw event when population fails", async () => {
      (
        ResponseBuilderService.buildEventWithRegistrations as any
      ).mockRejectedValue(new Error("Population error"));

      const result =
        await EventCreationNotificationService.sendCoOrganizerNotifications(
          createMockEvent(),
          createMockUser(),
        );

      expect(result).toBe(false);
    });
  });

  describe("sendAllNotifications", () => {
    it("should send system messages to active users", async () => {
      const activeUsers = [
        { _id: { toString: () => "user-1" } },
        { _id: { toString: () => "user-2" } },
      ];
      (User.find as any).mockReturnValue({
        select: vi.fn().mockResolvedValue(activeUsers),
      });
      (EmailRecipientUtils.getActiveVerifiedUsers as any).mockResolvedValue([]);

      const result =
        await EventCreationNotificationService.sendAllNotifications(
          createMockEvent(),
          createEventData(),
          createMockUser(),
        );

      expect(result.systemMessagesSent).toBe(true);
      expect(
        UnifiedMessageController.createTargetedSystemMessage,
      ).toHaveBeenCalled();
    });

    it("should send emails to all active users excluding creator", async () => {
      const activeUsers = [{ _id: { toString: () => "user-1" } }];
      const emailRecipients = [
        {
          email: "recipient@example.com",
          firstName: "Recipient",
          lastName: "User",
        },
      ];
      (User.find as any).mockReturnValue({
        select: vi.fn().mockResolvedValue(activeUsers),
      });
      (EmailRecipientUtils.getActiveVerifiedUsers as any).mockResolvedValue(
        emailRecipients,
      );

      const result =
        await EventCreationNotificationService.sendAllNotifications(
          createMockEvent(),
          createEventData(),
          createMockUser(),
        );

      expect(result.emailsSent).toBe(true);
      expect(EmailService.sendEventCreatedEmail).toHaveBeenCalledWith(
        "recipient@example.com",
        "Recipient User",
        expect.any(Object),
      );
    });

    it("should skip email sending when no recipients", async () => {
      (User.find as any).mockReturnValue({
        select: vi.fn().mockResolvedValue([]),
      });
      (EmailRecipientUtils.getActiveVerifiedUsers as any).mockResolvedValue([]);

      const result =
        await EventCreationNotificationService.sendAllNotifications(
          createMockEvent(),
          createEventData(),
          createMockUser(),
        );

      // Note: emailsSent is true even with empty recipients (no emails sent, but flag set)
      expect(result.emailsSent).toBe(true);
      expect(EmailService.sendEventCreatedEmail).not.toHaveBeenCalled();
    });

    it("should handle system message creation errors gracefully", async () => {
      (User.find as any).mockReturnValue({
        select: vi
          .fn()
          .mockResolvedValue([{ _id: { toString: () => "user-1" } }]),
      });
      (EmailRecipientUtils.getActiveVerifiedUsers as any).mockResolvedValue([]);
      (
        UnifiedMessageController.createTargetedSystemMessage as any
      ).mockRejectedValue(new Error("System message error"));

      const result =
        await EventCreationNotificationService.sendAllNotifications(
          createMockEvent(),
          createEventData(),
          createMockUser(),
        );

      expect(result.systemMessagesSent).toBe(false);
    });

    it("should include recurring series info when provided", async () => {
      const activeUsers = [{ _id: { toString: () => "user-1" } }];
      (User.find as any).mockReturnValue({
        select: vi.fn().mockResolvedValue(activeUsers),
      });
      (EmailRecipientUtils.getActiveVerifiedUsers as any).mockResolvedValue([
        { email: "user@example.com", firstName: "User", lastName: "Test" },
      ]);

      const result =
        await EventCreationNotificationService.sendAllNotifications(
          createMockEvent(),
          createEventData(),
          createMockUser(),
          { isRecurring: true, frequency: "monthly", occurrenceCount: 6 },
        );

      expect(result.systemMessagesSent).toBe(true);
      // Verify the recurring info was included
      const callArgs = (
        UnifiedMessageController.createTargetedSystemMessage as any
      ).mock.calls[0];
      expect(callArgs[0].title).toContain("Recurring");
    });

    it("should log info when no active users found", async () => {
      (User.find as any).mockReturnValue({
        select: vi.fn().mockResolvedValue([]),
      });
      (EmailRecipientUtils.getActiveVerifiedUsers as any).mockResolvedValue([]);

      const result =
        await EventCreationNotificationService.sendAllNotifications(
          createMockEvent(),
          createEventData(),
          createMockUser(),
        );

      expect(result.systemMessagesSent).toBe(false);
    });

    it("should handle every-two-weeks frequency in recurring info", async () => {
      const activeUsers = [{ _id: { toString: () => "user-1" } }];
      (User.find as any).mockReturnValue({
        select: vi.fn().mockResolvedValue(activeUsers),
      });
      (EmailRecipientUtils.getActiveVerifiedUsers as any).mockResolvedValue([]);

      const result =
        await EventCreationNotificationService.sendAllNotifications(
          createMockEvent(),
          createEventData(),
          createMockUser(),
          {
            isRecurring: true,
            frequency: "every-two-weeks",
            occurrenceCount: 4,
          },
        );

      expect(result.systemMessagesSent).toBe(true);
    });

    it("should handle every-two-months frequency in recurring info", async () => {
      const activeUsers = [{ _id: { toString: () => "user-1" } }];
      (User.find as any).mockReturnValue({
        select: vi.fn().mockResolvedValue(activeUsers),
      });
      (EmailRecipientUtils.getActiveVerifiedUsers as any).mockResolvedValue([]);

      const result =
        await EventCreationNotificationService.sendAllNotifications(
          createMockEvent(),
          createEventData(),
          createMockUser(),
          {
            isRecurring: true,
            frequency: "every-two-months",
            occurrenceCount: 3,
          },
        );

      expect(result.systemMessagesSent).toBe(true);
    });
  });
});
