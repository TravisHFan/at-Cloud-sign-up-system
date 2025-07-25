/**
 * Thread Safety Test Suite
 *
 * Tests the new In-Memory Lock Service and Thread-Safe Event Operations
 * to ensure race conditions are prevented in event signup scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { InMemoryLockService } from "../../src/services/LockService";

describe("🔒 Thread Safety - Lock Service Tests", () => {
  let lockService: InMemoryLockService;

  beforeEach(() => {
    lockService = new InMemoryLockService();
  });

  afterEach(() => {
    if (process.env.NODE_ENV !== "production") {
      lockService.clearAllLocks();
    }
  });

  it("should execute operations sequentially under the same lock", async () => {
    const results: number[] = [];
    const lockKey = "test-lock";

    // Simulate two concurrent operations
    const operation1 = lockService.withLock(lockKey, async () => {
      results.push(1);
      await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate work
      results.push(2);
      return "op1-done";
    });

    const operation2 = lockService.withLock(lockKey, async () => {
      results.push(3);
      await new Promise((resolve) => setTimeout(resolve, 30)); // Simulate work
      results.push(4);
      return "op2-done";
    });

    const [result1, result2] = await Promise.all([operation1, operation2]);

    // Operations should complete sequentially, not interleaved
    expect(results).toEqual([1, 2, 3, 4]);
    expect(result1).toBe("op1-done");
    expect(result2).toBe("op2-done");
  });

  it("should allow parallel execution for different lock keys", async () => {
    const results: string[] = [];

    const operation1 = lockService.withLock("lock-A", async () => {
      results.push("A-start");
      await new Promise((resolve) => setTimeout(resolve, 30));
      results.push("A-end");
      return "A-done";
    });

    const operation2 = lockService.withLock("lock-B", async () => {
      results.push("B-start");
      await new Promise((resolve) => setTimeout(resolve, 20));
      results.push("B-end");
      return "B-done";
    });

    await Promise.all([operation1, operation2]);

    // Different locks should allow parallel execution
    expect(results).toContain("A-start");
    expect(results).toContain("B-start");
    expect(results).toContain("A-end");
    expect(results).toContain("B-end");
  });

  it("should handle lock timeouts", async () => {
    const lockKey = "timeout-test";

    // Start a long-running operation
    const longOperation = lockService.withLock(lockKey, async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return "long-done";
    });

    // Try to acquire the same lock with a short timeout
    await expect(
      lockService.withLock(
        lockKey,
        async () => {
          return "short-done";
        },
        50
      ) // 50ms timeout
    ).rejects.toThrow("Lock timeout");

    // Long operation should still complete
    const longResult = await longOperation;
    expect(longResult).toBe("long-done");
  });

  it("should clean up locks after completion", async () => {
    const lockKey = "cleanup-test";

    await lockService.withLock(lockKey, async () => {
      return "done";
    });

    const stats = lockService.getLockStats();
    expect(stats.activeLocks).toBe(0);
    expect(stats.totalLocksAcquired).toBe(1);
  });

  it("should handle operation failures gracefully", async () => {
    const lockKey = "error-test";

    await expect(
      lockService.withLock(lockKey, async () => {
        throw new Error("Operation failed");
      })
    ).rejects.toThrow("Operation failed");

    // Lock should be cleaned up even after failure
    const stats = lockService.getLockStats();
    expect(stats.activeLocks).toBe(0);

    // Should be able to acquire the lock again
    const result = await lockService.withLock(lockKey, async () => {
      return "success";
    });

    expect(result).toBe("success");
  });

  it("should provide accurate lock statistics", async () => {
    const initialStats = lockService.getLockStats();
    expect(initialStats.activeLocks).toBe(0);
    expect(initialStats.totalLocksAcquired).toBe(0);

    // Run some operations
    await Promise.all([
      lockService.withLock("lock-1", async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "done1";
      }),
      lockService.withLock("lock-2", async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "done2";
      }),
    ]);

    const finalStats = lockService.getLockStats();
    expect(finalStats.activeLocks).toBe(0);
    expect(finalStats.totalLocksAcquired).toBe(2);
    expect(finalStats.averageWaitTime).toBeGreaterThan(0);
  });
});

describe("🚀 Thread Safety - Race Condition Prevention", () => {
  let lockService: InMemoryLockService;

  beforeEach(() => {
    lockService = new InMemoryLockService();
  });

  afterEach(() => {
    if (process.env.NODE_ENV !== "production") {
      lockService.clearAllLocks();
    }
  });

  it("should prevent race condition in event signup simulation", async () => {
    // Simulate event with 1 slot available
    const eventState = {
      roleCapacity: 2,
      currentSignups: 1, // 1 slot taken, 1 available
      signupList: ["user1"] as string[],
    };

    const lockKey = "event-123:role-456";

    // Simulate 3 users trying to signup simultaneously for the last slot
    const signupAttempts = [
      lockService.withLock(lockKey, async () => {
        // Simulate the capacity check and signup process
        if (eventState.currentSignups >= eventState.roleCapacity) {
          throw new Error("Role is already full");
        }

        // Simulate database operations
        await new Promise((resolve) => setTimeout(resolve, 10));

        eventState.currentSignups++;
        eventState.signupList.push("user2");
        return "user2-success";
      }),

      lockService.withLock(lockKey, async () => {
        if (eventState.currentSignups >= eventState.roleCapacity) {
          throw new Error("Role is already full");
        }

        await new Promise((resolve) => setTimeout(resolve, 10));

        eventState.currentSignups++;
        eventState.signupList.push("user3");
        return "user3-success";
      }),

      lockService.withLock(lockKey, async () => {
        if (eventState.currentSignups >= eventState.roleCapacity) {
          throw new Error("Role is already full");
        }

        await new Promise((resolve) => setTimeout(resolve, 10));

        eventState.currentSignups++;
        eventState.signupList.push("user4");
        return "user4-success";
      }),
    ];

    const results = await Promise.allSettled(signupAttempts);

    // Only one should succeed, two should fail with "already full"
    const successes = results.filter((r) => r.status === "fulfilled");
    const failures = results.filter((r) => r.status === "rejected");

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(2);
    expect(eventState.currentSignups).toBe(2); // No overbooking!
    expect(eventState.signupList).toHaveLength(2);

    // Check that failures are due to capacity, not race conditions
    failures.forEach((failure) => {
      expect((failure as PromiseRejectedResult).reason.message).toBe(
        "Role is already full"
      );
    });
  });
});

describe("🎯 Integration Test - Event Signup Flow", () => {
  it("should demonstrate the complete thread-safe signup flow", async () => {
    const lockService = new InMemoryLockService();

    // Mock event data
    const mockEvent = {
      id: "event-123",
      roleId: "role-456",
      capacity: 3,
      currentSignups: 2,
      participants: ["alice", "bob"] as string[],
    };

    const lockKey = `signup:${mockEvent.id}:${mockEvent.roleId}`;

    // Simulate the thread-safe signup operation
    const signupResult = await lockService.withLock(lockKey, async () => {
      // Step 1: Validate capacity (this is now atomic!)
      if (mockEvent.currentSignups >= mockEvent.capacity) {
        return { success: false, message: "Role is already full" };
      }

      // Step 2: Add user to event (simulate Event collection update)
      await new Promise((resolve) => setTimeout(resolve, 5)); // Simulate DB write
      mockEvent.participants.push("charlie");
      mockEvent.currentSignups++;

      // Step 3: Create registration record (simulate Registration collection)
      await new Promise((resolve) => setTimeout(resolve, 5)); // Simulate DB write
      const registration = {
        userId: "charlie",
        eventId: mockEvent.id,
        roleId: mockEvent.roleId,
        status: "active",
      };

      return {
        success: true,
        message: "Successfully signed up!",
        data: { event: mockEvent, registration },
      };
    });

    expect(signupResult.success).toBe(true);
    expect(signupResult.message).toBe("Successfully signed up!");
    expect(mockEvent.participants).toContain("charlie");
    expect(mockEvent.currentSignups).toBe(3);

    // Try to signup when full
    const fullSignupResult = await lockService.withLock(lockKey, async () => {
      if (mockEvent.currentSignups >= mockEvent.capacity) {
        return { success: false, message: "Role is already full" };
      }

      mockEvent.participants.push("david");
      mockEvent.currentSignups++;

      return { success: true, message: "Successfully signed up!" };
    });

    expect(fullSignupResult.success).toBe(false);
    expect(fullSignupResult.message).toBe("Role is already full");
    expect(mockEvent.currentSignups).toBe(3); // No overbooking
  });
});
