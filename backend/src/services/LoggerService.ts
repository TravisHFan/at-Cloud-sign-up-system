/**
 * Logger Service
 * Centralized logging functionality
 * Follows Single Responsibility Principle
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
  metadata?: unknown;
  error?: Error;
}

export interface ILogger {
  error(
    message: string,
    error?: Error,
    context?: string,
    metadata?: unknown,
  ): void;
  warn(message: string, context?: string, metadata?: unknown): void;
  info(message: string, context?: string, metadata?: unknown): void;
  debug(message: string, context?: string, metadata?: unknown): void;
  log(
    level: LogLevel,
    message: string,
    context?: string,
    metadata?: unknown,
    error?: Error,
  ): void;
}

export class Logger implements ILogger {
  private static instance: Logger;
  private currentLogLevel: LogLevel;
  private context: string;

  private constructor(
    context: string = "Application",
    logLevel: LogLevel = LogLevel.INFO,
  ) {
    this.context = context;
    this.currentLogLevel = logLevel;
  }

  public static getInstance(context?: string, logLevel?: LogLevel): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(context, logLevel);
    }
    return Logger.instance;
  }

  /**
   * Create a child logger with a specific context
   */
  public child(context: string): Logger {
    return new Logger(context, this.currentLogLevel);
  }

  /**
   * Set the current log level
   */
  public setLogLevel(level: LogLevel): void {
    this.currentLogLevel = level;
  }

  /**
   * Get the current log level
   */
  public getLogLevel(): LogLevel {
    return this.currentLogLevel;
  }

  /**
   * Check if a log level should be processed
   */
  private shouldLog(level: LogLevel): boolean {
    return level <= this.currentLogLevel;
  }

  /**
   * Format log entry for output
   */
  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const levelName = LogLevel[entry.level];
    const context = entry.context || this.context;

    let formatted = `[${timestamp}] [${levelName}] [${context}] ${entry.message}`;

    if (entry.metadata) {
      try {
        formatted += ` | Metadata: ${JSON.stringify(entry.metadata, null, 2)}`;
      } catch {
        formatted += " | Metadata: [unserializable]";
      }
    }

    if (entry.error) {
      formatted += `\nError: ${entry.error.message}`;
      if (entry.error.stack) {
        formatted += `\nStack: ${entry.error.stack}`;
      }
    }

    return formatted;
  }

  /**
   * Get console method for log level
   */
  private getConsoleMethod(level: LogLevel): "error" | "warn" | "info" | "log" {
    switch (level) {
      case LogLevel.ERROR:
        return "error";
      case LogLevel.WARN:
        return "warn";
      case LogLevel.INFO:
        return "info";
      case LogLevel.DEBUG:
      default:
        return "log";
    }
  }

  /**
   * Write log entry to output
   */
  private writeLog(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }
    const consoleMethod = this.getConsoleMethod(entry.level);
    if (process.env.LOG_FORMAT === "json") {
      // Emit structured JSON line (stable keys)
      const out: Record<string, unknown> = {
        ts: entry.timestamp.toISOString(),
        level: LogLevel[entry.level].toLowerCase(),
        message: entry.message,
        context: entry.context || this.context,
      };
      if (entry.metadata) {
        out.metadata = entry.metadata;
      }
      if (entry.error) {
        out.error = {
          message: entry.error.message,
          stack: entry.error.stack,
        };
      }
      try {
        console[consoleMethod](JSON.stringify(out));
      } catch {
        // Handle circular references or other serialization issues
        out.metadata = "[unserializable]";
        console[consoleMethod](JSON.stringify(out));
      }
    } else {
      const formatted = this.formatLogEntry(entry);
      console[consoleMethod](formatted);
    }

    // In production, you might want to send logs to external services
    if (process.env.NODE_ENV === "production") {
      this.sendToExternalService(entry);
    }
  }

  /**
   * Send logs to external service (placeholder)
   */
  private sendToExternalService(_entry: LogEntry): void {
    // Implement external logging service integration here
    // Examples: Winston, Bunyan, LogDNA, Splunk, etc.
    // For now, this is a placeholder
  }

  /**
   * Generic log method
   */
  public log(
    level: LogLevel,
    message: string,
    context?: string,
    metadata?: unknown,
    error?: Error,
  ): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context: context || this.context,
      metadata,
      error,
    };

    this.writeLog(entry);
  }

  /**
   * Log error message
   */
  public error(
    message: string,
    error?: Error,
    context?: string,
    metadata?: unknown,
  ): void {
    this.log(LogLevel.ERROR, message, context, metadata, error);
  }

  /**
   * Log warning message
   */
  public warn(message: string, context?: string, metadata?: unknown): void {
    this.log(LogLevel.WARN, message, context, metadata);
  }

  /**
   * Log info message
   */
  public info(message: string, context?: string, metadata?: unknown): void {
    this.log(LogLevel.INFO, message, context, metadata);
  }

  /**
   * Log debug message
   */
  public debug(message: string, context?: string, metadata?: unknown): void {
    this.log(LogLevel.DEBUG, message, context, metadata);
  }

  /**
   * Log HTTP request
   */
  public logRequest(
    method: string,
    url: string,
    statusCode: number,
    responseTime: number,
    userAgent?: string,
    ip?: string,
  ): void {
    const metadata = {
      method,
      url,
      statusCode,
      responseTime,
      userAgent,
      ip,
    };

    const level = statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    this.log(
      level,
      `${method} ${url} - ${statusCode} (${responseTime}ms)`,
      "HTTP",
      metadata,
    );
  }

  /**
   * Log database operation
   */
  public logDatabase(
    operation: string,
    collection: string,
    duration: number,
    error?: Error,
  ): void {
    const metadata = {
      operation,
      collection,
      duration,
    };

    if (error) {
      this.error(
        `Database operation failed: ${operation} on ${collection}`,
        error,
        "Database",
        metadata,
      );
    } else {
      this.debug(
        `Database operation: ${operation} on ${collection} (${duration}ms)`,
        "Database",
        metadata,
      );
    }
  }

  /**
   * Log authentication events
   */
  public logAuth(
    event: string,
    userId?: string,
    email?: string,
    ip?: string,
    success: boolean = true,
  ): void {
    const metadata = {
      event,
      userId,
      email,
      ip,
      success,
    };

    const level = success ? LogLevel.INFO : LogLevel.WARN;
    this.log(
      level,
      `Authentication event: ${event} ${success ? "succeeded" : "failed"}`,
      "Authentication",
      metadata,
    );
  }

  /**
   * Log user actions
   */
  public logUserAction(
    action: string,
    userId: string,
    resourceType?: string,
    resourceId?: string,
    details?: unknown,
  ): void {
    const metadata = {
      action,
      userId,
      resourceType,
      resourceId,
      details,
    };

    this.info(`User action: ${action}`, "UserAction", metadata);
  }

  /**
   * Log system events
   */
  public logSystem(
    event: string,
    component: string,
    details?: unknown,
    error?: Error,
  ): void {
    const metadata = {
      event,
      component,
      details,
    };

    if (error) {
      this.error(
        `System event: ${event} in ${component}`,
        error,
        "System",
        metadata,
      );
    } else {
      this.info(`System event: ${event} in ${component}`, "System", metadata);
    }
  }

  /**
   * Log performance metrics
   */
  public logPerformance(
    operation: string,
    duration: number,
    metadata?: Record<string, unknown>,
  ): void {
    const perfMetadata = {
      operation,
      duration,
      ...(metadata || {}),
    };

    const level = duration > 1000 ? LogLevel.WARN : LogLevel.DEBUG;
    this.log(
      level,
      `Performance: ${operation} took ${duration}ms`,
      "Performance",
      perfMetadata,
    );
  }

  /**
   * Start performance timer
   */
  public startTimer(label: string): () => void {
    const start = Date.now();

    return () => {
      const duration = Date.now() - start;
      this.logPerformance(label, duration);
    };
  }

  /**
   * Create a performance wrapper for async functions
   */
  public withPerformanceLogging<
    T extends (...args: unknown[]) => Promise<unknown>,
  >(fn: T, operationName: string): T {
    return (async (...args: unknown[]) => {
      const endTimer = this.startTimer(operationName);
      try {
        const result = await fn(...args);
        endTimer();
        return result;
      } catch (error) {
        endTimer();
        this.error(
          `Operation failed: ${operationName}`,
          error as Error,
          "Performance",
        );
        throw error;
      }
    }) as T;
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export context-specific loggers
export const createLogger = (context: string, _logLevel?: LogLevel): Logger => {
  return Logger.getInstance().child(context);
};

// Export log level mapping from string
export const getLogLevelFromString = (level: string): LogLevel => {
  switch (level.toLowerCase()) {
    case "error":
      return LogLevel.ERROR;
    case "warn":
    case "warning":
      return LogLevel.WARN;
    case "info":
      return LogLevel.INFO;
    case "debug":
      return LogLevel.DEBUG;
    default:
      return LogLevel.INFO;
  }
};
