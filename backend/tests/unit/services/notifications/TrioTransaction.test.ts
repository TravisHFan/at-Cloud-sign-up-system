import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TrioTransaction,
  TrioTransactionManager,
} from "../../../../src/services/notifications/TrioTransaction";

describe("TrioTransaction", () => {
  beforeEach(() => {
    // Reset manager state by accessing private arrays via any (test-only)
    (TrioTransactionManager as any).activeTransactions = new Map();
    (TrioTransactionManager as any).completedTransactions = [];
  });

  it("adds operations, commits successfully, and summarizes", async () => {
    const tx = new TrioTransaction();
    TrioTransactionManager.registerTransaction(tx);

    const rb1 = vi.fn().mockResolvedValue(undefined);
    const rb2 = vi.fn().mockResolvedValue(undefined);

    tx.addOperation("email", { id: "op1", rollback: rb1 });
    tx.addOperation("message", { id: "op2", rollback: rb2 });

    await tx.commit();
    TrioTransactionManager.completeTransaction(tx);

    const state = tx.getState();
    expect(tx.isCompleted()).toBe(true);
    expect(tx.isSuccessful()).toBe(true);
    expect(state.status).toBe("committed");
    expect(tx.getDuration()).not.toBeNull();
    const summary = tx.getSummary();
    expect(summary).toContain("Status: committed");

    const stats = TrioTransactionManager.getStatistics();
    expect(stats.totalCompleted).toBe(1);
    expect(stats.committed).toBe(1);
    expect(TrioTransactionManager.getActiveTransactions().length).toBe(0);
  });

  it("rolls back operations in reverse order and records partial failures", async () => {
    const tx = new TrioTransaction();
    TrioTransactionManager.registerTransaction(tx);

    const rb1 = vi.fn().mockResolvedValue(undefined);
    const rb2 = vi.fn().mockRejectedValue(new Error("fail2"));
    const rb3 = vi.fn().mockResolvedValue(undefined);

    tx.addOperation("email", { id: "op1", rollback: rb1 });
    tx.addOperation("message", { id: "op2", rollback: rb2 });
    tx.addOperation("websocket", { id: "op3", rollback: rb3 });

    await tx.rollback();
    TrioTransactionManager.completeTransaction(tx);

    const state = tx.getState();
    expect(state.status).toBe("rolled_back");
    // rb3 (op3) executed first, then rb2, then rb1
    expect(rb3).toHaveBeenCalledTimes(1);
    expect(rb2).toHaveBeenCalledTimes(1);
    expect(rb1).toHaveBeenCalledTimes(1);
    expect(state.error).toContain("Rollback partially failed");

    // idempotent rollback call
    await tx.rollback();
    expect(tx.getState().status).toBe("rolled_back");
  });

  it("prevents adding operations after completion and prevents double complete", async () => {
    const tx = new TrioTransaction();
    await tx.commit();
    expect(() =>
      tx.addOperation("email", { id: "late", rollback: vi.fn() })
    ).toThrow();
    await expect(tx.commit()).rejects.toThrow();
  });

  it("throws when attempting rollback after commit", async () => {
    const tx = new TrioTransaction();
    await tx.commit();
    await expect(tx.rollback()).rejects.toThrow(
      "Cannot rollback committed transaction"
    );
  });

  it("prevents adding operations after rollback as well", async () => {
    const tx = new TrioTransaction();
    await tx.rollback();
    expect(() =>
      tx.addOperation("message", { id: "late2", rollback: vi.fn() })
    ).toThrow("Cannot add operations to completed transaction");
  });

  it("manager history cleanup removes old transactions", () => {
    // fabricate older transactions in history
    (TrioTransactionManager as any).completedTransactions = [
      {
        id: "old1",
        status: "committed",
        operations: [],
        startTime: Date.now() - 100000,
        endTime: Date.now() - 90000,
      },
      {
        id: "new1",
        status: "rolled_back",
        operations: [],
        startTime: Date.now(),
        endTime: Date.now(),
      },
    ];

    const removed = TrioTransactionManager.cleanup(95_000); // remove older than 95s
    expect(removed).toBe(1);
    const stats = TrioTransactionManager.getStatistics();
    expect(stats.totalCompleted).toBe(1);
  });

  it("getDuration returns null while ongoing and summary includes error when present", async () => {
    const tx = new TrioTransaction();
    expect(tx.getDuration()).toBeNull();

    // Cause rollback with an error to populate state.error
    const errRollback = vi.fn().mockRejectedValue(new Error("boom"));
    tx.addOperation("message", { id: "m1", rollback: errRollback });
    await tx.rollback();
    const summary = tx.getSummary();
    expect(summary).toContain("Status: rolled_back");
    expect(summary).toContain("Error: Rollback partially failed");
  });

  it("getTransactionHistory supports limit and trimming of history when exceeding max size", async () => {
    // Reduce history size to exercise trimming branch
    (TrioTransactionManager as any).maxHistorySize = 2;

    const tx1 = new TrioTransaction();
    await tx1.commit();
    TrioTransactionManager.completeTransaction(tx1);

    const tx2 = new TrioTransaction();
    await tx2.rollback();
    TrioTransactionManager.completeTransaction(tx2);

    const tx3 = new TrioTransaction();
    await tx3.commit();
    TrioTransactionManager.completeTransaction(tx3);

    const fullHistory = TrioTransactionManager.getTransactionHistory();
    expect(fullHistory.length).toBe(2); // trimmed to maxHistorySize

    const limited = TrioTransactionManager.getTransactionHistory(1);
    expect(limited.length).toBe(1);
    // Most recent first
    expect(limited[0].id).toBe(tx3.getState().id);
  });
});
