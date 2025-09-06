/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  LogLevel,
  Logger,
  type ILogger,
  createLogger,
  logger,
  getLogLevelFromString,
} from "../../../src/services/LoggerService";

describe("LoggerService", () => {
  let testLogger: Logger;
  let consoleSpy: { error: any; warn: any; info: any; log: any };

  beforeEach(() => {
    // Reset Logger singleton for clean tests
    (Logger as any).instance = undefined;

    // Create fresh logger instance for testing
    testLogger = Logger.getInstance("TestContext", LogLevel.DEBUG);

    // Mock console methods
    consoleSpy = {
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      info: vi.spyOn(console, "info").mockImplementation(() => {}),
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe("Singleton Pattern", () => {
    it("should create a singleton instance", () => {
      const instance1 = Logger.getInstance();
      const instance2 = Logger.getInstance();

      expect(instance1).toBe(instance2);
    });

    it("should initialize with default context and log level", () => {
      // Reset singleton and create with defaults
      (Logger as any).instance = undefined;
      const instance = Logger.getInstance();

      expect(instance.getLogLevel()).toBe(LogLevel.INFO);
    });

    it("should initialize with custom context and log level", () => {
      (Logger as any).instance = undefined;
      const instance = Logger.getInstance("CustomContext", LogLevel.ERROR);

      expect(instance.getLogLevel()).toBe(LogLevel.ERROR);
    });
  });

  describe("Child Logger Creation", () => {
    it("should create child logger with specific context", () => {
      const childLogger = testLogger.child("ChildContext");

      expect(childLogger).toBeInstanceOf(Logger);
      expect(childLogger.getLogLevel()).toBe(testLogger.getLogLevel());
    });

    it("should inherit parent log level in child logger", () => {
      testLogger.setLogLevel(LogLevel.WARN);
      const childLogger = testLogger.child("ChildContext");

      expect(childLogger.getLogLevel()).toBe(LogLevel.WARN);
    });

    it("should use the child context in formatted output", () => {
      const childLogger = testLogger.child("ChildCtx");

      childLogger.info("Child message");

      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      const output = consoleSpy.info.mock.calls[0][0];
      expect(output).toContain("[ChildCtx]");
      expect(output).toContain("Child message");
      // Ensure it didn't fall back to parent's context
      expect(output).not.toContain("[TestContext]");
    });

    it("should not auto-update child log level when parent changes after creation", () => {
      // Parent at DEBUG initially
      const childLogger = testLogger.child("ChildCtx");
      expect(childLogger.getLogLevel()).toBe(LogLevel.DEBUG);

      // Change parent after child creation
      testLogger.setLogLevel(LogLevel.ERROR);

      // Child keeps its captured level
      expect(childLogger.getLogLevel()).toBe(LogLevel.DEBUG);
    });
  });

  describe("Log Level Management", () => {
    it("should set and get log level correctly", () => {
      testLogger.setLogLevel(LogLevel.ERROR);
      expect(testLogger.getLogLevel()).toBe(LogLevel.ERROR);

      testLogger.setLogLevel(LogLevel.DEBUG);
      expect(testLogger.getLogLevel()).toBe(LogLevel.DEBUG);
    });

    it("should only log messages at or below current log level", () => {
      testLogger.setLogLevel(LogLevel.WARN);

      testLogger.error("Error message");
      testLogger.warn("Warning message");
      testLogger.info("Info message"); // Should not log
      testLogger.debug("Debug message"); // Should not log

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.info).toHaveBeenCalledTimes(0);
      expect(consoleSpy.log).toHaveBeenCalledTimes(0);
    });
  });

  describe("Basic Logging Methods", () => {
    it("should log error messages correctly", () => {
      const error = new Error("Test error");
      testLogger.error("Error occurred", error, "ErrorContext", { id: 123 });

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.error.mock.calls[0][0];
      expect(logOutput).toContain("ERROR");
      expect(logOutput).toContain("Error occurred");
      expect(logOutput).toContain("ErrorContext");
      expect(logOutput).toContain("Test error");
    });

    it("should log warning messages correctly", () => {
      testLogger.warn("Warning message", "WarnContext", { severity: "medium" });

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.warn.mock.calls[0][0];
      expect(logOutput).toContain("WARN");
      expect(logOutput).toContain("Warning message");
      expect(logOutput).toContain("WarnContext");
    });

    it("should log info messages correctly", () => {
      testLogger.info("Info message", "InfoContext", { data: "value" });

      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.info.mock.calls[0][0];
      expect(logOutput).toContain("INFO");
      expect(logOutput).toContain("Info message");
      expect(logOutput).toContain("InfoContext");
    });

    it("should log debug messages correctly", () => {
      testLogger.debug("Debug message", "DebugContext", { trace: true });

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.log.mock.calls[0][0];
      expect(logOutput).toContain("DEBUG");
      expect(logOutput).toContain("Debug message");
      expect(logOutput).toContain("DebugContext");
    });
  });

  describe("Generic Log Method", () => {
    it("should log with specified level", () => {
      testLogger.log(LogLevel.WARN, "Generic warning", "GenericContext");

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.warn.mock.calls[0][0];
      expect(logOutput).toContain("WARN");
      expect(logOutput).toContain("Generic warning");
    });

    it("should include metadata in log output", () => {
      const metadata = { userId: "123", action: "login" };
      testLogger.log(LogLevel.INFO, "User action", "UserContext", metadata);

      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.info.mock.calls[0][0];
      expect(logOutput).toContain("Metadata:");
      expect(logOutput).toContain("userId");
      expect(logOutput).toContain("123");
    });

    it("should include error details in log output", () => {
      const error = new Error("Test error");
      error.stack = "Test stack trace";
      testLogger.log(
        LogLevel.ERROR,
        "Error occurred",
        "ErrorContext",
        {},
        error
      );

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.error.mock.calls[0][0];
      expect(logOutput).toContain("Error: Test error");
      expect(logOutput).toContain("Stack: Test stack trace");
    });
  });

  describe("HTTP Request Logging", () => {
    it("should log successful HTTP requests as INFO", () => {
      testLogger.logRequest(
        "GET",
        "/api/users",
        200,
        150,
        "Mozilla/5.0",
        "127.0.0.1"
      );

      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.info.mock.calls[0][0];
      expect(logOutput).toContain("GET /api/users - 200 (150ms)");
      expect(logOutput).toContain("HTTP");
    });

    it("should log failed HTTP requests as WARN", () => {
      testLogger.logRequest("POST", "/api/login", 401, 50);

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.warn.mock.calls[0][0];
      expect(logOutput).toContain("POST /api/login - 401 (50ms)");
    });

    it("should include request metadata", () => {
      testLogger.logRequest(
        "PUT",
        "/api/users/123",
        200,
        200,
        "Chrome",
        "192.168.1.1"
      );

      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.info.mock.calls[0][0];
      expect(logOutput).toContain("Chrome");
      expect(logOutput).toContain("192.168.1.1");
    });
  });

  describe("Database Operation Logging", () => {
    it("should log successful database operations as DEBUG", () => {
      testLogger.logDatabase("find", "users", 25);

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.log.mock.calls[0][0];
      expect(logOutput).toContain("Database operation: find on users (25ms)");
      expect(logOutput).toContain("Database");
    });

    it("should log failed database operations as ERROR", () => {
      const dbError = new Error("Connection timeout");
      testLogger.logDatabase("insert", "events", 5000, dbError);

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.error.mock.calls[0][0];
      expect(logOutput).toContain(
        "Database operation failed: insert on events"
      );
      expect(logOutput).toContain("Connection timeout");
    });
  });

  describe("Authentication Logging", () => {
    it("should log successful authentication as INFO", () => {
      testLogger.logAuth(
        "login",
        "user123",
        "test@example.com",
        "127.0.0.1",
        true
      );

      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.info.mock.calls[0][0];
      expect(logOutput).toContain("Authentication event: login succeeded");
      expect(logOutput).toContain("Authentication");
    });

    it("should log failed authentication as WARN", () => {
      testLogger.logAuth(
        "login",
        undefined,
        "test@example.com",
        "127.0.0.1",
        false
      );

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.warn.mock.calls[0][0];
      expect(logOutput).toContain("Authentication event: login failed");
    });
  });

  describe("User Action Logging", () => {
    it("should log user actions with metadata", () => {
      testLogger.logUserAction("create_event", "user123", "Event", "event456", {
        title: "Test Event",
      });

      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.info.mock.calls[0][0];
      expect(logOutput).toContain("User action: create_event");
      expect(logOutput).toContain("UserAction");
      expect(logOutput).toContain("user123");
    });
  });

  describe("System Event Logging", () => {
    it("should log successful system events as INFO", () => {
      testLogger.logSystem("startup", "server", { port: 3000 });

      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.info.mock.calls[0][0];
      expect(logOutput).toContain("System event: startup in server");
      expect(logOutput).toContain("System");
    });

    it("should log system errors as ERROR", () => {
      const systemError = new Error("Memory limit exceeded");
      testLogger.logSystem(
        "memory_warning",
        "server",
        { usage: "95%" },
        systemError
      );

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.error.mock.calls[0][0];
      expect(logOutput).toContain("System event: memory_warning in server");
      expect(logOutput).toContain("Memory limit exceeded");
    });
  });

  describe("Performance Logging", () => {
    it("should log fast operations as DEBUG", () => {
      testLogger.logPerformance("database_query", 50, {
        query: "SELECT * FROM users",
      });

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.log.mock.calls[0][0];
      expect(logOutput).toContain("Performance: database_query took 50ms");
      expect(logOutput).toContain("Performance");
    });

    it("should log slow operations as WARN", () => {
      testLogger.logPerformance("slow_query", 1500, { query: "Complex JOIN" });

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.warn.mock.calls[0][0];
      expect(logOutput).toContain("Performance: slow_query took 1500ms");
    });
  });

  describe("Performance Timer", () => {
    it("should create and execute performance timer", () => {
      const endTimer = testLogger.startTimer("test_operation");

      // Execute timer immediately (no async delay needed)
      endTimer();

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.log.mock.calls[0][0];
      expect(logOutput).toContain("Performance: test_operation took");
    });
  });

  describe("Performance Wrapper", () => {
    it("should wrap async function with performance logging", async () => {
      const mockAsyncFunction = vi.fn().mockResolvedValue("success");
      const wrappedFunction = testLogger.withPerformanceLogging(
        mockAsyncFunction,
        "async_operation"
      );

      const result = await wrappedFunction("arg1", "arg2");

      expect(result).toBe("success");
      expect(mockAsyncFunction).toHaveBeenCalledWith("arg1", "arg2");
      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.log.mock.calls[0][0];
      expect(logOutput).toContain("Performance: async_operation took");
    });

    it("should handle errors in wrapped functions", async () => {
      const error = new Error("Async operation failed");
      const mockAsyncFunction = vi.fn().mockRejectedValue(error);
      const wrappedFunction = testLogger.withPerformanceLogging(
        mockAsyncFunction,
        "failing_operation"
      );

      await expect(wrappedFunction()).rejects.toThrow("Async operation failed");

      expect(consoleSpy.log).toHaveBeenCalledTimes(1); // Performance log
      expect(consoleSpy.error).toHaveBeenCalledTimes(1); // Error log

      const errorOutput = consoleSpy.error.mock.calls[0][0];
      expect(errorOutput).toContain("Operation failed: failing_operation");
    });
  });

  describe("External Service Integration", () => {
    it("should handle production environment", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      // Mock the sendToExternalService method
      const sendToExternalServiceSpy = vi
        .spyOn(testLogger as any, "sendToExternalService")
        .mockImplementation(() => {});

      testLogger.info("Production log message");

      expect(sendToExternalServiceSpy).toHaveBeenCalledTimes(1);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("Log Formatting", () => {
    it("should format log entries with timestamp and level", () => {
      testLogger.info("Test message");

      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.info.mock.calls[0][0];

      expect(logOutput).toMatch(
        /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/
      ); // ISO timestamp
      expect(logOutput).toContain("[INFO]");
      expect(logOutput).toContain("[TestContext]");
      expect(logOutput).toContain("Test message");
    });
  });

  describe("Exported Functions", () => {
    it("should export singleton logger instance", () => {
      expect(logger).toBeInstanceOf(Logger);
    });

    it("should create logger with createLogger function", () => {
      const customLogger = createLogger("CustomContext");

      expect(customLogger).toBeInstanceOf(Logger);
      // createLogger creates a child logger which inherits log level from parent singleton
      expect(customLogger.getLogLevel()).toBe(testLogger.getLogLevel());
    });

    it("createLogger should pick up latest base level at creation time", () => {
      // Change the singleton/base level
      testLogger.setLogLevel(LogLevel.WARN);
      const l1 = createLogger("Ctx1");
      expect(l1.getLogLevel()).toBe(LogLevel.WARN);

      // Change again and create another
      testLogger.setLogLevel(LogLevel.ERROR);
      const l2 = createLogger("Ctx2");
      expect(l2.getLogLevel()).toBe(LogLevel.ERROR);

      // Previously created child should remain at its original level
      expect(l1.getLogLevel()).toBe(LogLevel.WARN);
    });

    it("should convert string to log level", () => {
      expect(getLogLevelFromString("error")).toBe(LogLevel.ERROR);
      expect(getLogLevelFromString("WARN")).toBe(LogLevel.WARN);
      expect(getLogLevelFromString("warning")).toBe(LogLevel.WARN);
      expect(getLogLevelFromString("info")).toBe(LogLevel.INFO);
      expect(getLogLevelFromString("debug")).toBe(LogLevel.DEBUG);
      expect(getLogLevelFromString("invalid")).toBe(LogLevel.INFO); // Default
    });
  });

  describe("Interface Compliance", () => {
    it("should implement ILogger interface", () => {
      const loggerInstance: ILogger = testLogger;

      expect(typeof loggerInstance.error).toBe("function");
      expect(typeof loggerInstance.warn).toBe("function");
      expect(typeof loggerInstance.info).toBe("function");
      expect(typeof loggerInstance.debug).toBe("function");
      expect(typeof loggerInstance.log).toBe("function");
    });
  });

  describe("Edge Cases", () => {
    it("should handle undefined metadata gracefully", () => {
      testLogger.info("Message without metadata", "Context", undefined);

      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.info.mock.calls[0][0];
      expect(logOutput).not.toContain("Metadata:");
    });

    it("should fallback when metadata is not JSON-serializable", () => {
      // Create a circular structure to trigger JSON.stringify failure
      const circular: any = {};
      circular.self = circular;

      testLogger.info("Message with circular metadata", "Ctx", circular);

      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      const output = consoleSpy.info.mock.calls[0][0];
      expect(output).toContain("Message with circular metadata");
      expect(output).toContain("[Ctx]");
      expect(output).toContain("Metadata: [unserializable]");
    });

    it("should handle error without stack trace", () => {
      const error = new Error("Error without stack");
      delete error.stack;

      testLogger.error("Error occurred", error);

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.error.mock.calls[0][0];
      expect(logOutput).toContain("Error: Error without stack");
      expect(logOutput).not.toContain("Stack:");
    });

    it("should handle empty context gracefully", () => {
      testLogger.info("Message", "");

      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.info.mock.calls[0][0];
      expect(logOutput).toContain("TestContext"); // Should fall back to default context
    });
  });
});
