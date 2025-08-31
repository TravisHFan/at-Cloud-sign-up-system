import { Request, Response } from "express";
import { User, Event, Registration, GuestRegistration } from "../models";
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
      const allowedFormats = new Set(["json", "csv", "xlsx"]);
      if (!allowedFormats.has(format)) {
        res.status(400).json({
          success: false,
          message: "Unsupported format. Use 'json', 'csv', or 'xlsx'.",
        });
        return;
      }

      // Optional export constraints (sensible defaults)
      // Query params: from, to (ISO date), maxRows (number)
      const fromParam = req.query.from as string | undefined;
      const toParam = req.query.to as string | undefined;
      const maxRowsParam = req.query.maxRows as string | undefined;

      const now = new Date();
      const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 6, 1); // last ~6 months by default
      const fromDate = fromParam ? new Date(fromParam) : defaultFrom;
      const toDate = toParam ? new Date(toParam) : now;
      const MAX_ROWS_HARD_CAP = 25000; // absolute cap as safety net
      const SOFT_DEFAULT_CAP = 5000; // default soft cap
      const maxRows = Math.min(
        Math.max(0, Number(maxRowsParam ?? SOFT_DEFAULT_CAP)) ||
          SOFT_DEFAULT_CAP,
        MAX_ROWS_HARD_CAP
      );

      // Base filters
      const userFilter = {
        isActive: true,
        createdAt: { $gte: fromDate, $lte: toDate },
      } as const;
      const eventFilter = {
        createdAt: { $gte: fromDate, $lte: toDate },
      } as const;
      const registrationFilter = {
        createdAt: { $gte: fromDate, $lte: toDate },
      } as const;

      // Helper to safely fetch arrays from mongoose or mocked find() calls
      const safeFetch = async <T = unknown>(
        model: unknown,
        filter: Record<string, unknown>,
        opts?: {
          select?: string | Record<string, number | boolean>;
          sort?: Record<string, unknown>;
          limit?: number;
          lean?: boolean;
          strict?: boolean;
        }
      ): Promise<T[]> => {
        try {
          const hasFind =
            model && typeof (model as { find?: unknown }).find === "function";
          const finder = hasFind
            ? (model as { find: (f: Record<string, unknown>) => unknown }).find(
                filter
              )
            : undefined;
          // Chainable mongoose query path
          if (finder && typeof finder === "object") {
            let q: unknown = finder;
            // select
            const sel = (
              q as {
                select?: (
                  s: string | Record<string, number | boolean>
                ) => unknown;
              }
            ).select;
            if (opts?.select && typeof sel === "function") {
              q = sel.call(q as object, opts.select);
            }
            // sort
            const sorter = (
              q as {
                sort?: (s: Record<string, unknown>) => unknown;
              }
            ).sort;
            if (opts?.sort && typeof sorter === "function") {
              q = sorter.call(q as object, opts.sort);
            }
            // limit
            const limiter = (q as { limit?: (n: number) => unknown }).limit;
            if (
              typeof opts?.limit === "number" &&
              typeof limiter === "function"
            ) {
              q = limiter.call(q as object, opts.limit);
            }
            // lean
            const leaner = (q as { lean?: () => Promise<T[]> }).lean;
            if (opts?.lean !== false && typeof leaner === "function") {
              return await leaner.call(q as object);
            }
            // Fallback to awaiting the query if thenable
            const thenable = q as {
              then?: (onf: (v: T[]) => unknown) => unknown;
            };
            if (thenable && typeof thenable.then === "function")
              return (await (thenable as unknown as Promise<T[]>)) as T[];
          }
          // If finder is already a thenable (some mocks)
          if (
            finder &&
            typeof (finder as { then?: unknown }).then === "function"
          )
            return (await (finder as unknown as Promise<T[]>)) as T[];
          // If finder is an array (some simplistic mocks)
          if (Array.isArray(finder)) return finder as T[];
          return [] as T[];
        } catch (e) {
          if (opts?.strict) {
            throw e;
          }
          console.warn("safeFetch fallback: returning [] due to error", e);
          return [] as T[];
        }
      };

      // Get constrained analytics data
      const data = {
        users: (await safeFetch(User as unknown, userFilter, {
          select: "-password",
          sort: { createdAt: -1 },
          limit: maxRows,
          strict: true,
        })) as Array<{
          username?: string;
          firstName?: string;
          lastName?: string;
          email?: string;
          phone?: string;
          role?: string;
          isAtCloudLeader?: boolean;
          roleInAtCloud?: string;
          gender?: string;
          occupation?: string;
          company?: string;
          weeklyChurch?: string;
          churchAddress?: string;
          isVerified?: boolean;
          isActive?: boolean;
          lastLogin?: string | Date;
          createdAt?: string | Date;
        }>,
        events: (await safeFetch(Event as unknown, eventFilter, {
          sort: { createdAt: -1 },
          limit: maxRows,
          strict: true,
        })) as Array<{
          title?: string;
          type?: string;
          date?: string | Date;
          endDate?: string | Date;
          time?: string;
          endTime?: string;
          timeZone?: string;
          location?: string;
          format?: string;
          status?: string;
          hostedBy?: string;
          organizer?: string;
          roles?: Array<{ name?: string; maxParticipants?: number }>;
          totalSlots?: number;
          signedUp?: number;
          createdBy?:
            | {
                username?: string;
                firstName?: string;
                lastName?: string;
                email?: string;
              }
            | string;
          createdAt?: string | Date;
        }>,
        registrations: (await safeFetch(
          Registration as unknown,
          registrationFilter,
          {
            sort: { createdAt: -1 },
            limit: maxRows,
            strict: true,
          }
        )) as Array<{
          userId?: string;
          eventId?: string;
          roleId?: string;
          status?: string;
          registrationDate?: string | Date;
          attendanceConfirmed?: boolean;
          notes?: string;
          specialRequirements?: string;
          registeredBy?: string;
          userSnapshot?: {
            username?: string;
            firstName?: string;
            lastName?: string;
            email?: string;
          };
          eventSnapshot?: {
            title?: string;
            date?: string;
            time?: string;
            location?: string;
            type?: string;
            roleName?: string;
          };
        }>,
        guestRegistrations: (await (async () => {
          // Define a minimal lean shape for GuestRegistration to avoid explicit 'any'.
          type GuestRegLean = {
            fullName?: string;
            gender?: "male" | "female" | string;
            email?: string;
            phone?: string;
            status?: string;
            registrationDate?: string | Date;
            eventId?: unknown;
            roleId?: string;
            migratedToUserId?: unknown;
            migrationStatus?: string;
            eventSnapshot?: {
              title?: string;
              date?: Date | string;
              location?: string;
              roleName?: string;
            };
            notes?: string;
          };

          try {
            const canQuery =
              Boolean(GuestRegistration) &&
              typeof (GuestRegistration as Partial<{ find: unknown }>).find ===
                "function";
            if (!canQuery) return [] as GuestRegLean[];

            // Use a loose type to allow filter/sort/limit chaining in tests
            const modelAny = GuestRegistration as unknown as {
              find: (filter?: Record<string, unknown>) => {
                sort: (s: Record<string, unknown>) => {
                  limit: (n: number) => { lean: () => Promise<GuestRegLean[]> };
                };
                lean: () => Promise<GuestRegLean[]>;
              };
            };
            const raw = await (modelAny.find
              ? modelAny
                  .find({ createdAt: { $gte: fromDate, $lte: toDate } })
                  .sort({ createdAt: -1 })
                  .limit(maxRows)
                  .lean()
              : Promise.resolve([] as GuestRegLean[]));

            return raw.map((g: GuestRegLean) => ({
              fullName: g.fullName,
              gender: g.gender,
              email: g.email,
              phone: g.phone,
              status: g.status,
              registrationDate: g.registrationDate,
              eventId: g.eventId != null ? String(g.eventId) : undefined,
              roleId: g.roleId,
              migratedToUserId:
                g.migratedToUserId != null
                  ? String(g.migratedToUserId)
                  : undefined,
              migrationStatus: g.migrationStatus,
              eventSnapshot: g.eventSnapshot
                ? {
                    title: g.eventSnapshot.title,
                    date: g.eventSnapshot.date,
                    location: g.eventSnapshot.location,
                    roleName: g.eventSnapshot.roleName,
                  }
                : undefined,
              notes: g.notes,
            }));
          } catch (e) {
            console.warn(
              "GuestRegistrations fetch failed, continuing without guests:",
              e
            );
            return [] as GuestRegLean[];
          }
        })()) as Array<{
          fullName?: string;
          gender?: "male" | "female" | string;
          email?: string;
          phone?: string;
          status?: string;
          registrationDate?: string | Date;
          eventId?: string;
          roleId?: string;
          migratedToUserId?: string;
          migrationStatus?: string;
          eventSnapshot?: {
            title?: string;
            date?: Date | string;
            location?: string;
            roleName?: string;
          };
          notes?: string;
        }>,
        timestamp: new Date().toISOString(),
        meta: {
          filteredFrom: fromDate.toISOString(),
          filteredTo: toDate.toISOString(),
          rowLimit: maxRows,
        },
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
        if (data.guestRegistrations && data.guestRegistrations.length > 0) {
          csv += `GuestRegistrations,${data.guestRegistrations.length}\n`;
        }

        res.send(csv);
      } else if (format === "xlsx") {
        // XLSX export
        const workbook = XLSX.utils.book_new();

        // Overview sheet
        const overviewData = [
          ["Metric", "Value", "Timestamp"],
          ["Total Users", data.users.length, data.timestamp],
          ["Total Events", data.events.length, data.timestamp],
          ["Total Registrations", data.registrations.length, data.timestamp],
          [
            "Total Guest Registrations",
            data.guestRegistrations.length,
            data.timestamp,
          ],
        ];
        const overviewWS = XLSX.utils.aoa_to_sheet(overviewData);
        XLSX.utils.book_append_sheet(workbook, overviewWS, "Overview");

        // Users sheet (minimal schema expected by tests)
        // Columns (0-based): Username(0), First Name(1), Last Name(2), Role(3), @Cloud Co-worker(4), Join Date(5)
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
            user.username ?? "",
            user.firstName ?? "",
            user.lastName ?? "",
            user.role ?? "",
            user.isAtCloudLeader ? "Yes" : "No",
            user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "",
          ]),
        ];
        const usersWS = XLSX.utils.aoa_to_sheet(usersData);
        XLSX.utils.book_append_sheet(workbook, usersWS, "Users");

        // Events sheet (minimal schema expected by tests)
        // Columns (0-based): Title(0), Type(1), Date(2), Location(3), Format(4), Status(5), Created Date(6)
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
            event.title ?? "",
            event.type ?? "",
            event.date ?? "",
            event.location ?? "",
            event.format ?? "",
            event.status || "upcoming",
            event.createdAt
              ? new Date(event.createdAt).toLocaleDateString()
              : "",
          ]),
        ];
        const eventsWS = XLSX.utils.aoa_to_sheet(eventsData);
        XLSX.utils.book_append_sheet(workbook, eventsWS, "Events");

        // Registrations sheet (minimal schema expected by tests)
        // Columns (0-based): User ID(0), Event ID(1), Role ID(2), Status(3), Registration Date(4)
        const registrationsData = [
          ["User ID", "Event ID", "Role ID", "Status", "Registration Date"],
          ...data.registrations.map((reg) => [
            reg.userId ?? "",
            reg.eventId ?? "",
            reg.roleId ?? "",
            reg.status ?? "",
            reg.registrationDate
              ? new Date(reg.registrationDate).toLocaleString()
              : "",
          ]),
        ];
        const registrationsWS = XLSX.utils.aoa_to_sheet(registrationsData);
        XLSX.utils.book_append_sheet(
          workbook,
          registrationsWS,
          "Registrations"
        );

        // Guest Registrations sheet (only when data present to preserve legacy test expectations)
        if (data.guestRegistrations && data.guestRegistrations.length > 0) {
          const guestRegsData = [
            [
              "Full Name",
              "Gender",
              "Email",
              "Phone",
              "Event ID",
              "Event Title",
              "Event Date",
              "Location",
              "Role Name",
              "Status",
              "Migrated To User ID",
              "Migration Status",
              "Notes",
              "Registration Date",
            ],
            ...data.guestRegistrations.map((g) => [
              g.fullName ?? "",
              g.gender ?? "",
              g.email ?? "",
              g.phone ?? "",
              g.eventId ?? "",
              g.eventSnapshot?.title ?? "",
              g.eventSnapshot?.date
                ? new Date(
                    g.eventSnapshot.date as Date | string
                  ).toLocaleString()
                : "",
              g.eventSnapshot?.location ?? "",
              g.eventSnapshot?.roleName ?? "",
              g.status ?? "",
              g.migratedToUserId ?? "",
              g.migrationStatus ?? "",
              g.notes ?? "",
              g.registrationDate
                ? new Date(g.registrationDate).toLocaleString()
                : "",
            ]),
          ];
          const guestRegsWS = XLSX.utils.aoa_to_sheet(guestRegsData);
          XLSX.utils.book_append_sheet(
            workbook,
            guestRegsWS,
            "Guest Registrations"
          );
        }

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
