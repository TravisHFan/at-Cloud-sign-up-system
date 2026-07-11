import { Router } from "express";
import PurchaseAdminController from "../../controllers/purchase/PurchaseAdminController";
import PurchaseStatsController from "../../controllers/purchase/PurchaseStatsController";
import { authenticate, requireAdmin } from "../../middleware/auth";

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

/**
 * Get all purchases for admin dashboard
 * GET /api/admin/purchases
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - search: string (search by user name, email, program name, order number)
 * - status: 'all' | 'pending' | 'completed' | 'failed' | 'refunded' (default: all)
 */
router.get("/", PurchaseAdminController.getAllPurchasesAdmin);

/**
 * Get payment statistics for admin dashboard
 * GET /api/admin/purchases/stats
 */
router.get("/stats", PurchaseStatsController.getPaymentStats);

export default router;
