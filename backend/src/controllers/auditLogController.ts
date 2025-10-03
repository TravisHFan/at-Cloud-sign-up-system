import { Request, Response } from "express";
import AuditLog from "../models/AuditLog";
import { createLogger } from "../services/LoggerService";

const log = createLogger("AuditLogController");

export class AuditLogController {
  /**
   * GET /api/audit-logs
   * Get audit logs with pagination and filtering
   * Admin only access
   */
  static async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = "1",
        limit = "20",
        action,
        date,
        eventId,
        actorId,
      } = req.query;

      // Parse pagination parameters
      const pageNumber = Math.max(1, parseInt(page as string, 10));
      const limitNumber = Math.min(
        100,
        Math.max(1, parseInt(limit as string, 10))
      ); // Cap at 100
      const skip = (pageNumber - 1) * limitNumber;

      // Build filter query
      const filter: any = {};

      if (action && typeof action === "string") {
        filter.action = action;
      }

      if (eventId && typeof eventId === "string") {
        filter.eventId = eventId;
      }

      if (actorId && typeof actorId === "string") {
        filter.actorId = actorId;
      }

      // Date filtering - if date is provided, filter for that specific day
      if (date && typeof date === "string") {
        const startDate = new Date(date);
        const endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 1);

        filter.createdAt = {
          $gte: startDate,
          $lt: endDate,
        };
      }

      // Execute queries
      const [auditLogs, totalCount] = await Promise.all([
        AuditLog.find(filter)
          .sort({ createdAt: -1 }) // Most recent first
          .skip(skip)
          .limit(limitNumber)
          .populate("actorId", "username email firstName lastName", "User")
          .populate("eventId", "title", "Event")
          .lean(),
        AuditLog.countDocuments(filter),
      ]);

      // Calculate pagination info
      const totalPages = Math.ceil(totalCount / limitNumber);
      const hasNextPage = pageNumber < totalPages;
      const hasPrevPage = pageNumber > 1;

      // Format response
      const formattedLogs = auditLogs.map((log: any) => ({
        id: log._id.toString(),
        action: log.action,
        actorId: log.actorId?.toString() || null,
        actorInfo: log.actorId
          ? {
              username: log.actorId.username,
              email: log.actorId.email,
              name: `${log.actorId.firstName || ""} ${
                log.actorId.lastName || ""
              }`.trim(),
            }
          : null,
        eventId: log.eventId?.toString() || null,
        eventTitle: log.eventId?.title || null,
        metadata: log.metadata,
        ipHash: log.ipHash,
        emailHash: log.emailHash,
        createdAt: log.createdAt,
      }));

      const response = {
        success: true,
        data: {
          auditLogs: formattedLogs,
          pagination: {
            currentPage: pageNumber,
            totalPages,
            totalCount,
            hasNextPage,
            hasPrevPage,
            limit: limitNumber,
          },
          filters: {
            action: action || null,
            date: date || null,
            eventId: eventId || null,
            actorId: actorId || null,
          },
        },
      };

      log.info(
        `Retrieved ${formattedLogs.length} audit logs`,
        "AuditLogController",
        {
          page: pageNumber,
          limit: limitNumber,
          totalCount,
          filters: Object.keys(filter),
          requestedBy: req.user?._id,
        }
      );

      res.status(200).json(response);
    } catch (error) {
      log.error(
        "Failed to fetch audit logs",
        error as Error,
        "AuditLogController",
        {
          query: req.query,
          requestedBy: req.user?._id,
        }
      );

      res.status(500).json({
        success: false,
        message: "Failed to fetch audit logs",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * GET /api/audit-logs/stats
   * Get audit log statistics
   * Admin only access
   */
  static async getAuditLogStats(req: Request, res: Response): Promise<void> {
    try {
      const { days = "30" } = req.query;
      const daysNumber = parseInt(days as string, 10);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNumber);

      const stats = await AuditLog.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: "$action",
            count: { $sum: 1 },
            lastOccurrence: { $max: "$createdAt" },
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);

      const totalLogs = await AuditLog.countDocuments({
        createdAt: { $gte: startDate },
      });

      log.info(
        `Retrieved audit log statistics for ${daysNumber} days`,
        "AuditLogController",
        {
          totalLogs,
          uniqueActions: stats.length,
          requestedBy: req.user?._id,
        }
      );

      res.status(200).json({
        success: true,
        data: {
          period: {
            days: daysNumber,
            startDate,
            endDate: new Date(),
          },
          totalLogs,
          actionStats: stats,
        },
      });
    } catch (error) {
      log.error(
        "Failed to fetch audit log statistics",
        error as Error,
        "AuditLogController",
        {
          query: req.query,
          requestedBy: req.user?._id,
        }
      );

      res.status(500).json({
        success: false,
        message: "Failed to fetch audit log statistics",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  }
}
