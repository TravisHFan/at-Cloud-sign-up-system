// EXTRACTED from eventController.ts (lines 602-1806) - EXACT COPY
// Purpose: Handle event creation logic including recurring events and notifications

import type { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";
import {
  Event,
  Registration,
  User,
  IEvent,
  IEventRole,
  Program,
  Purchase,
} from "../../models";
import { PERMISSIONS, hasPermission } from "../../utils/roleUtils";
import { validateRoles } from "../../utils/event/eventValidation";
import {
  toInstantFromWallClock,
  instantToWallClock,
} from "../../utils/event/timezoneUtils";
import { EmailService } from "../../services/infrastructure/EmailServiceFacade";
import { UnifiedMessageController } from "../unifiedMessageController";
import { EmailRecipientUtils } from "../../utils/emailRecipientUtils";
import { CachePatterns } from "../../services";
import { ResponseBuilderService } from "../../services/ResponseBuilderService";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";
import { Logger } from "../../services/LoggerService";

// Initialize logger
const logger = Logger.getInstance().child("CreationController");

// Type definitions
interface IncomingRoleData {
  name: string;
  description: string;
  maxParticipants: number;
  openToPublic?: boolean;
  agenda?: string;
  startTime?: string;
  endTime?: string;
}

interface CreateEventRequest {
  [key: string]: unknown;
  title: string;
  type: string;
  date: string;
  endDate?: string;
  time: string;
  endTime: string;
  organizer: string;
  format: "In-person" | "Online" | "Hybrid Participation";
  roles: IncomingRoleData[];
  purpose?: string;
  location?: string;
  zoomLink?: string;
  meetingId?: string;
  passcode?: string;
  flyerUrl?: string;
  secondaryFlyerUrl?: string;
  timeZone?: string;
  organizerDetails?: Array<{
    userId?: unknown;
    name?: string;
    role?: string;
    avatar?: string;
    gender?: "male" | "female";
  }>;
  hostedBy?: string;
  suppressNotifications?: boolean;
}

export class CreationController {
  // Helper type guard for organizerDetails
  private static hasOrganizerDetails(
    v: unknown
  ): v is { organizerDetails?: Array<unknown> } {
    return (
      typeof v === "object" &&
      v !== null &&
      Array.isArray((v as { organizerDetails?: unknown }).organizerDetails)
    );
  }

  static async createEvent(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      // Check permissions
      if (!hasPermission(req.user.role, PERMISSIONS.CREATE_EVENT)) {
        res.status(403).json({
          success: false,
          message: "Insufficient permissions to create events.",
        });
        return;
      }

      const eventData: CreateEventRequest = req.body;
      const recurring = (
        req.body as {
          recurring?: {
            isRecurring?: boolean;
            frequency?: "every-two-weeks" | "monthly" | "every-two-months";
            occurrenceCount?: number;
          };
        }
      ).recurring as
        | {
            isRecurring?: boolean;
            frequency?: "every-two-weeks" | "monthly" | "every-two-months";
            occurrenceCount?: number;
          }
        | undefined;

      // Normalize and default endDate
      if (
        (req.body as { endDate?: unknown }).endDate &&
        req.body.endDate instanceof Date
      ) {
        (eventData as { endDate?: string }).endDate = req.body.endDate
          .toISOString()
          .split("T")[0];
      }

      // Normalize virtual meeting fields
      // - For In-person: remove all virtual meeting fields
      // - For Online/Hybrid: trim and convert empty strings to undefined
      if (eventData.format === "In-person") {
        delete (eventData as { zoomLink?: unknown }).zoomLink;
        delete (eventData as { meetingId?: unknown }).meetingId;
        delete (eventData as { passcode?: unknown }).passcode;
      } else {
        if (
          typeof (eventData as { zoomLink?: unknown }).zoomLink === "string"
        ) {
          const v = (eventData.zoomLink as string).trim();
          (eventData as { zoomLink?: string }).zoomLink = v.length
            ? v
            : undefined;
        }
        if (
          typeof (eventData as { meetingId?: unknown }).meetingId === "string"
        ) {
          const v = (eventData.meetingId as string).trim();
          (eventData as { meetingId?: string }).meetingId = v.length
            ? v
            : undefined;
        }
        if (
          typeof (eventData as { passcode?: unknown }).passcode === "string"
        ) {
          const v = (eventData.passcode as string).trim();
          (eventData as { passcode?: string }).passcode = v.length
            ? v
            : undefined;
        }
      }

      // Normalize flyerUrl: trim empty to undefined; allow /uploads/* or http(s)
      if (typeof (eventData as { flyerUrl?: unknown }).flyerUrl === "string") {
        const raw = (eventData.flyerUrl as string).trim();
        (eventData as { flyerUrl?: string }).flyerUrl = raw.length
          ? raw
          : undefined;
      }

      // Normalize secondaryFlyerUrl: trim empty to undefined; allow /uploads/* or http(s)
      if (
        typeof (eventData as { secondaryFlyerUrl?: unknown })
          .secondaryFlyerUrl === "string"
      ) {
        const raw = (eventData.secondaryFlyerUrl as string).trim();
        (eventData as { secondaryFlyerUrl?: string }).secondaryFlyerUrl =
          raw.length ? raw : undefined;
      }

      // Server-side guard: ensure Online format always displays "Online" as location
      if (eventData.format === "Online") {
        (eventData as { location?: string }).location = "Online";
      } else if (
        typeof (eventData as { location?: unknown }).location === "string"
      ) {
        const loc = (eventData as { location?: string }).location!.trim();
        (eventData as { location?: string }).location = loc.length
          ? loc
          : undefined;
      }

      // FIX: Ensure date is a string in YYYY-MM-DD format
      // (JSON parsing sometimes converts date strings to Date objects)
      if (req.body.date && req.body.date instanceof Date) {
        eventData.date = req.body.date.toISOString().split("T")[0];
      }

      // Default endDate to date if not provided
      if (!eventData.endDate) {
        eventData.endDate = eventData.date;
      }

      // Normalize timeZone: trim empty to undefined
      if (typeof eventData.timeZone === "string") {
        const tz = eventData.timeZone.trim();
        eventData.timeZone = tz.length ? tz : undefined;
      }

      // Validate required fields (conditional based on format)
      const baseRequiredFields = [
        "title",
        "type",
        "date",
        "endDate",
        "time",
        "endTime",
        "organizer",
        "format",
        "roles",
      ];

      // Add conditional required fields based on format
      const requiredFields = [...baseRequiredFields];
      if (eventData.format === "Online") {
        // Online: location is not required; zoomLink optional
      } else if (eventData.format === "Hybrid Participation") {
        requiredFields.push("location");
        // zoomLink is now optional for hybrid events - can be added later
      } else if (eventData.format === "In-person") {
        requiredFields.push("location");
      }

      const missingFields = requiredFields.filter(
        (field) => !eventData[field as keyof CreateEventRequest]
      );

      if (missingFields.length > 0) {
        res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(", ")}`,
        });
        return;
      }

      // Validate date order and time order (timezone-aware if provided)
      const startDateObj = toInstantFromWallClock(
        eventData.date,
        eventData.time,
        eventData.timeZone
      );
      const endDateObj = toInstantFromWallClock(
        eventData.endDate!,
        eventData.endTime,
        eventData.timeZone
      );
      if (endDateObj < startDateObj) {
        res.status(400).json({
          success: false,
          message: "Event end date/time must be after start date/time.",
        });
        return;
      }

      // Prevent overlaps with existing events (skip in test environment when suppressNotifications=true to allow integration scenarios)
      const skipConflictCheck =
        process.env.NODE_ENV === "test" && eventData.suppressNotifications;
      if (!skipConflictCheck) {
        try {
          const { EventController } = await import("../eventController");
          const conflicts = await EventController.findConflictingEvents(
            eventData.date,
            eventData.time,
            eventData.endDate!,
            eventData.endTime,
            undefined,
            eventData.timeZone
          );
          if (conflicts.length > 0) {
            res.status(409).json({
              success: false,
              message:
                "Event time overlaps with existing event(s). Please choose a different time.",
              data: { conflicts },
            });
            return;
          }
        } catch (e) {
          console.error("Conflict detection failed:", e);
          // Continue (do not block) if conflict check fails unexpectedly
        }
      }

      // Validate date is not in the past (treat YYYY-MM-DD as a wall-date in local time)
      // Avoid constructing Date from YYYY-MM-DD (which is interpreted as UTC in JS)
      const todayLocalStr = (() => {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      })();

      if (eventData.date < todayLocalStr) {
        res.status(400).json({
          success: false,
          message: "Event date must be in the future.",
        });
        return;
      }

      // Validate roles array
      if (!eventData.roles || eventData.roles.length === 0) {
        res.status(400).json({
          success: false,
          message: "Event must have at least one role.",
        });
        return;
      }

      // Enforce server-side role validation
      const roleValidation = validateRoles(
        eventData.roles.map((r) => ({
          name: r.name,
          maxParticipants: r.maxParticipants,
        }))
      );
      if (roleValidation.valid === false) {
        res.status(400).json({
          success: false,
          message: "Invalid roles.",
          errors: roleValidation.errors,
        });
        return;
      }

      // Create roles with UUIDs
      const eventRoles: IEventRole[] = eventData.roles.map(
        (role: IncomingRoleData): IEventRole => ({
          id: uuidv4(),
          name: role.name,
          description: role.description,
          maxParticipants: role.maxParticipants,
          openToPublic: !!role.openToPublic,
          agenda: role.agenda || "",
          startTime: role.startTime,
          endTime: role.endTime,
          // currentSignups is not in IEventRole; signup tracking stored elsewhere
        })
      );

      // Calculate total slots
      const totalSlots = eventRoles.reduce(
        (sum, role) => sum + role.maxParticipants,
        0
      );

      // SIMPLIFIED: Store only essential organizer info, contact details fetched at read time
      // This prevents stale data and reduces storage redundancy
      let processedOrganizerDetails: Array<{
        userId?: unknown;
        name?: string;
        role?: string;
        avatar?: string;
        gender?: "male" | "female";
        email: string;
        phone: string;
      }> = [];
      if (
        eventData.organizerDetails &&
        Array.isArray(eventData.organizerDetails)
      ) {
        processedOrganizerDetails = eventData.organizerDetails.map(
          (organizer: {
            userId?: unknown;
            name?: string;
            role?: string;
            avatar?: string;
            gender?: "male" | "female";
          }) => ({
            userId: organizer.userId, // Essential for lookup
            name: organizer.name, // Display name
            role: organizer.role, // Organizer role
            avatar: organizer.avatar, // Avatar URL if provided
            gender: organizer.gender, // For default avatar selection
            // NOTE: email and phone are now ALWAYS fetched fresh from User collection in getEventById
            email: "placeholder@example.com", // Placeholder - will be replaced at read time
            phone: "Phone not provided", // Placeholder - will be replaced at read time
          })
        );
      }

      // Pre-validate programLabels if provided
      const linkedPrograms: Array<{ _id: unknown }> = [];
      const validatedProgramLabels: mongoose.Types.ObjectId[] = [];
      const rawProgramLabels = (req.body as { programLabels?: unknown })
        .programLabels;
      if (Array.isArray(rawProgramLabels) && rawProgramLabels.length > 0) {
        // Validate each program ID
        const programIds = rawProgramLabels
          .filter((id) => id !== null && id !== undefined && id !== "none")
          .map((id) => String(id))
          .filter((id) => id.trim() !== "");

        // Deduplicate program IDs
        const uniqueIds = Array.from(new Set(programIds));

        for (const pid of uniqueIds) {
          if (!mongoose.Types.ObjectId.isValid(pid)) {
            res.status(400).json({
              success: false,
              message: `Invalid program ID: ${pid}`,
            });
            return;
          }

          // Verify program exists
          const program = await (
            Program as unknown as {
              findById: (id: string) => {
                select: (f: string) => Promise<unknown>;
              };
            }
          )
            .findById(pid)
            .select("_id programType isFree mentors");

          if (!program) {
            res.status(400).json({
              success: false,
              message: `Program not found for ID: ${pid}`,
            });
            return;
          }

          linkedPrograms.push(program as { _id: unknown });
          validatedProgramLabels.push(new mongoose.Types.ObjectId(pid));
        }

        // FOR LEADER USERS: Validate they can only associate programs they have access to
        // (free programs, purchased programs, or programs where they are a mentor)
        if (req.user?.role === "Leader") {
          for (const program of linkedPrograms) {
            const prog = program as {
              _id: unknown;
              isFree?: boolean;
              mentors?: Array<{ userId: unknown }>;
            };

            // Check 1: Is program free?
            if (prog.isFree === true) {
              continue; // Free programs are accessible to everyone
            }

            // Check 2: Is user a mentor of this program?
            const isMentor = prog.mentors?.some(
              (m) => String(m.userId) === String(req.user!._id)
            );
            if (isMentor) {
              continue; // Mentors have access without purchasing
            }

            // Check 3: Has user purchased this program?
            const purchase = await (
              Purchase as unknown as {
                findOne: (q: unknown) => Promise<unknown>;
              }
            ).findOne({
              userId: req.user._id,
              programId: prog._id,
              status: "completed",
            });

            if (!purchase) {
              // User is Leader but has no access to this program
              res.status(403).json({
                success: false,
                message:
                  "You can only associate programs that you have access to (free programs, purchased programs, or programs where you are a mentor).",
                data: {
                  programId: String(prog._id),
                  reason: "no_access",
                },
              });
              return;
            }
          }
        }
      }

      // Helper functions for mentors are no longer needed (removed mentor snapshot logic)

      // Helper to create an Event document from a payload
      const createAndSaveEvent = async (data: CreateEventRequest) => {
        const ev = new Event({
          ...data,
          programLabels: validatedProgramLabels, // Override with validated ObjectIds
          organizerDetails: processedOrganizerDetails,
          roles: eventRoles,
          totalSlots,
          signedUp: 0,
          createdBy: req.user!._id,
          hostedBy: data.hostedBy || "@Cloud Marketplace Ministry",
          status: "upcoming",
        });
        await ev.save();

        // If linked to programs, add event to each program.events array (idempotent)
        if (linkedPrograms.length > 0) {
          for (const program of linkedPrograms) {
            try {
              await (
                Program as unknown as {
                  updateOne: (q: unknown, u: unknown) => Promise<unknown>;
                }
              ).updateOne(
                { _id: program._id },
                { $addToSet: { events: ev._id } }
              );
            } catch (e) {
              console.warn(`Failed to add event to program ${program._id}`, e);
            }
          }
        }
        return ev;
      };

      // Compute first occurrence wall-clock instants for recurring math
      const firstStartInstant = toInstantFromWallClock(
        eventData.date,
        eventData.time,
        eventData.timeZone
      );
      const firstEndInstant = toInstantFromWallClock(
        eventData.endDate!,
        eventData.endTime,
        eventData.timeZone
      );
      const durationMs =
        firstEndInstant.getTime() - firstStartInstant.getTime();

      // Create first event
      const event = await createAndSaveEvent(eventData);

      // Build series if recurring requested
      const { EventController } = await import("../eventController");
      const createdSeriesIds: string[] = [
        EventController.toIdString(event._id),
      ];
      const isValidRecurring =
        !!recurring?.isRecurring &&
        (recurring.frequency === "every-two-weeks" ||
          recurring.frequency === "monthly" ||
          recurring.frequency === "every-two-months") &&
        typeof recurring.occurrenceCount === "number" &&
        recurring.occurrenceCount > 1 &&
        recurring.occurrenceCount <= 24;

      if (isValidRecurring) {
        const originalWeekday = firstStartInstant.getDay(); // 0-6

        const addCycle = (base: Date): Date => {
          const d = new Date(base.getTime());
          if (recurring!.frequency === "every-two-weeks") {
            d.setDate(d.getDate() + 14);
            return d;
          }
          // Monthly or Every Two Months: advance months first
          const monthsToAdd = recurring!.frequency === "monthly" ? 1 : 2;
          const year = d.getFullYear();
          const month = d.getMonth();
          const date = d.getDate();
          const advanced = new Date(d.getTime());
          advanced.setFullYear(year, month + monthsToAdd, date);
          // Adjust forward to same weekday (Mon-Sun)
          while (advanced.getDay() !== originalWeekday) {
            advanced.setDate(advanced.getDate() + 1);
          }
          // Keep time portion the same (hours/minutes preserved by Date ops)
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
          // First try original (offset 0). If conflicts, bump 1..6 days
          for (let offset = 0; offset <= 6; offset++) {
            const candidateStart = new Date(
              desiredStart.getTime() + offset * 24 * 60 * 60 * 1000
            );
            const candidateEnd = new Date(
              candidateStart.getTime() + durationMs
            );
            const wallStart = instantToWallClock(
              candidateStart,
              eventData.timeZone
            );
            const wallEnd = instantToWallClock(
              candidateEnd,
              eventData.timeZone
            );
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
        const totalToCreate = recurring!.occurrenceCount! - 1; // excluding the first one already created
        const desiredStarts: Date[] = [];
        for (let i = 0; i < totalToCreate; i++) {
          const ds =
            i === 0 ? addCycle(prevStart) : addCycle(desiredStarts[i - 1]);
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
            const candidateEnd = new Date(
              scheduledStart.getTime() + durationMs
            );
            const wallStart = instantToWallClock(
              scheduledStart,
              eventData.timeZone
            );
            const wallEnd = instantToWallClock(
              candidateEnd,
              eventData.timeZone
            );
            const nextEventData: CreateEventRequest = {
              ...eventData,
              date: wallStart.date,
              time: wallStart.time,
              endDate: wallEnd.date,
              endTime: wallEnd.time,
            };
            const ev = await createAndSaveEvent(nextEventData);
            createdSeriesIds.push(EventController.toIdString(ev._id));
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
          // Advance by one cycle from the last scheduled start
          const desiredAppend = addCycle(lastStart);
          const { scheduledStart } = await tryScheduleWithBump(desiredAppend);
          if (scheduledStart) {
            const candidateEnd = new Date(
              scheduledStart.getTime() + durationMs
            );
            const wallStart = instantToWallClock(
              scheduledStart,
              eventData.timeZone
            );
            const wallEnd = instantToWallClock(
              candidateEnd,
              eventData.timeZone
            );
            const evData: CreateEventRequest = {
              ...eventData,
              date: wallStart.date,
              time: wallStart.time,
              endDate: wallEnd.date,
              endTime: wallEnd.time,
            };
            const ev = await createAndSaveEvent(evData);
            createdSeriesIds.push(EventController.toIdString(ev._id));
            appended.push({ newStart: scheduledStart, sourceSkipIndex: si });
            lastStart = scheduledStart;
          } else {
            // If even appended cannot be scheduled, we fail silently keeping system invariant
            console.warn(
              "Auto-reschedule: unable to append extra occurrence within 6 days window; series count reduced."
            );
          }
        }

        // If any auto-rescheduling happened, notify creator and co-organizers
        if (moved.length > 0 || skipped.length > 0 || appended.length > 0) {
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
              (s, _idx) => `• Skipped: ${fmt(s.originalStart)}`
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
            targetUserIds.push(EventController.toIdString(req.user!._id));
            if (req.user!.email) {
              const name =
                `${req.user!.firstName || ""} ${
                  req.user!.lastName || ""
                }`.trim() ||
                req.user!.username ||
                "User";
              targetEmails.push({ email: req.user!.email, name });
            }

            // Co-organizers via organizerDetails.userId
            if (
              eventData.organizerDetails &&
              Array.isArray(eventData.organizerDetails)
            ) {
              for (const org of eventData.organizerDetails as Array<{
                userId?: string;
              }>) {
                if (org.userId) {
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
                  id: EventController.toIdString(req.user!._id),
                  firstName: req.user!.firstName || "Unknown",
                  lastName: req.user!.lastName || "User",
                  username: req.user!.username || "unknown",
                  avatar: req.user!.avatar,
                  gender: req.user!.gender || "male",
                  authLevel: req.user!.role,
                  roleInAtCloud: req.user!.roleInAtCloud,
                }
              );
            }

            // Emails to creator and co-organizers
            for (const rec of targetEmails) {
              try {
                await EmailService.sendGenericNotificationEmail(
                  rec.email,
                  rec.name,
                  {
                    subject: `Auto-Rescheduled Occurrences: ${eventData.title}`,
                    contentHtml: content.replace(/\n/g, "<br>"),
                    contentText: content,
                  }
                );
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

      const suppressNotifications =
        typeof (req.body as { suppressNotifications?: unknown })
          .suppressNotifications === "boolean"
          ? Boolean(
              (req.body as { suppressNotifications?: boolean })
                .suppressNotifications
            )
          : false;

      // Create system messages and bell notifications (skipped if suppressed)
      // Recurring: send ONLY ONE announcement for the series (first occurrence)
      if (!suppressNotifications) {
        try {
          console.log("🔔 Creating system messages for new event...");
          logger.info("Creating system messages for new event", undefined, {
            title: eventData.title,
            date: eventData.date,
            time: eventData.time,
          });

          // Get all active users for system message (including event creator)
          const allUsers = await User.find({
            isVerified: true,
            isActive: { $ne: false },
          }).select("_id");

          const allUserIds = allUsers.map((user) =>
            EventController.toIdString(user._id)
          );

          if (allUserIds.length > 0) {
            const isSeries = isValidRecurring;
            const msgTitle = isSeries
              ? `New Recurring Program: ${eventData.title}`
              : `New Event: ${eventData.title}`;
            const freqMap: Record<string, string> = {
              "every-two-weeks": "Every Two Weeks",
              monthly: "Monthly",
              "every-two-months": "Every Two Months",
            };
            const seriesNote = isSeries
              ? `\nThis is a recurring program (${
                  freqMap[recurring!.frequency!]
                }, ${
                  recurring!.occurrenceCount
                } total occurrences including the first). Future events will follow the same weekday per cycle. Visit the system for the full schedule and details.`
              : "";

            await UnifiedMessageController.createTargetedSystemMessage(
              {
                title: msgTitle,
                content: `A new ${isSeries ? "recurring program" : "event"} "${
                  eventData.title
                }" has been created for ${eventData.date} at ${
                  eventData.time
                }. ${eventData.purpose || ""}${seriesNote}`,
                type: "announcement",
                priority: "medium",
                metadata: { eventId: event._id.toString(), kind: "new_event" },
              },
              allUserIds,
              {
                id: EventController.toIdString(req.user!._id),
                firstName: req.user!.firstName || "Unknown",
                lastName: req.user!.lastName || "User",
                username: req.user!.username || "unknown",
                avatar: req.user!.avatar,
                gender: req.user!.gender || "male",
                authLevel: req.user!.role,
                roleInAtCloud: req.user!.roleInAtCloud,
              }
            );

            console.log(
              `✅ System message created successfully for ${allUserIds.length} users`
            );
            logger.info("System message created successfully", undefined, {
              recipients: allUserIds.length,
              isSeries,
              eventId: event._id,
            });
          } else {
            console.log("ℹ️  No active users found for system message");
            logger.info("No active users found for system message");
          }
        } catch (error) {
          console.error(
            "❌ Failed to create system messages for event:",
            error
          );
          logger.error(
            "Failed to create system messages for event",
            error as Error,
            undefined,
            { eventId: event?._id }
          );
          // Continue execution - don't fail event creation if system messages fail
        }
      }

      // Send email notifications to all users - ONLY ONCE for recurring series (skipped if suppressed)
      if (!suppressNotifications) {
        try {
          // Get all active, verified users who want emails (excluding event creator)
          const allUsers = await EmailRecipientUtils.getActiveVerifiedUsers(
            req.user.email
          );

          // Send notifications in parallel but don't wait for all to complete
          // to avoid blocking the response
          const endDate = (eventData as { endDate?: string }).endDate;
          const timeZone = (eventData as { timeZone?: string }).timeZone;
          const emailPromises = allUsers.map(
            (user: { email: string; firstName: string; lastName: string }) =>
              EmailService.sendEventCreatedEmail(
                user.email,
                `${user.firstName} ${user.lastName}`,
                {
                  title: eventData.title,
                  date: eventData.date,
                  endDate,
                  time: eventData.time,
                  endTime: eventData.endTime,
                  location: eventData.location,
                  zoomLink: eventData.zoomLink,
                  organizer: eventData.organizer,
                  purpose: eventData.purpose,
                  format: eventData.format,
                  timeZone,
                  recurringInfo: isValidRecurring
                    ? {
                        frequency: String(recurring!.frequency),
                        occurrenceCount: recurring!.occurrenceCount!,
                      }
                    : undefined,
                }
              ).catch((error) => {
                console.error(
                  `Failed to send event notification to ${user.email}:`,
                  error
                );
                return false; // Continue with other emails even if one fails
              })
          );

          // Process emails in the background
          Promise.all(emailPromises)
            .then(() => {
              // results intentionally ignored
            })
            .catch((error) => {
              console.error(
                "Error processing event notification emails:",
                error
              );
            });
        } catch (emailError) {
          console.error(
            "Error fetching users for event notifications:",
            emailError
          );
          // Don't fail the event creation if email notifications fail
        }
      }

      // Get populated event data for notifications (includes real emails)
      let populatedEvent: unknown;
      try {
        populatedEvent =
          await ResponseBuilderService.buildEventWithRegistrations(
            EventController.toIdString(event._id)
          );
      } catch (populationError) {
        console.error("Error populating event data:", populationError);
        populatedEvent = event; // fallback to raw event
      }
      // Additional safeguard: if population returned null/undefined, fall back to original event
      if (!populatedEvent) {
        populatedEvent = event;
      }

      // Send co-organizer assignment notifications (skipped if suppressed)
      if (!suppressNotifications) {
        try {
          if (
            CreationController.hasOrganizerDetails(populatedEvent) &&
            populatedEvent.organizerDetails &&
            populatedEvent.organizerDetails.length > 0
          ) {
            console.log("🔔 Sending co-organizer assignment notifications...");

            // Get co-organizers (excluding main organizer) using populated event
            const coOrganizers = await EmailRecipientUtils.getEventCoOrganizers(
              populatedEvent as unknown as IEvent
            );

            if (coOrganizers.length > 0) {
              console.log(
                `📧 Found ${coOrganizers.length} co-organizers to notify`
              );

              // Send email notifications to co-organizers
              const coOrganizerEmailPromises = coOrganizers.map(
                async (coOrganizer) => {
                  try {
                    await EmailService.sendCoOrganizerAssignedEmail(
                      coOrganizer.email,
                      {
                        firstName: coOrganizer.firstName,
                        lastName: coOrganizer.lastName,
                      },
                      {
                        title: event.title,
                        date: event.date,
                        time: event.time,
                        location: event.location || "",
                      },
                      {
                        firstName: req.user!.firstName || "Unknown",
                        lastName: req.user!.lastName || "User",
                      }
                    );
                    console.log(
                      `✅ Co-organizer notification sent to ${coOrganizer.email}`
                    );
                    return true;
                  } catch (error) {
                    console.error(
                      `❌ Failed to send co-organizer notification to ${coOrganizer.email}:`,
                      error
                    );
                    return false;
                  }
                }
              );

              // Send system messages to co-organizers (targeted messages)
              const coOrganizerSystemMessagePromises = coOrganizers.map(
                async (coOrganizer) => {
                  try {
                    // Get the user ID for targeted system message
                    const coOrganizerUser = await User.findOne({
                      email: coOrganizer.email,
                    }).select("_id");

                    if (coOrganizerUser) {
                      // Create targeted system message using the new method
                      await UnifiedMessageController.createTargetedSystemMessage(
                        {
                          title: `Co-Organizer Assignment: ${event.title}`,
                          content: `You have been assigned as a co-organizer for the event "${event.title}" scheduled for ${event.date} at ${event.time}. Please review the event details and reach out to the main organizer if you have any questions.`,
                          type: "announcement",
                          priority: "high",
                        },
                        [EventController.toIdString(coOrganizerUser._id)],
                        {
                          id: EventController.toIdString(req.user!._id),
                          firstName: req.user!.firstName || "Unknown",
                          lastName: req.user!.lastName || "User",
                          username: req.user!.username || "unknown",
                          avatar: req.user!.avatar, // Include avatar for proper display
                          gender: req.user!.gender || "male",
                          authLevel: req.user!.role,
                          roleInAtCloud: req.user!.roleInAtCloud,
                        }
                      );

                      console.log(
                        `✅ Co-organizer system message sent to ${coOrganizer.email}`
                      );
                    }
                    return true;
                  } catch (error) {
                    console.error(
                      `❌ Failed to send co-organizer system message to ${coOrganizer.email}:`,
                      error
                    );
                    return false;
                  }
                }
              );

              // Process notifications in the background
              Promise.all([
                ...coOrganizerEmailPromises,
                ...coOrganizerSystemMessagePromises,
              ])
                .then((results) => {
                  console.log(
                    `✅ Processed ${results.length} co-organizer notifications`
                  );
                })
                .catch((error) => {
                  console.error(
                    "Error processing co-organizer notifications:",
                    error
                  );
                });
            } else {
              console.log("ℹ️  No co-organizers found for notifications");
            }
          }
        } catch (coOrganizerError) {
          console.error(
            "Error sending co-organizer notifications:",
            coOrganizerError
          );
          // Don't fail the event creation if co-organizer notifications fail
        }
        // Close suppression block for co-organizer notifications
      }

      // Invalidate event-related caches since new event was created
      await CachePatterns.invalidateEventCache(
        EventController.toIdString(event._id)
      );
      await CachePatterns.invalidateAnalyticsCache();

      // Ensure event object includes an id field for tests expecting data.event.id.
      const serializedEvent = ((): Record<string, unknown> => {
        // If populatedEvent is a Mongoose document with toJSON, call it; otherwise return as-is.
        if (
          populatedEvent &&
          typeof (populatedEvent as Record<string, unknown>).toJSON ===
            "function"
        ) {
          const docJson = (
            populatedEvent as { toJSON: () => Record<string, unknown> }
          ).toJSON();
          if (!docJson.id && docJson._id) {
            docJson.id = docJson._id.toString();
          }
          return docJson;
        }
        if (populatedEvent && typeof populatedEvent === "object") {
          // Mutate in place so unit tests comparing by object identity still pass
          const plain: Record<string, unknown> = populatedEvent as Record<
            string,
            unknown
          >;
          if (!plain.id && plain._id) {
            plain.id = plain._id.toString();
          }
          if (!plain.id) {
            plain.id = event._id.toString();
          }
          return plain;
        }
        return populatedEvent as Record<string, unknown>;
      })();
      res.status(201).json({
        success: true,
        message: "Event created successfully!",
        data: {
          event: serializedEvent,
          series: isValidRecurring ? createdSeriesIds : undefined,
        },
      });
    } catch (error: unknown) {
      console.error("Create event error:", error);
      CorrelatedLogger.fromRequest(req, "EventController").error(
        "createEvent failed",
        error as Error
      );

      if (
        typeof error === "object" &&
        error !== null &&
        (error as { name?: unknown }).name === "ValidationError"
      ) {
        const validationErrors = Object.values(
          (error as { errors: Record<string, { message: string }> }).errors
        ).map((err) => err.message);
        res.status(400).json({
          success: false,
          message: "Validation failed.",
          errors: validationErrors,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Failed to create event.",
      });
    }
  }
}
