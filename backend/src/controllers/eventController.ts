import { Request, Response } from "express";
import { Event, User, IEvent } from "../models";
import mongoose, { FilterQuery, Types } from "mongoose";
import { CachePatterns } from "../services";
import { toInstantFromWallClock } from "../utils/event/timezoneUtils";

/**
 * Capacity semantics (important):
 *
 * - This controller intentionally performs capacity checks using USER-ONLY counts
 *   for sign-up/move/assign flows. Historical behavior and tests depend on this
 *   exact semantics and on specific error precedence under application locks.
 * - Guest flows use CapacityService (with includeGuests=true by default) inside
 *   the guest controller and in read-model helpers where safe, without changing
 *   EventController behavior.
 * - Do not migrate EventController to include guest counts unless explicitly
 *   requested and the corresponding unit/integration tests are updated in lockstep.
 */

export class EventController {
  // Narrow guard to check organizerDetails array
  private static hasOrganizerDetails(
    v: unknown
  ): v is { organizerDetails?: Array<unknown> } {
    return (
      typeof v === "object" &&
      v !== null &&
      Array.isArray((v as { organizerDetails?: unknown }).organizerDetails)
    );
  }
  // Safely convert various ID-like values (ObjectId, string, etc.) to string
  public static toIdString(val: unknown): string {
    if (typeof val === "string") return val;
    if (
      val &&
      typeof (val as { toString?: () => string }).toString === "function"
    ) {
      try {
        return (val as { toString: () => string }).toString();
      } catch {
        // fall through to String(val)
      }
    }
    return String(val);
  }

