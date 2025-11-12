import { Request, Response } from "express";

export class PromoCodeController {
  /**
   * Get current user's promo codes
   * GET /api/promo-codes/my-codes?status=all|active|expired|used
   */
  static async getMyPromoCodes(req: Request, res: Response): Promise<void> {
    const { default: UserCodesController } = await import(
      "./promoCodes/UserCodesController"
    );
    return UserCodesController.getMyPromoCodes(req, res);
  }

  /**
   * Validate promo code for a program
   * POST /api/promo-codes/validate
   * Body: { code: string, programId: string }
   */
  static async validatePromoCode(req: Request, res: Response): Promise<void> {
    const { default: ValidationController } = await import(
      "./promoCodes/ValidationController"
    );
    return ValidationController.validatePromoCode(req, res);
  }

  /**
   * Get all promo codes (Admin only)
   * GET /api/promo-codes?type=all|bundle_discount|staff_access&status=all|active|used|expired&search=CODE&page=1&limit=20
   */
  static async getAllPromoCodes(req: Request, res: Response): Promise<void> {
    const { default: AdminListController } = await import(
      "./promoCodes/AdminListController"
    );
    return AdminListController.getAllPromoCodes(req, res);
  }

  /**
   * Get promo code usage history (Admin only)
   * GET /api/promo-codes/:id/usage-history
   */
  static async getPromoCodeUsageHistory(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: UsageHistoryController } = await import(
      "./promoCodes/UsageHistoryController"
    );
    return UsageHistoryController.getPromoCodeUsageHistory(req, res);
  }

  /**
   * Create staff access promo code (Admin only)
   * POST /api/promo-codes/staff
   * Body: { userId: string, discountPercent: number, allowedProgramIds?: string[], expiresAt?: Date }
   */
  static async createStaffCode(req: Request, res: Response): Promise<void> {
    const { default: StaffCodeCreationController } = await import(
      "./promoCodes/StaffCodeCreationController"
    );
    return StaffCodeCreationController.createStaffCode(req, res);
  }

  /**
   * Create general staff access promo code (Admin only)
   * POST /api/promo-codes/staff/general
   * Body: { description: string, discountPercent: number, expiresAt?: Date, isGeneral: boolean }
   */
  static async createGeneralStaffCode(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: GeneralCodeCreationController } = await import(
      "./promoCodes/GeneralCodeCreationController"
    );
    return GeneralCodeCreationController.createGeneralStaffCode(req, res);
  }

  /**
   * Create reward promo code (Admin only)
   * POST /api/promo-codes/reward
   * Body: { userId: string, discountPercent: number (10-100), allowedProgramIds?: string[], expiresAt?: Date }
   */
  static async createRewardCode(req: Request, res: Response): Promise<void> {
    const { default: RewardCodeCreationController } = await import(
      "./promoCodes/RewardCodeCreationController"
    );
    return RewardCodeCreationController.createRewardCode(req, res);
  }

  /**
   * Get bundle discount configuration (Admin only)
   * GET /api/promo-codes/config
   */
  static async getBundleConfig(req: Request, res: Response): Promise<void> {
    const { default: BundleConfigController } = await import(
      "./promoCodes/BundleConfigController"
    );
    return BundleConfigController.getBundleConfig(req, res);
  }

  /**
   * Update bundle discount configuration (Admin only)
   * PUT /api/promo-codes/config
   * Body: { enabled: boolean, discountAmount: number, expiryDays: number }
   */
  static async updateBundleConfig(req: Request, res: Response): Promise<void> {
    const { default: BundleConfigController } = await import(
      "./promoCodes/BundleConfigController"
    );
    return BundleConfigController.updateBundleConfig(req, res);
  }

  /**
   * Deactivate a promo code (Admin only)
   * PUT /api/promo-codes/:id/deactivate
   */
  static async deactivatePromoCode(req: Request, res: Response): Promise<void> {
    const { default: DeactivationController } = await import(
      "./promoCodes/DeactivationController"
    );
    return DeactivationController.deactivatePromoCode(req, res);
  }

  /**
   * Reactivate a promo code (Admin only)
   * PUT /api/promo-codes/:id/reactivate
   */
  static async reactivatePromoCode(req: Request, res: Response): Promise<void> {
    const { default: ReactivationController } = await import(
      "./promoCodes/ReactivationController"
    );
    return ReactivationController.reactivatePromoCode(req, res);
  }

  /**
   * Delete a promo code (Admin only)
   * DELETE /api/promo-codes/:id
   */
  static async deletePromoCode(req: Request, res: Response): Promise<void> {
    const { default: DeletionController } = await import(
      "./promoCodes/DeletionController"
    );
    return DeletionController.deletePromoCode(req, res);
  }
}
