/**
 * RecurringEventGenerationService
 *
 * Handles recurring event series generation with intelligent conflict resolution.
 *
 * Key Responsibilities:
 * - Cycle calculation (every-two-weeks, monthly, every-two-months)
 * - Weekday preservation across month boundaries
 * - Conflict detection and auto-rescheduling (up to 6-day window)
 * - Skip/append tracking for maintaining occurrence count
 * - Auto-reschedule notifications to creator and co-organizers
 *
 * Auto-Rescheduling Logic:
 * - If desired slot conflicts, try +1, +2, ... +6 days
 * - If all 6 days conflict, skip that occurrence
 * - After primary series, append extra occurrences to maintain count
 * - Notify users of all moved/skipped/appended changes
 */

import { EventController } from "../../controllers/eventController";
import { User } from "../../models";
import {
  toInstantFromWallClock,
  instantToWallClock,
} from "../../utils/event/timezoneUtils";
import { UnifiedMessageController } from "../../controllers/unifiedMessageController";
import { EmailService } from "../infrastructure/EmailServiceFacade";

interface RecurringConfig {
  isRecurring: boolean;
  frequency: "every-two-weeks" | "monthly" | "every-two-months";
  occurrenceCount: number;
}

interface EventData {
  title: string;
  date: string;
  endDate?: string;
  time: string;
  endTime: string;
  timeZone?: string;
  organizerDetails?: Array<{
    userId?: unknown;
    name?: string;
    role?: string;
    avatar?: string;
    gender?: "male" | "female";
  }>;
  [key: string]: unknown;
}

interface CreateEventFn {
  // Accept any object that has at minimum the EventData properties
  (data: Record<string, unknown> & EventData): Promise<{ _id: unknown }>;
}

interface UserInfo {
  _id: unknown;
  email?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  avatar?: string;
  gender?: "male" | "female";
  role: string;
  roleInAtCloud?: string;
}

interface GenerationResult {
  success: boolean;
  seriesIds: string[];
  firstEventId: string;
  autoRescheduled?: {
    moved: Array<{ originalStart: Date; newStart: Date; offsetDays: number }>;
    skipped: Array<{ originalStart: Date }>;
    appended: Array<{ newStart: Date; sourceSkipIndex: number }>;
  };
}

