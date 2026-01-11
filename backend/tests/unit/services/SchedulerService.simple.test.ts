import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SchedulerService } from "../../../src/services/SchedulerService";
import { MessageCleanupService } from "../../../src/services/MessageCleanupService";
import { PromoCodeCleanupService } from "../../../src/services/promoCodeCleanupService";
import { PendingPurchaseCleanupService } from "../../../src/services/PendingPurchaseCleanupService";
import { AutoUnpublishService } from "../../../src/services/event/AutoUnpublishService";

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

  it("should not start if already running", () => {
    process.env.NODE_ENV = "production";
    SchedulerService.start();
    expect(SchedulerService.getStatus().isRunning).toBe(true);
    const initialIntervalCount = SchedulerService.getStatus().activeIntervals;

    // Try to start again
    SchedulerService.start();

    // Should still be running but not add more intervals
    expect(SchedulerService.getStatus().isRunning).toBe(true);
    expect(SchedulerService.getStatus().activeIntervals).toBe(
      initialIntervalCount
    );
  });

  it("should not error if stop is called when not running", () => {
    process.env.NODE_ENV = "test";
    expect(SchedulerService.getStatus().isRunning).toBe(false);

    // This should not throw
    SchedulerService.stop();

    expect(SchedulerService.getStatus().isRunning).toBe(false);
  });

  it("should execute promo code cleanup", async () => {
    const spy = vi
      .spyOn(PromoCodeCleanupService, "runCleanup")
      .mockResolvedValue({
        deletedUsed: 3,
        deletedExpired: 2,
      });

    await (SchedulerService as any).executePromoCodeCleanup();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("should handle promo code cleanup errors gracefully", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const spy = vi
      .spyOn(PromoCodeCleanupService, "runCleanup")
      .mockRejectedValue(new Error("Promo cleanup failed"));

    await (SchedulerService as any).executePromoCodeCleanup();
    expect(spy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    spy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should execute auto-unpublish", async () => {
    const spy = vi
      .spyOn(AutoUnpublishService, "executeScheduledUnpublishes")
      .mockResolvedValue({
        unpublishedCount: 2,
        eventIds: ["event1", "event2"],
      });

    await (SchedulerService as any).executeAutoUnpublish();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("should execute auto-unpublish with zero events", async () => {
    const spy = vi
      .spyOn(AutoUnpublishService, "executeScheduledUnpublishes")
      .mockResolvedValue({
        unpublishedCount: 0,
        eventIds: [],
      });

    await (SchedulerService as any).executeAutoUnpublish();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("should handle auto-unpublish errors gracefully", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const spy = vi
      .spyOn(AutoUnpublishService, "executeScheduledUnpublishes")
      .mockRejectedValue(new Error("Auto-unpublish failed"));

    await (SchedulerService as any).executeAutoUnpublish();
    expect(spy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    spy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should execute pending purchase cleanup", async () => {
    const spy = vi
      .spyOn(PendingPurchaseCleanupService, "runCleanup")
      .mockResolvedValue({
        pendingDeleted: 5,
        refundedDeleted: 3,
      });

    await (SchedulerService as any).executePendingPurchaseCleanup();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("should handle pending purchase cleanup errors gracefully", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const spy = vi
      .spyOn(PendingPurchaseCleanupService, "runCleanup")
      .mockRejectedValue(new Error("Purchase cleanup failed"));

    await (SchedulerService as any).executePendingPurchaseCleanup();
    expect(spy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    spy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should handle cleanup error as non-Error type", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const spy = vi
      .spyOn(MessageCleanupService, "executeCleanup")
      .mockRejectedValue("String error");

    await (SchedulerService as any).executeMessageCleanup();
    expect(spy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    spy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should handle promo code cleanup error as non-Error type", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const spy = vi
      .spyOn(PromoCodeCleanupService, "runCleanup")
      .mockRejectedValue("String error");

    await (SchedulerService as any).executePromoCodeCleanup();
    expect(spy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    spy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should handle auto-unpublish error as non-Error type", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const spy = vi
      .spyOn(AutoUnpublishService, "executeScheduledUnpublishes")
      .mockRejectedValue("String error");

    await (SchedulerService as any).executeAutoUnpublish();
    expect(spy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    spy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should handle pending purchase cleanup error as non-Error type", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const spy = vi
      .spyOn(PendingPurchaseCleanupService, "runCleanup")
      .mockRejectedValue("String error");

    await (SchedulerService as any).executePendingPurchaseCleanup();
    expect(spy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    spy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
