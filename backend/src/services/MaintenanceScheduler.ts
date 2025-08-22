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
      return;
    }

    // Run every hour
    const hourly = setInterval(async () => {
      await this.purgeExpiredTokens();
    }, 60 * 60 * 1000);

    this.intervals.push(hourly);
    this.isRunning = true;

    console.log("🧹 Maintenance scheduler started (hourly purge)");
    // Trigger an initial purge shortly after startup
    setTimeout(async () => {
      await this.purgeExpiredTokens();
    }, 10 * 1000);
  }

  public stop(): void {
    if (!this.isRunning) {
      console.log("⚠️ Maintenance scheduler is not running");
      return;
    }
    this.intervals.forEach(clearInterval);
    this.intervals = [];
    this.isRunning = false;
    console.log("🛑 Maintenance scheduler stopped");
  }

  private async purgeExpiredTokens() {
    try {
      await (GuestRegistration as any).purgeExpiredManageTokens?.();
      console.log("🧽 Purged expired guest manage tokens (unset)");
    } catch (err) {
      console.error("Failed to purge expired manage tokens:", err);
    }
  }
}

export default MaintenanceScheduler;