export class RecurringEventGenerationService {
  /**
   * Generate recurring event series with auto-rescheduling on conflicts
   * @param recurring - Recurring configuration
   * @param eventData - Base event data for creating additional occurrences
   * @param firstEventId - ID of the already-created first event
   * @param createEventFn - Function to create additional event occurrences
   * @param currentUser - Current user creating the events
   */
  static async generateRecurringSeries(
    recurring: RecurringConfig,
    eventData: EventData,
    firstEventId: unknown,
    createEventFn: CreateEventFn,
    currentUser: UserInfo
  ): Promise<GenerationResult> {
    // Validate recurring configuration
    const isValidRecurring =
      !!recurring?.isRecurring &&
      (recurring.frequency === "every-two-weeks" ||
        recurring.frequency === "monthly" ||
        recurring.frequency === "every-two-months") &&
      typeof recurring.occurrenceCount === "number" &&
      recurring.occurrenceCount > 1 &&
      recurring.occurrenceCount <= 24;

    if (!isValidRecurring) {
      throw new Error("Invalid recurring configuration");
    }

    // Validate required event data
    if (!eventData.endDate) {
      throw new Error("endDate is required for recurring events");
    }

    // Compute first occurrence wall-clock instants
    const firstStartInstant = toInstantFromWallClock(
      eventData.date,
      eventData.time,
      eventData.timeZone
    );
    const firstEndInstant = toInstantFromWallClock(
      eventData.endDate,
      eventData.endTime,
      eventData.timeZone
    );
    const durationMs = firstEndInstant.getTime() - firstStartInstant.getTime();

    // Start with the first event ID (already created by caller)
    const seriesIds: string[] = [EventController.toIdString(firstEventId)];

    const originalWeekday = firstStartInstant.getDay(); // 0-6

    // Cycle advance function
    const addCycle = (base: Date): Date => {
      const d = new Date(base.getTime());
      if (recurring.frequency === "every-two-weeks") {
        d.setDate(d.getDate() + 14);
        return d;
      }
      // Monthly or Every Two Months: advance months first
      const monthsToAdd = recurring.frequency === "monthly" ? 1 : 2;
      const year = d.getFullYear();
      const month = d.getMonth();
      const date = d.getDate();
      const advanced = new Date(d.getTime());
      advanced.setFullYear(year, month + monthsToAdd, date);
      // Adjust forward to same weekday (Mon-Sun)
      while (advanced.getDay() !== originalWeekday) {
        advanced.setDate(advanced.getDate() + 1);
      }
      return advanced;
    };

    // Auto-rescheduling summary tracking
    const moved: Array<{
      originalStart: Date;
      newStart: Date;
      offsetDays: number;
    }> = [];
    const skipped: Array<{ originalStart: Date }> = [];
    const appended: Array<{ newStart: Date; sourceSkipIndex: number }> = [];

    // Helper: try schedule at base start, then bump +24h up to 6 days if conflict
    const tryScheduleWithBump = async (
      desiredStart: Date
    ): Promise<{ scheduledStart?: Date; offsetDays: number }> => {
      for (let offset = 0; offset <= 6; offset++) {
        const candidateStart = new Date(
          desiredStart.getTime() + offset * 24 * 60 * 60 * 1000
        );
        const candidateEnd = new Date(candidateStart.getTime() + durationMs);
        const wallStart = instantToWallClock(
          candidateStart,
          eventData.timeZone
        );
        const wallEnd = instantToWallClock(candidateEnd, eventData.timeZone);
        const conflicts = await EventController.findConflictingEvents(
          wallStart.date,
          wallStart.time,
          wallEnd.date,
          wallEnd.time,
          undefined,
          eventData.timeZone
        );
        if (conflicts.length === 0) {
          return { scheduledStart: candidateStart, offsetDays: offset };
        }
      }
      return { scheduledStart: undefined, offsetDays: -1 };
    };

    let prevStart = new Date(firstStartInstant.getTime());
    const totalToCreate = recurring.occurrenceCount - 1; // excluding first
    const desiredStarts: Date[] = [];
    for (let i = 0; i < totalToCreate; i++) {
      const ds = i === 0 ? addCycle(prevStart) : addCycle(desiredStarts[i - 1]);
      desiredStarts.push(ds);
    }

    const finalizedStarts: Date[] = [];

    // Schedule each desired occurrence
    for (let i = 0; i < desiredStarts.length; i++) {
      const desiredStart = desiredStarts[i];
      const { scheduledStart, offsetDays } = await tryScheduleWithBump(
        desiredStart
      );
      if (scheduledStart) {
        const candidateEnd = new Date(scheduledStart.getTime() + durationMs);
        const wallStart = instantToWallClock(
          scheduledStart,
          eventData.timeZone
        );
        const wallEnd = instantToWallClock(candidateEnd, eventData.timeZone);
        const nextEventData: EventData = {
          ...eventData,
          date: wallStart.date,
          time: wallStart.time,
          endDate: wallEnd.date,
          endTime: wallEnd.time,
        };
        const ev = await createEventFn(nextEventData);
        seriesIds.push(EventController.toIdString(ev._id));
        finalizedStarts.push(scheduledStart);
        prevStart = scheduledStart;
        if (offsetDays > 0) {
          moved.push({
            originalStart: desiredStart,
            newStart: scheduledStart,
            offsetDays,
          });
        }
      } else {
        // Could not find a slot within 6 days → skip for now, append later
        skipped.push({ originalStart: desiredStart });
      }
    }

    // Append extra occurrences at the end to keep count for each skip
    let lastStart =
      finalizedStarts.length > 0
        ? finalizedStarts[finalizedStarts.length - 1]
        : firstStartInstant;
    for (let si = 0; si < skipped.length; si++) {
      const desiredAppend = addCycle(lastStart);
      const { scheduledStart } = await tryScheduleWithBump(desiredAppend);
      if (scheduledStart) {
        const candidateEnd = new Date(scheduledStart.getTime() + durationMs);
        const wallStart = instantToWallClock(
          scheduledStart,
          eventData.timeZone
        );
        const wallEnd = instantToWallClock(candidateEnd, eventData.timeZone);
        const evData: EventData = {
          ...eventData,
          date: wallStart.date,
          time: wallStart.time,
          endDate: wallEnd.date,
          endTime: wallEnd.time,
        };
        const ev = await createEventFn(evData);
        seriesIds.push(EventController.toIdString(ev._id));
        appended.push({ newStart: scheduledStart, sourceSkipIndex: si });
        lastStart = scheduledStart;
      } else {
        // If even appended cannot be scheduled, fail silently keeping system invariant
        console.warn(
          "Auto-reschedule: unable to append extra occurrence within 6 days window; series count reduced."
        );
      }
    }

    // Notify about auto-rescheduling if any changes occurred
    if (moved.length > 0 || skipped.length > 0 || appended.length > 0) {
      await this.sendAutoRescheduleNotifications(
        eventData,
        moved,
        skipped,
        appended,
        currentUser
      );
    }

    return {
      success: true,
      seriesIds,
      firstEventId: seriesIds[0],
      autoRescheduled:
        moved.length > 0 || skipped.length > 0 || appended.length > 0
          ? { moved, skipped, appended }
          : undefined,
    };
  }

