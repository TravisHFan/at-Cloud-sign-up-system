import { Request, Response } from "express";
import { Event, Registration, User, IEvent, IEventRole } from "../models";
import { PERMISSIONS, hasPermission } from "../utils/roleUtils";
import { EmailRecipientUtils } from "../utils/emailRecipientUtils";
import { v4 as uuidv4 } from "uuid";
import mongoose, { FilterQuery, Types } from "mongoose";
import { EmailService } from "../services/infrastructure/emailService";
import { socketService } from "../services/infrastructure/SocketService";
// import { RegistrationQueryService } from "../services/RegistrationQueryService";
import { ResponseBuilderService } from "../services/ResponseBuilderService";
import { UnifiedMessageController } from "./unifiedMessageController";
import { lockService } from "../services/LockService";
import { CachePatterns } from "../services";
import { getEventTemplates } from "../config/eventTemplates";
import { TrioNotificationService } from "../services/notifications/TrioNotificationService";
import { formatActorDisplay } from "../utils/systemMessageFormatUtils";

/**
 * Capacity semantics (important):
 *
 * - This controller intentionally performs capacity checks using USER-ONLY counts
 *   for sign-up/move/assign flows. Historical behavior and tests depend on this
 *   exact semantics and on specific error precedence under application locks.
 * - Guest flows use CapacityService (with includeGuests=true by default) inside
 *   the guest controller and in read-model helpers like RegistrationQueryService
 *   where safe, without changing EventController behavior.
 * - Do not migrate EventController to include guest counts unless explicitly
 *   requested and the corresponding unit/integration tests are updated in lockstep.
 */

// Interface for creating events (matches frontend EventData structure)
interface CreateEventRequest {
  title: string;
  type: string;
  date: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD (defaults to date)
  time: string; // HH:MM
  endTime: string; // HH:MM
  location: string;
  organizer: string;
  organizerDetails?: Array<{
    name: string;
    role: string;
    email: string;
    phone: string;
    avatar?: string;
    gender?: "male" | "female";
  }>;
  hostedBy?: string;
  purpose: string;
  agenda?: string;
  format: string;
  disclaimer?: string;
  roles: Array<{
    name: string;
    description: string;
    maxParticipants: number;
  }>;
  isHybrid?: boolean;
  zoomLink?: string;
  meetingId?: string;
  passcode?: string;
  requirements?: string;
  materials?: string;
  timeZone?: string; // IANA timezone of the event times
  workshopGroupTopics?: {
    A?: string;
    B?: string;
    C?: string;
    D?: string;
    E?: string;
    F?: string;
  };
}

// Interface for event signup
interface EventSignupRequest {
  roleId: string;
  notes?: string;
  specialRequirements?: string;
}

export class EventController {
  // Safely convert various ID-like values (ObjectId, string, etc.) to string
  private static toIdString(val: unknown): string {
    if (typeof val === "string") return val;
    if (
      val &&
      typeof (val as { toString?: () => string }).toString === "function"
    ) {
      try {
        return (val as { toString: () => string }).toString();
      } catch {
        // fall back
      }
    }
    return String(val);
  }

  // Narrow an unknown event-like object that may carry organizerDetails
  private static hasOrganizerDetails(
    e: unknown
  ): e is { organizerDetails?: Array<unknown> } {
    return (
      typeof e === "object" &&
      e !== null &&
      Array.isArray((e as { organizerDetails?: unknown }).organizerDetails)
    );
  }
  // Convert a wall-clock date+time (YYYY-MM-DD, HH:mm) in a given IANA timeZone to a UTC instant.
  private static toInstantFromWallClock(
    date: string,
    time: string,
    timeZone?: string
  ): Date {
    const [y, mo, d] = date.split("-").map((v) => parseInt(v, 10));
    const [hh, mi] = time.split(":").map((v) => parseInt(v, 10));
    if (!timeZone) {
      const local = new Date();
      local.setFullYear(y, mo - 1, d);
      local.setHours(hh, mi, 0, 0);
      return local;
    }
    const target = {
      year: String(y).padStart(4, "0"),
      month: String(mo).padStart(2, "0"),
      day: String(d).padStart(2, "0"),
      hour: String(hh).padStart(2, "0"),
      minute: String(mi).padStart(2, "0"),
    } as const;
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const base = Date.UTC(y, mo - 1, d, hh, mi, 0, 0);
    const matches = (ts: number) => {
      const parts = fmt
        .formatToParts(ts)
        .reduce<Record<string, string>>((acc, p) => {
          if (p.type !== "literal") acc[p.type] = p.value;
          return acc;
        }, {});
      return (
        parts.year === target.year &&
        parts.month === target.month &&
        parts.day === target.day &&
        parts.hour === target.hour &&
        parts.minute === target.minute
      );
    };
    let found: Date | null = null;
    const stepMs = 15 * 60 * 1000;
    const rangeMs = 24 * 60 * 60 * 1000;
    for (let offset = -rangeMs; offset <= rangeMs; offset += stepMs) {
      const ts = base + offset;
      if (matches(ts)) {
        found = new Date(ts);
        break;
      }
    }
    if (found) return found;

    // Fallback: If no exact wall-clock match (e.g., during DST spring-forward when
    // the local time doesn't exist), round FORWARD to the next representable
    // wall-clock instant in the given time zone. This maps e.g. 02:30 -> 03:00
    // on the spring-forward day in America/Los_Angeles.
    const wallParts = (ts: number) => {
      const parts = fmt
        .formatToParts(ts)
        .reduce<Record<string, string>>((acc, p) => {
          if (p.type !== "literal") acc[p.type] = p.value;
          return acc;
        }, {});
      return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        time: `${parts.hour}:${parts.minute}`,
      };
    };
    const cmp = (
      a: { date: string; time: string },
      b: { date: string; time: string }
    ) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : a.time.localeCompare(b.time);

    const targetWall = {
      date: `${target.year}-${target.month}-${target.day}`,
      time: `${target.hour}:${target.minute}`,
    };
    // Search forward minute-by-minute up to 24 hours to find the first representable wall time >= target
    const minute = 60 * 1000;
    for (let ts = base; ts <= base + 24 * 60 * minute; ts += minute) {
      const wp = wallParts(ts);
      if (cmp(wp, targetWall) >= 0) {
        return new Date(ts);
      }
    }

