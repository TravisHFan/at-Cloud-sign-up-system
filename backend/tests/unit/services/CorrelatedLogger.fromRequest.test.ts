import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Request } from "express";
import { CorrelatedLogger } from "../../../src/services/CorrelatedLogger";
import { Logger, LogLevel } from "../../../src/services/LoggerService";

describe("CorrelatedLogger.fromRequest", () => {
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
    // Ensure base logger allows all levels for these tests
    Logger.getInstance().setLogLevel(LogLevel.DEBUG);
  });

  afterEach(() => {
    console.log = original.log;
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
    vi.restoreAllMocks();
  });

  function makeReq(overrides: any = {}): Request {
    const base = {
      correlationId: "cid-123",
      method: "GET",
      path: "/test",
      ip: "127.0.0.1",
      get: vi
        .fn()
        .mockImplementation((h: string) =>
          h === "User-Agent" ? "agent/1.0" : undefined
        ),
      user: { id: "u-1" },
    } as unknown as Request;
    return Object.assign(base as any, overrides) as unknown as Request;
  }

  it("includes correlation metadata from request and logs via info", () => {
    const req = makeReq();
    const clog = CorrelatedLogger.fromRequest(req, "ReqCtx");
    clog.info("hello");

    expect(console.info).toHaveBeenCalledTimes(1);
    const msg = (console.info as any).mock.calls[0][0] as string;
    expect(msg).toContain("[INFO]");
    expect(msg).toContain("[ReqCtx]");
    expect(msg).toContain("hello");
    expect(msg).toContain("cid-123");
    expect(msg).toContain("GET");
    expect(msg).toContain("/test");
    expect(msg).toContain("127.0.0.1");
    expect(msg).toContain("agent/1.0");
    expect(msg).toContain("u-1");
  });

  it("derives userId from _id.toString when id is absent", () => {
    const req = makeReq({ user: { _id: { toString: () => "mongo-123" } } });
    const clog = CorrelatedLogger.fromRequest(req, "ReqCtx");
    clog.info("user check");
    const msg = (console.info as any).mock.calls[0][0] as string;
    expect(msg).toContain("mongo-123");
  });

  it("routes warn and error to correct console methods", () => {
    const req = makeReq();
    const clog = CorrelatedLogger.fromRequest(req, "ReqCtx");
    clog.warn("careful");
    clog.error("boom", new Error("boom"));
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
    const warnMsg = (console.warn as any).mock.calls[0][0] as string;
    expect(warnMsg).toContain("[WARN]");
    const errMsg = (console.error as any).mock.calls[0][0] as string;
    expect(errMsg).toContain("[ERROR]");
    expect(errMsg).toContain("boom");
  });

  it("logRequest uses INFO for 2xx and WARN for 4xx/5xx", () => {
    const req = makeReq();
    const clog = CorrelatedLogger.fromRequest(req, "ReqCtx");
    clog.logRequest("GET", "/x", 200, 12);
    clog.logRequest("POST", "/y", 404, 8);
    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
    const infoMsg = (console.info as any).mock.calls[0][0] as string;
    const warnMsg = (console.warn as any).mock.calls[0][0] as string;
    expect(infoMsg).toContain("GET /x - 200 (12ms)");
    expect(warnMsg).toContain("POST /y - 404 (8ms)");
  });

  it("merges primitive metadata under data field", () => {
    const req = makeReq();
    const clog = CorrelatedLogger.fromRequest(req, "ReqCtx");
    clog.debug("primitive meta", undefined, "extra");
    expect(console.log).toHaveBeenCalledTimes(1);
    const msg = (console.log as any).mock.calls[0][0] as string;
    expect(msg).toContain("primitive meta");
    expect(msg).toContain("Metadata");
    expect(msg).toContain('"data": "extra"');
  });
});
