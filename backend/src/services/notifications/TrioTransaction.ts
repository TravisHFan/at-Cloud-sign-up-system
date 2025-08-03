/**
 * TRIO TRANSACTION MANAGEMENT - Phase 2 Enhancement
 *
 * ⚠️  CORE TRANSACTION SYSTEM - DO NOT DELETE ⚠️
 *
 * Provides transaction-like behavior for trio operations with rollback capabilities.
 * Ensures atomicity and consistency across email, database, and WebSocket operations.
 *
 * PURPOSE: Atomic trio operations with rollback support
 * SCOPE: Cross-service transaction coordination
 * FEATURES: Operation tracking, rollback mechanisms, error recovery
 */

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

/**
 * Transaction-like coordinator for trio operations
 * Provides rollback capabilities when any part of the trio fails
 */
export class TrioTransaction {
  private operations: TrioOperation[] = [];
  private state: TrioTransactionState;
  private committed = false;
  private rolledBack = false;

  constructor() {
    this.state = {
      id: this.generateTransactionId(),
      status: "pending",
      operations: [],
      startTime: Date.now(),
    };

    console.log(`🔄 Transaction ${this.state.id} started`);
  }

  /**
   * Add an operation to the transaction
   */
  addOperation(
    type: TrioOperation["type"],
    operation: Omit<TrioOperation, "type">
  ): void {
    if (this.committed || this.rolledBack) {
      throw new Error("Cannot add operations to completed transaction");
    }

    const fullOperation: TrioOperation = {
      type,
      ...operation,
    };

    this.operations.push(fullOperation);
    this.state.operations = [...this.operations];

    console.log(
      `➕ Added ${type} operation ${operation.id} to transaction ${this.state.id}`
    );
  }