    // As a last resort, return the base UTC time (best-effort)
    return new Date(base);
  }

  // Format a UTC instant into wall-clock strings in a given IANA timeZone.
  private static instantToWallClock(
    instant: Date,
    timeZone?: string
  ): { date: string; time: string } {
    if (!timeZone) {
      const yyyy = instant.getFullYear();
      const mm = String(instant.getMonth() + 1).padStart(2, "0");
      const dd = String(instant.getDate()).padStart(2, "0");
      const hh = String(instant.getHours()).padStart(2, "0");
      const mi = String(instant.getMinutes()).padStart(2, "0");
      return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}` };
    }
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt
      .formatToParts(instant)
      .reduce<Record<string, string>>((acc, p) => {
        if (p.type !== "literal") acc[p.type] = p.value;
        return acc;
      }, {});
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}`,
    };
  }
  // Determine if a new timespan overlaps with any existing event timespan.
  private static async findConflictingEvents(
    startDate: string,
    startTime: string,
    endDate: string,
    endTime: string,
    excludeEventId?: string,
    candidateTimeZone?: string
  ): Promise<Array<{ id: string; title: string }>> {
    // Narrow candidates by date range first (string YYYY-MM-DD works lexicographically)
    const dateRangeFilter: FilterQuery<IEvent> = {
      status: { $ne: "cancelled" },
      date: { $lte: endDate },
      endDate: { $gte: startDate },
    };
    if (excludeEventId && mongoose.Types.ObjectId.isValid(excludeEventId)) {
      dateRangeFilter._id = {
        $ne: new mongoose.Types.ObjectId(excludeEventId),
      };
    }
    type CandidateEvent = {
      _id: Types.ObjectId;
      title: string;
      date: string;
      endDate?: string;
      time: string;
      endTime: string;
      timeZone?: string;
    };

    // Support both real Mongoose chains and unit-test mocks that return arrays
    type Chain =
      | {
          select?: (fields: string) => unknown;
          lean?: () => Promise<unknown>;
        }
      | Promise<unknown>
      | unknown;
    const baseQuery = (
      Event as unknown as { find: (q: unknown) => Chain }
    ).find(dateRangeFilter);
    let chained: Chain = baseQuery;
    if (
      chained &&
      typeof (chained as { select?: unknown }).select === "function"
    ) {
      chained = (chained as { select: (fields: string) => unknown }).select(
        "_id title date endDate time endTime timeZone"
      ) as Chain;
    }
    let candidates: CandidateEvent[];
    if (chained && typeof (chained as { lean?: unknown }).lean === "function") {
      candidates = (await (
        chained as { lean: () => Promise<unknown> }
      ).lean()) as CandidateEvent[];
    } else {
      candidates = (await (chained as Promise<unknown>)) as CandidateEvent[];
    }

    const newStart = EventController.toInstantFromWallClock(
      startDate,
      startTime,
      candidateTimeZone
    );
    const newEnd = EventController.toInstantFromWallClock(
      endDate,
      endTime,
      candidateTimeZone
    );

    const conflicts: Array<{ id: string; title: string }> = [];
    for (const ev of candidates) {
      const evStart = EventController.toInstantFromWallClock(
        ev.date,
        ev.time,
        ev.timeZone
      );
      const evEnd = EventController.toInstantFromWallClock(
        ev.endDate || ev.date,
        ev.endTime,
        ev.timeZone
      );
      // Overlap if newStart < evEnd AND newEnd > evStart (boundaries allowed to touch)
      if (newStart < evEnd && newEnd > evStart) {
        conflicts.push({ id: ev._id.toString(), title: ev.title });
      }
    }
    return conflicts;
  }

  // Public endpoint to check for time conflicts (supports point or span checks)
  static async checkTimeConflict(req: Request, res: Response): Promise<void> {
    try {
      const pickStr = (v: unknown): string | undefined =>
        typeof v === "string"
          ? v
          : Array.isArray(v) && typeof v[0] === "string"
          ? v[0]
          : undefined;
      const startDate = pickStr(req.query.startDate);
      const startTime = pickStr(req.query.startTime);
      const endDate = pickStr(req.query.endDate);
      const endTime = pickStr(req.query.endTime);
      const excludeId = pickStr(req.query.excludeId);
      const mode = pickStr(req.query.mode);
      const timeZone = pickStr(req.query.timeZone);

      if (!startDate || !startTime) {
        res.status(400).json({
          success: false,
          message: "startDate and startTime are required",
        });
        return;
      }

      // Point-in-interval check if end not provided
      const effectiveEndDate = endDate || startDate;
      const effectiveEndTime = endTime || startTime;

      // If explicitly point mode, nudge end time by +1 minute for detection using event's timeZone.
      let checkEndDate = effectiveEndDate as string;
      let checkEndTime = effectiveEndTime as string;
      if (!endDate || mode === "point") {
        const pt = EventController.toInstantFromWallClock(
          startDate,
          startTime,
          timeZone
        );
        const plus = new Date(pt.getTime() + 60 * 1000);
        const wc = EventController.instantToWallClock(plus, timeZone);
        checkEndDate = wc.date;
        checkEndTime = wc.time;
      }

      const conflicts = await EventController.findConflictingEvents(
        startDate,
        startTime,
        checkEndDate,
        checkEndTime,
        excludeId,
        timeZone
      );

      res.status(200).json({
        success: true,
        data: { conflict: conflicts.length > 0, conflicts },
      });
    } catch (error) {
      console.error("checkTimeConflict error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to check time conflicts.",
      });
    }
  }
  // Validate provided roles against the canonical templates for the given event type
  private static validateRolesAgainstTemplates(
    eventType: string,
    roles: Array<{ name: string; maxParticipants: number }>
  ): { valid: true } | { valid: false; errors: string[] } {
    const { allowedTypes, templates } = getEventTemplates();

    // Quick guard: ensure eventType is allowed (in addition to schema-level enum)
    if (!allowedTypes.some((t) => t === eventType)) {
      return {
        valid: false,
        errors: [`Event type must be one of: ${allowedTypes.join(", ")}`],
      };
    }

    const template = templates[eventType as keyof typeof templates] || [];
    const templateMap = new Map<string, number>(
      template.map((r) => [r.name, r.maxParticipants])
    );

    const errors: string[] = [];
    const seenNames = new Set<string>();

    for (const role of roles) {
      const roleName = (role?.name || "").trim();
      const max = role?.maxParticipants;
      if (!roleName) {
        errors.push("Role name is required");
        continue;
      }
      if (seenNames.has(roleName)) {
        errors.push(`Duplicate role not allowed: ${roleName}`);
      } else {
        seenNames.add(roleName);
      }

      if (!templateMap.has(roleName)) {
        errors.push(
          `Role "${roleName}" is not allowed for event type "${eventType}"`
        );
        continue;
      }
      const templateMax = templateMap.get(roleName)!;
      const maxAllowed = templateMax * 3; // Allow up to 3x the template value
      if (typeof max !== "number" || Number.isNaN(max) || max < 1) {
        errors.push(
          `Role "${roleName}": maxParticipants must be a positive integer`
        );
        continue;
      }
      if (max > maxAllowed) {
        errors.push(
          `Role "${roleName}" exceeds maximum allowed (${maxAllowed}) for ${eventType}`
        );
      }
    }

    if (errors.length > 0) return { valid: false, errors };
    return { valid: true };
  }
  // Read-only: return allowed event types and role templates
  static async getEventTemplates(req: Request, res: Response): Promise<void> {
    try {
      const payload = getEventTemplates();
      res.status(200).json({ success: true, data: payload });
    } catch {
      res
        .status(500)
        .json({ success: false, message: "Failed to load event templates." });
    }
  }
  /**
   * Helper function to check if a user is an organizer (creator or co-organizer) of an event
   */
  private static isEventOrganizer(
    event: {
      createdBy?: Types.ObjectId | string;
      organizerDetails?: Array<{ userId?: Types.ObjectId | string }>;
    },
    userId: string
  ): boolean {
    // Check if user is the event creator
    if (event.createdBy && event.createdBy.toString() === userId.toString()) {
      return true;
    }

    // Check if user is a co-organizer
    if (event.organizerDetails && event.organizerDetails.length > 0) {
      return event.organizerDetails.some(
        (organizer) => organizer.userId?.toString() === userId.toString()
      );
    }

    return false;
  }

  // Helper method to determine event status based on date and time
  private static getEventStatus(
    eventDate: string,
    eventEndDateOrTime: string,
    eventTimeOrEndTime: string,
    maybeEventEndTime?: string
  ): "upcoming" | "ongoing" | "completed" {
    // Backward compatibility: support legacy 3-arg calls as (date, time, endTime)
    let eventEndDate: string;
    let eventTime: string;
    let eventEndTime: string;

    if (typeof maybeEventEndTime === "undefined") {
      // Old signature: (date, time, endTime) -> endDate defaults to date
      eventEndDate = eventDate;
      eventTime = eventEndDateOrTime; // actually time
      eventEndTime = eventTimeOrEndTime; // actually endTime
    } else {
      // New signature: (date, endDate, time, endTime)
      eventEndDate = eventEndDateOrTime;
      eventTime = eventTimeOrEndTime;
      eventEndTime = maybeEventEndTime;
    }

    const now = new Date();
    const eventStart = new Date(`${eventDate}T${eventTime}`);
    const eventEnd = new Date(`${eventEndDate}T${eventEndTime}`);

    if (now < eventStart) {
      return "upcoming";
    } else if (now >= eventStart && now <= eventEnd) {
      return "ongoing";
    } else {
      return "completed";
    }
  }

  // Helper method to update event status if needed
  private static async updateEventStatusIfNeeded(event: {
    _id: Types.ObjectId;
    date: string;
    endDate?: string;
    time: string;
    endTime: string;
    status: string;
  }): Promise<void> {
    const newStatus = EventController.getEventStatus(
      event.date,
      event.endDate || event.date,
      event.time,
      event.endTime
    );

    if (event.status !== newStatus && event.status !== "cancelled") {
      await Event.findByIdAndUpdate(event._id, { status: newStatus });
      event.status = newStatus; // Update the in-memory object too

      // Invalidate caches after status update
      await CachePatterns.invalidateEventCache(event._id.toString());
      await CachePatterns.invalidateAnalyticsCache();
    }
  }

  // Helper method to populate fresh organizer contact information
  private static async populateFreshOrganizerContacts(
    organizerDetails: Array<{
      userId?: Types.ObjectId | string;
      toObject: () => Record<string, unknown>;
      email?: string;
      phone?: string;
      name?: string;
      avatar?: string;
    }>
  ): Promise<Array<Record<string, unknown>>> {
    if (!organizerDetails || organizerDetails.length === 0) {
      return [];
    }

    return Promise.all(
      organizerDetails.map(async (organizer) => {
        if (organizer.userId) {
          // Get fresh contact info from User collection
          const user = await User.findById(organizer.userId).select(
            "email phone firstName lastName avatar"
          );
          if (user) {
            return {
              ...organizer.toObject(),
              email: user.email, // Always fresh from User collection
              phone: user.phone || "Phone not provided", // Always fresh
              name: `${user.firstName} ${user.lastName}`, // Ensure name is current
              avatar: user.avatar || organizer.avatar, // Use latest avatar
            };
          }
        }
        // If no userId or user not found, return stored data
        return organizer.toObject();
      })
    );
  }

  // Batch update all event statuses (can be called periodically)
  static async updateAllEventStatuses(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const updatedCount = await EventController.updateAllEventStatusesHelper();

      res.status(200).json({
        success: true,
        message: `Updated ${updatedCount} event statuses.`,
        data: { updatedCount },
      });
    } catch (error: unknown) {
      console.error("Update event statuses error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update event statuses.",
      });
    }
  }

  // Helper method to update all event statuses without sending response
  private static async updateAllEventStatusesHelper(): Promise<number> {
    // Be robust to test doubles that don't support chaining
    type StatusChain =
      | {
          select?: (fields: string) => unknown;
          lean?: () => Promise<unknown>;
        }
      | Promise<unknown>
      | unknown;
    const findRes = (
      Event as unknown as { find: (q: unknown) => StatusChain }
    ).find({ status: { $ne: "cancelled" } });
    let events: Array<{
      _id: Types.ObjectId;
      date: string;
      endDate?: string;
      time: string;
      endTime: string;
      status: string;
    }> = [] as Array<{
      _id: Types.ObjectId;
      date: string;
      endDate?: string;
      time: string;
      endTime: string;
      status: string;
    }>;
    if (
      findRes &&
      typeof (findRes as { select?: unknown }).select === "function"
    ) {
      try {
        const maybe = (
          findRes as { select: (fields: string) => unknown }
        ).select("_id date endDate time endTime status");
        // Prefer lean when available to reduce overhead
        if (maybe && typeof (maybe as { lean?: unknown }).lean === "function") {
          events = (await (
            maybe as { lean: () => Promise<unknown> }
          ).lean()) as Array<{
            _id: Types.ObjectId;
            date: string;
            endDate?: string;
            time: string;
            endTime: string;
            status: string;
          }>;
        } else {
          events = (await maybe) as Array<{
            _id: Types.ObjectId;
            date: string;
            endDate?: string;
            time: string;
            endTime: string;
            status: string;
          }>;
        }
      } catch {
        // Fallback to awaiting the original query/mocked value
        events = (await (findRes as Promise<unknown>)) as Array<{
          _id: Types.ObjectId;
          date: string;
          endDate?: string;
          time: string;
          endTime: string;
          status: string;
        }>;
      }
    } else {
      // Mocked implementation might return an array directly
      events = (await (findRes as Promise<unknown>)) as Array<{
        _id: Types.ObjectId;
        date: string;
        endDate?: string;
        time: string;
        endTime: string;
        status: string;
      }>;
    }
    let updatedCount = 0;

    for (const event of events) {
      const newStatus = EventController.getEventStatus(
        event.date,
        (event.endDate as unknown as string) || event.date,
        event.time,
        event.endTime
      );

      if (event.status !== newStatus) {
        await Event.findByIdAndUpdate(event._id, { status: newStatus });
        updatedCount++;

        // Invalidate caches after status update
        await CachePatterns.invalidateEventCache(event._id.toString());
        await CachePatterns.invalidateAnalyticsCache();
      }
    }

    return updatedCount;
  }

  // Recalculate signup counts for all events
  static async recalculateSignupCounts(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const updatedCount =
        await EventController.recalculateSignupCountsHelper();

      res.status(200).json({
        success: true,
        message: `Recalculated signup counts for ${updatedCount} events.`,
        data: { updatedCount },
      });
    } catch (error: unknown) {
      console.error("Recalculate signup counts error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to recalculate signup counts.",
      });
    }
  }

  // Helper method to recalculate signup counts for all events
  private static async recalculateSignupCountsHelper(): Promise<number> {
    const events = await Event.find({});
    let updatedCount = 0;

    for (const event of events) {
      const currentSignedUp = event.signedUp || 0;
      const calculatedSignedUp = await event.calculateSignedUp();

      if (currentSignedUp !== calculatedSignedUp) {
        await Event.findByIdAndUpdate(event._id, {
          signedUp: calculatedSignedUp,
        });
        updatedCount++;

        // Invalidate caches after signup count update
        await CachePatterns.invalidateEventCache(
          EventController.toIdString(event._id)
        );
        await CachePatterns.invalidateAnalyticsCache();
      }
    }

    return updatedCount;
  }

  // Get all events with filtering and pagination
  static async getAllEvents(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        type,
        search,
        sortBy = "date",
        sortOrder = "asc",
        minParticipants,
        maxParticipants,
        category,
        startDate,
        endDate,
      } = req.query;

      const pageNumber = parseInt(page as string);
      const limitNumber = parseInt(limit as string);

      // Create cache key based on query parameters
      const cacheKey = `events-list:${JSON.stringify({
        page: pageNumber,
        limit: limitNumber,
        status,
        type,
        search,
        sortBy,
        sortOrder,
        minParticipants,
        maxParticipants,
        category,
        startDate,
        endDate,
      })}`;

      const result = await CachePatterns.getEventListing(cacheKey, async () => {
        const skip = (pageNumber - 1) * limitNumber;

        // Build filter object
        const filter: Record<string, unknown> & {
          date?: { $gte?: string; $lte?: string };
          totalSlots?: { $gte?: number; $lte?: number };
        } = {};

        // For non-status filters, apply them directly
        if (type) {
          filter.type = type;
        }

        if (category) {
          filter.category = category;
        }

        // Date range filtering
        if (startDate || endDate) {
          filter.date = {};
          if (startDate) {
            filter.date.$gte = String(startDate);
          }
          if (endDate) {
            filter.date.$lte = String(endDate);
          }
        }

        // Participant capacity filtering
        if (minParticipants) {
          filter.totalSlots = { $gte: parseInt(minParticipants as string) };
        }
        if (maxParticipants) {
          if (filter.totalSlots) {
            filter.totalSlots.$lte = parseInt(maxParticipants as string);
          } else {
            filter.totalSlots = { $lte: parseInt(maxParticipants as string) };
          }
        }

        // Text search
        if (search) {
          filter.$text = { $search: search as string };
        }

        // Build sort object
        const sort: Record<string, 1 | -1> = {};
        sort[String(sortBy)] = sortOrder === "desc" ? -1 : 1;

        // If status filtering is requested, we need to handle it differently
        // First, update all event statuses to ensure they're current
        if (status) {
          await EventController.updateAllEventStatusesHelper();
          // Now we can filter by the updated status
          filter.status = status;
        }

        // Get events with pagination and status filter applied
        // Support mocks that do not implement the full Mongoose chain
        let events: unknown[] = [];
        try {
          const base = (
            Event as unknown as { find: (q: unknown) => unknown }
          ).find(filter) as unknown;
          if (
            base &&
            typeof (base as { populate?: unknown }).populate === "function"
          ) {
            const p = (
              base as {
                populate: (path: string, select: string) => unknown;
              }
            ).populate("createdBy", "username firstName lastName avatar");
            const s =
              typeof (p as { sort?: unknown }).sort === "function"
                ? (p as { sort: (s: unknown) => unknown }).sort(sort)
                : p;
            const sk =
              typeof (s as { skip?: unknown }).skip === "function"
                ? (s as { skip: (n: number) => unknown }).skip(skip)
                : s;
            const li =
              typeof (sk as { limit?: unknown }).limit === "function"
                ? (sk as { limit: (n: number) => Promise<unknown[]> }).limit(
                    limitNumber
                  )
                : (sk as Promise<unknown[]>);
            events = (await (li as Promise<unknown[]>)) as unknown[];
          } else {
            // If not chainable (unit tests), return empty set and rely on builder/count stubs
            events = ((await (base as Promise<unknown[]>)) as unknown[]) || [];
          }
        } catch {
          events = [];
        }

        // If no status filter was applied, still update individual event statuses
        if (!status) {
          for (const event of events as Array<Record<string, unknown>>) {
            await EventController.updateEventStatusIfNeeded(
              event as unknown as {
                _id: Types.ObjectId;
                date: string;
                endDate?: string;
                time: string;
                endTime: string;
                status: string;
              }
            );
          }
        }

        // FIX: Use ResponseBuilderService to include accurate registration counts
        // This ensures frontend event cards show correct signup statistics
        console.log(
          `🔍 [getAllEvents] Building ${events.length} events with registration data`
        );
        const eventsWithRegistrations =
          await ResponseBuilderService.buildEventsWithRegistrations(
            events as Array<{ _id: Types.ObjectId }>
          );

        console.log(
          `✅ [getAllEvents] Successfully built ${eventsWithRegistrations.length} events with registration counts`
        );

        const totalEvents = await Event.countDocuments(filter);
        const totalPages = Math.ceil(totalEvents / limitNumber);

        return {
          events: eventsWithRegistrations,
          pagination: {
            currentPage: pageNumber,
            totalPages,
            totalEvents,
            hasNext: pageNumber < totalPages,
            hasPrev: pageNumber > 1,
          },
        };
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      console.error("Get events error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve events.",
      });
    }
  }

  // Get single event by ID
  static async getEventById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid event ID.",
        });
        return;
      }

      const event = await Event.findById(id).populate(
        "createdBy",
        "username firstName lastName avatar"
      );

      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found.",
        });
        return;
      }

      // Update event status based on current time
      await EventController.updateEventStatusIfNeeded(event);

      // FIX: Use ResponseBuilderService to include registration data
      // This ensures frontend shows current registrations for each role
      console.log(
        `🔍 [getEventById] Building event data with registrations for event ${id}`
      );
      const eventWithRegistrations =
        await ResponseBuilderService.buildEventWithRegistrations(
          id,
          req.user ? EventController.toIdString(req.user._id) : undefined
        );

      if (!eventWithRegistrations) {
        res.status(404).json({
          success: false,
          message: "Event not found or failed to build registration data.",
        });
        return;
      }

      console.log(
        `✅ [getEventById] Successfully built event data with ${eventWithRegistrations.roles.length} roles`
      );
      eventWithRegistrations.roles.forEach((role, index) => {
        console.log(
          `   Role ${index + 1}: ${role.name} - ${role.currentCount}/${
            role.maxParticipants
          } registered`
        );
      });

      res.status(200).json({
        success: true,
        data: { event: eventWithRegistrations },
      });
    } catch (error: unknown) {
      console.error("Get event error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve event.",
      });
    }
  }

  // Create new event
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
        "purpose",
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
      const startDateObj = EventController.toInstantFromWallClock(
        eventData.date,
        eventData.time,
        eventData.timeZone
      );
      const endDateObj = EventController.toInstantFromWallClock(
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

      // Prevent overlaps with existing events
      try {
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

      // Enforce server-side role validation against templates
      const roleValidation = EventController.validateRolesAgainstTemplates(
        eventData.type,
        eventData.roles.map((r) => ({
          name: r.name,
          maxParticipants: r.maxParticipants,
        }))
      );
      if (roleValidation.valid === false) {
        res.status(400).json({
          success: false,
          message: "Invalid roles for selected event type.",
          errors: roleValidation.errors,
        });
        return;
      }

      // Create roles with UUIDs
      const eventRoles: IEventRole[] = eventData.roles.map((role) => ({
        id: uuidv4(),
        name: role.name,
        description: role.description,
        maxParticipants: role.maxParticipants,
        currentSignups: [],
      }));

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

      // Helper to create an Event document from a payload
      const createAndSaveEvent = async (data: CreateEventRequest) => {
        const ev = new Event({
          ...data,
          organizerDetails: processedOrganizerDetails,
          roles: eventRoles,
          totalSlots,
          signedUp: 0,
          createdBy: req.user!._id,
          hostedBy: data.hostedBy || "@Cloud Marketplace Ministry",
          status: "upcoming",
        });
        await ev.save();
        return ev;
      };

      // Compute duration from first event wall-clock span
      const firstStartInstant = EventController.toInstantFromWallClock(
        eventData.date,
        eventData.time,
        eventData.timeZone
      );
      const firstEndInstant = EventController.toInstantFromWallClock(
        eventData.endDate!,
        eventData.endTime,
        eventData.timeZone
      );
      const durationMs =
        firstEndInstant.getTime() - firstStartInstant.getTime();

      // Create first event
      const event = await createAndSaveEvent(eventData);

      // Build series if recurring requested
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
            const wallStart = EventController.instantToWallClock(
              candidateStart,
              eventData.timeZone
            );
            const wallEnd = EventController.instantToWallClock(
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
            const wallStart = EventController.instantToWallClock(
              scheduledStart,
              eventData.timeZone
            );
            const wallEnd = EventController.instantToWallClock(
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
            const wallStart = EventController.instantToWallClock(
              scheduledStart,
              eventData.timeZone
            );
            const wallEnd = EventController.instantToWallClock(
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

      // Create system messages and bell notifications
      // Recurring: send ONLY ONE announcement for the series (first occurrence)
      try {
        console.log("🔔 Creating system messages for new event...");

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
              }" has been created for ${eventData.date} at ${eventData.time}. ${
                eventData.purpose || ""
              }${seriesNote}`,
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
        } else {
          console.log("ℹ️  No active users found for system message");
        }
      } catch (error) {
        console.error("❌ Failed to create system messages for event:", error);
        // Continue execution - don't fail event creation if system messages fail
      }

      // Send email notifications to all users - ONLY ONCE for recurring series
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
            console.error("Error processing event notification emails:", error);
          });
      } catch (emailError) {
        console.error(
          "Error fetching users for event notifications:",
          emailError
        );
        // Don't fail the event creation if email notifications fail
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

      // Send co-organizer assignment notifications
      try {
        if (
          EventController.hasOrganizerDetails(populatedEvent) &&
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

      // Invalidate event-related caches since new event was created
      await CachePatterns.invalidateEventCache(
        EventController.toIdString(event._id)
      );
      await CachePatterns.invalidateAnalyticsCache();

      res.status(201).json({
        success: true,
        message: "Event created successfully!",
        data: {
          event: populatedEvent,
          series: isValidRecurring ? createdSeriesIds : undefined,
        },
      });
    } catch (error: unknown) {
      console.error("Create event error:", error);

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

  // Update event
  static async updateEvent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid event ID.",
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const event = await Event.findById(id);

      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found.",
        });
        return;
      }

      // Check permissions
      const canEditAnyEvent = hasPermission(
        req.user.role,
        PERMISSIONS.EDIT_ANY_EVENT
      );
      const canEditOwnEvent = hasPermission(
        req.user.role,
        PERMISSIONS.EDIT_OWN_EVENT
      );
      const isEventOrganizer = EventController.isEventOrganizer(
        event,
        EventController.toIdString(req.user._id)
      );

      if (!canEditAnyEvent && !(canEditOwnEvent && isEventOrganizer)) {
        res.status(403).json({
          success: false,
          message:
            "Insufficient permissions to edit this event. You must be the event creator or a co-organizer.",
        });
        return;
      }

      // Update event data
      const updateData: Record<string, unknown> = { ...req.body };

      // Normalize endDate if provided; default will be handled by schema if absent
      if (typeof updateData.endDate === "string") {
        updateData.endDate = updateData.endDate.trim();
      }

      // If time-related fields are being updated, ensure no overlap
      const willUpdateStart =
        typeof updateData.date === "string" ||
        typeof updateData.time === "string";
      const willUpdateEnd =
        typeof updateData.endDate === "string" ||
        typeof updateData.endTime === "string";
      if (willUpdateStart || willUpdateEnd) {
        const newStartDate = (updateData.date as string) || event.date;
        const newStartTime = (updateData.time as string) || event.time;
        const newEndDate =
          (updateData.endDate as string) || event.endDate || newStartDate;
        const newEndTime =
          (updateData.endTime as string) || event.endTime || newStartTime;

        // Determine effective timezone for the event (updated or existing)
        const effectiveTz =
          (updateData.timeZone as string | undefined) || event.timeZone;

        const startObj = EventController.toInstantFromWallClock(
          newStartDate,
          newStartTime,
          effectiveTz
        );
        const endObj = EventController.toInstantFromWallClock(
          newEndDate,
          newEndTime,
          effectiveTz
        );
        if (endObj < startObj) {
          res.status(400).json({
            success: false,
            message: "Event end date/time must be after start date/time.",
          });
          return;
        }

        const conflicts = await EventController.findConflictingEvents(
          newStartDate,
          newStartTime,
          newEndDate,
          newEndTime,
          id,
          effectiveTz
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
      }

      // Normalize virtual meeting fields similar to createEvent
      // Determine effective format after update
      const effectiveFormat = updateData.format || event.format;
      if (effectiveFormat === "In-person") {
        // Ensure these are cleared when switching to In-person
        updateData.zoomLink = undefined;
        updateData.meetingId = undefined;
        updateData.passcode = undefined;
      } else {
        if (typeof updateData.zoomLink === "string") {
          const v = (updateData.zoomLink as string).trim();
          updateData.zoomLink = v.length ? v : undefined;
        }
        if (typeof updateData.meetingId === "string") {
          const v = (updateData.meetingId as string).trim();
          updateData.meetingId = v.length ? v : undefined;
        }
        if (typeof updateData.passcode === "string") {
          const v = (updateData.passcode as string).trim();
          updateData.passcode = v.length ? v : undefined;
        }
      }

      // Normalize timeZone on update
      if (typeof updateData.timeZone === "string") {
        const tz = updateData.timeZone.trim();
        updateData.timeZone = tz.length ? tz : undefined;
      }

      // Validate that resulting end datetime is not before start
      const effectiveDate = updateData.date || event.date;
      const effectiveEndDate =
        updateData.endDate ||
        (event as unknown as { endDate?: string }).endDate ||
        event.date;
      const effectiveTime = updateData.time || event.time;
      const effectiveEndTime = updateData.endTime || event.endTime;
      const effStart = new Date(`${effectiveDate}T${effectiveTime}`);
      const effEnd = new Date(`${effectiveEndDate}T${effectiveEndTime}`);
      if (effEnd < effStart) {
        res.status(400).json({
          success: false,
          message: "Event end date/time must be after start date/time.",
        });
        return;
      }

      // Handle roles update if provided
      if (updateData.roles && Array.isArray(updateData.roles)) {
        // Determine the effective event type (might be updated in the same request)
        const effectiveType = updateData.type || event.type;

        const roleValidation = EventController.validateRolesAgainstTemplates(
          effectiveType,
          updateData.roles.map(
            (r: { name: string; maxParticipants: number }) => ({
              name: r.name,
              maxParticipants: r.maxParticipants,
            })
          )
        );
        if (roleValidation.valid === false) {
          res.status(400).json({
            success: false,
            message: "Invalid roles for selected event type.",
            errors: roleValidation.errors,
          });
          return;
        }

        event.roles = updateData.roles;
        delete updateData.roles; // Remove from updateData since we handled it directly
      }

      // Track old organizer details for comparison (to detect new co-organizers)
      const oldOrganizerUserIds = event.organizerDetails
        ? event.organizerDetails
            .map((org: { userId?: unknown }) =>
              org.userId ? EventController.toIdString(org.userId) : undefined
            )
            .filter((v: unknown): v is string => typeof v === "string")
        : [];

      // SIMPLIFIED: Store only essential organizer info, contact details fetched at read time
      if (
        updateData.organizerDetails &&
        Array.isArray(updateData.organizerDetails)
      ) {
        updateData.organizerDetails = updateData.organizerDetails.map(
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

      Object.assign(event, updateData);
      await event.save();

      // Send notifications to newly added co-organizers
      try {
        if (
          updateData.organizerDetails &&
          Array.isArray(updateData.organizerDetails)
        ) {
          // Get new organizer user IDs
          const newOrganizerUserIds = updateData.organizerDetails
            .map((org: { userId?: unknown }) =>
              org.userId ? EventController.toIdString(org.userId) : undefined
            )
            .filter(Boolean);

          // Find newly added organizers (exclude main organizer)
          const mainOrganizerId = event.createdBy.toString();
          const newCoOrganizerIds = newOrganizerUserIds.filter(
            (userId): userId is string =>
              !!userId &&
              userId !== mainOrganizerId &&
              !oldOrganizerUserIds.includes(userId)
          );

          if (newCoOrganizerIds.length > 0) {
            console.log(
              `📧 Found ${newCoOrganizerIds.length} new co-organizers to notify`
            );

            // Get user details for new co-organizers
            const newCoOrganizers = await User.find({
              _id: { $in: newCoOrganizerIds },
              isActive: true,
              isVerified: true,
              emailNotifications: true,
            }).select("email firstName lastName");

            // Send email notifications to new co-organizers
            const coOrganizerEmailPromises = newCoOrganizers.map(
              async (coOrganizer) => {
                try {
                  await EmailService.sendCoOrganizerAssignedEmail(
                    coOrganizer.email,
                    {
                      firstName: coOrganizer.firstName || "Unknown",
                      lastName: coOrganizer.lastName || "User",
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
                    `✅ Co-organizer update notification sent to ${coOrganizer.email}`
                  );
                  return true;
                } catch (error) {
                  console.error(
                    `❌ Failed to send co-organizer update notification to ${coOrganizer.email}:`,
                    error
                  );
                  return false;
                }
              }
            );

            // Send system messages to new co-organizers (targeted messages)
            const coOrganizerSystemMessagePromises = newCoOrganizers.map(
              async (coOrganizer) => {
                try {
                  // Create targeted system message using the new method
                  await UnifiedMessageController.createTargetedSystemMessage(
                    {
                      title: `Co-Organizer Assignment: ${event.title}`,
                      content: `You have been assigned as a co-organizer for the event "${event.title}" scheduled for ${event.date} at ${event.time}. Please review the event details and reach out to the main organizer if you have any questions.`,
                      type: "announcement",
                      priority: "high",
                    },
                    [EventController.toIdString(coOrganizer._id)],
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
                    `✅ Co-organizer update system message sent to ${coOrganizer.email}`
                  );
                  return true;
                } catch (error) {
                  console.error(
                    `❌ Failed to send co-organizer update system message to ${coOrganizer.email}:`,
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
                const successCount = results.filter(
                  (result) => result === true
                ).length;
                console.log(
                  `✅ Processed ${successCount}/${results.length} co-organizer update notifications`
                );
              })
              .catch((error) => {
                console.error(
                  "Error processing co-organizer update notifications:",
                  error
                );
              });
          } else {
            console.log("ℹ️  No new co-organizers found for notifications");
          }
        }
      } catch (coOrganizerError) {
        console.error(
          "Error sending co-organizer update notifications:",
          coOrganizerError
        );
        // Don't fail the event update if co-organizer notifications fail
      }

      // Notify participants and guests that the event has been edited
      try {
        const [participants, guests] = await Promise.all([
          EmailRecipientUtils.getEventParticipants(id),
          EmailRecipientUtils.getEventGuests(id),
        ]);

        const actorDisplay = formatActorDisplay({
          firstName: req.user?.firstName,
          lastName: req.user?.lastName,
          email: req.user?.email,
          role: req.user?.role,
        });

        const updateMessage = `The event "${
          event.title
        }" you registered for has been edited by ${
          actorDisplay || "an authorized user"
        }. Please review the updated details.`;

        const eventMeta = event as unknown as {
          endDate?: string;
          timeZone?: string;
        };
        const emailPayload = {
          eventTitle: event.title,
          date: event.date,
          endDate: eventMeta.endDate,
          time: event.time,
          endTime: event.endTime,
          timeZone: eventMeta.timeZone,
          message: updateMessage,
        };

        const participantEmailPromises = (participants || []).map(
          (p: { email: string; firstName?: string; lastName?: string }) =>
            EmailService.sendEventNotificationEmail(
              p.email,
              [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email,
              emailPayload
            ).catch((err) => {
              console.error(
                `❌ Failed to send participant event update email to ${p.email}:`,
                err
              );
              return false;
            })
        );

        const guestEmailPromises = (guests || []).map(
          (g: { email: string; firstName?: string; lastName?: string }) =>
            EmailService.sendEventNotificationEmail(
              g.email,
              [g.firstName, g.lastName].filter(Boolean).join(" ") || g.email,
              emailPayload
            ).catch((err) => {
              console.error(
                `❌ Failed to send guest event update email to ${g.email}:`,
                err
              );
              return false;
            })
        );

        // Resolve participant user IDs; fallback to lookup by email when _id missing
        const participantUserIds = (
          await Promise.all(
            (participants || []).map(
              async (p: { _id?: unknown; email?: string }) => {
                const existing = p._id
                  ? EventController.toIdString(p._id)
                  : undefined;
                if (existing) return existing;
                if (!p.email) return undefined;
                try {
                  const email = String(p.email).toLowerCase();
                  // Support both real Mongoose Query (with select/lean) and mocked plain object returns
                  const findQuery = (
                    User as unknown as {
                      findOne: (q: unknown) => unknown;
                    }
                  ).findOne({
                    email,
                    isActive: true,
                    isVerified: true,
                  });

                  let userDoc: unknown;
                  if (
                    findQuery &&
                    typeof (findQuery as { select?: unknown }).select ===
                      "function"
                  ) {
                    // In production, use a lean, minimal fetch
                    try {
                      userDoc = await (
                        findQuery as {
                          select: (f: string) => {
                            lean: () => Promise<unknown>;
                          };
                        }
                      )
                        .select("_id")
                        .lean();
                    } catch {
                      // Fallback: await the query as-is (helps in certain mocked scenarios)
                      userDoc = await (findQuery as Promise<unknown>);
                    }
                  } else {
                    // In tests, mocked findOne may resolve directly to a plain object
                    userDoc = await (findQuery as Promise<unknown>);
                  }

                  const idVal = (userDoc as { _id?: unknown })?._id;
                  return idVal ? EventController.toIdString(idVal) : undefined;
                } catch (e) {
                  console.warn(
                    `⚠️ Failed to resolve user ID by email for participant ${p.email}:`,
                    e
                  );
                  return undefined;
                }
              }
            )
          )
        )
          .filter(Boolean)
          // ensure uniqueness
          .filter((id, idx, arr) => arr.indexOf(id) === idx) as string[];

        const systemMessagePromise =
          participantUserIds.length > 0
            ? UnifiedMessageController.createTargetedSystemMessage(
                {
                  title: `Event Updated: ${event.title}`,
                  content: updateMessage,
                  type: "update",
                  priority: "medium",
                  metadata: { eventId: id },
                },
                participantUserIds,
                {
                  id: EventController.toIdString(req.user!._id),
                  firstName: req.user?.firstName || "",
                  lastName: req.user?.lastName || "",
                  username: req.user?.username || "",
                  avatar: req.user?.avatar,
                  gender: req.user?.gender || "male",
                  authLevel: req.user?.role,
                  roleInAtCloud: req.user?.roleInAtCloud,
                }
              ).catch((err: unknown) => {
                console.error(
                  "❌ Failed to create participant system messages for event update:",
                  err
                );
                return false as boolean;
              })
            : Promise.resolve(true as boolean);

        // Fire-and-forget to avoid blocking the response
        Promise.all([
          ...participantEmailPromises,
          ...guestEmailPromises,
          systemMessagePromise,
        ])
          .then((results) => {
            const successCount = results.filter((r) => r === true).length;
            console.log(
              `✅ Processed ${successCount}/${results.length} event edit notifications (participants + guests + system messages)`
            );
          })
          .catch((err) => {
            console.error(
              "Error processing event edit notifications (participants/guests):",
              err
            );
          });
      } catch (notifyErr) {
        console.error(
          "Error preparing participant/guest notifications for event edit:",
          notifyErr
        );
      }

      // Invalidate event-related caches since event was updated
      await CachePatterns.invalidateEventCache(id);
      await CachePatterns.invalidateAnalyticsCache();

      // Build response with proper field mapping (includes maxParticipants alias)
      const eventResponse =
        await ResponseBuilderService.buildEventWithRegistrations(id);

      res.status(200).json({
        success: true,
        message: "Event updated successfully!",
        data: { event: eventResponse },
      });
    } catch (error: unknown) {
      console.error("Update event error:", error);

      // Handle validation errors
      if (
        typeof error === "object" &&
        error !== null &&
        (error as { name?: unknown }).name === "ValidationError"
      ) {
        const errs = (error as { errors: Record<string, { message: string }> })
          .errors;
        const validationErrors = Object.values(errs).map((err) => err.message);
        res.status(400).json({
          success: false,
          message: `Validation failed: ${validationErrors.join(", ")}`,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Failed to update event.",
      });
    }
  }

  // Delete event
  static async deleteEvent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid event ID.",
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const event = await Event.findById(id);

      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found.",
        });
        return;
      }

      // Check permissions
      const canDeleteAnyEvent = hasPermission(
        req.user.role,
        PERMISSIONS.DELETE_ANY_EVENT
      );
      const canDeleteOwnEvent = hasPermission(
        req.user.role,
        PERMISSIONS.DELETE_OWN_EVENT
      );
      const isEventOrganizer = EventController.isEventOrganizer(
        event,
        EventController.toIdString(req.user._id)
      );

      if (!canDeleteAnyEvent && !(canDeleteOwnEvent && isEventOrganizer)) {
        res.status(403).json({
          success: false,
          message:
            "Insufficient permissions to delete this event. You must be the event creator or a co-organizer.",
        });
        return;
      }

      // Check if event has participants and handle cascade deletion
      let deletedRegistrationsCount = 0;
      if (event.signedUp > 0) {
        console.log(`🔄 Event has ${event.signedUp} registered participants`);

        // Check if user has permission to force delete events with participants
        // This should be based on permissions, not hardcoded roles
        const canForceDelete =
          canDeleteAnyEvent || (canDeleteOwnEvent && isEventOrganizer);

        if (!canForceDelete) {
          res.status(400).json({
            success: false,
            message:
              "Cannot delete event with registered participants. Please remove all participants first, or contact an Administrator or Super Admin for force deletion.",
          });
          return;
        }

        // Force deletion: Delete all associated registrations first
        console.log(
          "🚨 Force deletion by authorized user: Deleting associated registrations..."
        );
        const deletionResult = await Registration.deleteMany({ eventId: id });
        deletedRegistrationsCount = deletionResult.deletedCount || 0;
        console.log(
          `✅ Deleted ${deletedRegistrationsCount} registrations for event ${id}`
        );
      }

      // Delete the event
      await Event.findByIdAndDelete(id);

      // Invalidate event-related caches since event was deleted
      await CachePatterns.invalidateEventCache(id);
      await CachePatterns.invalidateAnalyticsCache();

      const response: {
        success: true;
        message: string;
        deletedRegistrations?: number;
      } = {
        success: true,
        message:
          deletedRegistrationsCount > 0
            ? `Event deleted successfully! Also removed ${deletedRegistrationsCount} associated registrations.`
            : "Event deleted successfully!",
      };

      if (deletedRegistrationsCount > 0) {
        response.deletedRegistrations = deletedRegistrationsCount;
      }

      res.status(200).json(response);
    } catch (error: unknown) {
      console.error("Delete event error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete event.",
      });
    }
  }

  // Sign up for event role (THREAD-SAFE VERSION)
  static async signUpForEvent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { roleId, notes, specialRequirements }: EventSignupRequest =
        req.body;

      // Basic validation
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid event ID.",
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      if (!roleId) {
        res.status(400).json({
          success: false,
          message: "Role ID is required.",
        });
        return;
      }

      // Pre-flight checks (before acquiring lock)
      const event = await Event.findById(id);
      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found.",
        });
        return;
      }

      if (event.status !== "upcoming") {
        res.status(400).json({
          success: false,
          message: "Cannot sign up for this event.",
        });
        return;
      }

      // User role and capacity checks - Check signups for THIS EVENT only (no status filtering needed)
      const userCurrentSignupsInThisEvent = await Registration.countDocuments({
        eventId: id,
        userId: req.user._id,
      });

      const getRoleLimit = (authLevel: string, eventType: string): number => {
        // Workshop events allow multi-group participation
        if (eventType === "Effective Communication Workshop") {
          switch (authLevel) {
            case "Super Admin":
            case "Administrator":
              return 6; // Can be in all groups
            case "Leader":
              return 4; // Can be in multiple groups
            case "Participant":
            default:
              return 3; // Allow participants to join multiple workshop groups
          }
        }

        // Standard events use original limits
        switch (authLevel) {
          case "Super Admin":
          case "Administrator":
            return 3;
          case "Leader":
            return 2;
          case "Participant":
          default:
            return 1;
        }
      };

      const userRoleLimit = getRoleLimit(req.user.role, event.type);
      if (userCurrentSignupsInThisEvent >= userRoleLimit) {
        res.status(400).json({
          success: false,
          message: `You have reached the maximum number of roles (${userRoleLimit}) allowed for your authorization level (${req.user.role}) in this event.`,
        });
        return;
      }

      // Role permission checks
      const targetRole = event.roles.find(
        (role: IEventRole) => role.id === roleId
      );
      if (!targetRole) {
        res.status(400).json({
          success: false,
          message: "Role not found in this event.",
        });
        return;
      }

      // Participant restrictions for Effective Communication Workshop events
      if (req.user.role === "Participant") {
        if (event.type === "Effective Communication Workshop") {
          const allowedNames = [
            "Group A Leader",
            "Group B Leader",
            "Group C Leader",
            "Group D Leader",
            "Group E Leader",
            "Group F Leader",
            "Group A Participants",
            "Group B Participants",
            "Group C Participants",
            "Group D Participants",
            "Group E Participants",
            "Group F Participants",
          ];
          if (!allowedNames.includes(targetRole.name)) {
            res.status(403).json({
              success: false,
              message:
                "Participants can only sign up for Group Leader and Group Participants roles in this workshop.",
            });
            return;
          }
        } else {
          const participantAllowedRoles = [
            "Prepared Speaker (on-site)",
            "Prepared Speaker (Zoom)",
            "Common Participant (on-site)",
            "Common Participant (Zoom)",
          ];
          if (!participantAllowedRoles.includes(targetRole.name)) {
            res.status(403).json({
              success: false,
              message:
                "This role is open to @Cloud Co-Workers only. Apply to become a Co-Worker to be eligible.",
            });
            return;
          }
        }
      }

      // 🔒 THREAD-SAFE REGISTRATION WITH APPLICATION LOCK 🔒
      // Use application-level locking for capacity-safe registration
      const lockKey = `signup:${id}:${roleId}`;
      const user = req.user!; // Already validated above

      try {
        await lockService.withLock(
          lockKey,
          async () => {
            // Final capacity check under lock (race condition protection) - no status filtering needed
            const currentCount = await Registration.countDocuments({
              eventId: id,
              roleId,
            });

            if (currentCount >= targetRole.maxParticipants) {
              throw new Error(
                `This role is at full capacity (${currentCount}/${targetRole.maxParticipants}). Please try another role.`
              );
            }

            // Check for duplicate registration under lock (no status filtering needed)
            const existingRegistration = await Registration.findOne({
              eventId: id,
              userId: user._id,
              roleId,
            });

            if (existingRegistration) {
              throw new Error("You are already signed up for this role.");
            }

            // Create new registration record
            const newRegistration = new Registration({
              eventId: id,
              userId: user._id,
              roleId,
              registrationDate: new Date(),
              notes,
              specialRequirements,
              registeredBy: user._id,
              userSnapshot: {
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                systemAuthorizationLevel: user.role,
                roleInAtCloud: user.roleInAtCloud,
                avatar: user.avatar,
                gender: user.gender,
              },
              eventSnapshot: await (async () => {
                const { EventSnapshotBuilder } = await import(
                  "../services/EventSnapshotBuilder"
                );
                return EventSnapshotBuilder.buildRegistrationSnapshot(
                  event,
                  targetRole
                );
              })(),
            });

            // Attempt atomic save (protected by unique index for duplicates)
            console.log(
              `🔄 Saving registration for user ${user._id} to role ${roleId} in event ${id}`
            );
            await newRegistration.save();
            console.log(`✅ Registration saved successfully`);

            // Update the Event document to trigger statistics recalculation
            console.log(`🔄 Updating event statistics...`);
            await event.save(); // This triggers the pre-save hook to update signedUp and totalSlots
            console.log(`✅ Event statistics updated`);

            return newRegistration;
          },
          10000
        ); // 10 second timeout

        // Get updated event data using ResponseBuilderService
        console.log(`🔄 Building updated event data with registrations...`);
        const updatedEvent =
          await ResponseBuilderService.buildEventWithRegistrations(
            id,
            req.user ? EventController.toIdString(req.user._id) : undefined
          );
        console.log(`✅ Updated event data built:`, {
          eventId: id,
          roleCount: updatedEvent?.roles?.length,
          targetRoleSignups: updatedEvent?.roles?.find((r) => r.id === roleId)
            ?.registrations?.length,
        });

        // Emit real-time event update for signup
        console.log(`📡 Emitting WebSocket event update for signup...`);
        socketService.emitEventUpdate(id, "user_signed_up", {
          userId: user._id,
          roleId,
          roleName: targetRole.name,
          user: {
            userId: user._id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          event: updatedEvent,
        });
        console.log(`✅ WebSocket event emitted successfully`);

        // Invalidate caches after successful signup
        await CachePatterns.invalidateEventCache(id);
        await CachePatterns.invalidateAnalyticsCache();

        res.status(200).json({
          success: true,
          message: `Successfully signed up for ${targetRole.name}`,
          data: {
            event: updatedEvent,
          },
        });
      } catch (lockError: unknown) {
        if (
          typeof lockError === "object" &&
          lockError !== null &&
          typeof (lockError as { message?: unknown }).message === "string" &&
          (lockError as { message: string }).message.includes("Lock timeout")
        ) {
          res.status(503).json({
            success: false,
            message:
              "Service temporarily unavailable due to high load. Please try again.",
          });
          return;
        }

        if (
          typeof lockError === "object" &&
          lockError !== null &&
          typeof (lockError as { message?: unknown }).message === "string" &&
          ((lockError as { message: string }).message.includes(
            "already signed up"
          ) ||
            (lockError as { message: string }).message.includes(
              "full capacity"
            ))
        ) {
          const msg = (lockError as { message: string }).message;
          res.status(400).json({
            success: false,
            message: msg,
          });
          return;
        }

        throw lockError; // Re-throw unexpected errors
      }
    } catch (error: unknown) {
      console.error("Event signup error:", error);

      if (
        typeof error === "object" &&
        error !== null &&
        typeof (error as { message?: unknown }).message === "string" &&
        ((error as { message: string }).message.includes("already signed up") ||
          (error as { message: string }).message.includes("already full") ||
          (error as { message: string }).message.includes("timeout"))
      ) {
        res.status(400).json({
          success: false,
          message: (error as { message: string }).message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Failed to sign up for event.",
      });
    }
  }

  // Update a specific workshop group topic (Workshop only)
  static async updateWorkshopGroupTopic(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { id, group } = req.params as { id: string; group: string };
      const { topic } = req.body as { topic: string };

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ success: false, message: "Invalid event ID." });
        return;
      }
      const validGroups = ["A", "B", "C", "D", "E", "F"] as const;
      if (!validGroups.some((g) => g === group)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid group key. Must be A-F." });
        return;
      }
      const event = await Event.findById(id);
      if (!event) {
        res.status(404).json({ success: false, message: "Event not found." });
        return;
      }
      if (event.type !== "Effective Communication Workshop") {
        res.status(400).json({
          success: false,
          message:
            "Group topics are only for Effective Communication Workshop events.",
        });
        return;
      }
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      const user = req.user;
      let authorized = false;
      if (user.role === "Super Admin" || user.role === "Administrator") {
        authorized = true;
      }
      if (
        !authorized &&
        event.createdBy?.toString() === EventController.toIdString(user._id)
      ) {
        authorized = true;
      }
      if (!authorized && Array.isArray(event.organizerDetails)) {
        authorized = event.organizerDetails.some(
          (o: { userId?: unknown }) =>
            (o.userId ? EventController.toIdString(o.userId) : undefined) ===
            EventController.toIdString(user._id)
        );
      }
      if (!authorized) {
        // Check if user is registered as Group X Leader for this event
        const leaderRoleName = `Group ${group} Leader`;
        const leaderRole = event.roles.find(
          (r: { id: string; name: string }) => r.name === leaderRoleName
        );
        if (leaderRole) {
          const count = await Registration.countDocuments({
            eventId: id,
            roleId: leaderRole.id,
            userId: user._id,
          });
          if (count > 0) authorized = true;
        }
      }

      if (!authorized) {
        res.status(403).json({
          success: false,
          message: "You do not have permission to edit this group topic.",
        });
        return;
      }

      const key = `workshopGroupTopics.${group}`;
      await Event.findByIdAndUpdate(
        id,
        { $set: { [key]: (topic ?? "").toString().trim() } },
        { new: true, runValidators: true, context: "query" }
      );

      // Build fresh event response and emit socket update
      const updatedEvent =
        await ResponseBuilderService.buildEventWithRegistrations(
          id,
          req.user ? EventController.toIdString(req.user._id) : undefined
        );
      await CachePatterns.invalidateEventCache(id);
      socketService.emitEventUpdate(id, "workshop_topic_updated", {
        group,
        topic,
        userId: req.user ? EventController.toIdString(req.user._id) : undefined,
      });

      res.status(200).json({
        success: true,
        message: "Group topic updated",
        data: { event: updatedEvent },
      });
    } catch (error: unknown) {
      console.error("Update workshop topic error:", error);
      if (
        typeof error === "object" &&
        error !== null &&
        (error as { name?: unknown }).name === "ValidationError"
      ) {
        const errors = Object.values(
          (error as { errors?: Record<string, { message?: string }> }).errors ||
            {}
        ).map((e) => e.message || "Validation error");
        res
          .status(400)
          .json({ success: false, message: "Invalid topic", errors });
        return;
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to update group topic." });
    }
  }

  // Cancel event signup (THREAD-SAFE VERSION)
  static async cancelSignup(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { roleId } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid event ID.",
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      // Basic validation
      const event = await Event.findById(id);
      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found.",
        });
        return;
      }

      const role = event.roles.find((r: IEventRole) => r.id === roleId);
      if (!role) {
        res.status(404).json({
          success: false,
          message: "Role not found.",
        });
        return;
      }

      // 🔒 REGISTRATION-BASED CANCELLATION (ATOMIC OPERATION) 🔒
      // Remove registration record - this is atomic and thread-safe
      const deletedRegistration = await Registration.findOneAndDelete({
        eventId: id,
        userId: req.user._id,
        roleId,
      });

      if (!deletedRegistration) {
        res.status(400).json({
          success: false,
          message: "You are not signed up for this role.",
        });
        return;
      }

      // Update the Event document to trigger statistics recalculation
      await event.save(); // This triggers the pre-save hook to update signedUp and totalSlots

      // Invalidate caches after cancellation
      await CachePatterns.invalidateEventCache(id);
      await CachePatterns.invalidateAnalyticsCache();

      // Get updated event data using ResponseBuilderService
      const updatedEvent =
        await ResponseBuilderService.buildEventWithRegistrations(
          id,
          req.user ? EventController.toIdString(req.user._id) : undefined
        );

      // Emit real-time event update for cancellation
      socketService.emitEventUpdate(id, "user_cancelled", {
        userId: req.user._id,
        roleId,
        roleName: role.name,
        event: updatedEvent,
      });

      res.status(200).json({
        success: true,
        message: `Successfully cancelled signup for ${role.name}`,
        data: {
          event: updatedEvent,
        },
      });
    } catch (error: unknown) {
      console.error("Cancel signup error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cancel signup.",
      });
    }
  }

  // Remove user from role (admin/organizer management operation)
  static async removeUserFromRole(req: Request, res: Response): Promise<void> {
    try {
      const { id: eventId } = req.params;
      const { userId, roleId } = req.body;

      const event = await Event.findById(eventId);
      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found",
        });
        return;
      }

      // Verify role exists
      const role = event.roles.find((r: IEventRole) => r.id === roleId);
      if (!role) {
        res.status(404).json({
          success: false,
          message: "Role not found",
        });
        return;
      }

      // Remove the registration record (this is our single source of truth)
      const deletedRegistration = await Registration.findOneAndDelete({
        userId: new mongoose.Types.ObjectId(userId),
        eventId: event._id,
        roleId,
      });

      if (!deletedRegistration) {
        res.status(404).json({
          success: false,
          message: "Registration not found",
        });
        return;
      }

      // Update the Event document to trigger statistics recalculation
      await event.save(); // This triggers the pre-save hook to update signedUp and totalSlots

      // Invalidate caches after user removal
      await CachePatterns.invalidateEventCache(eventId);
      await CachePatterns.invalidateAnalyticsCache();

      // Build updated event for the acting viewer
      const updatedEvent =
        await ResponseBuilderService.buildEventWithRegistrations(
          eventId,
          req.user ? EventController.toIdString(req.user._id) : undefined
        );

      // Emit real-time event update to all connected clients
      socketService.emitEventUpdate(eventId, "user_removed", {
        userId,
        roleId,
        roleName: role.name,
        event: updatedEvent,
      });

      // Trio notification (best effort)
      try {
        const removedUser = (await User.findById(userId).lean()) as {
          _id: unknown;
          email?: string;
          firstName?: string;
          lastName?: string;
        } | null;
        if (removedUser) {
          await TrioNotificationService.createEventRoleRemovedTrio({
            event: { id: event._id.toString(), title: event.title },
            targetUser: {
              id: EventController.toIdString(removedUser._id),
              email: removedUser.email || "",
              firstName: removedUser.firstName || "",
              lastName: removedUser.lastName || "",
            },
            roleName: role.name,
            actor: {
              id:
                req.user && req.user._id
                  ? EventController.toIdString(req.user._id)
                  : "system",
              firstName: req.user?.firstName || "System",
              lastName: req.user?.lastName || "",
              username: req.user?.username || "system",
              avatar: req.user?.avatar,
              gender: req.user?.gender,
              authLevel: req.user?.role,
              roleInAtCloud: req.user?.roleInAtCloud,
            },
          });
        }
      } catch (trioErr) {
        console.warn("Trio role removed notification failed:", trioErr);
      }

      res.status(200).json({
        success: true,
        message: `User removed from ${role.name} successfully`,
        data: { event: updatedEvent },
      });
    } catch (error: unknown) {
      console.error("Remove user from role error:", error);
      res.status(500).json({
        success: false,
        message:
          (typeof error === "object" &&
            error !== null &&
            typeof (error as { message?: unknown }).message === "string" &&
            (error as { message: string }).message) ||
          "Failed to remove user from role",
      });
    }
  }

  // Move user between roles (admin/organizer management operation)
  static async moveUserBetweenRoles(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { id: eventId } = req.params;
      const { userId, fromRoleId, toRoleId } = req.body;

      const event = await Event.findById(eventId);
      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found",
        });
        return;
      }

      const sourceRole = event.roles.find(
        (r: IEventRole) => r.id === fromRoleId
      );
      const targetRole = event.roles.find((r: IEventRole) => r.id === toRoleId);

      if (!sourceRole || !targetRole) {
        res.status(404).json({
          success: false,
          message: "Source or target role not found",
        });
        return;
      }

      // Check if user is registered for source role
      const existingRegistration = await Registration.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        eventId: event._id,
        roleId: fromRoleId,
      });

      if (!existingRegistration) {
        res.status(404).json({
          success: false,
          message: "User not found in source role",
        });
        return;
      }

      // 🔒 ENHANCED CAPACITY-SAFE ROLE MOVE 🔒
      // Pre-check target role capacity (reduces race condition window)
      const currentCount = await Registration.countDocuments({
        eventId: event._id,
        roleId: toRoleId,
      });

      if (currentCount >= targetRole.maxParticipants) {
        res.status(400).json({
          success: false,
          message: `Target role is at full capacity (${currentCount}/${targetRole.maxParticipants})`,
        });
        return;
      }

      try {
        // Update registration record to move to new role (atomic operation)
        existingRegistration.roleId = toRoleId;
        // Update the event snapshot to reflect the new role
        existingRegistration.eventSnapshot.roleName = targetRole.name;
        existingRegistration.eventSnapshot.roleDescription =
          targetRole.description;

        await existingRegistration.save();

        // Update the Event document to trigger statistics recalculation
        await event.save(); // This triggers the pre-save hook to update signedUp and totalSlots

        // Invalidate caches after role switch
        await CachePatterns.invalidateEventCache(eventId);
        await CachePatterns.invalidateAnalyticsCache();

        // Get updated event data using ResponseBuilderService
        const updatedEvent =
          await ResponseBuilderService.buildEventWithRegistrations(
            eventId,
            req.user ? EventController.toIdString(req.user._id) : undefined
          );

        // Emit real-time event update to all connected clients
        socketService.emitEventUpdate(eventId, "user_moved", {
          userId,
          fromRoleId,
          toRoleId,
          fromRoleName: sourceRole.name,
          toRoleName: targetRole.name,
          event: updatedEvent,
        });

        // Trio notification (best effort)
        try {
          const movedUser = (await User.findById(userId).lean()) as {
            _id: unknown;
            email?: string;
            firstName?: string;
            lastName?: string;
          } | null;
          if (movedUser) {
            await TrioNotificationService.createEventRoleMovedTrio({
              event: { id: event._id.toString(), title: event.title },
              targetUser: {
                id: EventController.toIdString(movedUser._id),
                email: movedUser.email || "",
                firstName: movedUser.firstName || "",
                lastName: movedUser.lastName || "",
              },
              fromRoleName: sourceRole.name,
              toRoleName: targetRole.name,
              actor: {
                id:
                  req.user && req.user._id
                    ? EventController.toIdString(req.user._id)
                    : "system",
                firstName: req.user?.firstName || "System",
                lastName: req.user?.lastName || "",
                username: req.user?.username || "system",
                avatar: req.user?.avatar,
                gender: req.user?.gender,
                authLevel: req.user?.role,
                roleInAtCloud: req.user?.roleInAtCloud,
              },
            });
          }
        } catch (trioErr) {
          console.warn("Trio role moved notification failed:", trioErr);
        }

        res.status(200).json({
          success: true,
          message: "User moved between roles successfully",
          data: { event: updatedEvent },
        });
      } catch (moveError: unknown) {
        // Handle potential capacity race condition for role moves
        const finalCount = await Registration.countDocuments({
          eventId: event._id,
          roleId: toRoleId,
        });

        if (finalCount >= targetRole.maxParticipants) {
          res.status(400).json({
            success: false,
            message: `Target role became full while processing move (${finalCount}/${targetRole.maxParticipants})`,
          });
          return;
        }

        // Some other error, re-throw
        throw moveError;
      }
    } catch (error: unknown) {
      console.error("Move user between roles error:", error);
      res.status(500).json({
        success: false,
        message:
          (typeof error === "object" &&
            error !== null &&
            typeof (error as { message?: unknown }).message === "string" &&
            (error as { message: string }).message) ||
          "Failed to move user between roles",
      });
    }
  }

  // Assign user to role (organizers/co-organizers only)
  static async assignUserToRole(req: Request, res: Response): Promise<void> {
    try {
      const { id: eventId } = req.params;
      const { userId, roleId, notes, specialRequirements } = req.body as {
        userId: string;
        roleId: string;
        notes?: string;
        specialRequirements?: string;
      };

      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        res.status(400).json({ success: false, message: "Invalid event ID." });
        return;
      }
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ success: false, message: "Invalid user ID." });
        return;
      }
      if (!roleId) {
        res
          .status(400)
          .json({ success: false, message: "Role ID is required." });
        return;
      }

      const event = await Event.findById(eventId);
      if (!event) {
        res.status(404).json({ success: false, message: "Event not found" });
        return;
      }

      // Authorizer middleware already ensures req.user is organizer or super admin
      const targetRole = event.roles.find((r: IEventRole) => r.id === roleId);
      if (!targetRole) {
        res.status(404).json({ success: false, message: "Role not found" });
        return;
      }

      // Ensure event is upcoming
      if (event.status !== "upcoming") {
        res.status(400).json({
          success: false,
          message: "Cannot assign users to a non-upcoming event.",
        });
        return;
      }

      // Fetch target user
      const targetUser = await User.findById(userId);
      if (!targetUser) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }
      if (!targetUser.isActive || !targetUser.isVerified) {
        res.status(400).json({
          success: false,
          message: "User is inactive or not verified.",
        });
        return;
      }

      // Eligibility: reuse sign-up rules for Participants vs other roles depending on event type
      const roleName = targetRole.name;
      if (targetUser.role === "Participant") {
        if (event.type === "Effective Communication Workshop") {
          const allowedNames = [
            "Group A Leader",
            "Group B Leader",
            "Group C Leader",
            "Group D Leader",
            "Group E Leader",
            "Group F Leader",
            "Group A Participants",
            "Group B Participants",
            "Group C Participants",
            "Group D Participants",
            "Group E Participants",
            "Group F Participants",
          ];
          if (!allowedNames.includes(roleName)) {
            res.status(403).json({
              success: false,
              message: "Target user is not authorized for this role.",
            });
            return;
          }
        } else {
          const participantAllowedRoles = [
            "Prepared Speaker (on-site)",
            "Prepared Speaker (Zoom)",
            "Common Participant (on-site)",
            "Common Participant (Zoom)",
          ];
          if (!participantAllowedRoles.includes(roleName)) {
            res.status(403).json({
              success: false,
              message: "Target user is not authorized for this role.",
            });
            return;
          }
        }
      }

      // Idempotency: if already registered to this role, return success with current state
      const existingRegistration = await Registration.findOne({
        eventId: event._id,
        userId: targetUser._id,
        roleId,
      });
      if (existingRegistration) {
        const updatedEvent =
          await ResponseBuilderService.buildEventWithRegistrations(
            eventId,
            req.user ? EventController.toIdString(req.user._id) : undefined
          );
        res.status(200).json({
          success: true,
          message: `${
            targetUser.getDisplayName?.() || targetUser.username
          } is already assigned to ${roleName}`,
          data: { event: updatedEvent },
        });
        return;
      }

      // Capacity check
      const currentCount = await Registration.countDocuments({
        eventId: event._id,
        roleId,
      });
      if (currentCount >= targetRole.maxParticipants) {
        res.status(400).json({
          success: false,
          message: `This role is at full capacity (${currentCount}/${targetRole.maxParticipants}).`,
        });
        return;
      }

      // Create registration on behalf of the organizer
      const actingUser = req.user!;
      const reg = new Registration({
        eventId: event._id,
        userId: targetUser._id,
        roleId,
        registrationDate: new Date(),
        notes,
        specialRequirements,
        registeredBy: actingUser._id,
        userSnapshot: {
          username: targetUser.username,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName,
          email: targetUser.email,
          systemAuthorizationLevel: targetUser.role,
          roleInAtCloud: targetUser.roleInAtCloud,
          avatar: targetUser.avatar,
          gender: targetUser.gender,
        },
        eventSnapshot: await (async () => {
          const { EventSnapshotBuilder } = await import(
            "../services/EventSnapshotBuilder"
          );
          return EventSnapshotBuilder.buildRegistrationSnapshot(
            event,
            targetRole
          );
        })(),
      });

      // Add explicit audit entry for assignment
      reg.addAuditEntry(
        "assigned",
        actingUser._id,
        `Assigned to role: ${targetRole.name}`
      );
      await reg.save();

      // Update event stats
      await event.save();

      // Build updated response and emit socket event
      const updatedEvent =
        await ResponseBuilderService.buildEventWithRegistrations(
          eventId,
          req.user ? EventController.toIdString(req.user._id) : undefined
        );
      socketService.emitEventUpdate(eventId, "user_assigned", {
        operatorId: EventController.toIdString(actingUser._id),
        userId: EventController.toIdString(targetUser._id),
        roleId,
        roleName,
        event: updatedEvent,
      });

      // Trio notification (best effort)
      try {
        await TrioNotificationService.createEventRoleAssignedTrio({
          event: {
            id: event._id.toString(),
            title: event.title,
            date: event.date,
            time: event.time,
            location: event.location,
          },
          targetUser: {
            id: targetUser._id.toString(),
            email: targetUser.email,
            firstName: targetUser.firstName,
            lastName: targetUser.lastName,
          },
          roleName,
          actor: {
            id: EventController.toIdString(actingUser._id),
            firstName: actingUser.firstName || "",
            lastName: actingUser.lastName || "",
            username: actingUser.username || "",
            avatar: actingUser.avatar,
            gender: actingUser.gender,
            authLevel: actingUser.role,
            roleInAtCloud: actingUser.roleInAtCloud,
          },
        });
      } catch (trioErr) {
        console.warn("Trio role assigned notification failed:", trioErr);
      }

      // Invalidate caches
      await CachePatterns.invalidateEventCache(eventId);
      await CachePatterns.invalidateAnalyticsCache();

      res.status(200).json({
        success: true,
        message: `Assigned ${
          targetUser.getDisplayName?.() || targetUser.username
        } to ${roleName}`,
        data: { event: updatedEvent },
      });
    } catch (error: unknown) {
      console.error("Assign user to role error:", error);
      res.status(500).json({
        success: false,
        message:
          (typeof error === "object" &&
            error !== null &&
            typeof (error as { message?: unknown }).message === "string" &&
            (error as { message: string }).message) ||
          "Failed to assign user to role",
      });
    }
  }

  // Get user's registered events
  static async getUserEvents(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      // Build filter - just get user's registrations (no status filtering needed)
      // Accept either string or ObjectId to play well with tests and mocks
      const filter: { userId: mongoose.Types.ObjectId | string } = {
        userId: req.user._id as unknown as mongoose.Types.ObjectId | string,
      };

      // Get user's registrations with populated event data
      const registrations = await Registration.find(filter)
        .populate({
          path: "eventId",
          select:
            "title date endDate time endTime timeZone location format status type organizer createdAt roles",
        })
        .sort({ registrationDate: -1 }); // Most recent first

      // Categorize events and enhance with current status
      const now = new Date();
      const events = registrations
        .filter((reg) => reg.eventId) // Only include registrations with valid events
        .map((reg) => {
          const event = reg.eventId as unknown as {
            _id: unknown;
            title: string;
            date: string;
            endDate?: string;
            time: string;
            endTime: string;
            timeZone?: string;
            location?: string;
            format?: string;
            status?: string;
            type?: string;
            organizer?: string;
            createdAt?: Date | string;
            roles?: Array<{ id: string; name: string; description?: string }>;
          };
          const eventEndDateStr = event.endDate || event.date;
          const eventDateTime = new Date(
            `${eventEndDateStr}T${event.endTime || event.time}`
          );
          const isPassedEvent = eventDateTime < now;

          // Get current role name from event data instead of snapshot
          // This ensures we get the latest role name if the user was moved between roles
          const currentRole = event.roles?.find(
            (role: { id: string }) => role.id === reg.roleId
          );
          const currentRoleName = currentRole
            ? currentRole.name
            : reg.eventSnapshot.roleName;
          const currentRoleDescription = currentRole
            ? currentRole.description
            : reg.eventSnapshot.roleDescription;

          return {
            event: {
              id: event._id,
              title: event.title,
              date: event.date,
              endDate: event.endDate,
              time: event.time,
              endTime: event.endTime,
              timeZone: event.timeZone,
              location: event.location,
              format: event.format,
              status: event.status,
              type: event.type,
              organizer: event.organizer,
              createdAt: event.createdAt,
            },
            registration: {
              id: reg._id,
              roleId: reg.roleId,
              roleName: currentRoleName, // Use current role name instead of snapshot
              roleDescription: currentRoleDescription, // Use current role description instead of snapshot
              registrationDate: reg.registrationDate,
              status: reg.status,
              notes: reg.notes,
              specialRequirements: reg.specialRequirements,
            },
            // Add computed properties for frontend
            isPassedEvent,
            eventStatus: isPassedEvent ? "passed" : "upcoming",
          };
        });

      // Provide summary statistics based on unique events
      const uniqueEvents = new Map();
      events.forEach((e) => {
        uniqueEvents.set(e.event.id, e);
      });
      const uniqueEventsArray = Array.from(uniqueEvents.values());

      const stats = {
        total: uniqueEventsArray.length,
        upcoming: uniqueEventsArray.filter((e) => !e.isPassedEvent).length,
        passed: uniqueEventsArray.filter((e) => e.isPassedEvent).length,
        active: uniqueEventsArray.filter(
          (e) => e.registration.status === "active"
        ).length,
        cancelled: uniqueEventsArray.filter(
          (e) => e.event.status === "cancelled"
        ).length,
      };

      res.status(200).json({
        success: true,
        data: {
          events,
          stats,
        },
      });
    } catch (error: unknown) {
      console.error("Get user events error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve user events.",
      });
    }
  }

  // Get events created by user
  static async getCreatedEvents(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const events = await Event.find({ createdBy: req.user._id }).sort({
        createdAt: -1,
      });

      res.status(200).json({
        success: true,
        data: { events },
      });
    } catch (error: unknown) {
      console.error("Get created events error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve created events.",
      });
    }
  }

  // Get event participants (for event organizers and admins)
  static async getEventParticipants(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid event ID.",
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const event = await Event.findById(id);

      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found.",
        });
        return;
      }

      // Check permissions
      const canViewParticipants = hasPermission(
        req.user.role,
        PERMISSIONS.MODERATE_EVENT_PARTICIPANTS
      );
      const isEventOrganizer = EventController.isEventOrganizer(
        event,
        EventController.toIdString(req.user._id)
      );

      if (!canViewParticipants && !isEventOrganizer) {
        res.status(403).json({
          success: false,
          message:
            "Insufficient permissions to view participants. You must be the event creator or a co-organizer.",
        });
        return;
      }

      // Get detailed registrations (no status filtering needed)
      const registrations = await Registration.find({
        eventId: id,
      }).populate("userId", "username firstName lastName email avatar role");

      res.status(200).json({
        success: true,
        data: {
          event: {
            id: event._id,
            title: event.title,
            roles: event.roles,
          },
          registrations,
        },
      });
    } catch (error: unknown) {
      console.error("Get event participants error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve event participants.",
      });
    }
  }
}
