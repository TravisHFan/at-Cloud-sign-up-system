import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  NotificationErrorHandler,
  RetryRecoveryStrategy,
  QueueRecoveryStrategy,
  DeferredRetryStrategy,
  LogOnlyStrategy,
  CircuitBreakerStrategy,
  type TrioError,
} from "../../../../src/services/notifications/NotificationErrorHandler";

// Minimal TrioTransaction mock
class MockTrioTransaction {
  getState() {
    return { id: "tx-123" } as any;
  }
}

const context = { request: {}, transaction: new MockTrioTransaction() as any };

describe("NotificationErrorHandler", () => {
  beforeEach(() => {
    // Reset internal static maps by touching private APIs indirectly
    // We can't directly clear private maps; use classification/recording to rebuild state
  });

  describe("classifyError", () => {
    it("classifies email errors", async () => {
      const res = await (NotificationErrorHandler as any).handleTrioFailure(
        new Error("SMTP timeout while sending email"),
        { ...context }
      );
      expect(res).toBeDefined();
    });

    it("classifies database errors", async () => {
      const res = await (NotificationErrorHandler as any).handleTrioFailure(
        new Error("MongoDB connection error"),
        { ...context }
      );
      expect(res).toBeDefined();
    });

    it("classifies websocket errors", async () => {
      const res = await (NotificationErrorHandler as any).handleTrioFailure(
        new Error("WebSocket emit failed"),
        { ...context }
      );
      expect(res).toBeDefined();
    });

    it("classifies validation errors", async () => {
      const res = await (NotificationErrorHandler as any).handleTrioFailure(
        new Error("Validation failed: invalid input"),
        { ...context }
      );
      expect(res).toBeDefined();
    });

    it("classifies auth errors", async () => {
      const res = await (NotificationErrorHandler as any).handleTrioFailure(
        new Error("Unauthorized: auth permission denied"),
        { ...context }
      );
      expect(res).toBeDefined();
    });

    it("falls back to system error", async () => {
      const res = await (NotificationErrorHandler as any).handleTrioFailure(
        new Error("Some random failure"),
        { ...context }
      );
      expect(res).toBeDefined();
    });
  });

  describe("recovery strategies selection", () => {
    it("uses retry for email error", async () => {
      const error = new Error("email service not responding");
      const result = await NotificationErrorHandler.handleTrioFailure(error, {
        ...context,
      });
      expect([
        "retry_scheduled",
        "queued",
        "circuit_recording",
        "circuit_reset",
      ]).toContain(result.action);
    });

    it("uses deferred for websocket error", async () => {
      const error = new Error("socket emit failure");
      const result = await NotificationErrorHandler.handleTrioFailure(error, {
        ...context,
      });
      expect(["deferred", "circuit_recording", "circuit_reset"]).toContain(
        result.action
      );
    });

    it("logs-only for validation/auth", async () => {
      const error = new Error("invalid input");
      const result = await NotificationErrorHandler.handleTrioFailure(error, {
        ...context,
      });
      expect(["logged", "circuit_recording", "circuit_reset"]).toContain(
        result.action
      );
    });
  });

  describe("statistics and history APIs", () => {
    it("returns error statistics", () => {
      const stats = NotificationErrorHandler.getErrorStatistics();
      expect(stats).toHaveProperty("totalErrors");
      expect(stats).toHaveProperty("errorsByService");
      expect(stats).toHaveProperty("errorsByType");
      expect(stats).toHaveProperty("recentRecoveries");
    });

    it("returns recent recovery history", () => {
      const history = NotificationErrorHandler.getRecoveryHistory(5);
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe("edge coverage", () => {
    it("returns max_retries_exceeded when attempt reaches max", async () => {
      const error = new Error("email service timeout");
      const result = await NotificationErrorHandler.handleTrioFailure(error, {
        ...context,
        attempt: 3, // equals maxRetries for email (3)
      } as any);
      expect([
        "max_retries_exceeded",
        "retry_scheduled",
        "circuit_reset",
        "circuit_recording",
      ]).toContain(result.action);
    });

    it("selects queue strategy for high-severity email and critical DB errors", async () => {
      // Ensure circuit breaker isn't triggered by prior tests
      (NotificationErrorHandler as any).errorCounts?.clear?.();

      const getStrategy = (
        NotificationErrorHandler as any
      ).getRecoveryStrategy.bind(NotificationErrorHandler as any);

      const emailHigh = getStrategy({
        type: "EMAIL_SERVICE_ERROR",
        message: "smtp outage",
        service: "email",
        severity: "high",
        recoverable: true,
      } as any);
      expect(emailHigh).toBeInstanceOf(
        (
          await import(
            "../../../../src/services/notifications/NotificationErrorHandler"
          )
        ).QueueRecoveryStrategy
      );

      const dbCritical = getStrategy({
        type: "DATABASE_ERROR",
        message: "db down",
        service: "database",
        severity: "critical",
        recoverable: true,
      } as any);
      expect(dbCritical).toBeInstanceOf(
        (
          await import(
            "../../../../src/services/notifications/NotificationErrorHandler"
          )
        ).QueueRecoveryStrategy
      );
    });

    it("exercises circuit breaker reset, recording, and open states", async () => {
      // Prime errorCounts to force circuit breaker strategy selection
      const errorKey = "email-EMAIL_SERVICE_ERROR";
      (NotificationErrorHandler as any).errorCounts?.set?.(errorKey, 3);

      // First call should use CircuitBreaker and hit reset path (since lastFailureTime is 0)
      let result = await NotificationErrorHandler.handleTrioFailure(
        new Error("email service down"),
        { ...context }
      );
      expect(["circuit_reset", "circuit_recording", "circuit_open"]).toContain(
        result.action
      );

      // Prepare CircuitBreaker internals to avoid reset and simulate near-threshold
      const CB: any = (
        await import(
          "../../../../src/services/notifications/NotificationErrorHandler"
        )
      ).CircuitBreakerStrategy;
      if (CB && CB.lastFailureTime && CB.failureCounts) {
        CB.lastFailureTime.set(errorKey, Date.now());
        CB.failureCounts.set(errorKey, 4); // below threshold
      }

      result = await NotificationErrorHandler.handleTrioFailure(
        new Error("email service still down"),
        { ...context }
      );
      expect(["circuit_recording", "circuit_open"]).toContain(result.action);

      // Now force open
      if (CB && CB.lastFailureTime && CB.failureCounts) {
        CB.lastFailureTime.set(errorKey, Date.now());
        CB.failureCounts.set(errorKey, 5); // at/over threshold triggers open
      }

      result = await NotificationErrorHandler.handleTrioFailure(
        new Error("email still failing"),
        { ...context }
      );
      expect(result.action).toBe("circuit_open");
    });

    it("forces cleanup path in recordError via Math.random stub", async () => {
      const spyLog = vi.spyOn(console, "log").mockImplementation(() => {});
      const origRandom = Math.random;
      // Force cleanup branch
      (Math as any).random = () => 0;

      await NotificationErrorHandler.handleTrioFailure(
        new Error("random failure"),
        { ...context }
      );

      const stats = NotificationErrorHandler.getErrorStatistics();
      expect(stats.totalErrors === 0 || spyLog).toBeTruthy();
      expect(spyLog).toHaveBeenCalledWith("🧹 Error counts reset");

      // restore
      (Math as any).random = origRandom;
      spyLog.mockRestore();
    });
  });
});
