import { Router } from "express";
import { AnalyticsController } from "../controllers/analyticsController";
import { authenticate, authorizePermission } from "../middleware/auth";
import { PERMISSIONS } from "../utils/roleUtils";

const router = Router();

// All routes require authentication and analytics permissions
router.use(authenticate);
router.use(authorizePermission(PERMISSIONS.VIEW_SYSTEM_ANALYTICS));

// Analytics routes
router.get("/", AnalyticsController.getAnalytics);
router.get("/users", AnalyticsController.getUserAnalytics);
router.get("/events", AnalyticsController.getEventAnalytics);
router.get("/engagement", AnalyticsController.getEngagementAnalytics);
router.get("/export", AnalyticsController.exportAnalytics);

export default router;
