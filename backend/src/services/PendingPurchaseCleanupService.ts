import Purchase from "../models/Purchase";

/**
 * Purchase Cleanup Service
 *
 * Retention Policy:
 * - Pending purchases older than 15 days are automatically deleted
 * - Refunded purchases older than 30 days are automatically deleted
 * - This runs as a scheduled background job (daily at 4 AM)
 * - Additionally, per-user cleanup happens on-demand when viewing purchase history
 *
 * Rationale:
 * - Pending: Stripe checkout sessions expire after 24 hours;
 *   15 days gives users ample time to retry if they intended to complete
 * - Refunded: 30 days allows for dispute resolution and accounting reconciliation
 * - Prevents database bloat from abandoned checkouts and closed transactions
 */
export class PendingPurchaseCleanupService {
  /** Retention period for pending purchases (days) */
  static readonly PENDING_RETENTION_DAYS = 15;

  /** Retention period for refunded purchases (days) */
  static readonly REFUNDED_RETENTION_DAYS = 30;

  /**
   * Delete pending purchases older than the retention period
   * @param retentionDays - Number of days to keep pending purchases (default: 15)
   * @returns Number of deleted records
   */
  static async deleteOldPendingPurchases(
    retentionDays: number = this.PENDING_RETENTION_DAYS
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
   * Delete refunded purchases older than the retention period
   * @param retentionDays - Number of days to keep refunded purchases (default: 30)
   * @returns Number of deleted records
   */
  static async deleteOldRefundedPurchases(
    retentionDays: number = this.REFUNDED_RETENTION_DAYS
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await Purchase.deleteMany({
      status: "refunded",
      createdAt: { $lt: cutoffDate },
    });

    return result.deletedCount || 0;
  }

  /**
   * Run cleanup for all applicable purchase statuses and return stats
   */
  static async runCleanup(): Promise<{
    pendingDeleted: number;
    refundedDeleted: number;
  }> {
    const [pendingDeleted, refundedDeleted] = await Promise.all([
      this.deleteOldPendingPurchases(),
      this.deleteOldRefundedPurchases(),
    ]);
    return { pendingDeleted, refundedDeleted };
  }
}
