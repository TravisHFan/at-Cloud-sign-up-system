import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CorrelatedLogger } from "../../../src/services/CorrelatedLogger";
import { Logger, LogLevel } from "../../../src/services/LoggerService";

describe("CorrelatedLogger helpers", () => {
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
    Logger.getInstance().setLogLevel(LogLevel.DEBUG);
  });

  afterEach(() => {
    console.log = original.log;
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
    vi.restoreAllMocks();
  });

  it("logAuth routes INFO on success and WARN on failure, includes metadata", () => {
    const clog = new CorrelatedLogger("AuthCtx", { correlationId: "cid" });
    clog.logAuth("login", "u1", "e@x.com", true, { ip: "1.2.3.4" });
    clog.logAuth("login", "u1", "e@x.com", false);

    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
    const infoMsg = (console.info as any).mock.calls[0][0] as string;
    const warnMsg = (console.warn as any).mock.calls[0][0] as string;
    expect(infoMsg).toContain("Authentication event: login succeeded");
    expect(infoMsg).toContain("cid");
    expect(infoMsg).toContain("u1");
    expect(infoMsg).toContain("e@x.com");
    expect(infoMsg).toContain("1.2.3.4");
    expect(warnMsg).toContain("Authentication event: login failed");
  });

  it("logUserAction logs info with action and details", () => {
    const clog = new CorrelatedLogger("UserActionCtx", { userId: "u1" });
    clog.logUserAction("create_event", "u1", "Event", "e1", {
      title: "T",
    });
    expect(console.info).toHaveBeenCalledTimes(1);
    const msg = (console.info as any).mock.calls[0][0] as string;
    expect(msg).toContain("User action: create_event");
    expect(msg).toContain("u1");
    expect(msg).toContain("Event");
    expect(msg).toContain("e1");
    expect(msg).toContain("title");
  });
});
