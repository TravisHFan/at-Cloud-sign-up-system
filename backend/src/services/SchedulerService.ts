import { Logger } from "./LoggerService";
import { MessageCleanupService } from "./MessageCleanupService";
import { PromoCodeCleanupService } from "./promoCodeCleanupService";
import { PendingPurchaseCleanupService } from "./PendingPurchaseCleanupService";
import { AutoUnpublishService } from "./event/AutoUnpublishService";

const logger = Logger.getInstance().child("SchedulerService");

/**
 * SchedulerService - Handles periodic background tasks
 *
 * Currently scheduled tasks:
 * - Message cleanup: Runs daily at 2:00 AM to remove old/deleted messages
 * - Promo code cleanup: Runs daily at 3:00 AM to remove old used/expired promo codes
 * - Pending purchase cleanup: Runs daily at 4:00 AM to remove stale pending purchases (>15 days)
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

    // Schedule auto-unpublish execution - runs every 15 minutes
    this.scheduleAutoUnpublishExecution();

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
   * Execute the pending purchase cleanup task
   */
  private static async executePendingPurchaseCleanup(): Promise<void> {
    try {
      logger.info(
        `Starting scheduled pending purchase cleanup (>${PendingPurchaseCleanupService.RETENTION_DAYS} days old)...`
      );

      const { deletedCount } = await PendingPurchaseCleanupService.runCleanup();

      logger.info(
        `Scheduled pending purchase cleanup completed: deleted ${deletedCount} stale pending purchases`
      );
    } catch (error) {
      logger.error(
        "Failed to execute scheduled pending purchase cleanup",
        error instanceof Error ? error : new Error(String(error))
      );
      // Don't throw - we want the scheduler to continue running
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
