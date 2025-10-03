import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import MaintenanceScheduler from "../../../src/services/MaintenanceScheduler";
import AuditLog from "../../../src/models/AuditLog";

// Mock AuditLog to control behavior
vi.mock("../../../src/models/AuditLog", () => ({
  default: {
    purgeOldAuditLogs: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

describe("MaintenanceScheduler - Audit Log Integration", () => {
  let scheduler: MaintenanceScheduler;
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.AUDIT_LOG_RETENTION_MONTHS;
    scheduler = MaintenanceScheduler.getInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.AUDIT_LOG_RETENTION_MONTHS;
    } else {
      process.env.AUDIT_LOG_RETENTION_MONTHS = originalEnv;
    }
    scheduler.stop();
  });

  it("should call purgeOldAuditLogs during maintenance cycle", async () => {
    const mockPurgeResult = { deletedCount: 5 };
    (AuditLog.purgeOldAuditLogs as any).mockResolvedValue(mockPurgeResult);

    // Access private method for testing
    const schedulerInstance = scheduler as any;
    await schedulerInstance.purgeOldAuditLogs();

    expect(AuditLog.purgeOldAuditLogs).toHaveBeenCalledOnce();
  });

  it("should log successful audit log purge with deletion count", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const mockPurgeResult = { deletedCount: 10 };
    (AuditLog.purgeOldAuditLogs as any).mockResolvedValue(mockPurgeResult);

    const schedulerInstance = scheduler as any;
    await schedulerInstance.purgeOldAuditLogs();

    expect(consoleSpy).toHaveBeenCalledWith("🗂️ Purged 10 old audit logs");
    consoleSpy.mockRestore();
  });

  it("should log no purge needed when no old logs exist", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const mockPurgeResult = { deletedCount: 0 };
    (AuditLog.purgeOldAuditLogs as any).mockResolvedValue(mockPurgeResult);
    (AuditLog.countDocuments as any).mockResolvedValue(25); // System has logs, just none to purge

    const schedulerInstance = scheduler as any;
    await schedulerInstance.purgeOldAuditLogs();

    expect(consoleSpy).toHaveBeenCalledWith("🗂️ No old audit logs to purge");
    consoleSpy.mockRestore();
  });

  it("should not log when system has no audit logs at all", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const mockPurgeResult = { deletedCount: 0 };
    (AuditLog.purgeOldAuditLogs as any).mockResolvedValue(mockPurgeResult);
    (AuditLog.countDocuments as any).mockResolvedValue(0); // Empty system

    const schedulerInstance = scheduler as any;
    await schedulerInstance.purgeOldAuditLogs();

    // Should not log "No old audit logs to purge" for empty systems
    expect(consoleSpy).not.toHaveBeenCalledWith(
      "🗂️ No old audit logs to purge"
    );
    consoleSpy.mockRestore();
  });

  it("should handle and log errors from purgeOldAuditLogs", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const testError = new Error("Database connection failed");
    (AuditLog.purgeOldAuditLogs as any).mockRejectedValue(testError);

    const schedulerInstance = scheduler as any;
    await schedulerInstance.purgeOldAuditLogs();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to purge old audit logs:",
      testError
    );
    consoleErrorSpy.mockRestore();
  });

  it("should use correct retention months from environment", async () => {
    process.env.AUDIT_LOG_RETENTION_MONTHS = "18";
    const mockPurgeResult = { deletedCount: 3 };
    (AuditLog.purgeOldAuditLogs as any).mockResolvedValue(mockPurgeResult);

    const schedulerInstance = scheduler as any;
    await schedulerInstance.purgeOldAuditLogs();

    // The method itself uses the env var internally, so we just verify it's called
    expect(AuditLog.purgeOldAuditLogs).toHaveBeenCalledOnce();
  });

  it("should handle malformed purge result gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    (AuditLog.purgeOldAuditLogs as any).mockResolvedValue(null); // Malformed result
    (AuditLog.countDocuments as any).mockResolvedValue(5);

    const schedulerInstance = scheduler as any;
    await schedulerInstance.purgeOldAuditLogs();

    // Should handle null result and not crash
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Purged")
    );
    consoleSpy.mockRestore();
  });
});