  /**
   * Commit the transaction (marks as successful)
   */
  async commit(): Promise<void> {
    if (this.committed || this.rolledBack) {
      throw new Error("Transaction already completed");
    }

    try {
      this.committed = true;
      this.state.status = "committed";
      this.state.endTime = Date.now();

      const duration = this.state.endTime - this.state.startTime;
      console.log(
        `✅ Transaction ${this.state.id} committed successfully (${duration}ms, ${this.operations.length} operations)`
      );
    } catch (error) {
      this.state.status = "failed";
      this.state.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Rollback all operations in reverse order
   */
  async rollback(): Promise<void> {
    if (this.committed) {
      throw new Error("Cannot rollback committed transaction");
    }

    if (this.rolledBack) {
      console.log(`⚠️  Transaction ${this.state.id} already rolled back`);
      return;
    }

    console.log(
      `🔄 Rolling back transaction ${this.state.id} (${this.operations.length} operations)`
    );

    const rollbackErrors: string[] = [];

    // Rollback operations in reverse order (LIFO)
    for (let i = this.operations.length - 1; i >= 0; i--) {
      const operation = this.operations[i];

      try {
        console.log(
          `🔄 Rolling back ${operation.type} operation ${operation.id}`
        );
        await operation.rollback();
        console.log(
          `✅ Successfully rolled back ${operation.type} operation ${operation.id}`
        );
      } catch (error) {
        const errorMsg = `Failed to rollback ${operation.type} operation ${operation.id}: ${error}`;
        console.error(`❌ ${errorMsg}`);
        rollbackErrors.push(errorMsg);
      }
    }

    this.rolledBack = true;
    this.state.status = "rolled_back";
    this.state.endTime = Date.now();

    if (rollbackErrors.length > 0) {
      this.state.error = `Rollback partially failed: ${rollbackErrors.join(
        "; "
      )}`;
      console.warn(
        `⚠️  Transaction ${this.state.id} rollback completed with errors: ${this.state.error}`
      );
    } else {
      console.log(
        `✅ Transaction ${this.state.id} rollback completed successfully`
      );
    }
  }

  /**
   * Get current transaction state
   */
  getState(): TrioTransactionState {
    return {
      ...this.state,
      operations: [...this.operations],
    };
  }

  /**
   * Check if transaction is completed
   */
  isCompleted(): boolean {
    return this.committed || this.rolledBack;
  }

  /**
   * Check if transaction was successful
   */
  isSuccessful(): boolean {
    return this.committed && !this.rolledBack;
  }

  /**
   * Get transaction duration
   */
  getDuration(): number | null {
    if (!this.state.endTime) return null;
    return this.state.endTime - this.state.startTime;
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `trio-tx-${timestamp}-${random}`;
  }

  /**
   * Create a summary of the transaction for logging
   */
  getSummary(): string {
    const duration = this.getDuration();
    const durationStr = duration ? `${duration}ms` : "ongoing";

    return [
      `Transaction ${this.state.id}:`,
      `  Status: ${this.state.status}`,
      `  Duration: ${durationStr}`,
      `  Operations: ${this.operations.length}`,
      `  Types: ${this.operations.map((op) => op.type).join(", ")}`,
      this.state.error ? `  Error: ${this.state.error}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
}

/**
 * Transaction manager for tracking and monitoring all trio transactions
 */
export class TrioTransactionManager {
  private static activeTransactions = new Map<string, TrioTransaction>();
  private static completedTransactions: TrioTransactionState[] = [];
  private static maxHistorySize = 1000;

  /**
   * Register a new transaction
   */
  static registerTransaction(transaction: TrioTransaction): void {
    const state = transaction.getState();
    this.activeTransactions.set(state.id, transaction);
    console.log(
      `📋 Registered transaction ${state.id} (${this.activeTransactions.size} active)`
    );
  }

  /**
   * Mark transaction as completed and move to history
   */
  static completeTransaction(transaction: TrioTransaction): void {
    const state = transaction.getState();

    // Remove from active transactions
    this.activeTransactions.delete(state.id);

    // Add to completed history
    this.completedTransactions.push(state);

    // Limit history size
    if (this.completedTransactions.length > this.maxHistorySize) {
      this.completedTransactions = this.completedTransactions.slice(
        -this.maxHistorySize
      );
    }

    console.log(
      `📝 Completed transaction ${state.id} (${this.activeTransactions.size} active, ${this.completedTransactions.length} in history)`
    );
  }

  /**
   * Get all active transactions
   */
  static getActiveTransactions(): TrioTransaction[] {
    return Array.from(this.activeTransactions.values());
  }

  /**
   * Get transaction history
   */
  static getTransactionHistory(limit?: number): TrioTransactionState[] {
    const history = [...this.completedTransactions].reverse(); // Most recent first
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get transaction statistics
   */
  static getStatistics(): {
    active: number;
    totalCompleted: number;
    committed: number;
    rolledBack: number;
    failed: number;
    averageDuration: number;
  } {
    const committed = this.completedTransactions.filter(
      (tx) => tx.status === "committed"
    ).length;
    const rolledBack = this.completedTransactions.filter(
      (tx) => tx.status === "rolled_back"
    ).length;
    const failed = this.completedTransactions.filter(
      (tx) => tx.status === "failed"
    ).length;

    const durations = this.completedTransactions
      .filter((tx) => tx.endTime)
      .map((tx) => tx.endTime! - tx.startTime);

    const averageDuration =
      durations.length > 0
        ? durations.reduce((sum, duration) => sum + duration, 0) /
          durations.length
        : 0;

    return {
      active: this.activeTransactions.size,
      totalCompleted: this.completedTransactions.length,
      committed,
      rolledBack,
      failed,
      averageDuration,
    };
  }

  /**
   * Clean up old completed transactions
   */
  static cleanup(maxAge: number = 24 * 60 * 60 * 1000): number {
    // Default: 24 hours
    const cutoff = Date.now() - maxAge;
    const initialCount = this.completedTransactions.length;

    this.completedTransactions = this.completedTransactions.filter(
      (tx) => tx.startTime > cutoff
    );

    const removedCount = initialCount - this.completedTransactions.length;
    if (removedCount > 0) {
      console.log(`🧹 Cleaned up ${removedCount} old transactions`);
    }

    return removedCount;
  }
}
