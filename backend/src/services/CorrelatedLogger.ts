import { Request } from "express";
import { Logger, LogLevel } from "./LoggerService";

/**
 * Enhanced Logger with Correlation Support
 * Extends the base LoggerService to include request correlation tracking
 */

export interface CorrelationMetadata {
  correlationId?: string;
  requestId?: string;
  userId?: string;
  method?: string;
  path?: string;
  ip?: string;
  userAgent?: string;
}

export class CorrelatedLogger {
  private logger: Logger;
  private baseMetadata: CorrelationMetadata;

  constructor(
    context: string = "Application",
    baseMetadata: CorrelationMetadata = {}
  ) {
    this.logger = Logger.getInstance().child(context);
    this.baseMetadata = baseMetadata;
  }

  /**
   * Create a correlated logger from Express request
   */
  static fromRequest(req: Request, context?: string): CorrelatedLogger {
    // Support both real Express Request and lightweight mocks (plain objects)
    type RequestLike = {
      get?: (name: string) => string | undefined;
      headers?: Record<string, unknown>;
      method?: string;
      path?: string;
      originalUrl?: string;
      url?: string;
      ip?: string;
      socket?: { remoteAddress?: string };
      connection?: { remoteAddress?: string };
      correlationId?: string;
      user?: { id?: string; _id?: { toString: () => string } };
    };

    const r = req as unknown as RequestLike;

    // Helper to read headers safely without relying on req.get
    const getHeader = (name: string): string | undefined => {
      const getter = r.get;
      if (typeof getter === "function") {
        try {
          return getter.call(r, name);
        } catch {
          // fall through to direct header access
        }
      }
      const headers = (r.headers ?? {}) as Record<string, unknown>;
      const lower = name.toLowerCase();
      const v = (headers[lower] ??
        (headers as Record<string, unknown>)[name]) as
        | string
        | string[]
        | undefined;
      return Array.isArray(v) ? v[0] : v;
    };

    type MaybeUser =
      | { id?: string; _id?: { toString: () => string } }
      | undefined;
    const u = (r as { user?: MaybeUser }).user;
    const userId = u?.id ?? u?._id?.toString();

    const metadata: CorrelationMetadata = {
      correlationId: r.correlationId ?? getHeader("x-correlation-id"),
      method: r.method,
      path: r.path ?? r.originalUrl ?? r.url,
      ip: r.ip ?? r.socket?.remoteAddress ?? r.connection?.remoteAddress,
      userAgent: getHeader("User-Agent"),
      userId,
    };

    return new CorrelatedLogger(context || "Request", metadata);
  }

  /**
   * Create a child logger with additional context
   */
  child(
    context: string,
    additionalMetadata: Partial<CorrelationMetadata> = {}
  ): CorrelatedLogger {
    return new CorrelatedLogger(context, {
      ...this.baseMetadata,
      ...additionalMetadata,
    });
  }

  /**
   * Merge base metadata with provided metadata
   */
  private mergeMetadata(metadata?: unknown): unknown {
    if (!metadata) return this.baseMetadata;
    if (typeof metadata !== "object")
      return { ...this.baseMetadata, data: metadata };
    return { ...this.baseMetadata, ...metadata };
  }

  /**
   * Log error with correlation context
   */
  error(
    message: string,
    error?: Error,
    context?: string,
    metadata?: unknown
  ): void {
    this.logger.error(message, error, context, this.mergeMetadata(metadata));
  }

  /**
   * Log warning with correlation context
   */
  warn(message: string, context?: string, metadata?: unknown): void {
    this.logger.warn(message, context, this.mergeMetadata(metadata));
  }

  /**
   * Log info with correlation context
   */
  info(message: string, context?: string, metadata?: unknown): void {
    this.logger.info(message, context, this.mergeMetadata(metadata));
  }

  /**
   * Log debug with correlation context
   */
  debug(message: string, context?: string, metadata?: unknown): void {
    this.logger.debug(message, context, this.mergeMetadata(metadata));
  }

  /**
   * Generic log method with correlation context
   */
  log(
    level: LogLevel,
    message: string,
    context?: string,
    metadata?: unknown,
    error?: Error
  ): void {
    this.logger.log(
      level,
      message,
      context,
      this.mergeMetadata(metadata),
      error
    );
  }

  /**
   * Log HTTP request with correlation
   */
  logRequest(
    method: string,
    url: string,
    statusCode: number,
    responseTime: number,
    additionalMetadata?: Record<string, unknown>
  ): void {
    const metadata = this.mergeMetadata({
      statusCode,
      responseTime,
      ...(additionalMetadata || {}),
    });

    const level = statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    this.log(
      level,
      `${method} ${url} - ${statusCode} (${responseTime}ms)`,
      "HTTP",
      metadata
    );
  }

  /**
   * Log authentication events with correlation
   */
  logAuth(
    event: string,
    userId?: string,
    email?: string,
    success: boolean = true,
    additionalMetadata?: Record<string, unknown>
  ): void {
    const metadata = this.mergeMetadata({
      event,
      userId,
      email,
      success,
      ...(additionalMetadata || {}),
    });

    const level = success ? LogLevel.INFO : LogLevel.WARN;
    this.log(
      level,
      `Authentication event: ${event} ${success ? "succeeded" : "failed"}`,
      "Authentication",
      metadata
    );
  }

  /**
   * Log user actions with correlation
   */
  logUserAction(
    action: string,
    userId: string,
    resourceType?: string,
    resourceId?: string,
    details?: unknown
  ): void {
    const metadata = this.mergeMetadata({
      action,
      userId,
      resourceType,
      resourceId,
      details,
    });

    this.info(`User action: ${action}`, "UserAction", metadata);
  }

  /**
   * Log system events with correlation
   */
  logSystemEvent(
    event: string,
    success: boolean = true,
    details?: unknown
  ): void {
    const metadata = this.mergeMetadata({
      event,
      success,
      details,
    });

    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    this.log(
      level,
      `System event: ${event} ${success ? "completed" : "failed"}`,
      "System",
      metadata
    );
  }
}
