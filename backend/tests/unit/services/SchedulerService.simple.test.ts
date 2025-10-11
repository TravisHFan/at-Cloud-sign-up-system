import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SchedulerService } from "../../../src/services/SchedulerService";
import { MessageCleanupService } from "../../../src/services/MessageCleanupService";

describe("SchedulerService - Simplified Tests", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    SchedulerService.stop();
  });

  afterEach(() => {
    SchedulerService.stop();
    vi.useRealTimers();
    process.env.NODE_ENV = originalEnv;
  });

  it("should start the scheduler in production mode", () => {
    process.env.NODE_ENV = "production";
    SchedulerService.start();
    const status = SchedulerService.getStatus();
    expect(status.isRunning).toBe(true);
    expect(status.activeIntervals).toBeGreaterThan(0);
  });

  it("should not start in test environment", () => {
    process.env.NODE_ENV = "test";
    SchedulerService.start();
    const status = SchedulerService.getStatus();
    expect(status.isRunning).toBe(false);
    expect(status.activeIntervals).toBe(0);
  });

  it("should stop the scheduler", () => {
    process.env.NODE_ENV = "production";
    SchedulerService.start();
    expect(SchedulerService.getStatus().isRunning).toBe(true);
    SchedulerService.stop();
    expect(SchedulerService.getStatus().isRunning).toBe(false);
  });

  it("should call MessageCleanupService when executed (mocked)", async () => {
    const spy = vi
      .spyOn(MessageCleanupService, "executeCleanup")
      .mockResolvedValue({
        deletedCount: 5,
        scannedCount: 10,
        deletionsByReason: {
          deletedByAllReceivers: 1,
          lowPriorityExpired: 2,
          mediumPriorityExpired: 1,
          highPriorityExpired: 0,
          seenAndExpired: 1,
        },
        executionTimeMs: 100,
      });
    await (SchedulerService as any).executeMessageCleanup();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("should handle cleanup errors gracefully", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const spy = vi
      .spyOn(MessageCleanupService, "executeCleanup")
      .mockRejectedValue(new Error("Cleanup failed"));
    await (SchedulerService as any).executeMessageCleanup();
    expect(spy).toHaveBeenCalled();
    // The error is logged via logger, which formats it with timestamp and context
    expect(consoleErrorSpy).toHaveBeenCalled();
    spy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
