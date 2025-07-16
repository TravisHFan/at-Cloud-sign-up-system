import { Router } from "express";
import { PerformanceController } from "../controllers/performanceController";
import { authenticate } from "../middleware/auth";

const router = Router();

// All performance routes require authentication
router.use(authenticate);

// Performance metrics endpoints
router.get("/metrics/system", PerformanceController.getSystemMetrics);
router.get("/metrics/api", PerformanceController.getApiMetrics);
router.get("/health", PerformanceController.healthCheck);

export default router;
