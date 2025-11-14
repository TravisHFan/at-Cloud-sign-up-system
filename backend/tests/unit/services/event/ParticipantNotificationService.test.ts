import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request } from "express";

vi.mock("../../../../src/utils/emailRecipientUtils", () => ({
  EmailRecipientUtils: {
    getEventParticipants: vi.fn(),
    getEventGuests: vi.fn(),
  },
}));

vi.mock("../../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendEventNotificationEmailBulk: vi.fn().mockResolvedValue([true]),
  },
}));

vi.mock("../../../../src/controllers/unifiedMessageController", () => ({
  UnifiedMessageController: {
    createTargetedSystemMessage: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../../../../src/controllers/eventController", () => ({
  EventController: {
    toIdString: (id: any) => String(id),
  },
}));

vi.mock("../../../../src/models", () => ({
  User: {
    findOne: vi.fn(),
  },
}));

import { ParticipantNotificationService } from "../../../../src/services/event/ParticipantNotificationService";
import { EmailRecipientUtils } from "../../../../src/utils/emailRecipientUtils";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";
import { UnifiedMessageController } from "../../../../src/controllers/unifiedMessageController";
import { User } from "../../../../src/models";

const baseEvent = {
  _id: "event-1",
  id: "event-1",
  title: "Test Event",
  date: "2025-01-01",
  endDate: "2025-01-02",
  time: "10:00",
  endTime: "12:00",
  timeZone: "America/New_York",
} as any;

const makeReq = (overrides: Partial<Request> = {}): Request =>
  ({
    user: {
      _id: "user-actor",
      firstName: "John",
      lastName: "Doe",
      email: "actor@example.com",
      username: "jdoe",
      avatar: "avatar.png",
      gender: "male",
      role: "organizer",
      roleInAtCloud: "organizer",
      ...((overrides as any).user || {}),
    },
    ...overrides,
  } as unknown as Request);

describe("ParticipantNotificationService.sendEventUpdateNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends bulk emails to combined participant and guest list with deduped recipients", async () => {
    (EmailRecipientUtils.getEventParticipants as any).mockResolvedValue([
      { email: "p1@example.com", firstName: "P1", lastName: "User" },
      { email: "shared@example.com", firstName: "Shared", lastName: "User" },
    ]);
    (EmailRecipientUtils.getEventGuests as any).mockResolvedValue([
      { email: "g1@example.com", firstName: "G1", lastName: "Guest" },
      {
        email: "shared@example.com",
        firstName: "Duplicate",
        lastName: "Person",
      },
    ]);

    const req = makeReq();

    await ParticipantNotificationService.sendEventUpdateNotifications(
      baseEvent.id,
      baseEvent,
      req
    );

    expect(EmailService.sendEventNotificationEmailBulk).toHaveBeenCalled();
    const [recipients, payload] = (
      EmailService.sendEventNotificationEmailBulk as any
    ).mock.calls[0];

    // Bulk method receives all recipients; it is responsible for deduplication.
    expect(recipients).toEqual([
      { email: "p1@example.com", name: "P1 User" },
      { email: "shared@example.com", name: "Shared User" },
      { email: "g1@example.com", name: "G1 Guest" },
      { email: "shared@example.com", name: "Duplicate Person" },
    ]);

    expect(payload).toMatchObject({
      eventTitle: baseEvent.title,
      date: baseEvent.date,
      endDate: baseEvent.endDate,
      time: baseEvent.time,
      endTime: baseEvent.endTime,
      timeZone: baseEvent.timeZone,
    });
    expect(payload.message).toContain("Test Event");
    expect(payload.message).toContain("has been edited by");
  });

  it("resolves participant user IDs from existing _id and via email lookup", async () => {
    (EmailRecipientUtils.getEventParticipants as any).mockResolvedValue([
      { _id: "existing-1", email: "existing@example.com" },
      { email: "lookup@example.com" },
    ]);
    (EmailRecipientUtils.getEventGuests as any).mockResolvedValue([]);

    // Mock User.findOne to support both select().lean() and plain promise returns
    (User.findOne as any).mockImplementation(({ email }: { email: string }) => {
      if (email === "lookup@example.com") {
        return {
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue({ _id: "user-lookup" }),
          }),
        };
      }
      return null;
    });

    const req = makeReq();

    await ParticipantNotificationService.sendEventUpdateNotifications(
      baseEvent.id,
      baseEvent,
      req
    );

    expect(User.findOne).toHaveBeenCalledWith({
      email: "lookup@example.com",
      isActive: true,
      isVerified: true,
    });

    expect(
      UnifiedMessageController.createTargetedSystemMessage
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("Event Updated"),
        metadata: { eventId: baseEvent.id },
      }),
      ["existing-1", "user-lookup"],
      expect.objectContaining({ id: "user-actor" })
    );
  });

  it("handles failures in user ID resolution gracefully and still sends notifications", async () => {
    (EmailRecipientUtils.getEventParticipants as any).mockResolvedValue([
      { email: "bad@example.com" },
    ]);
    (EmailRecipientUtils.getEventGuests as any).mockResolvedValue([]);

    (User.findOne as any).mockImplementation(() => {
      throw new Error("db failure");
    });

    const req = makeReq();

    await ParticipantNotificationService.sendEventUpdateNotifications(
      baseEvent.id,
      baseEvent,
      req
    );

    // No system message should be created because no IDs resolved
    expect(
      UnifiedMessageController.createTargetedSystemMessage
    ).not.toHaveBeenCalled();

    // But emails should still have been attempted
    expect(EmailService.sendEventNotificationEmailBulk).toHaveBeenCalled();
  });

  it("swallows outer errors and does not throw", async () => {
    (EmailRecipientUtils.getEventParticipants as any).mockRejectedValue(
      new Error("participant query failed")
    );
    (EmailRecipientUtils.getEventGuests as any).mockResolvedValue([]);

    const req = makeReq();

    await expect(
      ParticipantNotificationService.sendEventUpdateNotifications(
        baseEvent.id,
        baseEvent,
        req
      )
    ).resolves.toBeUndefined();
  });
});
