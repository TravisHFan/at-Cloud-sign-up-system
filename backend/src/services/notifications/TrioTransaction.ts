import { createLogger } from "../LoggerService";

interface TrioOperation {
  type: "email" | "message" | "websocket";
  id: string;
  rollback: () => Promise<void>;
  metadata?: any;
}
interface TrioTransactionState {
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
