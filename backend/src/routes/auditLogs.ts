import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import { AuditLogController } from "../controllers";

const router = Router();

// Debug endpoint (no auth required) - to test if route is registered
router.get("/test", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Audit logs route is working",
    timestamp: new Date().toISOString(),
  });
});

// GET /api/audit-logs - Get audit logs with pagination and filtering (auth required)
router.get("/", authenticate, requireAdmin, AuditLogController.getAuditLogs);

export default router;
