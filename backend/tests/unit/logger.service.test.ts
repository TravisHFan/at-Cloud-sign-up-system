import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  Logger,
  LogLevel,
  createLogger,
  getLogLevelFromString,
  logger as singletonLogger,
} from "../../src/services/LoggerService";

describe("LoggerService", () => {
  let infoSpy: any;
  let warnSpy: any;
  let errorSpy: any;
  let logSpy: any;

  beforeEach(() => {
    // Reset spies and set default log level to INFO before each test
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    singletonLogger.setLogLevel(LogLevel.INFO);
  });

  afterEach(() => {
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("filters out debug logs when level is INFO", () => {
    const appLogger = createLogger("Test");
    appLogger.debug("hidden debug");
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("emits debug logs when level is DEBUG", () => {
    singletonLogger.setLogLevel(LogLevel.DEBUG);
    const appLogger = createLogger("Test");
    appLogger.debug("visible debug");
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain("[DEBUG]");
    expect(logSpy.mock.calls[0][0]).toContain("visible debug");
  });

  it("includes context in messages for child loggers", () => {
    const child = createLogger("ChildContext");
    child.info("hello");
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const line = infoSpy.mock.calls[0][0] as string;
    expect(line).toContain("[INFO]");
    expect(line).toContain("[ChildContext]");
    expect(line).toContain("hello");
  });

  it("serializes error details on error logs", () => {
    const err = new Error("boom");
    const appLogger = createLogger("Errors");
    appLogger.error("operation failed", err);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const out = errorSpy.mock.calls[0][0] as string;
    expect(out).toContain("[ERROR]");
    expect(out).toContain("operation failed");
    expect(out).toContain("Error: boom");
  });

  it("maps level strings correctly", () => {
    expect(getLogLevelFromString("error")).toBe(LogLevel.ERROR);
    expect(getLogLevelFromString("warn")).toBe(LogLevel.WARN);
    expect(getLogLevelFromString("warning")).toBe(LogLevel.WARN);
    expect(getLogLevelFromString("info")).toBe(LogLevel.INFO);
    expect(getLogLevelFromString("debug")).toBe(LogLevel.DEBUG);
    // default fallback
    expect(getLogLevelFromString("unknown" as any)).toBe(LogLevel.INFO);
  });
});
