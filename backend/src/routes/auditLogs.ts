import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import { AuditLogController } from "../controllers";

const router = Router();

// All audit log routes require authentication and admin privileges
router.use(authenticate, requireAdmin);

// GET /api/audit-logs - Get audit logs with pagination and filtering
router.get("/", AuditLogController.getAuditLogs);

export default router;
