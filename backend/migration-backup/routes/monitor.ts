import { Router, Request, Response } from "express";
import RequestMonitorService from "../middleware/RequestMonitorService";

const router = Router();

// GET /api/monitor/stats - Get current request statistics
router.get("/stats", (req: Request, res: Response) => {
  try {
    const monitor = RequestMonitorService.getInstance();
    const stats = monitor.getStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting monitor stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get monitoring statistics",
    });
  }
});

// POST /api/monitor/emergency-disable - Emergency disable rate limiting
router.post("/emergency-disable", (req: Request, res: Response) => {
  try {
    const monitor = RequestMonitorService.getInstance();
    monitor.emergencyDisableRateLimit();

    res.json({
      success: true,
      message: "Rate limiting has been emergency disabled",
      status: "emergency_disabled",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error disabling rate limiting:", error);
    res.status(500).json({
      success: false,
      error: "Failed to disable rate limiting",
    });
  }
});

// POST /api/monitor/emergency-enable - Emergency re-enable rate limiting
router.post("/emergency-enable", (req: Request, res: Response) => {
  try {
    const monitor = RequestMonitorService.getInstance();
    monitor.emergencyEnableRateLimit();

    res.json({
      success: true,
      message: "Rate limiting has been re-enabled",
      status: "enabled",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error re-enabling rate limiting:", error);
    res.status(500).json({
      success: false,
      error: "Failed to re-enable rate limiting",
    });
  }
});

// GET /api/monitor/rate-limiting-status - Get current rate limiting status
router.get("/rate-limiting-status", (req: Request, res: Response) => {
  try {
    const monitor = RequestMonitorService.getInstance();
    const status = monitor.getRateLimitingStatus();

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting rate limiting status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get rate limiting status",
    });
  }
});

// GET /api/monitor/health - Quick health check
router.get("/health", (req: Request, res: Response) => {
  try {
    const monitor = RequestMonitorService.getInstance();
    const stats = monitor.getStats();

    const isHealthy =
      stats.requestsPerSecond < 20 && stats.totalRequestsLastMinute < 500;

    res.json({
      success: true,
      healthy: isHealthy,
      requestsPerSecond: stats.requestsPerSecond,
      requestsLastMinute: stats.totalRequestsLastMinute,
      suspiciousPatterns: stats.suspiciousPatterns.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error checking health:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check system health",
    });
  }
});

export default router;
