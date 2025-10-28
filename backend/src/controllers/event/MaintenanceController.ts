import { Request, Response } from "express";
import mongoose from "mongoose";
import { Event, Registration } from "../../models";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";
import { EventController } from "../eventController";

/**
 * MaintenanceController
 *
 * Handles event maintenance and utility operations:
 * - hasRegistrations: Check if an event has any registrations
 * - getUserEvents: Get user's registered events with pagination
 * - getCreatedEvents: Get events created by the user
 */
export class MaintenanceController {
  /**
   * Check if an event has any registrations (user or guest)
   * Used by frontend to determine if confirmation modal should be shown before deleting registrations
   *
   * GET /api/events/:id/has-registrations
   *
   * @returns { hasRegistrations: boolean, userCount: number, guestCount: number, totalCount: number }
   */
  static async hasRegistrations(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid event ID.",
        });
        return;
      }

      // Count user registrations
      const userCount = await Registration.countDocuments({ eventId: id });

      // Count guest registrations
      const { GuestRegistration } = await import("../../models");
      const guestCount = await GuestRegistration.countDocuments({
        eventId: id,
        status: "active", // Only count active guest registrations
      });

      const totalCount = userCount + guestCount;
      const hasRegistrations = totalCount > 0;

      res.status(200).json({
        success: true,
        data: {
          hasRegistrations,
          userCount,
          guestCount,
          totalCount,
        },
      });
    } catch (error: unknown) {
      console.error("Check registrations error:", error);
      CorrelatedLogger.fromRequest(req, "EventController").error(
        "hasRegistrations failed",
        error as Error,
        undefined,
        { eventId: req.params?.id }
      );
      res.status(500).json({
        success: false,
        message: "Failed to check event registrations.",
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

      // Pagination params (optional for backwards compatibility)
      const { page = 1, limit = 10 } = req.query;
      const pageNumber = parseInt(page as string);
      const limitNumber = parseInt(limit as string);

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
          // Use unified status logic (timezone + endDate aware) instead of naive local Date parse
          // Provide safe fallbacks: if endDate absent use start date; if endTime absent use start time
          // (zero-duration events are treated as a single instant and will classify as completed at start).
          const endDate = event.endDate || event.date;
          const endTime = event.endTime || event.time; // Avoid legacy 3-arg path mis-parsing when endTime undefined
          const computedStatus = EventController.getEventStatus(
            event.date,
            endDate,
            event.time,
            endTime,
            event.timeZone
          );
          const isPassedEvent = computedStatus === "completed";

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
            eventStatus: isPassedEvent
              ? "passed"
              : computedStatus === "ongoing"
              ? "ongoing"
              : "upcoming",
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

      // Build pagination over the distinct events (not registrations)
      const totalEvents = stats.total;
      const totalPages = Math.max(1, Math.ceil(totalEvents / limitNumber));
      const clampedPage = Math.min(Math.max(pageNumber, 1), totalPages);
      const startIndex = (clampedPage - 1) * limitNumber;
      const endIndex = startIndex + limitNumber;
      const pagedEvents = uniqueEventsArray.slice(startIndex, endIndex);

      // Filter original registrations to only those belonging to paged events
      const pagedEventIds = new Set(pagedEvents.map((e) => e.event.id));
      const pagedRegistrations = events.filter((e) =>
        pagedEventIds.has(e.event.id)
      );

      res.status(200).json({
        success: true,
        data: {
          events: pagedRegistrations,
          stats,
          pagination: {
            currentPage: clampedPage,
            totalPages,
            totalEvents,
            hasNext: clampedPage < totalPages,
            hasPrev: clampedPage > 1,
            pageSize: limitNumber,
          },
        },
      });
    } catch (error: unknown) {
      console.error("Get user events error:", error);
      CorrelatedLogger.fromRequest(req, "EventController").error(
        "getUserEvents failed",
        error as Error
      );
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
      CorrelatedLogger.fromRequest(req, "EventController").error(
        "getCreatedEvents failed",
        error as Error
      );
      res.status(500).json({
        success: false,
        message: "Failed to retrieve created events.",
      });
    }
  }
}
