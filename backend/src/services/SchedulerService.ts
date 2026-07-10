import { Logger } from "./LoggerService";
import { MessageCleanupService } from "./MessageCleanupService";
import { PromoCodeCleanupService } from "./promoCodeCleanupService";
import { PendingPurchaseCleanupService } from "./PendingPurchaseCleanupService";
import { AutoUnpublishService } from "./event/AutoUnpublishService";
import { RefundRequestService } from "./RefundRequestService";

const logger = Logger.getInstance().child("SchedulerService");

/**
 * SchedulerService - Handles periodic background tasks
 *
 * Currently scheduled tasks:
 * - Message cleanup: Runs daily at 2:00 AM to remove old/deleted messages
 * - Promo code cleanup: Runs daily at 3:00 AM to remove old used/expired promo codes
 * - Pending purchase cleanup: Runs daily at 4:00 AM to remove stale pending purchases (>15 days)
 * - Event status refresh: Runs every minute outside request paths
 *
 * Design:
 * - Simple setInterval-based scheduler (can be replaced with node-cron if needed)
 * - Runs in-process (for production, consider external schedulers like cron)
 * - Logs all executions for audit trail
 * - Error handling prevents crashes
 */
export class SchedulerService {
  private static intervals: NodeJS.Timeout[] = [];
  private static isRunning = false;

  /**
   * Start all scheduled tasks
   */
  static start(): void {
    // Don't start scheduler in test environment
    if (process.env.NODE_ENV === "test") {
      logger.info("Scheduler disabled in test environment");
      return;
    }

    if (this.isRunning) {
      logger.warn("Scheduler is already running");
      return;
    }

    logger.info("Starting scheduled tasks...");
    this.isRunning = true;

    // Schedule message cleanup - runs daily at 2:00 AM
    this.scheduleMessageCleanup();

    // Schedule promo code cleanup - runs daily at 3:00 AM
    this.schedulePromoCodeCleanup();

    // Schedule pending purchase cleanup - runs daily at 4:00 AM
    this.schedulePendingPurchaseCleanup();

    // Schedule refund request cleanup - runs daily at 5:00 AM
    this.scheduleRefundRequestCleanup();

    // Schedule auto-unpublish execution - runs every 15 minutes
    this.scheduleAutoUnpublishExecution();

    // Keep persisted status filters current without mutating data during GETs.
    this.scheduleEventStatusRefresh();

    logger.info("Scheduler started successfully");
  }

  /**
   * Stop all scheduled tasks
   */
  static stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info("Stopping scheduled tasks...");

    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals = [];
    this.isRunning = false;

