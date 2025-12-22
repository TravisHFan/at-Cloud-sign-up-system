import Purchase from "../models/Purchase";

/**
 * Pending Purchase Cleanup Service
 *
 * Retention Policy:
 * - Pending purchases older than 15 days are automatically deleted
 * - This runs as a scheduled background job (daily at 4 AM)
 * - Additionally, per-user cleanup happens on-demand when viewing purchase history
 *
 * Rationale:
 * - Stripe checkout sessions expire after 24 hours
 * - 15 days gives users ample time to retry if they intended to complete
 * - Prevents database bloat from abandoned checkouts
 */
export class PendingPurchaseCleanupService {
  /** Default retention period in days */
  static readonly RETENTION_DAYS = 15;

  /**
   * Delete pending purchases older than the retention period
   * @param retentionDays - Number of days to keep pending purchases (default: 15)
   * @returns Number of deleted records
   */
  static async deleteOldPendingPurchases(
    retentionDays: number = this.RETENTION_DAYS
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await Purchase.deleteMany({
      status: "pending",
      createdAt: { $lt: cutoffDate },
    });

    return result.deletedCount || 0;
  }

  /**
   * Run cleanup and return stats
   */
  static async runCleanup(): Promise<{ deletedCount: number }> {
    const deletedCount = await this.deleteOldPendingPurchases();
    return { deletedCount };
  }
}
