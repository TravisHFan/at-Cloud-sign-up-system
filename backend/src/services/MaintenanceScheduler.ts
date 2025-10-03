import { createLogger } from "./LoggerService";
const log = createLogger("MaintenanceScheduler");
/**
 * Maintenance Scheduler
 * - Periodically purges expired guest manage tokens
 * - Periodically purges old audit logs based on retention policy
 */
import GuestRegistration from "../models/GuestRegistration";
import AuditLog from "../models/AuditLog";

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
      await this.purgeOldAuditLogs();
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
      await this.purgeOldAuditLogs();
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

  private async purgeOldAuditLogs() {
    try {
      const result = await (
        AuditLog as unknown as {
          purgeOldAuditLogs?: () => Promise<{ deletedCount: number }>;
        }
      ).purgeOldAuditLogs?.();

      if (result && result.deletedCount > 0) {
        console.log(`🗂️ Purged ${result.deletedCount} old audit logs`);
        log.info("Purged old audit logs", undefined, {
          deletedCount: result.deletedCount,
          retentionMonths: parseInt(
            process.env.AUDIT_LOG_RETENTION_MONTHS || "12",
            10
          ),
        });
      } else {
        // Only log if there were logs to check (avoid spam in empty systems)
        const totalCount = await AuditLog.countDocuments({});
        if (totalCount > 0) {
          console.log("🗂️ No old audit logs to purge");
          log.info("No old audit logs to purge", undefined, {
            totalAuditLogs: totalCount,
            retentionMonths: parseInt(
              process.env.AUDIT_LOG_RETENTION_MONTHS || "12",
              10
            ),
          });
        }
      }
    } catch (err) {
      console.error("Failed to purge old audit logs:", err);
      log.error(
        "Failed to purge old audit logs",
        err instanceof Error ? err : undefined,
        undefined,
        { error: err instanceof Error ? err.message : String(err) }
      );
    }
  }
}

export default MaintenanceScheduler;
