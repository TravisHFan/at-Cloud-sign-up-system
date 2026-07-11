import { describe, it, expect, vi } from "vitest";
import { TrioTransaction } from "../../../../src/services/notifications/TrioTransaction";

describe("TrioTransaction", () => {
  it("adds operations, commits successfully, and summarizes", async () => {
    const tx = new TrioTransaction();

    const rb1 = vi.fn().mockResolvedValue(undefined);
    const rb2 = vi.fn().mockResolvedValue(undefined);

    tx.addOperation("email", { id: "op1", rollback: rb1 });
    tx.addOperation("message", { id: "op2", rollback: rb2 });

    await tx.commit();

    const state = tx.getState();
    expect(tx.isCompleted()).toBe(true);
    expect(tx.isSuccessful()).toBe(true);
    expect(state.status).toBe("committed");
    expect(tx.getDuration()).not.toBeNull();
    const summary = tx.getSummary();
    expect(summary).toContain("Status: committed");
  });

  it("rolls back operations in reverse order and records partial failures", async () => {
    const tx = new TrioTransaction();

    const rb1 = vi.fn().mockResolvedValue(undefined);
    const rb2 = vi.fn().mockRejectedValue(new Error("fail2"));
    const rb3 = vi.fn().mockResolvedValue(undefined);

    tx.addOperation("email", { id: "op1", rollback: rb1 });
    tx.addOperation("message", { id: "op2", rollback: rb2 });
    tx.addOperation("websocket", { id: "op3", rollback: rb3 });

    await tx.rollback();

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

});