    logger.info("Scheduler stopped");
  }

  /**
   * Schedule message cleanup to run daily at 2:00 AM
   */
  private static scheduleMessageCleanup(): void {
    // Calculate time until next 2:00 AM
    const now = new Date();
    const next2AM = new Date();
    next2AM.setHours(2, 0, 0, 0);

    // If 2 AM has passed today, schedule for tomorrow
    if (next2AM <= now) {
      next2AM.setDate(next2AM.getDate() + 1);
    }

    const timeUntilNext2AM = next2AM.getTime() - now.getTime();

    logger.info(
      `Message cleanup scheduled for ${next2AM.toISOString()} (in ${Math.round(
        timeUntilNext2AM / 1000 / 60
      )} minutes)`
    );

    // Initial execution at 2 AM
    const initialTimeout = setTimeout(() => {
      this.executeMessageCleanup();

      // Then repeat every 24 hours
      const dailyInterval = setInterval(() => {
        this.executeMessageCleanup();
      }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds

      this.intervals.push(dailyInterval);
    }, timeUntilNext2AM);

    // Store the initial timeout (not an interval, but we track it for cleanup)
    this.intervals.push(initialTimeout as unknown as NodeJS.Timeout);
  }

  /**
   * Schedule promo code cleanup to run daily at 3:00 AM
   */
  private static schedulePromoCodeCleanup(): void {
    // Calculate time until next 3:00 AM
    const now = new Date();
    const next3AM = new Date();
    next3AM.setHours(3, 0, 0, 0);

    // If 3 AM has passed today, schedule for tomorrow
    if (next3AM <= now) {
      next3AM.setDate(next3AM.getDate() + 1);
    }

    const timeUntilNext3AM = next3AM.getTime() - now.getTime();

    logger.info(
      `Promo code cleanup scheduled for ${next3AM.toISOString()} (in ${Math.round(
        timeUntilNext3AM / 1000 / 60
      )} minutes)`
    );

    // Initial execution at 3 AM
    const initialTimeout = setTimeout(() => {
      this.executePromoCodeCleanup();

      // Then repeat every 24 hours
      const dailyInterval = setInterval(() => {
        this.executePromoCodeCleanup();
      }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds

      this.intervals.push(dailyInterval);
    }, timeUntilNext3AM);

    // Store the initial timeout (not an interval, but we track it for cleanup)
    this.intervals.push(initialTimeout as unknown as NodeJS.Timeout);
  }

  /**
   * Execute the message cleanup task
   */
  private static async executeMessageCleanup(): Promise<void> {
    try {
      logger.info("Starting scheduled message cleanup...");

      const stats = await MessageCleanupService.executeCleanup();

      logger.info(
        `Scheduled message cleanup completed: deleted ${stats.deletedCount} messages in ${stats.executionTimeMs}ms`
      );
    } catch (error) {
      logger.error(
        "Failed to execute scheduled message cleanup",
        error instanceof Error ? error : new Error(String(error))
      );
      // Don't throw - we want the scheduler to continue running
    }
  }

  /**
   * Execute the promo code cleanup task
   */
  private static async executePromoCodeCleanup(): Promise<void> {
    try {
      logger.info("Starting scheduled promo code cleanup...");

      const { deletedUsed, deletedExpired } =
        await PromoCodeCleanupService.runCleanup();

      logger.info(
        `Scheduled promo code cleanup completed: deleted ${deletedUsed} used codes, ${deletedExpired} expired codes`
      );
    } catch (error) {
      logger.error(
        "Failed to execute scheduled promo code cleanup",
        error instanceof Error ? error : new Error(String(error))
      );
      // Don't throw - we want the scheduler to continue running
    }
  }

  /**
   * Schedule auto-unpublish execution - runs every 15 minutes to check for events
   * whose 48-hour grace period has expired and should be unpublished.
   */
  private static scheduleAutoUnpublishExecution(): void {
    logger.info("Auto-unpublish execution scheduled: every 15 minutes");

    // Run every 15 minutes (900000 ms)
    const interval = setInterval(() => {
      this.executeAutoUnpublish();
    }, 15 * 60 * 1000);

    this.intervals.push(interval);

    // Also run once after a short delay on startup
    setTimeout(() => {
      this.executeAutoUnpublish();
    }, 30000); // 30 seconds after startup
  }

  /**
   * Execute auto-unpublish for events past their 48-hour grace period
   */
  private static async executeAutoUnpublish(): Promise<void> {
    try {
      const { unpublishedCount, eventIds } =
        await AutoUnpublishService.executeScheduledUnpublishes();

      if (unpublishedCount > 0) {
        logger.info(
          `Auto-unpublish executed: ${unpublishedCount} events unpublished`,
          undefined,
          { eventIds }
        );
      }
    } catch (error) {
      logger.error(
        "Failed to execute scheduled auto-unpublish",
        error instanceof Error ? error : new Error(String(error))
      );
      // Don't throw - we want the scheduler to continue running
    }
  }

  /** Refresh event statuses independently of list/detail requests. */
  private static scheduleEventStatusRefresh(): void {
    logger.info("Event status refresh scheduled: every minute");

    const interval = setInterval(() => {
      this.executeEventStatusRefresh();
    }, 60 * 1000);
    const initialTimeout = setTimeout(() => {
      this.executeEventStatusRefresh();
    }, 10 * 1000);

    this.intervals.push(interval, initialTimeout);
  }

  private static async executeEventStatusRefresh(): Promise<void> {
    try {
      // Lazy loading avoids a controller/services initialization cycle.
      const { BatchOperationsController } = await import(
        "../controllers/event/BatchOperationsController"
      );
      const updatedCount =
        await BatchOperationsController.updateAllEventStatusesHelper();

      if (updatedCount > 0) {
        logger.info(`Refreshed ${updatedCount} event statuses`);
      }
    } catch (error) {
      logger.error(
        "Failed to refresh event statuses",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Schedule pending purchase cleanup to run daily at 4:00 AM
   */
  private static schedulePendingPurchaseCleanup(): void {
    // Calculate time until next 4:00 AM
    const now = new Date();
    const next4AM = new Date();
    next4AM.setHours(4, 0, 0, 0);

    // If 4 AM has passed today, schedule for tomorrow
    if (next4AM <= now) {
      next4AM.setDate(next4AM.getDate() + 1);
    }

    const timeUntilNext4AM = next4AM.getTime() - now.getTime();

    logger.info(
      `Pending purchase cleanup scheduled for ${next4AM.toISOString()} (in ${Math.round(
        timeUntilNext4AM / 1000 / 60
      )} minutes)`
    );

    // Initial execution at 4 AM
    const initialTimeout = setTimeout(() => {
      this.executePendingPurchaseCleanup();

      // Then repeat every 24 hours
      const dailyInterval = setInterval(() => {
        this.executePendingPurchaseCleanup();
      }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds

      this.intervals.push(dailyInterval);
    }, timeUntilNext4AM);

    // Store the initial timeout (not an interval, but we track it for cleanup)
    this.intervals.push(initialTimeout as unknown as NodeJS.Timeout);
  }

  /**
   * Execute the purchase cleanup task (pending + refunded)
   */
  private static async executePendingPurchaseCleanup(): Promise<void> {
    try {
      logger.info(
        `Starting scheduled purchase cleanup (pending >${PendingPurchaseCleanupService.PENDING_RETENTION_DAYS}d, refunded >${PendingPurchaseCleanupService.REFUNDED_RETENTION_DAYS}d)...`
      );

      const { pendingDeleted, refundedDeleted } =
        await PendingPurchaseCleanupService.runCleanup();

      logger.info(
        `Scheduled purchase cleanup completed: deleted ${pendingDeleted} pending, ${refundedDeleted} refunded`
      );
    } catch (error) {
      logger.error(
        "Failed to execute scheduled purchase cleanup",
        error instanceof Error ? error : new Error(String(error))
      );
      // Don't throw - we want the scheduler to continue running
    }
  }

  /**
   * Schedule refund request cleanup to run daily at 5:00 AM
   */
  private static scheduleRefundRequestCleanup(): void {
    const now = new Date();
    const next5AM = new Date();
    next5AM.setHours(5, 0, 0, 0);

    if (next5AM <= now) {
      next5AM.setDate(next5AM.getDate() + 1);
    }

    const timeUntilNext5AM = next5AM.getTime() - now.getTime();

    logger.info(
      `Refund request cleanup scheduled for ${next5AM.toISOString()} (in ${Math.round(
        timeUntilNext5AM / 1000 / 60,
      )} minutes)`,
    );

    const initialTimeout = setTimeout(() => {
      this.executeRefundRequestCleanup();

      const dailyInterval = setInterval(() => {
        this.executeRefundRequestCleanup();
      }, 24 * 60 * 60 * 1000);

      this.intervals.push(dailyInterval);
    }, timeUntilNext5AM);

    this.intervals.push(initialTimeout as unknown as NodeJS.Timeout);
  }

  /**
   * Execute refund request expiration and cleanup.
   */
  private static async executeRefundRequestCleanup(): Promise<void> {
    try {
      logger.info("Starting scheduled refund request cleanup...");

      const { expiredNotified, deletedFinished } =
        await RefundRequestService.runCleanup();

      logger.info(
        `Scheduled refund request cleanup completed: expired ${expiredNotified}, deleted ${deletedFinished} finished requests`,
      );
    } catch (error) {
      logger.error(
        "Failed to execute scheduled refund request cleanup",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Get scheduler status
   */
  static getStatus(): {
    isRunning: boolean;
    activeIntervals: number;
  } {
    return {
      isRunning: this.isRunning,
      activeIntervals: this.intervals.length,
    };
  }
}
