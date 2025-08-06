/**
 * Integration Test Resource Manager
 *
 * Manages resource cleanup and timing to prevent test interference
 */

export class IntegrationTestManager {
  private static pendingTimers: Set<NodeJS.Timeout> = new Set();
  private static pendingPromises: Set<Promise<any>> = new Set();

  static async beforeEach() {
    // Clear any pending timers from previous tests
    this.pendingTimers.forEach((timer) => clearTimeout(timer));
    this.pendingTimers.clear();

    // Wait for pending promises to resolve
    if (this.pendingPromises.size > 0) {
      await Promise.allSettled(Array.from(this.pendingPromises));
      this.pendingPromises.clear();
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Small delay to let event loop settle
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  static trackTimer(timer: NodeJS.Timeout) {
    this.pendingTimers.add(timer);
    return timer;
  }

  static trackPromise<T>(promise: Promise<T>): Promise<T> {
    this.pendingPromises.add(promise);
    promise.finally(() => this.pendingPromises.delete(promise));
    return promise;
  }

  static async afterEach() {
    // Clean up any timers created during test
    this.pendingTimers.forEach((timer) => clearTimeout(timer));
    this.pendingTimers.clear();
  }
}
