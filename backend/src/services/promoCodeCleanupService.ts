import { PromoCode } from "../models";

/**
 * Promo Code Retention Policy:
 * - Used codes: Kept for 7 days after use
 * - Expired codes: Kept for 30 days after expiration
 * - Active unused codes: Never deleted
 */
export class PromoCodeCleanupService {
  /**
   * Delete used promo codes older than 7 days
   */
  static async deleteOldUsedCodes(): Promise<number> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await PromoCode.deleteMany({
      isUsed: true,
      usedAt: { $lt: sevenDaysAgo },
    });

    return result.deletedCount || 0;
  }

  /**
   * Delete expired promo codes older than 30 days
   */
  static async deleteOldExpiredCodes(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await PromoCode.deleteMany({
      expiresAt: { $exists: true, $lt: thirtyDaysAgo },
      isUsed: false,
    });

    return result.deletedCount || 0;
  }

  /**
   * Run all cleanup tasks
   */
  static async runCleanup(): Promise<{
    deletedUsed: number;
    deletedExpired: number;
  }> {
    const deletedUsed = await this.deleteOldUsedCodes();
    const deletedExpired = await this.deleteOldExpiredCodes();

    return { deletedUsed, deletedExpired };
  }
}
