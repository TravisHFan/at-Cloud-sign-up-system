import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import { AuditLogController } from "../controllers";

const router = Router();

// GET /api/audit-logs - Get audit logs with pagination and filtering (auth required)
router.get("/", authenticate, requireAdmin, AuditLogController.getAuditLogs);

export default router;
