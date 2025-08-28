import { Request, Response } from "express";
import { User, Event, Registration } from "../models";
import { hasPermission, PERMISSIONS } from "../utils/roleUtils";
import {
  ResponseBuilderService,
  AnalyticsEventInput,
  LeanUser,
  EventRole,
} from "../services/ResponseBuilderService";
import { CachePatterns } from "../services";
import * as XLSX from "xlsx";
import { Types } from "mongoose";

export class AnalyticsController {
  // Get general analytics overview
  static async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      // Check permissions
      if (!hasPermission(req.user.role, PERMISSIONS.VIEW_SYSTEM_ANALYTICS)) {
        res.status(403).json({
          success: false,
          message: "Insufficient permissions to view analytics.",
        });
        return;
      }

      // Get overview statistics with caching
      const analytics = await CachePatterns.getAnalyticsData(
        "system-overview",
        async () => {
          const [
            totalUsers,
            totalEvents,
            totalRegistrations,
            activeUsers,
            upcomingEvents,
            recentRegistrations,
          ] = await Promise.all([
            User.countDocuments({ isActive: true }),
            Event.countDocuments(),
            Registration.countDocuments(),
            User.countDocuments({
              isActive: true,
              lastLogin: {
                $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            }),
            Event.countDocuments({
              date: { $gte: new Date() },
            }),
            Registration.countDocuments({
              createdAt: {
                $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              },
            }),
          ]);

          return {
            overview: {
              totalUsers,
              totalEvents,
              totalRegistrations,
              activeUsers,
              upcomingEvents,
              recentRegistrations,
            },
            growth: {
              userGrowthRate: await calculateGrowthRate("users"),
              eventGrowthRate: await calculateGrowthRate("events"),
              registrationGrowthRate: await calculateGrowthRate(
                "registrations"
              ),
            },
          };
        }
      );

      res.status(200).json({
        success: true,
        data: analytics,
      });
    } catch (error: unknown) {
      console.error("Get analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve analytics.",
      });
    }
  }

  // Get user analytics
  static async getUserAnalytics(req: Request, res: Response): Promise<void> {
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
          message: "Insufficient permissions to view user analytics.",
        });
        return;
      }

      // User statistics by role
      const usersByRole = await User.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: "$role", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      // User statistics by @Cloud co-worker status
      const usersByAtCloudStatus = await User.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: "$isAtCloudLeader", count: { $sum: 1 } } },
      ]);

      // User statistics by church
      const usersByChurch = await User.aggregate([
        {
          $match: { isActive: true, weeklyChurch: { $exists: true, $ne: "" } },
        },
        { $group: { _id: "$weeklyChurch", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]);

      // User registration trends (last 12 months)
      const registrationTrends = await User.aggregate([
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

      res.status(200).json({
        success: true,
        data: {
          usersByRole,
          usersByAtCloudStatus,
          usersByChurch,
          registrationTrends,
        },
      });
    } catch (error: unknown) {
      console.error("Get user analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve user analytics.",
      });
    }
  }

  // Get event analytics
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
      res.status(500).json({
        success: false,
        message: "Failed to retrieve event analytics.",
      });
    }
  }

  // Get engagement analytics
  static async getEngagementAnalytics(
    req: Request,
    res: Response
  ): Promise<void> {
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
          message: "Insufficient permissions to view engagement analytics.",
        });
        return;
      }

      // Event participation rates
      const participationRates = await Event.aggregate([
        {
          $lookup: {
            from: "registrations",
            localField: "_id",
            foreignField: "eventId",
            as: "registrations",
          },
        },
        {
          $addFields: {
            totalSlots: { $sum: "$roles.maxParticipants" },
            filledSlots: { $size: "$registrations" },
          },
        },
        {
          $addFields: {
            participationRate: {
              $cond: {
                if: { $gt: ["$totalSlots", 0] },
                then: { $divide: ["$filledSlots", "$totalSlots"] },
                else: 0,
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            averageParticipationRate: { $avg: "$participationRate" },
            totalEvents: { $sum: 1 },
          },
        },
      ]);

      // User activity
      const userActivity = await User.aggregate([
        {
          $match: {
            lastLogin: {
              $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$lastLogin" },
              month: { $month: "$lastLogin" },
              day: { $dayOfMonth: "$lastLogin" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      ]);

      res.status(200).json({
        success: true,
        data: {
          participationRates: participationRates[0] || {
            averageParticipationRate: 0,
            totalEvents: 0,
          },
          userActivity,
        },
      });
    } catch (error: unknown) {
      console.error("Get engagement analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve engagement analytics.",
      });
    }
  }

  // Export analytics data
  static async exportAnalytics(req: Request, res: Response): Promise<void> {
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
          message: "Insufficient permissions to export analytics.",
        });
        return;
      }

      const format = (req.query.format as string) || "json";

      // Get comprehensive analytics data
      const data = {
        users: (await User.find({ isActive: true })
          .select("-password")
          .lean()) as Array<{
          username?: string;
          firstName?: string;
          lastName?: string;
          role?: string;
          isAtCloudLeader?: boolean;
          createdAt?: string | Date;
        }>,
        events: (await Event.find().lean()) as Array<{
          title?: string;
          type?: string;
          date?: string | Date;
          location?: string;
          format?: string;
          status?: string;
          createdAt?: string | Date;
        }>,
        registrations: (await Registration.find().lean()) as Array<{
          userId?: string;
          eventId?: string;
          roleId?: string;
          status?: string;
          registrationDate?: string | Date;
        }>,
        timestamp: new Date().toISOString(),
      };

      if (format === "json") {
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=analytics.json"
        );
        res.send(JSON.stringify(data, null, 2));
      } else if (format === "csv") {
        // Enhanced CSV export
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=analytics.csv"
        );

        let csv = "Type,Count\n";
        csv += `Users,${data.users.length}\n`;
        csv += `Events,${data.events.length}\n`;
        csv += `Registrations,${data.registrations.length}\n`;

        res.send(csv);
      } else if (format === "xlsx") {
        // Enhanced XLSX export with multiple sheets
        const workbook = XLSX.utils.book_new();

        // Overview sheet
        const overviewData = [
          ["Metric", "Value", "Timestamp"],
          ["Total Users", data.users.length, data.timestamp],
          ["Total Events", data.events.length, data.timestamp],
          ["Total Registrations", data.registrations.length, data.timestamp],
        ];
        const overviewWS = XLSX.utils.aoa_to_sheet(overviewData);
        XLSX.utils.book_append_sheet(workbook, overviewWS, "Overview");

        // Users sheet (limited fields for privacy)
        const usersData = [
          [
            "Username",
            "First Name",
            "Last Name",
            "Role",
            "@Cloud Co-worker",
            "Join Date",
          ],
          ...data.users.map((user) => [
            user.username,
            user.firstName || "",
            user.lastName || "",
            user.role,
            user.isAtCloudLeader ? "Yes" : "No",
            user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "",
          ]),
        ];
        const usersWS = XLSX.utils.aoa_to_sheet(usersData);
        XLSX.utils.book_append_sheet(workbook, usersWS, "Users");

        // Events sheet
        const eventsData = [
          [
            "Title",
            "Type",
            "Date",
            "Location",
            "Format",
            "Status",
            "Created Date",
          ],
          ...data.events.map((event) => [
            event.title,
            event.type,
            event.date,
            event.location,
            event.format,
            event.status || "upcoming",
            event.createdAt
              ? new Date(event.createdAt).toLocaleDateString()
              : "",
          ]),
        ];
        const eventsWS = XLSX.utils.aoa_to_sheet(eventsData);
        XLSX.utils.book_append_sheet(workbook, eventsWS, "Events");

        // Registrations sheet
        const registrationsData = [
          ["User ID", "Event ID", "Role ID", "Status", "Registration Date"],
          ...data.registrations.map((reg) => [
            reg.userId,
            reg.eventId,
            reg.roleId,
            reg.status,
            reg.registrationDate
              ? new Date(reg.registrationDate).toLocaleDateString()
              : "",
          ]),
        ];
        const registrationsWS = XLSX.utils.aoa_to_sheet(registrationsData);
        XLSX.utils.book_append_sheet(
          workbook,
          registrationsWS,
          "Registrations"
        );

        // Generate buffer
        const buffer = XLSX.write(workbook, {
          type: "buffer",
          bookType: "xlsx",
        });

        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=analytics.xlsx"
        );
        res.send(buffer);
      } else {
        res.status(400).json({
          success: false,
          message: "Unsupported format. Use 'json', 'csv', or 'xlsx'.",
        });
      }
    } catch (error: unknown) {
      console.error("Export analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export analytics.",
      });
    }
  }
}

// Helper function to calculate growth rate
async function calculateGrowthRate(
  type: "users" | "events" | "registrations"
): Promise<number> {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let Model;
  switch (type) {
    case "users":
      Model = User;
      break;
    case "events":
      Model = Event;
      break;
    case "registrations":
      Model = Registration;
      break;
  }

  const [lastMonthCount, thisMonthCount] = await Promise.all([
    Model.countDocuments({
      createdAt: { $gte: lastMonth, $lt: thisMonth },
    }),
    Model.countDocuments({
      createdAt: { $gte: thisMonth },
    }),
  ]);

  if (lastMonthCount === 0) return thisMonthCount > 0 ? 100 : 0;
  return ((thisMonthCount - lastMonthCount) / lastMonthCount) * 100;
}
