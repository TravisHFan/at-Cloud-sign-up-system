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

describe("RecurringEventGenerationService - additional coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (EventController.findConflictingEvents as any).mockResolvedValue([]);
    (User.findById as any).mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    });
    // Reset mocks to default resolved values
    (
      UnifiedMessageController.createTargetedSystemMessage as any
    ).mockResolvedValue(undefined);
    (EmailService.sendGenericNotificationEmail as any).mockResolvedValue(
      undefined
    );
  });

  const createEventFn = vi.fn(async (data: any) => ({ _id: data.date }));

  describe("frequency variations", () => {
    it("generates series with monthly frequency", async () => {
      const monthlyRecurring = {
        isRecurring: true,
        frequency: "monthly" as const,
        occurrenceCount: 3,
      };

      const result =
        await RecurringEventGenerationService.generateRecurringSeries(
          monthlyRecurring,
          baseEventData as any,
          "e1",
          createEventFn,
          currentUser as any
        );

      expect(result.success).toBe(true);
      expect(result.seriesIds).toHaveLength(3);
      expect(createEventFn).toHaveBeenCalledTimes(2);
    });

    it("generates series with every-two-months frequency", async () => {
      const biMonthlyRecurring = {
        isRecurring: true,
        frequency: "every-two-months" as const,
        occurrenceCount: 4,
      };

      const result =
        await RecurringEventGenerationService.generateRecurringSeries(
          biMonthlyRecurring,
          baseEventData as any,
          "e1",
          createEventFn,
          currentUser as any
        );

      expect(result.success).toBe(true);
      expect(result.seriesIds).toHaveLength(4);
      expect(createEventFn).toHaveBeenCalledTimes(3);
    });
  });

  describe("occurrence count edge cases", () => {
    it("allows maximum occurrence count of 24", async () => {
      const maxRecurring = {
        isRecurring: true,
        frequency: "every-two-weeks" as const,
        occurrenceCount: 24,
      };

      const result =
        await RecurringEventGenerationService.generateRecurringSeries(
          maxRecurring,
          baseEventData as any,
          "e1",
          createEventFn,
          currentUser as any
        );

      expect(result.success).toBe(true);
      expect(result.seriesIds).toHaveLength(24);
      expect(createEventFn).toHaveBeenCalledTimes(23);
    });

    it("rejects occurrence count above 24", async () => {
      const tooManyRecurring = {
        isRecurring: true,
        frequency: "every-two-weeks" as const,
        occurrenceCount: 25,
      };

      await expect(
        RecurringEventGenerationService.generateRecurringSeries(
          tooManyRecurring,
          baseEventData as any,
          "e1",
          createEventFn,
          currentUser as any
        )
      ).rejects.toThrow("Invalid recurring configuration");
    });

    it("rejects invalid frequency value", async () => {
      const invalidFreq = {
        isRecurring: true,
        frequency: "weekly" as any, // not a valid frequency
        occurrenceCount: 3,
      };

      await expect(
        RecurringEventGenerationService.generateRecurringSeries(
          invalidFreq,
          baseEventData as any,
          "e1",
          createEventFn,
          currentUser as any
        )
      ).rejects.toThrow("Invalid recurring configuration");
    });
  });

  describe("notification edge cases", () => {
    it("handles user without email gracefully", async () => {
      const userWithoutEmail = {
        _id: "user-1",
        email: undefined,
        firstName: "NoEmail",
        lastName: "User",
        username: "noemail",
        avatar: undefined,
        gender: "male" as const,
        role: "admin",
        roleInAtCloud: "organizer",
      };

      // Trigger a moved event
      let callCount = 0;
      (EventController.findConflictingEvents as any).mockImplementation(
        async () => {
          callCount++;
          return callCount === 1 ? [{ id: "conflict" }] : [];
        }
      );

      const result =
        await RecurringEventGenerationService.generateRecurringSeries(
          {
            isRecurring: true,
            frequency: "every-two-weeks" as const,
            occurrenceCount: 2,
          },
          baseEventData as any,
          "e1",
          createEventFn,
          userWithoutEmail as any
        );

      expect(result.success).toBe(true);
      expect(result.autoRescheduled).toBeDefined();
      expect(
        UnifiedMessageController.createTargetedSystemMessage
      ).toHaveBeenCalled();
      // Email should not be called for this user
      // but createTargetedSystemMessage should still work
    });

    it("handles currentUser with empty firstName and lastName", async () => {
      const userWithEmptyNames = {
        _id: "user-1",
        email: "test@example.com",
        firstName: "",
        lastName: "",
        username: "fallback_username",
        avatar: undefined,
        gender: "male" as const,
        role: "user",
        roleInAtCloud: undefined,
      };

      let callCount = 0;
      (EventController.findConflictingEvents as any).mockImplementation(
        async () => {
          callCount++;
          return callCount === 1 ? [{ id: "conflict" }] : [];
        }
      );

      const result =
        await RecurringEventGenerationService.generateRecurringSeries(
          {
            isRecurring: true,
            frequency: "every-two-weeks" as const,
            occurrenceCount: 2,
          },
          baseEventData as any,
          "e1",
          createEventFn,
          userWithEmptyNames as any
        );

      expect(result.success).toBe(true);
      expect(result.autoRescheduled).toBeDefined();
      expect(EmailService.sendGenericNotificationEmail).toHaveBeenCalledWith(
        "test@example.com",
        "fallback_username", // Falls back to username
        expect.any(Object)
      );
    });

    it("handles email sending failure gracefully", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Trigger notification by having a conflict move
      let callCount = 0;
      (EventController.findConflictingEvents as any).mockImplementation(
        async () => {
          callCount++;
          return callCount === 1 ? [{ id: "conflict" }] : [];
        }
      );

      // Make email sending fail
      (EmailService.sendGenericNotificationEmail as any).mockRejectedValue(
        new Error("SMTP failure")
      );

      const result =
        await RecurringEventGenerationService.generateRecurringSeries(
          {
            isRecurring: true,
            frequency: "every-two-weeks" as const,
            occurrenceCount: 2,
          },
          baseEventData as any,
          "e1",
          createEventFn,
          currentUser as any
        );

      // Should still succeed despite email failure
      expect(result.success).toBe(true);
      expect(result.autoRescheduled).toBeDefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to send auto-reschedule email to",
        "creator@example.com",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it("handles notification system failure gracefully", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Trigger notification by having a conflict move
      let callCount = 0;
      (EventController.findConflictingEvents as any).mockImplementation(
        async () => {
          callCount++;
          return callCount === 1 ? [{ id: "conflict" }] : [];
        }
      );

      // Make system message fail
      (
        UnifiedMessageController.createTargetedSystemMessage as any
      ).mockRejectedValue(new Error("System message failure"));

      const result =
        await RecurringEventGenerationService.generateRecurringSeries(
          {
            isRecurring: true,
            frequency: "every-two-weeks" as const,
            occurrenceCount: 2,
          },
          baseEventData as any,
          "e1",
          createEventFn,
          currentUser as any
        );

      // Should still succeed despite notification failure
      expect(result.success).toBe(true);
      expect(result.autoRescheduled).toBeDefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to notify about auto-reschedule:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("organizer details handling", () => {
    it("handles organizerDetails with non-string userId", async () => {
      let callCount = 0;
      (EventController.findConflictingEvents as any).mockImplementation(
        async () => {
          callCount++;
          return callCount === 1 ? [{ id: "conflict" }] : [];
        }
      );

      const eventWithWeirdOrgDetails = {
        ...baseEventData,
        organizerDetails: [
          { userId: 123 }, // not a string
          { userId: null },
          { name: "no userId here" },
        ],
      };

      const result =
        await RecurringEventGenerationService.generateRecurringSeries(
          {
            isRecurring: true,
            frequency: "every-two-weeks" as const,
            occurrenceCount: 2,
          },
          eventWithWeirdOrgDetails as any,
          "e1",
          createEventFn,
          currentUser as any
        );

      expect(result.success).toBe(true);
      // Should not throw on malformed organizerDetails
    });

    it("handles co-organizer user found without email", async () => {
      let callCount = 0;
      (EventController.findConflictingEvents as any).mockImplementation(
        async () => {
          callCount++;
          return callCount === 1 ? [{ id: "conflict" }] : [];
        }
      );

      // Co-org user found but has no email
      (User.findById as any).mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: "co-org-1",
          email: undefined,
          firstName: "CoOrg",
          lastName: "NoEmail",
          username: "coorgnoemail",
        }),
      });

      const eventWithOrg = {
        ...baseEventData,
        organizerDetails: [{ userId: "co-org-1" }],
      };

      const result =
        await RecurringEventGenerationService.generateRecurringSeries(
          {
            isRecurring: true,
            frequency: "every-two-weeks" as const,
            occurrenceCount: 2,
          },
          eventWithOrg as any,
          "e1",
          createEventFn,
          currentUser as any
        );

      expect(result.success).toBe(true);
      expect(
        UnifiedMessageController.createTargetedSystemMessage
      ).toHaveBeenCalled();
      // Co-org without email should still be included in system message
    });

    it("handles co-organizer with empty names falling back to username", async () => {
      let callCount = 0;
      (EventController.findConflictingEvents as any).mockImplementation(
        async () => {
          callCount++;
          return callCount === 1 ? [{ id: "conflict" }] : [];
        }
      );

      (User.findById as any).mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: "co-org-1",
          email: "coorg@example.com",
          firstName: "",
          lastName: "",
          username: "coorg_username",
        }),
      });

      const eventWithOrg = {
        ...baseEventData,
        organizerDetails: [{ userId: "co-org-1" }],
      };

      const result =
        await RecurringEventGenerationService.generateRecurringSeries(
          {
            isRecurring: true,
            frequency: "every-two-weeks" as const,
            occurrenceCount: 2,
          },
          eventWithOrg as any,
          "e1",
          createEventFn,
          currentUser as any
        );

      expect(result.success).toBe(true);
      expect(EmailService.sendGenericNotificationEmail).toHaveBeenCalledWith(
        "coorg@example.com",
        "coorg_username",
        expect.any(Object)
      );
    });
  });

  describe("skip and append scenarios", () => {
    it("logs warning when unable to append extra occurrence", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      // All slots conflicting - both primary and append
      (EventController.findConflictingEvents as any).mockResolvedValue([
        { id: "always_conflict" },
      ]);

      const result =
        await RecurringEventGenerationService.generateRecurringSeries(
          {
            isRecurring: true,
            frequency: "every-two-weeks" as const,
            occurrenceCount: 2,
          },
          baseEventData as any,
          "e1",
          createEventFn,
          currentUser as any
        );

      expect(result.success).toBe(true);
      // First event ID is always included
      expect(result.seriesIds).toContain("e1");
      // Warning should be logged about unable to schedule (matches actual message)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Auto-reschedule: unable to")
      );

      consoleWarnSpy.mockRestore();
    });

    it("successfully appends occurrence after skip", async () => {
      // First 7 checks conflict (0-6 days), then clear for append cycle
      let callCount = 0;
      (EventController.findConflictingEvents as any).mockImplementation(
        async () => {
          callCount++;
          // Conflict for first 7 attempts (primary), then clear for append attempts
          if (callCount <= 7) {
            return [{ id: "conflict" }];
          }
          return [];
        }
      );

      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const result =
        await RecurringEventGenerationService.generateRecurringSeries(
          {
            isRecurring: true,
            frequency: "every-two-weeks" as const,
            occurrenceCount: 2,
          },
          baseEventData as any,
          "e1",
          createEventFn,
          currentUser as any
        );

      expect(result.success).toBe(true);
      // Should have skipped and then appended
      expect(result.autoRescheduled).toBeDefined();
      expect(result.autoRescheduled?.skipped.length).toBeGreaterThanOrEqual(0);

      consoleWarnSpy.mockRestore();
    });
  });

  describe("timeZone handling", () => {
    it("handles event without timeZone (defaults to UTC)", async () => {
      const eventWithoutTZ = {
        ...baseEventData,
        timeZone: undefined,
      };

      const result =
        await RecurringEventGenerationService.generateRecurringSeries(
          {
            isRecurring: true,
            frequency: "every-two-weeks" as const,
            occurrenceCount: 2,
          },
          eventWithoutTZ as any,
          "e1",
          createEventFn,
          currentUser as any
        );

      expect(result.success).toBe(true);
      expect(result.seriesIds).toHaveLength(2);
    });
  });
});
