/**
 * System Health and Monitoring Routes
 *
 * Provides endpoints for monitoring system health, including
 * thread safety statistics and performance metrics.
 */

import { Router, Request, Response } from "express";
import { lockService } from "../services";
import { authenticate, requireAdmin } from "../middleware/auth";

const router = Router();

/**
 * GET /api/system/health
 * Basic system health check
 */
router.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "System is healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

/**
 * GET /api/system/locks
 * Thread safety lock statistics (Admin only)
 */
router.get(
  "/locks",
  authenticate,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const stats = lockService.getLockStats();

      res.status(200).json({
        success: true,
        message: "Lock statistics retrieved successfully",
        data: {
          lockStats: stats,
          performance: {
            averageWaitTimeMs: Math.round(stats.averageWaitTime * 100) / 100,
            efficiency:
              stats.activeLocks === 0
                ? "optimal"
                : stats.activeLocks <= 5
                ? "good"
                : "high_contention",
          },
          recommendations:
            stats.averageWaitTime > 100
              ? [
                  "Consider optimizing operation duration",
                  "Monitor for potential deadlocks",
                ]
              : ["System performing optimally"],
        },
      });
    } catch (error: any) {
      console.error("Error getting lock stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve lock statistics",
      });
    }
  }
);

export default router;
