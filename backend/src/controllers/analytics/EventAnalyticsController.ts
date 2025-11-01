import { Request, Response } from "express";
import { Event, Registration } from "../../models";
import { hasPermission, PERMISSIONS } from "../../utils/roleUtils";
import {
  ResponseBuilderService,
  AnalyticsEventInput,
  LeanUser,
  EventRole,
} from "../../services/ResponseBuilderService";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";
import { Types } from "mongoose";

export default class EventAnalyticsController {
  static async getEventAnalytics(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      if (!hasPermission(req.user.role, PERMISSIONS.VIEW_SYSTEM_ANALYTICS)) {
        res.status(403).json({
          success: false,
          message: "Insufficient permissions to view event analytics.",
        });
        return;
      }

      // Event statistics by type
      const eventsByType = await Event.aggregate([
        { $group: { _id: "$type", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      // Event statistics by format
      const eventsByFormat = await Event.aggregate([
        { $group: { _id: "$format", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      // Registration statistics
      const registrationStats = await Registration.aggregate([
        {
          $lookup: {
            from: "events",
            localField: "eventId",
            foreignField: "_id",
            as: "event",
          },
        },
        { $unwind: "$event" },
        {
          $group: {
            _id: "$event.type",
            totalRegistrations: { $sum: 1 },
            averageRegistrations: { $avg: 1 },
          },
        },
      ]);

      // Event trends (last 12 months)
      const eventTrends = await Event.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]);

      // Get actual events data for frontend calculations

      // Get upcoming events (events that haven't started yet or are currently ongoing)
      const upcomingEventsRaw = await Event.find({
        status: { $in: ["upcoming", "ongoing"] },
      })
        .populate(
          "createdBy",
          "username firstName lastName email phone gender role roleInAtCloud avatar systemAuthorizationLevel"
        )
        .lean();

      // Get completed events
      const completedEventsRaw = await Event.find({
        status: "completed",
      })
        .populate(
          "createdBy",
          "username firstName lastName email phone gender role roleInAtCloud avatar systemAuthorizationLevel"
        )
        .lean();

      // Build events with registration data using our new service
      // Map lean events to the minimal AnalyticsEventInput shape
      type PopulatedCreatedBy = {
        _id?: string;
        username?: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
        gender?: string;
        role?: string;
        roleInAtCloud?: string;
        avatar?: string;
        systemAuthorizationLevel?: number;
      };

      type LeanEventDoc = {
        _id: Types.ObjectId;
        title?: string;
        date?: string | Date;
        endDate?: string | Date;
        time?: string;
        endTime?: string;
        location?: string;
        status?: string;
        format?: string;
        timeZone?: string;
        type?: string;
        hostedBy?: string;
        createdBy?:
          | PopulatedCreatedBy
          | Partial<LeanUser>
          | string
          | Types.ObjectId;
        roles?: EventRole[] | unknown[];
      };

      const mapToAnalyticsInput = (ev: LeanEventDoc): AnalyticsEventInput => ({
        _id: ev._id,
        title: String(ev.title ?? ""),
        date: String(ev.date ?? ""),
        endDate: ev.endDate !== undefined ? String(ev.endDate) : undefined,
        time: String(ev.time ?? ""),
        endTime: ev.endTime !== undefined ? String(ev.endTime) : undefined,
        location: ev.location ?? "",
        status: ev.status,
        format: ev.format,
        timeZone: ev.timeZone,
        type: ev.type,
        hostedBy: ev.hostedBy,
        createdBy:
          typeof ev.createdBy === "object" && ev.createdBy
            ? (ev.createdBy as LeanUser)
            : ({
                _id: new Types.ObjectId(),
                username: "",
                firstName: "",
                lastName: "",
              } as unknown as LeanUser),
        roles: (Array.isArray(ev.roles) ? ev.roles : []) as EventRole[],
      });

      const upcomingEvents =
        await ResponseBuilderService.buildAnalyticsEventData(
          (upcomingEventsRaw as unknown as LeanEventDoc[]).map(
            mapToAnalyticsInput
          )
        );
      const completedEvents =
        await ResponseBuilderService.buildAnalyticsEventData(
          (completedEventsRaw as unknown as LeanEventDoc[]).map(
            mapToAnalyticsInput
          )
        );

      res.status(200).json({
        success: true,
        data: {
          eventsByType,
          eventsByFormat,
          registrationStats,
          eventTrends,
          upcomingEvents,
          completedEvents,
        },
      });
    } catch (error: unknown) {
      console.error("Get event analytics error:", error);
      try {
        CorrelatedLogger.fromRequest(req, "AnalyticsController").error(
          "Get event analytics error",
          error as Error,
          "getEventAnalytics",
          { query: req.query }
        );
      } catch {}
      res.status(500).json({
        success: false,
        message: "Failed to retrieve event analytics.",
      });
    }
  }
}
