import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request } from "express";

// We will mock dynamic imports used inside AutoUnpublishService via vi.mock on their modules
vi.mock("../../../../src/utils/validatePublish", () => ({
  getMissingNecessaryFieldsForPublish: vi.fn(),
}));

vi.mock("../../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendEventAutoUnpublishNotification: vi.fn().mockResolvedValue(undefined),
    sendEventUnpublishWarningNotification: vi.fn().mockResolvedValue(undefined),
    sendEventActualUnpublishNotification: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../../src/services/domainEvents", () => ({
  domainEvents: {
    emit: vi.fn(),
  },
  EVENT_AUTO_UNPUBLISHED: "EVENT_AUTO_UNPUBLISHED",
}));

vi.mock("../../../../src/controllers/unifiedMessageController", () => ({
  UnifiedMessageController: {
    createTargetedSystemMessage: vi.fn().mockResolvedValue(undefined),
    createSystemMessage: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../../src/utils/emailRecipientUtils", () => ({
  EmailRecipientUtils: {
    getEventAllOrganizers: vi.fn(),
  },
}));

vi.mock("../../../../src/models", () => ({
  User: {
    findOne: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue(null),
  },
  Event: {
    find: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../../src/controllers/eventController", () => ({
  EventController: {
    toIdString: (id: any) => String(id),
  },
}));

import { AutoUnpublishService } from "../../../../src/services/event/AutoUnpublishService";
import { EmailRecipientUtils } from "../../../../src/utils/emailRecipientUtils";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";
import {
  domainEvents,
  EVENT_AUTO_UNPUBLISHED,
} from "../../../../src/services/domainEvents";
import { UnifiedMessageController } from "../../../../src/controllers/unifiedMessageController";
import { User, Event } from "../../../../src/models";
import * as validatePublish from "../../../../src/utils/validatePublish";

// Minimal IEvent-like shape for tests
const baseEvent = {
  id: "event-1",
  title: "Test Event",
  publish: true,
} as any;

describe("AutoUnpublishService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkAndApplyAutoUnpublish", () => {
    it("schedules unpublish with 48-hour grace period when required fields are missing", async () => {
      (
        validatePublish.getMissingNecessaryFieldsForPublish as any
      ).mockReturnValue(["zoomLink", "location"]);

      const event = { ...baseEvent };

      const result = await AutoUnpublishService.checkAndApplyAutoUnpublish(
        event as any
      );

      expect(result.autoUnpublished).toBe(true); // indicates warning was issued
      expect(result.missingFields).toEqual(["zoomLink", "location"]);
      // Event stays published during grace period
      expect(event.publish).toBe(true);
      // Should schedule unpublish ~48 hours from now
      expect((event as any).unpublishScheduledAt).toBeInstanceOf(Date);
      const scheduledTime = (event as any).unpublishScheduledAt.getTime();
      const expectedTime = Date.now() + 48 * 60 * 60 * 1000;
      // Allow 1 second tolerance
      expect(Math.abs(scheduledTime - expectedTime)).toBeLessThan(1000);
      expect((event as any).unpublishWarningFields).toEqual([
        "zoomLink",
        "location",
      ]);
      // Should NOT set autoUnpublishedAt/Reason yet (that happens on actual unpublish)
      expect((event as any).autoUnpublishedAt).toBeUndefined();
      expect((event as any).autoUnpublishedReason).toBeUndefined();
    });

    it("does not auto-unpublish when no fields are missing", async () => {
      (
        validatePublish.getMissingNecessaryFieldsForPublish as any
      ).mockReturnValue([]);

      const event = { ...baseEvent };

      const result = await AutoUnpublishService.checkAndApplyAutoUnpublish(
        event as any
      );

      expect(result.autoUnpublished).toBe(false);
      expect(result.missingFields).toEqual([]);
      expect(event.publish).toBe(true);
    });

    it("clears scheduled unpublish and previous autoUnpublishedReason when republished with no missing fields", async () => {
      (
        validatePublish.getMissingNecessaryFieldsForPublish as any
      ).mockReturnValue([]);

      const event = {
        ...baseEvent,
        autoUnpublishedReason: "MISSING_REQUIRED_FIELDS",
        unpublishScheduledAt: new Date(),
        unpublishWarningFields: ["zoomLink"],
      } as any;

      const result = await AutoUnpublishService.checkAndApplyAutoUnpublish(
        event
      );

      expect(result.autoUnpublished).toBe(false);
      expect((event as any).autoUnpublishedReason).toBeNull();
      expect((event as any).unpublishScheduledAt).toBeNull();
      expect((event as any).unpublishWarningFields).toBeUndefined();
    });

    it("logs warning and does not throw if validatePublish import fails", async () => {
      // ensure that if getMissingNecessaryFieldsForPublish throws, method still resolves.
      (
        validatePublish.getMissingNecessaryFieldsForPublish as any
      ).mockImplementation(() => {
        throw new Error("validation failure");
      });

      const event = { ...baseEvent };

      const result = await AutoUnpublishService.checkAndApplyAutoUnpublish(
        event as any
      );

      // Even on failure, it should not mark as auto-unpublished
      expect(result.autoUnpublished).toBe(false);
      expect(event.publish).toBe(true);
      expect((event as any).autoUnpublishedAt).toBeUndefined();
      expect((event as any).autoUnpublishedReason).toBeUndefined();
    });
  });

  describe("sendAutoUnpublishNotifications", () => {
    const makeReq = (overrides: Partial<Request> = {}): Request =>
      ({
        user: {
          _id: "user-1",
          firstName: "John",
          lastName: "Doe",
          username: "jdoe",
          avatar: "avatar.png",
          gender: "male",
          role: "admin",
          roleInAtCloud: "organizer",
          ...((overrides as any).user || {}),
        },
        ...overrides,
      } as unknown as Request);

    it("sends warning email to all organizers (no domain event during grace period)", async () => {
      (EmailRecipientUtils.getEventAllOrganizers as any).mockResolvedValue([
        { email: "a@example.com" },
        { email: "b@example.com" },
      ]);

      (User.findOne as any).mockReturnValue({
        select: vi.fn().mockResolvedValue({ _id: "user-1" }),
      });

      const event = {
        ...baseEvent,
        format: "zoom",
      } as any;

      const missingFields = ["zoomLink", "location"];

      await AutoUnpublishService.sendAutoUnpublishNotifications(
        event,
        missingFields,
        makeReq()
      );

      // Should call the WARNING notification, not the auto-unpublish notification
      expect(
        EmailService.sendEventUnpublishWarningNotification
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: event.id,
          title: event.title,
          format: "zoom",
          missingFields,
          recipients: ["a@example.com", "b@example.com"],
        })
      );

      // Domain event should NOT be emitted during grace period warning
      expect(domainEvents.emit).not.toHaveBeenCalled();

      expect(
        UnifiedMessageController.createTargetedSystemMessage
      ).toHaveBeenCalled();
    });

    it("sends system message to all organizers with grace period warning", async () => {
      (EmailRecipientUtils.getEventAllOrganizers as any).mockResolvedValue([
        { email: "a@example.com" },
        { email: "b@example.com" },
      ]);

      (User.findOne as any).mockImplementation(
        ({ email }: { email: string }) => ({
          select: vi.fn().mockResolvedValue({
            _id: email === "a@example.com" ? "user-a" : "user-b",
          }),
        })
      );

      const event = {
        ...baseEvent,
        format: "zoom",
      } as any;

      const missingFields = ["zoomLink"]; // to exercise human label mapping

      await AutoUnpublishService.sendAutoUnpublishNotifications(
        event,
        missingFields,
        makeReq()
      );

      expect(
        UnifiedMessageController.createTargetedSystemMessage
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining("Action Required"),
        }),
        ["user-a", "user-b"],
        expect.objectContaining({ id: "user-1" })
      );
    });

    it("falls back to admin email when organizer lookup fails", async () => {
      (EmailRecipientUtils.getEventAllOrganizers as any).mockRejectedValue(
        new Error("lookup failed")
      );

      const event = {
        ...baseEvent,
        format: "in-person",
      } as any;

      const missingFields = ["location"];

      await AutoUnpublishService.sendAutoUnpublishNotifications(
        event,
        missingFields,
        makeReq()
      );

      expect(
        EmailService.sendEventUnpublishWarningNotification
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: event.id,
          title: event.title,
          format: "in-person",
          missingFields,
        })
      );
    });

    it("falls back to actor-only system message when organizer user lookups fail", async () => {
      (EmailRecipientUtils.getEventAllOrganizers as any).mockResolvedValue([
        { email: "a@example.com" },
      ]);

      // Simulate user lookup throwing inside the loop
      (User.findOne as any).mockImplementation(() => {
        throw new Error("user lookup failed");
      });

      const event = {
        ...baseEvent,
        format: "zoom",
      } as any;

      const missingFields = ["zoomLink"];

      await AutoUnpublishService.sendAutoUnpublishNotifications(
        event,
        missingFields,
        makeReq()
      );

      // Should still send a system message, but to the actor only
      expect(
        UnifiedMessageController.createTargetedSystemMessage
      ).toHaveBeenCalledWith(
        expect.any(Object),
        ["user-1"],
        expect.any(Object)
      );
    });

    it("does not throw even if outer notification flow fails", async () => {
      // Force EmailService import usage to throw when called
      (
        EmailService.sendEventUnpublishWarningNotification as any
      ).mockImplementation(() => {
        throw new Error("email failure");
      });

      const event = {
        ...baseEvent,
        format: "zoom",
      } as any;

      const missingFields = ["zoomLink"];

      await expect(
        AutoUnpublishService.sendAutoUnpublishNotifications(
          event,
          missingFields,
          makeReq()
        )
      ).resolves.toBeUndefined();
    });
  });

  describe("executeScheduledUnpublishes", () => {
    it("returns empty results when no events need unpublishing", async () => {
      (Event.find as any).mockResolvedValue([]);

      const result = await AutoUnpublishService.executeScheduledUnpublishes();

      expect(result.unpublishedCount).toBe(0);
      expect(result.eventIds).toEqual([]);
    });

    it("unpublishes events with expired grace period", async () => {
      const mockEvent = {
        id: "event-expired",
        title: "Expired Event",
        publish: true,
        unpublishScheduledAt: new Date(Date.now() - 1000), // Past
        unpublishWarningFields: ["location"],
        save: vi.fn().mockResolvedValue(undefined),
      };

      (Event.find as any).mockResolvedValue([mockEvent]);
      (EmailRecipientUtils.getEventAllOrganizers as any).mockResolvedValue([
        { email: "org@example.com" },
      ]);
      (User.findOne as any).mockReturnValue({
        select: vi.fn().mockResolvedValue({ _id: "user-org" }),
      });

      const result = await AutoUnpublishService.executeScheduledUnpublishes();

      expect(result.unpublishedCount).toBe(1);
      expect(result.eventIds).toContain("event-expired");
      expect(mockEvent.publish).toBe(false);
      expect(mockEvent.autoUnpublishedAt).toBeInstanceOf(Date);
      expect(mockEvent.autoUnpublishedReason).toBe("MISSING_REQUIRED_FIELDS");
      expect(mockEvent.unpublishScheduledAt).toBeNull();
      expect(mockEvent.save).toHaveBeenCalled();
      expect(
        EmailService.sendEventActualUnpublishNotification
      ).toHaveBeenCalled();
    });

    it("continues processing when one event fails to unpublish", async () => {
      const mockEventSuccess = {
        id: "event-success",
        title: "Success Event",
        publish: true,
        unpublishScheduledAt: new Date(Date.now() - 1000),
        unpublishWarningFields: ["zoomLink"],
        save: vi.fn().mockResolvedValue(undefined),
      };

      const mockEventFail = {
        id: "event-fail",
        title: "Fail Event",
        publish: true,
        unpublishScheduledAt: new Date(Date.now() - 1000),
        unpublishWarningFields: ["location"],
        save: vi.fn().mockRejectedValue(new Error("save failed")),
      };

      (Event.find as any).mockResolvedValue([mockEventFail, mockEventSuccess]);
      (EmailRecipientUtils.getEventAllOrganizers as any).mockResolvedValue([]);

      const result = await AutoUnpublishService.executeScheduledUnpublishes();

      // Should only count the successful one
      expect(result.unpublishedCount).toBe(1);
      expect(result.eventIds).toEqual(["event-success"]);
    });

    it("handles find query failure gracefully", async () => {
      (Event.find as any).mockRejectedValue(new Error("DB error"));

      const result = await AutoUnpublishService.executeScheduledUnpublishes();

      expect(result.unpublishedCount).toBe(0);
      expect(result.eventIds).toEqual([]);
    });

    it("emits domain event after actual unpublish", async () => {
      const mockEvent = {
        id: "event-domain",
        title: "Domain Event Test",
        publish: true,
        format: "zoom",
        unpublishScheduledAt: new Date(Date.now() - 1000),
        unpublishWarningFields: ["zoomLink"],
        save: vi.fn().mockResolvedValue(undefined),
      };

      (Event.find as any).mockResolvedValue([mockEvent]);
      (EmailRecipientUtils.getEventAllOrganizers as any).mockResolvedValue([]);

      await AutoUnpublishService.executeScheduledUnpublishes();

      // Domain event should be emitted during actual unpublish
      expect(domainEvents.emit).toHaveBeenCalledWith(
        EVENT_AUTO_UNPUBLISHED,
        expect.objectContaining({
          eventId: "event-domain",
          title: "Domain Event Test",
          format: "zoom",
          missingFields: ["zoomLink"],
          reason: "MISSING_REQUIRED_FIELDS",
        })
      );
    });

    it("creates targeted system message for organizers after actual unpublish", async () => {
      const mockEvent = {
        id: "event-system-msg",
        title: "System Message Test",
        publish: true,
        unpublishScheduledAt: new Date(Date.now() - 1000),
        unpublishWarningFields: ["meetingId", "passcode"],
        save: vi.fn().mockResolvedValue(undefined),
      };

      (Event.find as any).mockResolvedValue([mockEvent]);
      (EmailRecipientUtils.getEventAllOrganizers as any).mockResolvedValue([
        { email: "org1@example.com" },
        { email: "org2@example.com" },
      ]);
      (User.findOne as any).mockImplementation(({ email }) => ({
        select: vi.fn().mockResolvedValue({
          _id: email === "org1@example.com" ? "user-org1" : "user-org2",
        }),
      }));

      await AutoUnpublishService.executeScheduledUnpublishes();

      expect(
        UnifiedMessageController.createTargetedSystemMessage
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining("Event Unpublished"),
          content: expect.stringContaining("48-hour grace period has expired"),
          type: "error",
          priority: "high",
        }),
        ["user-org1", "user-org2"]
      );
    });
  });

  describe("checkAndApplyAutoUnpublish - edge cases", () => {
    it("does not reset unpublish schedule on subsequent edits with missing fields", async () => {
      (
        validatePublish.getMissingNecessaryFieldsForPublish as any
      ).mockReturnValue(["zoomLink"]);

      // Event already has a scheduled unpublish time
      const existingScheduleTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      const event = {
        ...baseEvent,
        unpublishScheduledAt: existingScheduleTime,
        unpublishWarningFields: ["location"],
      } as any;

      const result = await AutoUnpublishService.checkAndApplyAutoUnpublish(
        event as any
      );

      // Should NOT issue new warning (autoUnpublished = false) since schedule already exists
      expect(result.autoUnpublished).toBe(false);
      // Schedule should NOT be reset - keep original time
      expect((event as any).unpublishScheduledAt).toBe(existingScheduleTime);
      // But warning fields should be updated
      expect((event as any).unpublishWarningFields).toEqual(["zoomLink"]);
    });

    it("skips check for unpublished events", async () => {
      (
        validatePublish.getMissingNecessaryFieldsForPublish as any
      ).mockReturnValue(["zoomLink"]);

      const event = {
        ...baseEvent,
        publish: false, // Unpublished event
      } as any;

      const result = await AutoUnpublishService.checkAndApplyAutoUnpublish(
        event as any
      );

      expect(result.autoUnpublished).toBe(false);
      expect(result.missingFields).toEqual([]);
      // getMissingNecessaryFieldsForPublish should not be called for unpublished events
      // (check happens inside publish block)
    });
  });
});
