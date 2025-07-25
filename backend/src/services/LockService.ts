/**
 * Lock Service - Thread Safety for Event Operations
 *
 * Provides application-level locking to prevent race conditions
 * in event signup operations across multiple collections.
 *
 * Current Implementation: In-Memory (perfect for single-server deployment)
 * Future: Can be swapped to Redis/MongoDB for distributed systems
 */

export interface ILockService {
  /**
   * Execute an operation with exclusive lock
   * @param lockKey Unique identifier for the lock (e.g., "signup:eventId:roleId")
   * @param operation The async operation to execute under lock
   * @param timeoutMs Maximum time to wait for lock (default: 5000ms)
   */
  withLock<T>(
    lockKey: string,
    operation: () => Promise<T>,
    timeoutMs?: number
  ): Promise<T>;

  /**
   * Get current lock statistics (for monitoring/debugging)
   */
  getLockStats(): {
    activeLocks: number;
    totalLocksAcquired: number;
    averageWaitTime: number;
  };
}

/**
 * In-Memory Lock Service Implementation
 *
 * Perfect for single-server deployments with low to moderate concurrency.
 * Provides fast, reliable locking without external dependencies.
 */
export class InMemoryLockService implements ILockService {
  private activeLocks = new Map<string, Promise<void>>();
  private lockStats = {
    totalLocksAcquired: 0,
    totalWaitTime: 0,
    lockCount: 0,
  };

  async withLock<T>(
    lockKey: string,
    operation: () => Promise<T>,
    timeoutMs: number = 5000
  ): Promise<T> {
    const startTime = Date.now();

    // Wait for existing lock to complete
    if (this.activeLocks.has(lockKey)) {
      const existingLock = this.activeLocks.get(lockKey)!;

      // Add timeout protection
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(`Lock timeout after ${timeoutMs}ms for key: ${lockKey}`)
          );
        }, timeoutMs);
      });

      try {
        await Promise.race([existingLock, timeoutPromise]);
      } catch (error) {
        if (error instanceof Error && error.message.includes("timeout")) {
          throw error;
        }
        // If existing lock failed, continue (don't propagate the error)
      }
    }

    // Create and execute new lock
    const lockPromise = this.executeLocked(operation);
    this.activeLocks.set(
      lockKey,
      lockPromise.then(
        () => {},
        () => {}
      )
    );

    try {
      const result = await lockPromise;

      // Update statistics
      const waitTime = Date.now() - startTime;
      this.lockStats.totalLocksAcquired++;
      this.lockStats.totalWaitTime += waitTime;
      this.lockStats.lockCount++;

      return result;
    } finally {
      // Always clean up the lock
      this.activeLocks.delete(lockKey);
    }
  }

  private async executeLocked<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      // Re-throw the original error
      throw error;
    }
  }

  getLockStats() {
    return {
      activeLocks: this.activeLocks.size,
      totalLocksAcquired: this.lockStats.totalLocksAcquired,
      averageWaitTime:
        this.lockStats.totalLocksAcquired > 0
          ? this.lockStats.totalWaitTime / this.lockStats.totalLocksAcquired
          : 0,
    };
  }

  /**
   * Development/debugging helper - clear all locks
   * Should never be called in production
   */
  clearAllLocks(): void {
    if (process.env.NODE_ENV === "production") {
      throw new Error("clearAllLocks() cannot be called in production");
    }
    this.activeLocks.clear();
  }
}

// Singleton instance for the application
export const lockService = new InMemoryLockService();
