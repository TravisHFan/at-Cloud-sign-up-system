import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  RetryRecoveryStrategy,
  QueueRecoveryStrategy,
  DeferredRetryStrategy,
  LogOnlyStrategy,
  NotificationErrorHandler,
} from "../../../../src/services/notifications/NotificationErrorHandler";

describe("NotificationErrorHandler more branches", () => {
  const realRandom = Math.random;
  let consoleLogSpy: any = null;
  let consoleErrorSpy: any = null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-08-10T16:56:00Z"));
    consoleLogSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    Math.random = realRandom;
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
    consoleLogSpy = null;
    consoleErrorSpy = null;
  });

  it("RetryRecoveryStrategy schedules next attempt and respects max retries", async () => {
    const strat = new RetryRecoveryStrategy(3, 1000);
    const result1 = await strat.execute(
      {
        type: "EMAIL_SERVICE_ERROR",
        message: "smtp fail",
        service: "email",
        severity: "medium",
        recoverable: true,
      } as any,
      {
        request: {},
        transaction: { getState: () => ({ id: "t1" }) } as any,
        attempt: 1,
      } as any
    );
    expect(result1.success).toBe(true);
    expect(result1.action).toBe("retry_scheduled");
    expect(result1.retryAfter).toBe(1000);
    expect(result1.metadata?.attempt).toBe(2);

    const stratMax = new RetryRecoveryStrategy(1, 500);
    const result2 = await stratMax.execute(
      {
        type: "EMAIL_SERVICE_ERROR",
        message: "smtp fail",
        service: "email",
        severity: "medium",
        recoverable: true,
      } as any,
      {
        request: {},
        transaction: { getState: () => ({ id: "t2" }) } as any,
        attempt: 1,
      } as any
    );
    expect(result2.success).toBe(false);
    expect(result2.action).toBe("max_retries_exceeded");
  });

  it("QueueRecoveryStrategy.execute returns queued with metadata", async () => {
    const strat = new QueueRecoveryStrategy();
    Math.random = () => 0.5; // deterministic queuePosition calculation path (still valid)
    const res = await strat.execute(
      {
        type: "DATABASE_ERROR",
        message: "db issue",
        service: "database",
        severity: "critical",
        recoverable: true,
      } as any,
      {
        request: {},
        transaction: { getState: () => ({ id: "q1" }) } as any,
      } as any
    );
    expect(res.action).toBe("queued");
    expect(res.retryAfter).toBeGreaterThan(0);
    expect(res.metadata?.queuePosition).toBeGreaterThanOrEqual(1);
    expect(res.metadata?.estimatedDelay).toBe(60000);
  });

  it("DeferredRetryStrategy.execute returns deferred with metadata", async () => {
    const strat = new DeferredRetryStrategy();
    const res = await strat.execute(
      {
        type: "WEBSOCKET_ERROR",
        message: "ws issue",
        service: "websocket",
        severity: "low",
        recoverable: true,
      } as any,
      {
        request: {},
        transaction: { getState: () => ({ id: "d1" }) } as any,
      } as any
    );
    expect(res.action).toBe("deferred");
    expect(res.retryAfter).toBe(300000);
    expect(res.metadata?.backgroundJobId).toMatch(/^bg-/);
  });

  it("LogOnlyStrategy.execute returns logged (no recovery)", async () => {
    const strat = new LogOnlyStrategy();
    const res = await strat.execute(
      {
        type: "AUTH_ERROR",
        message: "unauthorized",
        service: "system",
        severity: "high",
        recoverable: false,
      } as any,
      {
        request: {},
        transaction: { getState: () => ({ id: "l1" }) } as any,
      } as any
    );
    expect(res.success).toBe(false);
    expect(res.action).toBe("logged");
  });

  it("getRecoveryHistory default parameter path (no args)", async () => {
    // Drive at least one entry
    await NotificationErrorHandler.handleTrioFailure(
      new Error("email timeout"),
      {
        request: {},
        transaction: { getState: () => ({ id: "tx-clean" }) } as any,
      } as any
    );
    const history = NotificationErrorHandler.getRecoveryHistory(); // default limit
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
  });

  it("default recoverable=true uses RetryRecoveryStrategy (unlisted type)", async () => {
    const getStrategy = (
      NotificationErrorHandler as any
    ).getRecoveryStrategy.bind(NotificationErrorHandler as any);
    const strat = getStrategy({
      type: "SOME_UNKNOWN_ERROR",
      message: "oops",
      service: "system",
      severity: "low",
      recoverable: true,
    } as any);
    expect(strat).toBeInstanceOf(RetryRecoveryStrategy);
  });

  it("getErrorStatistics aggregates errorsByService and errorsByType", async () => {
    // Avoid cleanup branch so counts persist
    Math.random = () => 1;
    // Drive an email error to increment counts
    await NotificationErrorHandler.handleTrioFailure(
      new Error("SMTP email timeout"),
      {
        request: {},
        transaction: { getState: () => ({ id: "tx-stats" }) } as any,
      } as any
    );
    const stats = NotificationErrorHandler.getErrorStatistics();
    expect(stats.errorsByService.email).toBeGreaterThan(0);
    expect(stats.errorsByType.EMAIL_SERVICE_ERROR).toBeGreaterThan(0);
  });

  it("trims recovery history to last 500 when exceeding 1000 entries", async () => {
    // Reset recovery history for deterministic trim behavior in this test only
    (NotificationErrorHandler as any).recoveryHistory = [];

    // Avoid random cleanup of errorCounts during the loop
    Math.random = () => 1;

    // Drive many recoveries via a fast log-only path (validation error)
    for (let i = 0; i < 1005; i++) {
      // eslint-disable-next-line no-await-in-loop
      await NotificationErrorHandler.handleTrioFailure(
        new Error(`Validation invalid payload ${i}`),
        {
          request: {},
          transaction: { getState: () => ({ id: `tx-${i}` }) } as any,
        } as any
      );
    }

    const all = NotificationErrorHandler.getRecoveryHistory(2000);

    // Implementation trims to 500 when threshold crossed, then may grow with subsequent entries
    // Assert that a trim occurred by verifying earliest retained tx index is >= 500
    expect(all.length).toBeGreaterThan(500);
    const firstId = all[0]?.context?.transaction?.getState()?.id || "tx-0";
    const idx = Number(String(firstId).split("-")[1] || 0);
    expect(idx).toBeGreaterThanOrEqual(500);
  });

  it("classifyError uses toString fallback when message is missing", () => {
    // Provide an object lacking `message` but with a meaningful toString
    const obj: any = { toString: () => "smtp outage detected" };
    // @ts-ignore access private for targeted coverage
    const trioErr = (NotificationErrorHandler as any).classifyError(obj);
    expect(trioErr.type).toBe("EMAIL_SERVICE_ERROR");
    expect(trioErr.message).toBe("smtp outage detected");
  });
});