  /**
   * Send auto-reschedule notifications to creator and co-organizers
   */
  private static async sendAutoRescheduleNotifications(
    eventData: EventData,
    moved: Array<{ originalStart: Date; newStart: Date; offsetDays: number }>,
    skipped: Array<{ originalStart: Date }>,
    appended: Array<{ newStart: Date; sourceSkipIndex: number }>,
    currentUser: UserInfo
  ): Promise<void> {
    try {
      // Build human-readable summary
      const fmt = (d: Date) => {
        return new Intl.DateTimeFormat("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: eventData.timeZone || "UTC",
        }).format(d);
      };

      const movedLines = moved.map(
        (m) =>
          `• Moved: ${fmt(m.originalStart)} → ${fmt(m.newStart)} (+${
            m.offsetDays
          } day${m.offsetDays === 1 ? "" : "s"})`
      );
      const skippedLines = skipped.map(
        (s) => `• Skipped: ${fmt(s.originalStart)}`
      );
      const appendedLines = appended.map(
        (a) => `• Appended: ${fmt(a.newStart)}`
      );

      const content =
        `Some occurrences in the recurring event "${eventData.title}" were auto-rescheduled to avoid conflicts.\n\n` +
        (movedLines.length ? movedLines.join("\n") + "\n\n" : "") +
        (skippedLines.length ? skippedLines.join("\n") + "\n\n" : "") +
        (appendedLines.length ? appendedLines.join("\n") + "\n\n" : "") +
        `Time zone: ${eventData.timeZone || "UTC"}`;

      // Determine recipients: creator + co-organizers
      const targetUserIds: string[] = [];
      const targetEmails: Array<{ email: string; name: string }> = [];

      // Creator
      targetUserIds.push(EventController.toIdString(currentUser._id));
      if (currentUser.email) {
        const name =
          `${currentUser.firstName || ""} ${
            currentUser.lastName || ""
          }`.trim() ||
          currentUser.username ||
          "User";
        targetEmails.push({ email: currentUser.email, name });
      }

      // Co-organizers via organizerDetails.userId
      if (
        eventData.organizerDetails &&
        Array.isArray(eventData.organizerDetails)
      ) {
        for (const org of eventData.organizerDetails) {
          if (org.userId && typeof org.userId === "string") {
            const u = await User.findById(org.userId).select(
              "_id email firstName lastName username"
            );
            if (u) {
              targetUserIds.push(EventController.toIdString(u._id));
              if (u.email) {
                const name =
                  `${(u as { firstName?: string }).firstName || ""} ${
                    (u as { lastName?: string }).lastName || ""
                  }`.trim() ||
                  (u as { username?: string }).username ||
                  "User";
                targetEmails.push({ email: u.email, name });
              }
            }
          }
        }
      }

      // System message to creator and co-organizers
      if (targetUserIds.length) {
        await UnifiedMessageController.createTargetedSystemMessage(
          {
            title: `Auto-Rescheduled: ${eventData.title}`,
            content,
            type: "announcement",
            priority: "high",
            metadata: { kind: "recurring_auto_reschedule" },
          },
          targetUserIds,
          {
            id: EventController.toIdString(currentUser._id),
            firstName: currentUser.firstName || "Unknown",
            lastName: currentUser.lastName || "User",
            username: currentUser.username || "unknown",
            avatar: currentUser.avatar,
            gender: currentUser.gender || "male",
            authLevel: currentUser.role,
            roleInAtCloud: currentUser.roleInAtCloud,
          }
        );
      }

      // Emails to creator and co-organizers
      for (const rec of targetEmails) {
        try {
          await EmailService.sendGenericNotificationEmail(rec.email, rec.name, {
            subject: `Auto-Rescheduled Occurrences: ${eventData.title}`,
            contentHtml: content.replace(/\n/g, "<br>"),
            contentText: content,
          });
        } catch (e) {
          console.error(
            "Failed to send auto-reschedule email to",
            rec.email,
            e
          );
        }
      }
    } catch (notifyErr) {
      console.error("Failed to notify about auto-reschedule:", notifyErr);
    }
  }
}
