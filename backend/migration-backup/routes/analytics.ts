import { Router } from "express";
import { AnalyticsController } from "../controllers/analyticsController";
import { authenticate, authorizePermission } from "../middleware/auth";
import { PERMISSIONS } from "../utils/roleUtils";
import { analyticsLimiter, exportLimiter } from "../middleware/rateLimiting";

const router = Router();

// All routes require authentication and analytics permissions
router.use(authenticate);
router.use(authorizePermission(PERMISSIONS.VIEW_SYSTEM_ANALYTICS));

// Analytics routes with rate limiting
router.get("/", analyticsLimiter, AnalyticsController.getAnalytics);
router.get("/users", analyticsLimiter, AnalyticsController.getUserAnalytics);
router.get("/events", analyticsLimiter, AnalyticsController.getEventAnalytics);
router.get(
  "/engagement",
  analyticsLimiter,
  AnalyticsController.getEngagementAnalytics
);
router.get("/export", exportLimiter, AnalyticsController.exportAnalytics);

export default router;
