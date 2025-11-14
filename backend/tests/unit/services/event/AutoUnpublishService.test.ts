import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request } from "express";

// We will mock dynamic imports used inside AutoUnpublishService via vi.mock on their modules
vi.mock("../../../../src/utils/validatePublish", () => ({
  getMissingNecessaryFieldsForPublish: vi.fn(),
}));

vi.mock("../../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendEventAutoUnpublishNotification: vi.fn().mockResolvedValue(undefined),
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
import { User } from "../../../../src/models";
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
    it("auto-unpublishes when required fields are missing", async () => {
      (
        validatePublish.getMissingNecessaryFieldsForPublish as any
      ).mockReturnValue(["zoomLink", "location"]);

      const event = { ...baseEvent };

      const result = await AutoUnpublishService.checkAndApplyAutoUnpublish(
        event as any
      );

      expect(result.autoUnpublished).toBe(true);
      expect(result.missingFields).toEqual(["zoomLink", "location"]);
      expect(event.publish).toBe(false);
      expect((event as any).autoUnpublishedAt).toBeInstanceOf(Date);
      expect((event as any).autoUnpublishedReason).toBe(
        "MISSING_REQUIRED_FIELDS"
      );
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

    it("clears previous autoUnpublishedReason when republished with no missing fields", async () => {
      (
        validatePublish.getMissingNecessaryFieldsForPublish as any
      ).mockReturnValue([]);

      const event = {
        ...baseEvent,
        autoUnpublishedReason: "MISSING_REQUIRED_FIELDS",
      } as any;

      const result = await AutoUnpublishService.checkAndApplyAutoUnpublish(
        event
      );

      expect(result.autoUnpublished).toBe(false);
      expect((event as any).autoUnpublishedReason).toBeNull();
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

    it("sends email to all organizers and emits domain event", async () => {
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

      expect(
        EmailService.sendEventAutoUnpublishNotification
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: event.id,
          title: event.title,
          format: "zoom",
          missingFields,
          recipients: ["a@example.com", "b@example.com"],
        })
      );

      expect(domainEvents.emit).toHaveBeenCalledWith(
        EVENT_AUTO_UNPUBLISHED,
        expect.objectContaining({
          eventId: event.id,
          title: event.title,
          format: "zoom",
          missingFields,
          reason: "MISSING_REQUIRED_FIELDS",
        })
      );

      expect(
        UnifiedMessageController.createTargetedSystemMessage
      ).toHaveBeenCalled();
    });

    it("sends system message to all organizers when their user records are found", async () => {
      (EmailRecipientUtils.getEventAllOrganizers as any).mockResolvedValue([
        { email: "a@example.com" },
        { email: "b@example.com" },
      ]);

      (User.findOne as any).mockImplementation(
        ({ email }: { email: string }) => ({
          select: vi
            .fn()
            .mockResolvedValue({
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
          title: expect.stringContaining("Event Auto-Unpublished"),
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
        EmailService.sendEventAutoUnpublishNotification
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
        EmailService.sendEventAutoUnpublishNotification as any
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
});
