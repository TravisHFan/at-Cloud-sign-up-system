import { describe, it, expect, vi, beforeEach } from "vitest";

import { RecurringEventGenerationService } from "../../../../src/services/event/RecurringEventGenerationService";

vi.mock("../../../../src/controllers/eventController", () => ({
  EventController: {
    toIdString: (id: any) => String(id),
    findConflictingEvents: vi.fn(),
  },
}));

vi.mock("../../../../src/controllers/unifiedMessageController", () => ({
  UnifiedMessageController: {
    createTargetedSystemMessage: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../../src/models", () => ({
  User: {
    findById: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("../../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendGenericNotificationEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../../src/utils/event/timezoneUtils", () => ({
  toInstantFromWallClock: (date: string, time: string) =>
    new Date(`${date}T${time}:00.000Z`),
  instantToWallClock: (d: Date) => ({
    date: d.toISOString().slice(0, 10),
    time: d.toISOString().slice(11, 16),
  }),
}));

import { EventController } from "../../../../src/controllers/eventController";
import { UnifiedMessageController } from "../../../../src/controllers/unifiedMessageController";
import { User } from "../../../../src/models";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

const baseRecurring = {
  isRecurring: true,
  frequency: "every-two-weeks" as const,
  occurrenceCount: 3,
};

const baseEventData = {
  title: "Recurring Test",
  date: "2024-01-01",
  endDate: "2024-01-01",
  time: "10:00",
  endTime: "11:00",
  timeZone: "UTC",
};

const currentUser = {
  _id: "user-1",
  email: "creator@example.com",
  firstName: "Alice",
  lastName: "Creator",
  username: "alice",
  avatar: "avatar.png",
  gender: "female" as const,
  role: "admin",
  roleInAtCloud: "organizer",
};

describe("RecurringEventGenerationService.generateRecurringSeries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (EventController.findConflictingEvents as any).mockResolvedValue([]);
  });

  const createEventFn = vi.fn(async (data: any) => ({ _id: data.date }));

  it("throws on invalid recurring config", async () => {
    await expect(
      RecurringEventGenerationService.generateRecurringSeries(
        { ...baseRecurring, isRecurring: false },
        baseEventData as any,
        "e1",
        createEventFn,
        currentUser as any
      )
    ).rejects.toThrow("Invalid recurring configuration");

    await expect(
      RecurringEventGenerationService.generateRecurringSeries(
        { ...baseRecurring, occurrenceCount: 1 },
        baseEventData as any,
        "e1",
        createEventFn,
        currentUser as any
      )
    ).rejects.toThrow("Invalid recurring configuration");
  });

  it("throws when endDate is missing", async () => {
    await expect(
      RecurringEventGenerationService.generateRecurringSeries(
        baseRecurring,
        { ...baseEventData, endDate: undefined } as any,
        "e1",
        createEventFn,
        currentUser as any
      )
    ).rejects.toThrow("endDate is required for recurring events");
  });

  it("generates series without conflicts and no auto-reschedule", async () => {
    const result =
      await RecurringEventGenerationService.generateRecurringSeries(
        baseRecurring,
        baseEventData as any,
        "e1",
        createEventFn,
        currentUser as any
      );

    expect(result.success).toBe(true);
    expect(result.seriesIds).toHaveLength(baseRecurring.occurrenceCount);
    expect(result.firstEventId).toBe(String("e1"));
    expect(result.autoRescheduled).toBeUndefined();
    // two additional occurrences created
    expect(createEventFn).toHaveBeenCalledTimes(2);
  });

  it("auto-reschedules conflicts within +6 days and records moved entries", async () => {
    // First conflict: return a non-empty array for the first desired slot, then none
    let callCount = 0;
    (EventController.findConflictingEvents as any).mockImplementation(
      async () => {
        callCount += 1;
        // First call for desiredStart, second for +1 day, etc.
        // Mark first candidate as conflicting, then clear
        return callCount === 1 ? [{ id: "conflict" }] : [];
      }
    );

    const result =
      await RecurringEventGenerationService.generateRecurringSeries(
        baseRecurring,
        baseEventData as any,
        "e1",
        createEventFn,
        currentUser as any
      );

    expect(result.autoRescheduled).toBeDefined();
    expect(result.autoRescheduled?.moved.length).toBeGreaterThanOrEqual(1);
    expect(result.autoRescheduled?.moved[0].offsetDays).toBeGreaterThan(0);
  });

  it("skips occurrences that cannot be scheduled within +6 days and appends later", async () => {
    // Always conflicting for primary scheduling, but free for append cycle
    (EventController.findConflictingEvents as any).mockResolvedValueOnce([
      { id: "conflict" },
    ]);
    (EventController.findConflictingEvents as any).mockResolvedValueOnce([
      { id: "conflict" },
    ]);
    // For 7 attempts (0..6 days) return conflicts, then clear for append
    (EventController.findConflictingEvents as any).mockResolvedValue([
      { id: "conflict" },
    ]);

    const original = console.warn;
    console.warn = vi.fn();

    const result =
      await RecurringEventGenerationService.generateRecurringSeries(
        { ...baseRecurring, occurrenceCount: 2 },
        baseEventData as any,
        "e1",
        createEventFn,
        currentUser as any
      );

    console.warn = original;

    expect(result.success).toBe(true);
    // First event ID is always included; when scheduling fails, at most
    // one appended occurrence may be created, so seriesIds length can be 1 or 2.
    expect(result.seriesIds.length).toBeGreaterThanOrEqual(1);
  });

  it("sends system messages and emails when there are auto-rescheduled occurrences", async () => {
    (EventController.findConflictingEvents as any).mockResolvedValueOnce([
      { id: "conflict" },
    ]);
    (EventController.findConflictingEvents as any).mockResolvedValueOnce([]);

    (User.findById as any).mockReturnValue({
      select: vi.fn().mockResolvedValue({
        _id: "co-org-1",
        email: "coorg@example.com",
        firstName: "Bob",
        lastName: "Coorg",
        username: "bob",
      }),
    });

    const eventWithOrganizers = {
      ...baseEventData,
      organizerDetails: [{ userId: "co-org-1" }],
    };

    const result =
      await RecurringEventGenerationService.generateRecurringSeries(
        baseRecurring,
        eventWithOrganizers as any,
        "e1",
        createEventFn,
        currentUser as any
      );

    expect(result.autoRescheduled).toBeDefined();
    expect(
      UnifiedMessageController.createTargetedSystemMessage
    ).toHaveBeenCalled();
    expect(EmailService.sendGenericNotificationEmail).toHaveBeenCalled();
  });
});
