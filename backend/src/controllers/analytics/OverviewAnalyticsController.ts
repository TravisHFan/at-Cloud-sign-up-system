import { Request, Response } from "express";
import { User, Event, Registration } from "../../models";
import { hasPermission, PERMISSIONS } from "../../utils/roleUtils";
import { CachePatterns } from "../../services";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";

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

type CountResult = { count?: number };

type CapacityResult = {
  totalSlots?: number;
  filledSlots?: number;
};

type OverviewEventAggregate = {
  id: string;
  title: string;
  date?: string;
  type?: string;
  status?: string;
  registrations?: number;
  totalSlots?: number;
  signupRate?: number;
};

type OverviewProgramAggregate = {
  id: string;
  title: string;
  programType?: string;
  registrations?: number;
  events?: number;
};

type RecentRegistrationAggregate = {
  id: string;
  createdAt?: Date;
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  person?: string;
  eventTitle?: string;
  eventDate?: string;
};

type AttendanceSummaryAggregate = {
  registered?: number;
  recorded?: number;
  attended?: number;
};

const getDateStringDaysAgo = (daysAgo: number): string => {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
};

const getRegistrationStatusMatch = () => ({
  $in: [
    { $ifNull: ["$$registration.status", "active"] },
    ["active", "attended", "no_show"],
  ],
});

const normalizeCount = (result: CountResult[] | undefined): number =>
  result?.[0]?.count ?? 0;

const normalizeEventAggregate = (
  event: OverviewEventAggregate
): OverviewEventAggregate => ({
  id: String(event.id),
  title: event.title,
  date: event.date,
  type: event.type,
  status: event.status,
  registrations: event.registrations ?? 0,
  totalSlots: event.totalSlots ?? 0,
  signupRate: event.signupRate ?? 0,
});

