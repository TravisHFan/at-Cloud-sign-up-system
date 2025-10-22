import { Router } from "express";
import { PromoCodeController } from "../controllers/promoCodeController";
import { authenticate, requireAdmin } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// USER ROUTES - Authenticated users can manage their own promo codes
// ============================================================================

/**
 * Get current user's promo codes
 * Query params:
 * - status: 'all' | 'active' | 'expired' | 'used' (default: 'all')
 */
router.get("/my-codes", PromoCodeController.getMyPromoCodes);

/**
 * Validate a promo code for a specific program
 * Body: { code: string, programId: string }
 * Returns: { valid: boolean, message: string, code?: PromoCode }
 */
router.post("/validate", PromoCodeController.validatePromoCode);

// ============================================================================
// ADMIN ROUTES - Administrator access only
// ============================================================================

/**
 * Get all promo codes (admin only)
 * Query params:
 * - type: 'all' | 'bundle_discount' | 'staff_access' (default: 'all')
 * - status: 'all' | 'active' | 'expired' | 'used' (default: 'all')
 * - search: string (search by code or owner name/email)
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 */
router.get("/", requireAdmin, PromoCodeController.getAllPromoCodes);

/**
 * Get usage history for a specific promo code (admin only)
 * Returns: { code, type, isGeneral, description, usageHistory[], usageCount }
 */
router.get(
  "/:id/usage-history",
  requireAdmin,
  PromoCodeController.getPromoCodeUsageHistory
);

/**
 * Create a staff access promo code (admin only)
 * Body: {
 *   userId: string,
 *   discountPercent: number (0-100),
 *   allowedProgramIds?: string[] (empty = all programs),
 *   expiresAt?: Date (optional expiration)
 * }
 */
router.post("/staff", requireAdmin, PromoCodeController.createStaffCode);

/**
 * Create a general staff promo code (admin only)
 * POST /api/promo-codes/staff/general
 * Body: {
 *   description: string,
 *   discountPercent: number (0-100, typically 100),
 *   expiresAt?: Date (optional expiration),
 *   isGeneral: boolean (must be true)
 * }
 * Note: General codes have no owner, apply to all programs, unlimited uses
 */
router.post(
  "/staff/general",
  requireAdmin,
  PromoCodeController.createGeneralStaffCode
);

/**
 * Get bundle discount configuration (admin only)
 * Returns: { enabled: boolean, discountAmount: number, expiryDays: number }
 * Reads from SystemConfig database model
 */
router.get("/config", requireAdmin, PromoCodeController.getBundleConfig);

/**
 * Update bundle discount configuration (admin only)
 * Body: { enabled: boolean, discountAmount: number, expiryDays: number }
 * Updates SystemConfig database model - changes take effect immediately
 */
router.put("/config", requireAdmin, PromoCodeController.updateBundleConfig);

/**
 * Deactivate a promo code (admin only)
 * Prevents the code from being used in future purchases
 */
router.put(
  "/:id/deactivate",
  requireAdmin,
  PromoCodeController.deactivatePromoCode
);

/**
 * Reactivate a promo code (admin only)
 * Allows a previously deactivated code to be used again
 */
router.put(
  "/:id/reactivate",
  requireAdmin,
  PromoCodeController.reactivatePromoCode
);

export default router;
