import { Request, Response } from "express";
import { User, Event } from "../../models";
import { hasPermission, PERMISSIONS } from "../../utils/roleUtils";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";

export default class EngagementAnalyticsController {
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
      try {
        CorrelatedLogger.fromRequest(req, "AnalyticsController").error(
          "Get engagement analytics error",
          error as Error,
          "getEngagementAnalytics",
          { query: req.query }
        );
      } catch {}
      res.status(500).json({
        success: false,
        message: "Failed to retrieve engagement analytics.",
      });
    }
  }
}
