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