const formatRecentPerson = (registration: RecentRegistrationAggregate) => {
  const fullName = [registration.firstName, registration.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return (
    fullName ||
    registration.username?.trim() ||
    registration.email?.trim() ||
    "Unknown"
  );
};

export default class OverviewAnalyticsController {
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
        "system-overview-v2",
        async () => {
          const today = getDateStringDaysAgo(0);
          const thirtyDaysAgoDate = new Date(
            Date.now() - 30 * 24 * 60 * 60 * 1000
          );
          const thirtyDaysAgo = getDateStringDaysAgo(30);

          const [
            totalUsers,
            totalEvents,
            completedEvents,
            totalRegistrations,
            activeParticipants,
            activeUsers,
            upcomingEvents,
            recentRegistrations,
            signupCapacity,
            newUsersLast30Days,
            newEventsLast30Days,
            registrationsLast30Days,
            attendanceLast30Days,
            lowSignupUpcomingEvents,
            missingAttendanceEvents,
            missingAttendanceRegistrations,
            waitlistedRegistrations,
            topEvents,
            topPrograms,
            recentActivity,
          ] = await Promise.all([
            User.countDocuments({ isActive: true }),
            Event.countDocuments(),
            Event.countDocuments({ status: "completed" }),
            Registration.countDocuments(),
            Registration.distinct("userId").then((ids) => ids.length),
            User.countDocuments({
              isActive: true,
              lastLogin: {
                $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            }),
            Event.countDocuments({
              date: { $gte: today },
            }),
            Registration.countDocuments({
              createdAt: {
                $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              },
            }),
            Event.aggregate([
              {
                $lookup: {
                  from: "registrations",
                  localField: "_id",
                  foreignField: "eventId",
                  as: "registrations",
                },
              },
              {
                $project: {
                  totalSlots: { $sum: "$roles.maxParticipants" },
                  filledSlots: {
                    $size: {
                      $filter: {
                        input: "$registrations",
                        as: "registration",
                        cond: getRegistrationStatusMatch(),
                      },
                    },
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  totalSlots: { $sum: "$totalSlots" },
                  filledSlots: { $sum: "$filledSlots" },
                },
              },
            ]),
            User.countDocuments({
              isActive: true,
              createdAt: { $gte: thirtyDaysAgoDate },
            }),
            Event.countDocuments({
              createdAt: { $gte: thirtyDaysAgoDate },
            }),
            Registration.countDocuments({
              createdAt: { $gte: thirtyDaysAgoDate },
            }),
            Registration.aggregate([
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
                $match: {
                  "event.status": "completed",
                  "event.date": { $gte: thirtyDaysAgo },
                  status: { $ne: "waitlisted" },
                },
              },
              {
                $group: {
                  _id: null,
                  registered: { $sum: 1 },
                  recorded: {
                    $sum: {
                      $cond: [
                        {
                          $or: [
                            { $eq: ["$status", "attended"] },
                            { $eq: ["$status", "no_show"] },
                            { $eq: ["$attendanceConfirmed", true] },
                          ],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                  attended: {
                    $sum: {
                      $cond: [
                        {
                          $or: [
                            { $eq: ["$status", "attended"] },
                            { $eq: ["$attendanceConfirmed", true] },
                          ],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                },
              },
            ]),
            Event.aggregate([
              {
                $match: {
                  status: { $in: ["upcoming", "ongoing"] },
                  date: { $gte: today },
                },
              },
              {
                $lookup: {
                  from: "registrations",
                  localField: "_id",
                  foreignField: "eventId",
                  as: "registrations",
                },
              },
              {
                $project: {
                  totalSlots: { $sum: "$roles.maxParticipants" },
                  registrations: {
                    $size: {
                      $filter: {
                        input: "$registrations",
                        as: "registration",
                        cond: getRegistrationStatusMatch(),
                      },
                    },
                  },
                },
              },
              {
                $project: {
                  signupRate: {
                    $cond: [
                      { $gt: ["$totalSlots", 0] },
                      {
                        $multiply: [
                          { $divide: ["$registrations", "$totalSlots"] },
                          100,
                        ],
                      },
                      0,
                    ],
                  },
                  totalSlots: 1,
                },
              },
              {
                $match: {
                  totalSlots: { $gt: 0 },
                  signupRate: { $lt: 50 },
                },
              },
              { $count: "count" },
            ]),
            Registration.aggregate([
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
                $match: {
                  "event.status": "completed",
                  status: { $nin: ["waitlisted", "attended", "no_show"] },
                  attendanceConfirmed: { $ne: true },
                },
              },
              { $group: { _id: "$eventId" } },
              { $count: "count" },
            ]),
            Registration.aggregate([
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
                $match: {
                  "event.status": "completed",
                  status: { $nin: ["waitlisted", "attended", "no_show"] },
                  attendanceConfirmed: { $ne: true },
                },
              },
              { $count: "count" },
            ]),
            Registration.countDocuments({ status: "waitlisted" }),
            Event.aggregate([
              {
                $lookup: {
                  from: "registrations",
                  localField: "_id",
                  foreignField: "eventId",
                  as: "registrations",
                },
              },
              {
                $project: {
                  id: { $toString: "$_id" },
                  title: 1,
                  date: 1,
                  type: 1,
                  status: 1,
                  totalSlots: { $sum: "$roles.maxParticipants" },
                  registrations: {
                    $size: {
                      $filter: {
                        input: "$registrations",
                        as: "registration",
                        cond: getRegistrationStatusMatch(),
                      },
                    },
                  },
                },
              },
              {
                $project: {
                  id: 1,
                  title: 1,
                  date: 1,
                  type: 1,
                  status: 1,
                  registrations: 1,
                  totalSlots: 1,
                  signupRate: {
                    $cond: [
                      { $gt: ["$totalSlots", 0] },
                      {
                        $multiply: [
                          { $divide: ["$registrations", "$totalSlots"] },
                          100,
                        ],
                      },
                      0,
                    ],
                  },
                },
              },
              { $sort: { registrations: -1, date: -1, title: 1 } },
              { $limit: 5 },
            ]),
            Event.aggregate([
              {
                $match: {
                  programLabels: { $exists: true, $not: { $size: 0 } },
                },
              },
              {
                $lookup: {
                  from: "registrations",
                  localField: "_id",
                  foreignField: "eventId",
                  as: "registrations",
                },
              },
              {
                $project: {
                  programLabels: 1,
                  registrationCount: {
                    $size: {
                      $filter: {
                        input: "$registrations",
                        as: "registration",
                        cond: getRegistrationStatusMatch(),
                      },
                    },
                  },
                },
              },
              { $unwind: "$programLabels" },
              {
                $group: {
                  _id: "$programLabels",
                  registrations: { $sum: "$registrationCount" },
                  events: { $sum: 1 },
                },
              },
              {
                $lookup: {
                  from: "programs",
                  localField: "_id",
                  foreignField: "_id",
                  as: "program",
                },
              },
              {
                $unwind: {
                  path: "$program",
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $project: {
                  id: { $toString: "$_id" },
                  title: { $ifNull: ["$program.title", "Unknown Program"] },
                  programType: "$program.programType",
                  registrations: 1,
                  events: 1,
                },
              },
              { $sort: { registrations: -1, title: 1 } },
              { $limit: 5 },
            ]),
            Registration.aggregate([
              { $sort: { createdAt: -1 } },
              { $limit: 5 },
              {
                $project: {
                  id: { $toString: "$_id" },
                  createdAt: 1,
                  firstName: "$userSnapshot.firstName",
                  lastName: "$userSnapshot.lastName",
                  username: "$userSnapshot.username",
                  email: "$userSnapshot.email",
                  eventTitle: "$eventSnapshot.title",
                  eventDate: "$eventSnapshot.date",
                },
              },
            ]),
          ]);

          const capacity = (signupCapacity as CapacityResult[])[0];
          const totalSlots = capacity?.totalSlots ?? 0;
          const filledSlots = capacity?.filledSlots ?? 0;
          const averageSignupRate =
            totalSlots > 0 ? (filledSlots / totalSlots) * 100 : 0;
          const attendanceSummary =
            (attendanceLast30Days as AttendanceSummaryAggregate[])[0] || {};
          const last30Registered = attendanceSummary.registered ?? 0;
          const last30Recorded = attendanceSummary.recorded ?? 0;
          const last30Attended = attendanceSummary.attended ?? 0;

          return {
            overview: {
              totalUsers,
              totalEvents,
              completedEvents,
              totalRegistrations,
              activeParticipants,
              averageSignupRate,
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
            last30Days: {
              newUsers: newUsersLast30Days,
              newEvents: newEventsLast30Days,
              registrations: registrationsLast30Days,
              attendanceCompletionRate:
                last30Registered > 0
                  ? (last30Recorded / last30Registered) * 100
                  : 0,
              attendanceRate:
                last30Recorded > 0 ? (last30Attended / last30Recorded) * 100 : 0,
            },
            needsAttention: {
              lowSignupUpcomingEvents: normalizeCount(
                lowSignupUpcomingEvents as CountResult[]
              ),
              completedEventsMissingAttendance: normalizeCount(
                missingAttendanceEvents as CountResult[]
              ),
              unrecordedAttendance: normalizeCount(
                missingAttendanceRegistrations as CountResult[]
              ),
              waitlistedRegistrations,
            },
            topEvents: (topEvents as OverviewEventAggregate[]).map(
              normalizeEventAggregate
            ),
            topPrograms: (topPrograms as OverviewProgramAggregate[]).map(
              (program) => ({
                id: String(program.id),
                title: program.title,
                programType: program.programType,
                registrations: program.registrations ?? 0,
                events: program.events ?? 0,
              })
            ),
            recentActivity: (
              recentActivity as RecentRegistrationAggregate[]
            ).map((registration) => ({
              id: String(registration.id),
              type: "registration" as const,
              person: formatRecentPerson(registration),
              eventTitle: registration.eventTitle || "Unknown event",
              eventDate: registration.eventDate,
              createdAt: registration.createdAt?.toISOString?.() || "",
            })),
          };
        }
      );

      res.status(200).json({
        success: true,
        data: analytics,
      });
    } catch (error: unknown) {
      console.error("Get analytics error:", error);
      try {
        CorrelatedLogger.fromRequest(req, "AnalyticsController").error(
          "Get analytics error",
          error as Error,
          "getAnalytics",
          { query: req.query }
        );
      } catch {}
      res.status(500).json({
        success: false,
        message: "Failed to retrieve analytics.",
      });
    }
  }
}
