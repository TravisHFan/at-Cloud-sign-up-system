import { createLogger } from "./LoggerService";
const log = createLogger("MaintenanceScheduler");
/**
 * Maintenance Scheduler
 * - Periodically purges expired guest manage tokens
 */
import GuestRegistration from "../models/GuestRegistration";

class MaintenanceScheduler {
  private static instance: MaintenanceScheduler;
  private isRunning = false;
  private intervals: NodeJS.Timeout[] = [];

  public static getInstance(): MaintenanceScheduler {
    if (!MaintenanceScheduler.instance) {
      MaintenanceScheduler.instance = new MaintenanceScheduler();
    }
    return MaintenanceScheduler.instance;
  }

  public start(): void {
    if (this.isRunning) {
      console.log("⚠️ Maintenance scheduler is already running");
      log.warn("Maintenance scheduler already running");
      return;
    }

    // Run every hour
    const hourly = setInterval(async () => {
      await this.purgeExpiredTokens();
    }, 60 * 60 * 1000);

    this.intervals.push(hourly);
    this.isRunning = true;

    console.log("🧹 Maintenance scheduler started (hourly purge)");
    log.info("Maintenance scheduler started", undefined, {
      cadence: "hourly purge",
    });
    // Trigger an initial purge shortly after startup
    setTimeout(async () => {
      await this.purgeExpiredTokens();
    }, 10 * 1000);
  }

  public stop(): void {
    if (!this.isRunning) {
      console.log("⚠️ Maintenance scheduler is not running");
      log.warn("Maintenance scheduler not running");
      return;
    }
    this.intervals.forEach(clearInterval);
    this.intervals = [];
    this.isRunning = false;
    console.log("🛑 Maintenance scheduler stopped");
    log.info("Maintenance scheduler stopped");
  }

  private async purgeExpiredTokens() {
    try {
      await (
        GuestRegistration as unknown as {
          purgeExpiredManageTokens?: () => Promise<void>;
        }
      ).purgeExpiredManageTokens?.();
      console.log("🧽 Purged expired guest manage tokens (unset)");
      log.info("Purged expired guest manage tokens", undefined, {
        mode: "unset",
      });
    } catch (err) {
      console.error("Failed to purge expired manage tokens:", err);
      log.error(
        "Failed to purge expired manage tokens",
        err instanceof Error ? err : undefined,
        undefined,
        { error: err instanceof Error ? err.message : String(err) }
      );
    }
  }
}

export default MaintenanceScheduler;
