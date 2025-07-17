import { Request, Response } from "express";
import { hasPermission, PERMISSIONS } from "../utils/roleUtils";
import { User, Event, Registration, Message } from "../models";
import mongoose from "mongoose";
import os from "os";

export class PerformanceController {
  // Get system performance metrics
  static async getSystemMetrics(req: Request, res: Response): Promise<void> {
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
          message: "Insufficient permissions to view system metrics.",
        });
        return;
      }

      // Database connection metrics
      const dbStats = await mongoose.connection.db?.stats();

      // System metrics
      const systemMetrics = {
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
          usage: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100,
        },
        cpu: {
          cores: os.cpus().length,
          loadAverage: os.loadavg(),
        },
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: os.platform(),
        architecture: os.arch(),
      };

      // Database metrics
      const databaseMetrics = {
        connectionState: mongoose.connection.readyState,
        collections: dbStats?.collections || 0,
        dataSize: dbStats?.dataSize || 0,
        storageSize: dbStats?.storageSize || 0,
        indexes: dbStats?.indexes || 0,
        avgObjSize: dbStats?.avgObjSize || 0,
      };

      // Application metrics
      const [
        totalUsers,
        activeUsers,
        totalEvents,
        totalRegistrations,
        totalMessages,
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({
          lastLogin: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        }),
        Event.countDocuments(),
        Registration.countDocuments(),
        Message.countDocuments({ isDeleted: false }),
      ]);

      // Calculate total notifications from all user documents
      const notificationCounts = await User.aggregate([
        { $match: { isDeleted: false } },
        {
          $project: {
            bellNotificationCount: {
              $size: { $ifNull: ["$bellNotifications", []] },
            },
            systemMessageCount: { $size: { $ifNull: ["$systemMessages", []] } },
          },
        },
        {
          $group: {
            _id: null,
            totalBellNotifications: { $sum: "$bellNotificationCount" },
            totalSystemMessages: { $sum: "$systemMessageCount" },
          },
        },
      ]);

      const totalNotifications =
        notificationCounts.length > 0
          ? notificationCounts[0].totalBellNotifications +
            notificationCounts[0].totalSystemMessages
          : 0;

      const applicationMetrics = {
        users: {
          total: totalUsers,
          active24h: activeUsers,
          activePercentage:
            totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0,
        },
        events: {
          total: totalEvents,
        },
        registrations: {
          total: totalRegistrations,
        },
        messages: {
          total: totalMessages,
        },
        notifications: {
          total: totalNotifications,
        },
      };

      res.status(200).json({
        success: true,
        data: {
          system: systemMetrics,
          database: databaseMetrics,
          application: applicationMetrics,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error("Get system metrics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve system metrics.",
      });
    }
  }

  // Get API performance metrics
  static async getApiMetrics(req: Request, res: Response): Promise<void> {
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
          message: "Insufficient permissions to view API metrics.",
        });
        return;
      }

      // Response time analysis based on recent activity
      const recentActivity = {
        averageResponseTime: Math.floor(Math.random() * 100 + 50), // Mock data
        requestsPerMinute: Math.floor(Math.random() * 20 + 5),
        errorRate: Math.random() * 2,
        slowestEndpoints: [
          { endpoint: "/api/v1/events", avgTime: 150 },
          { endpoint: "/api/v1/users", avgTime: 120 },
          { endpoint: "/api/v1/analytics", avgTime: 200 },
        ],
        mostUsedEndpoints: [
          { endpoint: "/api/v1/auth/profile", count: 145 },
          { endpoint: "/api/v1/events", count: 89 },
          { endpoint: "/api/v1/notifications", count: 67 },
        ],
      };

      res.status(200).json({
        success: true,
        data: recentActivity,
      });
    } catch (error: any) {
      console.error("Get API metrics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve API metrics.",
      });
    }
  }

  // Health check endpoint
  static async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: {
          status:
            mongoose.connection.readyState === 1 ? "connected" : "disconnected",
          readyState: mongoose.connection.readyState,
        },
        environment: process.env.NODE_ENV || "development",
        version: "1.0.0",
      };

      res.status(200).json({
        success: true,
        data: health,
      });
    } catch (error: any) {
      res.status(503).json({
        success: false,
        message: "Service unavailable",
        error: error.message,
      });
    }
  }
}
