import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CorrelatedLogger } from "../../../src/services/CorrelatedLogger";
import { Logger, LogLevel } from "../../../src/services/LoggerService";

/**
 * Focused tests for Phase 6: level filtering and error serialization behavior
 */
describe("CorrelatedLogger level filtering and error serialization", () => {
  const original = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  beforeEach(() => {
    console.log = vi.fn();
    console.info = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.log = original.log;
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
    vi.restoreAllMocks();
  });

  it("suppresses DEBUG when base Logger level is INFO, allows after set to DEBUG (on new instance)", () => {
    // Set base logger to INFO, DEBUG should be suppressed
    Logger.getInstance().setLogLevel(LogLevel.INFO);
    const clog = new CorrelatedLogger("LevelCtx", { correlationId: "c1" });

    clog.debug("dbg one");
    clog.info("inf one");

    expect(console.log).toHaveBeenCalledTimes(0);
    expect(console.info).toHaveBeenCalledTimes(1);

    // Now allow DEBUG and ensure it logs
    vi.clearAllMocks();
    Logger.getInstance().setLogLevel(LogLevel.DEBUG);
    // Important: child logger instances capture level at creation time;
    // create a new correlated logger after bumping level to DEBUG.
    const clog2 = new CorrelatedLogger("LevelCtx", { correlationId: "c1" });
    clog2.debug("dbg two");
    expect(console.log).toHaveBeenCalledTimes(1);
    const dbgMsg = (console.log as any).mock.calls[0][0] as string;
    expect(dbgMsg).toContain("[DEBUG]");
    expect(dbgMsg).toContain("[LevelCtx]");
    expect(dbgMsg).toContain("dbg two");
  });

  it("serializes Error with stack and merges correlation metadata", () => {
    Logger.getInstance().setLogLevel(LogLevel.DEBUG);
    const clog = new CorrelatedLogger("ErrCtx", {
      correlationId: "cid-x",
      userId: "u1",
    });

    const err = new Error("broke");
    err.stack = "fake-stack\n at line";

    clog.error("failed", err, "Op", { stage: "s1" });

    expect(console.error).toHaveBeenCalledTimes(1);
    const msg = (console.error as any).mock.calls[0][0] as string;

    // Level + context + message
    expect(msg).toContain("[ERROR]");
    expect(msg).toContain("[Op]");
    expect(msg).toContain("failed");

    // Error details
    expect(msg).toContain("Error: broke");
    expect(msg).toContain("Stack: fake-stack");

    // Correlation metadata merged with provided metadata
    expect(msg).toContain("cid-x");
    expect(msg).toContain("u1");
    expect(msg).toContain("stage");
    expect(msg).toContain("s1");
  });
});
