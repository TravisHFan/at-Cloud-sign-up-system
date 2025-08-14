import { createLogger } from "../LoggerService";

export interface TrioOperation {
  type: "email" | "message" | "websocket";
  id: string;
  rollback: () => Promise<void>;
  metadata?: any;
}
export interface TrioTransactionState {
  id: string;
  status: "pending" | "committed" | "rolled_back" | "failed";
  operations: TrioOperation[];
  startTime: number;
  endTime?: number;
  error?: string;
}

export class TrioTransaction {
  private operations: TrioOperation[] = [];
  private state: TrioTransactionState;
  private committed = false;
  private rolledBack = false;
  private logger = createLogger("TrioTransaction");
  constructor() {
    this.state = {
      id: this.generateTransactionId(),
      status: "pending",
      operations: [],
      startTime: Date.now(),
    };
    this.logger.info(`Transaction ${this.state.id} started`);
  }
  addOperation(
    type: TrioOperation["type"],
    operation: Omit<TrioOperation, "type">
  ): void {
    if (this.committed || this.rolledBack)
      throw new Error("Cannot add operations to completed transaction");
    const full: TrioOperation = { type, ...operation };
    this.operations.push(full);
    this.state.operations = [...this.operations];
    this.logger.debug(
      `Added ${type} operation ${operation.id} to transaction ${this.state.id}`
    );
  }
  async commit(): Promise<void> {
    if (this.committed || this.rolledBack)
      throw new Error("Transaction already completed");
    try {
      const end = Date.now();
      this.state.endTime = end;
      this.committed = true;
      this.state.status = "committed";
      const duration = end - this.state.startTime;
      this.logger.info(
        `Transaction ${this.state.id} committed successfully (${duration}ms, ${this.operations.length} operations)`
      );
    } catch (err) {
      this.state.status = "failed";
      this.state.error = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Transaction ${this.state.id} commit failed: ${this.state.error}`
      );
      throw err;
    }
  }
  async rollback(): Promise<void> {
    if (this.committed)
      throw new Error("Cannot rollback committed transaction");
    if (this.rolledBack) {
      console.log(`Transaction ${this.state.id} already rolled back`); // test compatibility
      this.logger.warn(`Transaction ${this.state.id} already rolled back`);
      return;
    }
    this.logger.warn(
      `Rolling back transaction ${this.state.id} (${this.operations.length} operations)`
    );
    const errors: string[] = [];
    for (let i = this.operations.length - 1; i >= 0; i--) {
      const op = this.operations[i];
      try {
        this.logger.debug(`Rolling back ${op.type} operation ${op.id}`);
        await op.rollback();
        this.logger.info(
          `Successfully rolled back ${op.type} operation ${op.id}`
        );
      } catch (err) {
        const msg = `Failed to rollback ${op.type} operation ${op.id}: ${err}`;
        this.logger.error(msg, err as Error);
        errors.push(msg);
      }
    }
    this.rolledBack = true;
    this.state.status = "rolled_back";
    this.state.endTime = Date.now();
    if (errors.length) {
      this.state.error = `Rollback partially failed: ${errors.join("; ")}`;
      this.logger.warn(
        `Transaction ${this.state.id} rollback completed with errors: ${this.state.error}`
      );
    } else {
      this.logger.info(
        `Transaction ${this.state.id} rollback completed successfully`
      );
    }
  }
  getState(): TrioTransactionState {
    return { ...this.state, operations: [...this.operations] };
  }
  isCompleted(): boolean {
    return this.committed || this.rolledBack;
  }
  isSuccessful(): boolean {
    return this.committed && !this.rolledBack;
  }
  getDuration(): number | null {
    return this.state.endTime
      ? this.state.endTime - this.state.startTime
      : null;
  }
  private generateTransactionId(): string {
    return `trio-tx-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .substring(2, 11)}`;
  }
  getSummary(): string {
    const d = this.getDuration();
    return [
      `Transaction ${this.state.id}:`,
      `  Status: ${this.state.status}`,
      `  Duration: ${d ? d + "ms" : "ongoing"}`,
      `  Operations: ${this.operations.length}`,
      `  Types: ${this.operations.map((o) => o.type).join(", ")}`,
      this.state.error ? `  Error: ${this.state.error}` : ``,
    ]
      .filter(Boolean)
      .join("\n");
  }
}

export class TrioTransactionManager {
  private static activeTransactions = new Map<string, TrioTransaction>();
  private static completedTransactions: TrioTransactionState[] = [];
  private static maxHistorySize = 1000;
  private static logger = createLogger("TrioTransactionManager");

  static register(tx: TrioTransaction) {
    const s = tx.getState();
    this.activeTransactions.set(s.id, tx);
    this.logger.debug(
      `Registered transaction ${s.id} (${this.activeTransactions.size} active)`
    );
  }
  static complete(tx: TrioTransaction) {
    const s = tx.getState();
    this.activeTransactions.delete(s.id);
    this.completedTransactions.push(s);
    if (this.completedTransactions.length > this.maxHistorySize) {
      this.completedTransactions = this.completedTransactions.slice(
        -this.maxHistorySize
      );
    }
    this.logger.info(
      `Completed transaction ${s.id} (${this.activeTransactions.size} active, ${this.completedTransactions.length} in history)`
    );
  }
  static getActive(): TrioTransaction[] {
    return Array.from(this.activeTransactions.values());
  }
  static history(limit?: number): TrioTransactionState[] {
    const h = [...this.completedTransactions].reverse();
    return limit ? h.slice(0, limit) : h;
  }
  static stats() {
    const committed = this.completedTransactions.filter(
      (t) => t.status === "committed"
    ).length;
    const rolled = this.completedTransactions.filter(
      (t) => t.status === "rolled_back"
    ).length;
    const failed = this.completedTransactions.filter(
      (t) => t.status === "failed"
    ).length;
    const durations = this.completedTransactions
      .filter((t) => t.endTime)
      .map((t) => (t.endTime as number) - t.startTime);
    const avg = durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;
    return {
      active: this.activeTransactions.size,
      totalCompleted: this.completedTransactions.length,
      committed,
      rolledBack: rolled,
      failed,
      averageDuration: avg,
    };
  }
  static cleanup(maxAge = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - maxAge;
    const before = this.completedTransactions.length;
    this.completedTransactions = this.completedTransactions.filter(
      (t) => t.startTime > cutoff
    );
    const removed = before - this.completedTransactions.length;
    if (removed) this.logger.info(`Cleaned up ${removed} old transactions`);
    return removed;
  }

  // Legacy method name compatibility for tests
  static registerTransaction(tx: TrioTransaction) {
    return this.register(tx);
  }
  static completeTransaction(tx: TrioTransaction) {
    return this.complete(tx);
  }
  static getActiveTransactions() {
    return this.getActive();
  }
  static getTransactionHistory(limit?: number) {
    return this.history(limit);
  }
  static getStatistics() {
    return this.stats();
  }
}
