import { Request, Response } from "express";
import AuditLog, { IAuditLog } from "../models/AuditLog";
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
      // Intentionally kept minimal logging; removed temporary debug console statements.

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
      const filter: Record<string, unknown> = {};

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
      interface PopulatedUserRef {
        _id?: unknown;
        username: string;
        email: string;
        firstName?: string;
        lastName?: string;
      }
      interface PopulatedEventRef {
        _id?: unknown;
        title?: string;
      }
      interface LeanAuditLog extends Omit<IAuditLog, "actorId" | "eventId"> {
        _id: { toString(): string };
        actorId?: PopulatedUserRef | string;
        eventId?: PopulatedEventRef | string;
      }

      function hasObjectKeys(obj: unknown, keys: readonly string[]): boolean {
        if (!obj || typeof obj !== "object") return false;
        return keys.every((k) => k in (obj as Record<string, unknown>));
      }
      function isPopulatedUserRef(val: unknown): val is PopulatedUserRef {
        return hasObjectKeys(val, ["username", "email"]);
      }
      function isPopulatedEventRef(val: unknown): val is PopulatedEventRef {
        return hasObjectKeys(val, ["title"]);
      }

      const formattedLogs = (auditLogs as unknown as LeanAuditLog[]).map(
        (auditLog) => {
          // Actor info normalization
          let actorIdStr: string | null = null;
          let actorInfo: {
            username: string;
            email: string;
            name: string;
          } | null = null;
          if (isPopulatedUserRef(auditLog.actorId)) {
            const a = auditLog.actorId;
            actorIdStr = a._id ? String(a._id) : null;
            actorInfo = {
              username: a.username,
              email: a.email,
              name: `${a.firstName || ""} ${a.lastName || ""}`.trim(),
            };
          } else if (typeof auditLog.actorId === "string") {
            actorIdStr = auditLog.actorId;
          }

          // Event info normalization
          let eventIdStr: string | null = null;
          let eventTitle: string | null = null;
          if (isPopulatedEventRef(auditLog.eventId)) {
            const e = auditLog.eventId;
            eventIdStr = e._id ? String(e._id) : null;
            eventTitle = e.title || null;
          } else if (typeof auditLog.eventId === "string") {
            eventIdStr = auditLog.eventId;
          }

          return {
            id: auditLog._id.toString(),
            action: auditLog.action,
            actorId: actorIdStr,
            actorInfo,
            eventId: eventIdStr,
            eventTitle,
            metadata: auditLog.metadata,
            ipHash: auditLog.ipHash,
            emailHash: auditLog.emailHash,
            createdAt: auditLog.createdAt,
          };
        }
      );

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
