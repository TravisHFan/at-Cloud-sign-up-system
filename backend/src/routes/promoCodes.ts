import { Router } from "express";
import UserCodesController from "../controllers/promoCodes/UserCodesController";
import ValidationController from "../controllers/promoCodes/ValidationController";
import AdminListController from "../controllers/promoCodes/AdminListController";
import UsageHistoryController from "../controllers/promoCodes/UsageHistoryController";
import StaffCodeCreationController from "../controllers/promoCodes/StaffCodeCreationController";
import GeneralCodeCreationController from "../controllers/promoCodes/GeneralCodeCreationController";
import RewardCodeCreationController from "../controllers/promoCodes/RewardCodeCreationController";
import BundleConfigController from "../controllers/promoCodes/BundleConfigController";
import DeactivationController from "../controllers/promoCodes/DeactivationController";
import ReactivationController from "../controllers/promoCodes/ReactivationController";
import DeletionController from "../controllers/promoCodes/DeletionController";
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
router.get("/my-codes", UserCodesController.getMyPromoCodes);

/**
 * Validate a promo code for a specific program
 * Body: { code: string, programId: string }
 * Returns: { valid: boolean, message: string, code?: PromoCode }
 */
router.post("/validate", ValidationController.validatePromoCode);

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
router.get("/", requireAdmin, AdminListController.getAllPromoCodes);

/**
 * Get usage history for a specific promo code (admin only)
 * Returns: { code, type, isGeneral, description, usageHistory[], usageCount }
 */
router.get(
  "/:id/usage-history",
  requireAdmin,
  UsageHistoryController.getPromoCodeUsageHistory
);

/**
 * Create a staff access promo code (admin only)
 * Body: {
 *   userId: string,
 *   discountPercent: number (10-100),
 *   allowedProgramIds?: string[] (empty = all programs),
 *   expiresAt?: Date (optional expiration)
 * }
 */
router.post("/staff", requireAdmin, StaffCodeCreationController.createStaffCode);

/**
 * Create a general staff promo code (admin only)
 * POST /api/promo-codes/general OR /api/promo-codes/staff/general
 * Body: {
 *   description: string,
 *   discountPercent: number (10-100, default UI value 100),
 *   expiresAt?: Date (optional expiration),
 *   isGeneral: boolean (must be true)
 * }
 * Note: General codes have no owner, apply to all programs, unlimited uses
 */
router.post(
  "/general",
  requireAdmin,
  GeneralCodeCreationController.createGeneralStaffCode
);
router.post(
  "/staff/general",
  requireAdmin,
  GeneralCodeCreationController.createGeneralStaffCode
);

/**
 * Create a reward promo code (admin only)
 * Body: {
 *   userId: string,
 *   discountPercent: number (10-100, required),
 *   allowedProgramIds?: string[] (empty = all programs),
 *   expiresAt?: Date (optional expiration)
 * }
 * Note: Reward codes are similar to personal staff codes and require 10-100% discount
 */
router.post("/reward", requireAdmin, RewardCodeCreationController.createRewardCode);

/**
 * Get bundle discount configuration (admin only)
 * Returns: { enabled: boolean, discountAmount: number, expiryDays: number }
 * Reads from SystemConfig database model
 */
router.get("/config", requireAdmin, BundleConfigController.getBundleConfig);

/**
 * Update bundle discount configuration (admin only)
 * Body: { enabled: boolean, discountAmount: number, expiryDays: number }
 * Updates SystemConfig database model - changes take effect immediately
 */
router.put("/config", requireAdmin, BundleConfigController.updateBundleConfig);

/**
 * Deactivate a promo code (admin only)
 * Prevents the code from being used in future purchases
 */
router.put(
  "/:id/deactivate",
  requireAdmin,
  DeactivationController.deactivatePromoCode
);

/**
 * Reactivate a promo code (admin only)
 * Allows a previously deactivated code to be used again
 */
router.put(
  "/:id/reactivate",
  requireAdmin,
  ReactivationController.reactivatePromoCode
);

/**
 * Delete a promo code (admin only)
 * Permanently removes a promo code from the database
 * Use with caution - this action cannot be undone
 */
router.delete("/:id", requireAdmin, DeletionController.deletePromoCode);

export default router;
