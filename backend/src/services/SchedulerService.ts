import { Logger } from "./LoggerService";
import { MessageCleanupService } from "./MessageCleanupService";

const logger = Logger.getInstance().child("SchedulerService");

/**
 * SchedulerService - Handles periodic background tasks
 *
 * Currently scheduled tasks:
 * - Message cleanup: Runs daily at 2:00 AM to remove old/deleted messages
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