  // Determine if a new timespan overlaps with any existing event timespan.
  // Made public for use by EventConflictController and other internal methods
  public static async findConflictingEvents(
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

    const newStart = toInstantFromWallClock(
      startDate,
      startTime,
      candidateTimeZone
    );
    const newEnd = toInstantFromWallClock(endDate, endTime, candidateTimeZone);

    const conflicts: Array<{ id: string; title: string }> = [];
    for (const ev of candidates) {
      const evStart = toInstantFromWallClock(ev.date, ev.time, ev.timeZone);
      const evEnd = toInstantFromWallClock(
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
    const { EventConflictController } = await import(
      "./event/EventConflictController"
    );
    return EventConflictController.checkTimeConflict(req, res);
  }

  /**
   * Publish an event - delegates to PublishingController
   */
  static async publishEvent(req: Request, res: Response): Promise<void> {
    const { PublishingController } = await import(
      "./event/PublishingController"
    );
    return PublishingController.publishEvent(req, res);
  }

  /**
   * Unpublish an event - delegates to PublishingController
   */
  static async unpublishEvent(req: Request, res: Response): Promise<void> {
    const { PublishingController } = await import(
      "./event/PublishingController"
    );
    return PublishingController.unpublishEvent(req, res);
  }

  // generateUniquePublicSlug moved to utils/publicSlug.ts
  // validateRoles moved to utils/event/eventValidation.ts
  // isEventOrganizer moved to utils/event/eventPermissions.ts

  // Helper method to determine event status based on date and time
  public static getEventStatus(
    eventDate: string,
    eventEndDateOrTime: string,
    eventTimeOrEndTime: string,
    maybeEventEndTime?: string,
    maybeTimeZone?: string
  ): "upcoming" | "ongoing" | "completed" {
    // Backward compatibility: legacy signature (date, time, endTime[, tz]) vs new (date, endDate, time, endTime[, tz])
    let eventEndDate: string;
    let eventTime: string;
    let eventEndTime: string;
    const timeZone: string | undefined = maybeTimeZone;

    if (typeof maybeEventEndTime === "undefined") {
      // Invoked with old 3-arg form; shift parameters
      eventEndDate = eventDate;
      eventTime = eventEndDateOrTime; // actually time
      eventEndTime = eventTimeOrEndTime; // actually endTime
    } else {
      eventEndDate = eventEndDateOrTime;
      eventTime = eventTimeOrEndTime;
      eventEndTime = maybeEventEndTime;
    }

    // Build instants using timezone-aware conversion; falls back to local if tz absent
    const startInstant = toInstantFromWallClock(eventDate, eventTime, timeZone);
    const endInstant = toInstantFromWallClock(
      eventEndDate,
      eventEndTime,
      timeZone
    );

    const now = new Date();

    // Guard: if end < start (data issue), treat end = start to avoid premature completion.
    if (endInstant < startInstant) {
      endInstant.setTime(startInstant.getTime());
    }

    if (now < startInstant) return "upcoming";
    if (now >= startInstant && now < endInstant) return "ongoing";
    // Completed only when now >= endInstant
    return "completed";
  }

  // Helper method to update event status if needed
  public static async updateEventStatusIfNeeded(event: {
    _id: Types.ObjectId;
    date: string;
    endDate?: string;
    time: string;
    endTime: string;
    status: string;
    timeZone?: string;
  }): Promise<void> {
    const newStatus = EventController.getEventStatus(
      event.date,
      event.endDate || event.date,
      event.time,
      event.endTime,
      event.timeZone
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
    const { BatchOperationsController } = await import(
      "./event/BatchOperationsController"
    );
    return BatchOperationsController.updateAllEventStatuses(req, res);
  }

  // Helper method to update all event statuses without sending response
  public static async updateAllEventStatusesHelper(): Promise<number> {
    const { BatchOperationsController } = await import(
      "./event/BatchOperationsController"
    );
    return BatchOperationsController.updateAllEventStatusesHelper();
  }

  // Recalculate signup counts for all events
  static async recalculateSignupCounts(
    req: Request,
    res: Response
  ): Promise<void> {
    const { BatchOperationsController } = await import(
      "./event/BatchOperationsController"
    );
    return BatchOperationsController.recalculateSignupCounts(req, res);
  }

  // Helper method to recalculate signup counts for all events
  private static async recalculateSignupCountsHelper(): Promise<number> {
    const { BatchOperationsController } = await import(
      "./event/BatchOperationsController"
    );
    return BatchOperationsController.recalculateSignupCountsHelper();
  }

  // Get all events with filtering and pagination
  // Delegated to EventQueryController
  static async getAllEvents(req: Request, res: Response): Promise<void> {
    const { EventQueryController } = await import(
      "./event/EventQueryController"
    );
    return EventQueryController.getAllEvents(req, res);
  }

  // Get single event by ID
  static async getEventById(req: Request, res: Response): Promise<void> {
    const { EventQueryController } = await import(
      "./event/EventQueryController"
    );
    return EventQueryController.getEventById(req, res);
  }

  /**
   * Check if an event has any registrations (user or guest)
   * Used by frontend to determine if confirmation modal should be shown before deleting registrations
   *
   * GET /api/events/:id/has-registrations
   *
   * @returns { hasRegistrations: boolean, userCount: number, guestCount: number, totalCount: number }
   */
  static async hasRegistrations(req: Request, res: Response): Promise<void> {
    const { MaintenanceController } = await import(
      "./event/MaintenanceController"
    );
    return MaintenanceController.hasRegistrations(req, res);
  }

  // Create new event
  static async createEvent(req: Request, res: Response): Promise<void> {
    const { CreationController } = await import("./event/CreationController");
    return CreationController.createEvent(req, res);
  }

  /**
   * Helper function to delete ALL registrations (both user and guest) for an event
   * Used when applying a role template that replaces existing roles with registrations
   *
   * @param eventId - MongoDB ObjectId of the event
   * @returns Promise resolving to deletion counts
   */
  // Update event
  static async updateEvent(req: Request, res: Response): Promise<void> {
    const { UpdateController } = await import("./event/UpdateController");
    return UpdateController.updateEvent(req, res);
  }

  // Delete event
  static async deleteEvent(req: Request, res: Response): Promise<void> {
    const { DeletionController } = await import("./event/DeletionController");
    return DeletionController.deleteEvent(req, res);
  }

  // Sign up for event role (THREAD-SAFE VERSION)
  static async signUpForEvent(req: Request, res: Response): Promise<void> {
    const { RegistrationController } = await import(
      "./event/RegistrationController"
    );
    return RegistrationController.signUpForEvent(req, res);
  }

  // Update a specific workshop group topic (Workshop only)
  static async updateWorkshopGroupTopic(
    req: Request,
    res: Response
  ): Promise<void> {
    const { RegistrationController } = await import(
      "./event/RegistrationController"
    );
    return RegistrationController.updateWorkshopGroupTopic(req, res);
  }

  // Cancel event signup (THREAD-SAFE VERSION)
  static async cancelSignup(req: Request, res: Response): Promise<void> {
    const { RegistrationController } = await import(
      "./event/RegistrationController"
    );
    return RegistrationController.cancelSignup(req, res);
  }

  // Remove user from role (admin/organizer management operation)
  static async removeUserFromRole(req: Request, res: Response): Promise<void> {
    const { RegistrationController } = await import(
      "./event/RegistrationController"
    );
    return RegistrationController.removeUserFromRole(req, res);
  }

  // Move user between roles (admin/organizer management operation)
  static async moveUserBetweenRoles(
    req: Request,
    res: Response
  ): Promise<void> {
    const { RegistrationController } = await import(
      "./event/RegistrationController"
    );
    return RegistrationController.moveUserBetweenRoles(req, res);
  }

  // Assign user to role (organizers/co-organizers only)
  static async assignUserToRole(req: Request, res: Response): Promise<void> {
    const { RegistrationController } = await import(
      "./event/RegistrationController"
    );
    return RegistrationController.assignUserToRole(req, res);
  }

  // Get user's registered events
  static async getUserEvents(req: Request, res: Response): Promise<void> {
    const { MaintenanceController } = await import(
      "./event/MaintenanceController"
    );
    return MaintenanceController.getUserEvents(req, res);
  }

  // Get events created by user
  static async getCreatedEvents(req: Request, res: Response): Promise<void> {
    const { MaintenanceController } = await import(
      "./event/MaintenanceController"
    );
    return MaintenanceController.getCreatedEvents(req, res);
  }

  // Get event participants (for event organizers and admins)
  static async getEventParticipants(
    req: Request,
    res: Response
  ): Promise<void> {
    const { MaintenanceController } = await import(
      "./event/MaintenanceController"
    );
    return MaintenanceController.getEventParticipants(req, res);
  }
}
