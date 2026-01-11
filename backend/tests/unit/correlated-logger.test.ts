import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CorrelatedLogger } from "../../src/services/CorrelatedLogger";
import { LogLevel } from "../../src/services/LoggerService";

describe("CorrelatedLogger", () => {
  let infoSpy: any;
  let warnSpy: any;
  let errorSpy: any;
  let logSpy: any;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("creates from minimal request-like object without req.get", () => {
    const reqLike = {
      headers: {
        "x-correlation-id": "abc-123",
        "user-agent": "Vitest",
      },
      method: "GET",
      path: "/api/test",
      ip: "127.0.0.1",
      user: { id: "u1" },
    } as any;

    const clog = CorrelatedLogger.fromRequest(reqLike, "HTTPTest");
    clog.info("hello");
    // Should include context and correlation metadata serialized
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const out = infoSpy.mock.calls[0][0] as string;
    expect(out).toContain("[HTTPTest]");
    expect(out).toContain("hello");
    expect(out).toContain("abc-123");
    expect(out).toContain("Vitest");
  });

  it("child() merges metadata and overrides context", () => {
    const reqLike = {
      headers: { "x-correlation-id": "xyz-999" },
      method: "POST",
      url: "/submit",
      socket: { remoteAddress: "::1" },
    } as any;
    const clog = CorrelatedLogger.fromRequest(reqLike, "Base");
    const child = clog.child("Child", { requestId: "r-1" });
    child.warn("notice", "CTX", { foo: "bar" });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const out = warnSpy.mock.calls[0][0] as string;
    // Explicit context argument should override child context label
    expect(out).toContain("[CTX]");
    expect(out).toContain("notice");
    // merged metadata should include correlationId and requestId
    expect(out).toContain("xyz-999");
    expect(out).toContain("r-1");
    expect(out).toContain("foo");
  });

  it("logRequest uses WARN for >=400 and INFO otherwise", () => {
    const reqLike = { headers: {}, method: "GET", path: "/" } as any;
    const clog = CorrelatedLogger.fromRequest(reqLike, "Req");
    clog.logRequest("GET", "/ok", 200, 5);
    clog.logRequest("GET", "/bad", 404, 2);
    // one info and one warn
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const infoOut = infoSpy.mock.calls[0][0] as string;
    const warnOut = warnSpy.mock.calls[0][0] as string;
    expect(infoOut).toContain("/ok - 200 (5ms)");
    expect(warnOut).toContain("/bad - 404 (2ms)");
  });

  it("logSystemEvent logs INFO for success=true and ERROR for success=false", () => {
    const reqLike = { headers: {}, method: "GET", path: "/" } as any;
    const clog = CorrelatedLogger.fromRequest(reqLike, "Sys");

    // Success case (INFO)
    clog.logSystemEvent("DatabaseSync", true, { records: 100 });
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const infoOut = infoSpy.mock.calls[0][0] as string;
    expect(infoOut).toContain("System event: DatabaseSync completed");

    // Failure case (ERROR)
    clog.logSystemEvent("CacheFlush", false, { error: "connection timeout" });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const errOut = errorSpy.mock.calls[0][0] as string;
    expect(errOut).toContain("System event: CacheFlush failed");
  });

  it("logSystemEvent uses default success=true when not provided", () => {
    const reqLike = { headers: {}, method: "GET", path: "/" } as any;
    const clog = CorrelatedLogger.fromRequest(reqLike, "Default");

    clog.logSystemEvent("Startup");
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const out = infoSpy.mock.calls[0][0] as string;
    expect(out).toContain("completed");
  });
});
