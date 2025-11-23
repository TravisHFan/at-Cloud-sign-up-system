import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request } from "express";

vi.mock("../../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendCoOrganizerAssignedEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../../src/controllers/unifiedMessageController", () => ({
  UnifiedMessageController: {
    createTargetedSystemMessage: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../../src/controllers/eventController", () => ({
  EventController: {
    toIdString: (id: any) => String(id),
  },
}));

vi.mock("../../../../src/models", () => ({
  User: {
    find: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue([]),
  },
}));

import { CoOrganizerNotificationService } from "../../../../src/services/event/CoOrganizerNotificationService";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";
import { UnifiedMessageController } from "../../../../src/controllers/unifiedMessageController";
import { User } from "../../../../src/models";

const baseEvent = {
  _id: "event-1",
  id: "event-1",
  title: "Test Event",
  date: "2025-01-01",
  time: "10:00",
  location: "Online",
  createdBy: "creator-1",
} as any;

const makeReq = (overrides: Partial<Request> = {}): Request =>
  ({
    user: {
      _id: "creator-1",
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

describe("CoOrganizerNotificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early when organizerDetails is missing or not an array", async () => {
    const req = makeReq();

    await CoOrganizerNotificationService.sendNewCoOrganizerNotifications(
      baseEvent,
      [],
      {},
      req
    );

    expect(User.find).not.toHaveBeenCalled();
    expect(EmailService.sendCoOrganizerAssignedEmail).not.toHaveBeenCalled();
    expect(
      UnifiedMessageController.createTargetedSystemMessage
    ).not.toHaveBeenCalled();
  });

  it("sends notifications only to newly added co-organizers (excluding main organizer and existing ones)", async () => {
    const req = makeReq();

    (User.find as any).mockReturnValue({
      select: vi.fn().mockResolvedValue([
        {
          _id: "user-2",
          email: "user2@example.com",
          firstName: "Jane",
          lastName: "Smith",
        },
      ]),
    });

    await CoOrganizerNotificationService.sendNewCoOrganizerNotifications(
      baseEvent,
      ["user-1"],
      {
        organizerDetails: [
          { userId: "creator-1" },
          { userId: "user-1" },
          { userId: "user-2" },
        ],
      },
      req
    );

    // Co-organizers are notified regardless of emailNotifications preference
    expect(User.find).toHaveBeenCalledWith({
      _id: { $in: ["user-2"] },
      isActive: true,
      isVerified: true,
    });

    expect(EmailService.sendCoOrganizerAssignedEmail).toHaveBeenCalledWith(
      "user2@example.com",
      expect.objectContaining({ firstName: "Jane", lastName: "Smith" }),
      expect.objectContaining({ title: baseEvent.title }),
      expect.objectContaining({ firstName: "John", lastName: "Doe" })
    );
  });

  it("continues when individual email or system message fails", async () => {
    const req = makeReq();

    (User.find as any).mockReturnValue({
      select: vi.fn().mockResolvedValue([
        {
          _id: "co-2",
          email: "co2@example.com",
          firstName: "Co",
          lastName: "Two",
        },
      ]),
    });

    (EmailService.sendCoOrganizerAssignedEmail as any).mockRejectedValue(
      new Error("email failed")
    );
    (
      UnifiedMessageController.createTargetedSystemMessage as any
    ).mockRejectedValue(new Error("system message failed"));

    await CoOrganizerNotificationService.sendNewCoOrganizerNotifications(
      baseEvent,
      [],
      { organizerDetails: [{ userId: "co-2" }] },
      req
    );

    await vi.waitFor(() => {
      expect(EmailService.sendCoOrganizerAssignedEmail).toHaveBeenCalled();
      expect(
        UnifiedMessageController.createTargetedSystemMessage
      ).toHaveBeenCalled();
    });
  });

  it("swallows outer errors without throwing", async () => {
    const req = makeReq();

    (User.find as unknown as any).mockImplementation(() => {
      throw new Error("db failure");
    });

    await expect(
      CoOrganizerNotificationService.sendNewCoOrganizerNotifications(
        baseEvent,
        [],
        { organizerDetails: [{ userId: "co-2" }] },
        req
      )
    ).resolves.toBeUndefined();
  });
});
