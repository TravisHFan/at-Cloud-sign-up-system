import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CorrelatedLogger } from "../../../src/services/CorrelatedLogger";
import { Logger, LogLevel } from "../../../src/services/LoggerService";

describe("CorrelatedLogger", () => {
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  beforeEach(() => {
    console.log = vi.fn();
    console.info = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
    // Ensure base logger allows info
    Logger.getInstance().setLogLevel(LogLevel.INFO);
  });

  afterEach(() => {
    console.log = originalLog;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
  });

  it("merges base metadata with additional metadata", () => {
    const clog = new CorrelatedLogger("TestCtx", {
      correlationId: "abc123",
      path: "/x",
    });
    clog.info("hello", undefined, { extra: 42 });
    // Info goes to console.info via LoggerService formatting
    expect(console.info).toHaveBeenCalledTimes(1);
    const msg = (console.info as any).mock.calls[0][0] as string;
    expect(msg).toContain("[INFO]");
    expect(msg).toContain("[TestCtx]");
    expect(msg).toContain("hello");
    expect(msg).toContain("correlationId");
    expect(msg).toContain("abc123");
    expect(msg).toContain("extra");
    expect(msg).toContain("42");
  });

  it("creates child logger that preserves and extends metadata", () => {
    const parent = new CorrelatedLogger("ParentCtx", {
      correlationId: "cid-1",
      userId: "u1",
    });
    const child = parent.child("ChildCtx", { method: "GET" });
    child.log(LogLevel.INFO, "child log");
    expect(console.info).toHaveBeenCalledTimes(1);
    const msg = (console.info as any).mock.calls[0][0] as string;
    expect(msg).toContain("[INFO]");
    expect(msg).toContain("[ChildCtx]");
    expect(msg).toContain("child log");
    expect(msg).toContain("cid-1");
    expect(msg).toContain("u1");
    expect(msg).toContain("GET");
  });

  it("falls back to direct header access when req.get throws", () => {
    // Create a mock request where req.get() throws but headers object has value
    const mockReq = {
      get: (_name: string): string => {
        throw new Error("get function failed");
      },
      headers: {
        "x-correlation-id": "direct-header-id",
        "user-agent": "TestAgent/1.0",
      },
      path: "/test-path",
      method: "POST",
      ip: "192.168.1.1",
    };

    const clog = CorrelatedLogger.fromRequest(mockReq as any, "TestCtx");
    clog.info("test message");

    expect(console.info).toHaveBeenCalledTimes(1);
    const msg = (console.info as any).mock.calls[0][0] as string;
    // The fallback should read from headers directly
    expect(msg).toContain("direct-header-id");
  });
});
