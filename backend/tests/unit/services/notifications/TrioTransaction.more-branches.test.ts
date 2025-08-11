import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  TrioTransaction,
  TrioTransactionManager,
} from "../../../../src/services/notifications/TrioTransaction";

describe("TrioTransaction - additional branches", () => {
  beforeEach(() => {
    (TrioTransactionManager as any).activeTransactions = new Map();
    (TrioTransactionManager as any).completedTransactions = [];
  });

  it("summary shows ongoing when not completed and types list", () => {
    const tx = new TrioTransaction();
    tx.addOperation("email", { id: "e1", rollback: vi.fn() });
    tx.addOperation("message", { id: "m1", rollback: vi.fn() });

    const summary = tx.getSummary();
    expect(summary).toContain("Status: pending");
    expect(summary).toContain("Duration: ongoing");
    expect(summary).toContain("Types: email, message");
    expect(tx.isCompleted()).toBe(false);
    expect(tx.isSuccessful()).toBe(false);
  });

  it("isSuccessful is false after rollback", async () => {
    const tx = new TrioTransaction();
    tx.addOperation("websocket", { id: "w1", rollback: vi.fn() });
    await tx.rollback();
    expect(tx.isCompleted()).toBe(true);
    expect(tx.isSuccessful()).toBe(false);
    const summary = tx.getSummary();
    expect(summary).toContain("Status: rolled_back");
  });

  it("second rollback is a no-op and logs 'already rolled back'", async () => {
    const tx = new TrioTransaction();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await tx.rollback();
    // Clear to capture only the second call path
    logSpy.mockClear();
    await tx.rollback();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("already rolled back")
    );
    logSpy.mockRestore();
  });

  it("getStatistics returns zeros with no history (averageDuration=0)", () => {
    const stats = TrioTransactionManager.getStatistics();
    expect(stats).toEqual({
      active: 0,
      totalCompleted: 0,
      committed: 0,
      rolledBack: 0,
      failed: 0,
      averageDuration: 0,
    });
  });

  it("commit catch-path sets status failed when an unexpected error occurs", async () => {
    const tx = new TrioTransaction();
    // Simulate an internal error during commit by temporarily monkey-patching state mutation
    // We'll throw from Date.now to force the catch block without changing production code
    const realNow = Date.now;
    // @ts-ignore
    Date.now = () => {
      throw new Error("time boom");
    };
    try {
      await expect(tx.commit()).rejects.toThrow("time boom");
      const state = tx.getState();
      expect(state.status).toBe("failed");
      expect(state.error).toContain("time boom");
    } finally {
      // restore
      Date.now = realNow;
    }
  });

  it("commit rejects when called after a rollback (covers rolledBack branch of guard)", async () => {
    const tx = new TrioTransaction();
    await tx.rollback();
    await expect(tx.commit()).rejects.toThrow("Transaction already completed");
  });

  it("commit catch-path handles non-Error thrown values (uses String(error))", async () => {
    const tx = new TrioTransaction();
    const realNow = Date.now;
    // @ts-ignore - throw a primitive to hit the non-Error branch
    Date.now = () => {
      throw "time oops";
    };
    try {
      await expect(tx.commit()).rejects.toThrow();
      const state = tx.getState();
      expect(state.status).toBe("failed");
      expect(state.error).toBe("time oops");
    } finally {
      Date.now = realNow;
    }
  });
});
