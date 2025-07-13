import { Request, Response } from "express";
import { User, Event, Registration, Message, Notification } from "../models";
import { hasPermission, PERMISSIONS } from "../utils/roleUtils";

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

      // Get overview statistics
      const [
        totalUsers,
        totalEvents,
        totalRegistrations,
        totalMessages,
        totalNotifications,
        activeUsers,
        upcomingEvents,
        recentRegistrations
      ] = await Promise.all([
        User.countDocuments({ isActive: true }),
        Event.countDocuments(),
        Registration.countDocuments(),
        Message.countDocuments({ isDeleted: false }),
        Notification.countDocuments(),
        User.countDocuments({ 
          isActive: true, 
          lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } 
        }),
        Event.countDocuments({ 
          date: { $gte: new Date() } 
        }),
        Registration.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        })
      ]);

      const analytics = {
        overview: {
          totalUsers,
          totalEvents,
          totalRegistrations,
          totalMessages,
          totalNotifications,
          activeUsers,
          upcomingEvents,
          recentRegistrations
        },
        growth: {
          userGrowthRate: await calculateGrowthRate('users'),
          eventGrowthRate: await calculateGrowthRate('events'),
          registrationGrowthRate: await calculateGrowthRate('registrations')
        }
      };

      res.status(200).json({
        success: true,
        data: analytics,
      });
    } catch (error: any) {
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
        { $sort: { count: -1 } }
      ]);

      // User statistics by @Cloud Leader status
      const usersByAtCloudStatus = await User.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: "$isAtCloudLeader", count: { $sum: 1 } } }
      ]);

      // User statistics by church
      const usersByChurch = await User.aggregate([
        { $match: { isActive: true, weeklyChurch: { $exists: true, $ne: "" } } },
        { $group: { _id: "$weeklyChurch", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      // User registration trends (last 12 months)
      const registrationTrends = await User.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ]);

      res.status(200).json({
        success: true,
        data: {
          usersByRole,
          usersByAtCloudStatus,
          usersByChurch,
          registrationTrends
        },
      });
    } catch (error: any) {
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
        { $sort: { count: -1 } }
      ]);

      // Event statistics by format
      const eventsByFormat = await Event.aggregate([
        { $group: { _id: "$format", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      // Registration statistics
      const registrationStats = await Registration.aggregate([
        {
          $lookup: {
            from: "events",
            localField: "eventId",
            foreignField: "_id",
            as: "event"
          }
        },
        { $unwind: "$event" },
        {
          $group: {
            _id: "$event.type",
            totalRegistrations: { $sum: 1 },
            averageRegistrations: { $avg: 1 }
          }
        }
      ]);

      // Event trends (last 12 months)
      const eventTrends = await Event.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ]);

      res.status(200).json({
        success: true,
        data: {
          eventsByType,
          eventsByFormat,
          registrationStats,
          eventTrends
        },
      });
    } catch (error: any) {
      console.error("Get event analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve event analytics.",
      });
    }
  }

  // Get engagement analytics
  static async getEngagementAnalytics(req: Request, res: Response): Promise<void> {
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

      // Message activity
      const messageActivity = await Message.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            isDeleted: false
          }
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: { $dayOfMonth: "$createdAt" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
      ]);

      // Event participation rates
      const participationRates = await Event.aggregate([
        {
          $lookup: {
            from: "registrations",
            localField: "_id",
            foreignField: "eventId",
            as: "registrations"
          }
        },
        {
          $addFields: {
            totalSlots: { $sum: "$roles.maxParticipants" },
            filledSlots: { $size: "$registrations" }
          }
        },
        {
          $addFields: {
            participationRate: {
              $cond: {
                if: { $gt: ["$totalSlots", 0] },
                then: { $divide: ["$filledSlots", "$totalSlots"] },
                else: 0
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            averageParticipationRate: { $avg: "$participationRate" },
            totalEvents: { $sum: 1 }
          }
        }
      ]);

      // User activity
      const userActivity = await User.aggregate([
        {
          $match: {
            lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: "$lastLogin" },
              month: { $month: "$lastLogin" },
              day: { $dayOfMonth: "$lastLogin" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
      ]);

      res.status(200).json({
        success: true,
        data: {
          messageActivity,
          participationRates: participationRates[0] || { averageParticipationRate: 0, totalEvents: 0 },
          userActivity
        },
      });
    } catch (error: any) {
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

      const format = req.query.format as string || 'json';

      // Get comprehensive analytics data
      const data = {
        users: await User.find({ isActive: true }).select('-password').lean(),
        events: await Event.find().lean(),
        registrations: await Registration.find().lean(),
        timestamp: new Date().toISOString()
      };

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=analytics.json');
        res.send(JSON.stringify(data, null, 2));
      } else if (format === 'csv') {
        // Simple CSV export - could be enhanced with a proper CSV library
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=analytics.csv');
        
        let csv = 'Type,Count\n';
        csv += `Users,${data.users.length}\n`;
        csv += `Events,${data.events.length}\n`;
        csv += `Registrations,${data.registrations.length}\n`;
        
        res.send(csv);
      } else {
        res.status(400).json({
          success: false,
          message: "Unsupported format. Use 'json' or 'csv'.",
        });
      }
    } catch (error: any) {
      console.error("Export analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export analytics.",
      });
    }
  }
}

// Helper function to calculate growth rate
async function calculateGrowthRate(type: 'users' | 'events' | 'registrations'): Promise<number> {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let Model;
  switch (type) {
    case 'users':
      Model = User;
      break;
    case 'events':
      Model = Event;
      break;
    case 'registrations':
      Model = Registration;
      break;
  }

  const [lastMonthCount, thisMonthCount] = await Promise.all([
    Model.countDocuments({
      createdAt: { $gte: lastMonth, $lt: thisMonth }
    }),
    Model.countDocuments({
      createdAt: { $gte: thisMonth }
    })
  ]);

  if (lastMonthCount === 0) return thisMonthCount > 0 ? 100 : 0;
  return ((thisMonthCount - lastMonthCount) / lastMonthCount) * 100;
}
