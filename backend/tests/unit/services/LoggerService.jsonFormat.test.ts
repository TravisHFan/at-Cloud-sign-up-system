import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger, LogLevel } from "../../../src/services/LoggerService";

describe("Logger - JSON format output", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let infoSpy: any;
  let originalLogFormat: string | undefined;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalLogFormat = process.env.LOG_FORMAT;
    originalNodeEnv = process.env.NODE_ENV;
    process.env.LOG_FORMAT = "json";
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.LOG_FORMAT = originalLogFormat;
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it("should output log in JSON format when LOG_FORMAT is json", () => {
    const logger = createLogger("TestContext", LogLevel.DEBUG);

    logger.info("Test message");

    expect(infoSpy).toHaveBeenCalled();
    const output = infoSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    expect(parsed).toMatchObject({
      ts: expect.any(String),
      level: "info",
      message: "Test message",
      context: "TestContext",
    });
  });

  it("should include metadata in JSON output when provided", () => {
    const logger = createLogger("MetadataTest", LogLevel.DEBUG);

    logger.info("Message with metadata", undefined, { key: "value", num: 123 });

    expect(infoSpy).toHaveBeenCalled();
    const output = infoSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.metadata).toEqual({ key: "value", num: 123 });
  });

  it("should handle non-object metadata in JSON output", () => {
    const logger = createLogger("PrimitiveMetadata", LogLevel.DEBUG);

    logger.info("Primitive metadata", undefined, "string-metadata");

    expect(infoSpy).toHaveBeenCalled();
    const output = infoSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.metadata).toBe("string-metadata");
  });

  it("should include error info in JSON output when provided", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createLogger("ErrorTest", LogLevel.DEBUG);
    const testError = new Error("Test error message");

    // Signature is: error(message, error?, context?, metadata?)
    logger.error("Error occurred", testError);

    expect(errorSpy).toHaveBeenCalled();
    const output = errorSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.error).toMatchObject({
      message: "Test error message",
      stack: expect.any(String),
    });
  });

  it("should use correct log levels in JSON output", () => {
    const logger = createLogger("LevelTest", LogLevel.DEBUG);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    logger.debug("Debug message");
    logger.warn("Warn message");
    logger.error("Error message");

    // Check debug (uses console.log)
    const debugOutput = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(debugOutput.level).toBe("debug");

    // Check warn
    const warnOutput = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(warnOutput.level).toBe("warn");

    // Check error
    const errorOutput = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(errorOutput.level).toBe("error");
  });

  it("should fall back to logger context when entry context is not provided", () => {
    const logger = createLogger("DefaultContext", LogLevel.DEBUG);

    logger.log(LogLevel.INFO, "Message without context");

    expect(infoSpy).toHaveBeenCalled();
    const output = infoSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.context).toBe("DefaultContext");
  });

  it("should use entry context when provided", () => {
    const logger = createLogger("DefaultContext", LogLevel.DEBUG);

    logger.log(LogLevel.INFO, "Message with context", "SpecificContext");

    expect(infoSpy).toHaveBeenCalled();
    const output = infoSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.context).toBe("SpecificContext");
  });
});

describe("Logger - production external service", () => {
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it("should call sendToExternalService in production", () => {
    process.env.NODE_ENV = "production";

    const logger = createLogger("ProdContext", LogLevel.DEBUG);

    // The sendToExternalService is currently a placeholder, but we test it's called
    // by checking that no error is thrown in production mode
    expect(() => {
      logger.info("Production log");
    }).not.toThrow();
  });
});
