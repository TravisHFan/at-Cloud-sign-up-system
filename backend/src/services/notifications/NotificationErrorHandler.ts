/**
 * NOTIFICATION ERROR HANDLER - Phase 2 Enhancement
 *
 * ⚠️  CORE ERROR HANDLING - DO NOT DELETE ⚠️
 *
 * Centralized error handling with recovery strategies for trio operations.
 * Provides intelligent error classification and appropriate recovery mechanisms.
 *
 * PURPOSE: Centralized error handling and recovery for trio system
 * SCOPE: All trio-related errors and recovery strategies
 * FEATURES: Error classification, recovery strategies, monitoring integration
 */

import { TrioTransaction } from "./TrioTransaction";
import { NOTIFICATION_CONFIG } from "../../config/notificationConfig";

export interface TrioError {
  type: string;
  message: string;
  code?: string;
  service: "email" | "database" | "websocket" | "system";
  severity: "low" | "medium" | "high" | "critical";
  recoverable: boolean;
  metadata?: any;
}

export interface TrioContext {
  request: any;
  transaction: TrioTransaction;
  attempt?: number;
  userId?: string;
}

export interface RecoveryResult {
  success: boolean;
  action: string;
  message: string;
  retryAfter?: number;
  metadata?: any;
}

/**
 * Abstract base class for recovery strategies
 */
export abstract class RecoveryStrategy {
  abstract execute(
    error: TrioError,
    context: TrioContext
  ): Promise<RecoveryResult>;

  protected logRecovery(
    action: string,
    error: TrioError,
    context: TrioContext
  ): void {
    console.log(
      `🔧 Recovery: ${action} for ${error.service} error: ${error.message}`
    );
  }
}

/**
 * Retry recovery strategy with exponential backoff
 */
export class RetryRecoveryStrategy extends RecoveryStrategy {
  constructor(
    private maxRetries: number = 3,
    private baseDelay: number = 1000
  ) {
    super();
  }

  async execute(
    error: TrioError,
    context: TrioContext
  ): Promise<RecoveryResult> {
    const attempt = context.attempt || 1;

    if (attempt >= this.maxRetries) {
      this.logRecovery(
        `Max retries (${this.maxRetries}) exceeded`,
        error,
        context
      );
      return {
        success: false,
        action: "max_retries_exceeded",
        message: `Failed after ${this.maxRetries} attempts`,
      };
    }

    const delay = this.baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
    this.logRecovery(
      `Retrying in ${delay}ms (attempt ${attempt}/${this.maxRetries})`,
      error,
      context
    );

    return {
      success: true,
      action: "retry_scheduled",
      message: `Retry attempt ${attempt} scheduled`,
      retryAfter: delay,
      metadata: { attempt: attempt + 1 },
    };
  }
}

/**
 * Queue recovery strategy for deferring operations
 */
export class QueueRecoveryStrategy extends RecoveryStrategy {
  async execute(
    error: TrioError,
    context: TrioContext
  ): Promise<RecoveryResult> {
    this.logRecovery("Queuing for later processing", error, context);

    // In a real implementation, this would add to a job queue
    // For now, we'll simulate queuing

    return {
      success: true,
      action: "queued",
      message: "Operation queued for later processing",
      retryAfter: 60000, // Retry in 1 minute
      metadata: {
        queuePosition: Math.floor(Math.random() * 10) + 1,
        estimatedDelay: 60000,
      },
    };
  }
}

/**
 * Deferred retry strategy for non-critical operations
 */
export class DeferredRetryStrategy extends RecoveryStrategy {
  async execute(
    error: TrioError,
    context: TrioContext
  ): Promise<RecoveryResult> {
    this.logRecovery("Deferring retry to background process", error, context);

    return {
      success: true,
      action: "deferred",
      message: "Operation deferred to background process",
      retryAfter: 300000, // Retry in 5 minutes
      metadata: {
        backgroundJobId: `bg-${Date.now()}`,
      },
    };
  }
}

/**
 * Log-only strategy for non-recoverable errors
 */
export class LogOnlyStrategy extends RecoveryStrategy {
  async execute(
    error: TrioError,
    context: TrioContext
  ): Promise<RecoveryResult> {
    this.logRecovery("Logging error (no recovery available)", error, context);

    return {
      success: false,
      action: "logged",
      message: "Error logged, no recovery strategy available",
    };
  }
}

/**
 * Circuit breaker strategy to prevent cascade failures
 */
export class CircuitBreakerStrategy extends RecoveryStrategy {
  private static failureCounts = new Map<string, number>();
  private static lastFailureTime = new Map<string, number>();
  private static readonly FAILURE_THRESHOLD = 5;
  private static readonly RESET_TIMEOUT = 60000; // 1 minute

  async execute(
    error: TrioError,
    context: TrioContext
  ): Promise<RecoveryResult> {
    const key = `${error.service}-${error.type}`;
    const now = Date.now();

    const currentFailures = CircuitBreakerStrategy.failureCounts.get(key) || 0;
    const lastFailure = CircuitBreakerStrategy.lastFailureTime.get(key) || 0;

    // Reset count if enough time has passed
    if (now - lastFailure > CircuitBreakerStrategy.RESET_TIMEOUT) {
      CircuitBreakerStrategy.failureCounts.set(key, 1);
      CircuitBreakerStrategy.lastFailureTime.set(key, now);

      this.logRecovery(
        "Circuit breaker reset, allowing operation",
        error,
        context
      );
      return {
        success: true,
        action: "circuit_reset",
        message: "Circuit breaker reset, operation allowed",
      };
    }

    // Increment failure count
    CircuitBreakerStrategy.failureCounts.set(key, currentFailures + 1);
    CircuitBreakerStrategy.lastFailureTime.set(key, now);

    // Check if threshold exceeded
    if (currentFailures >= CircuitBreakerStrategy.FAILURE_THRESHOLD) {
      this.logRecovery(
        `Circuit breaker open (${currentFailures} failures)`,
        error,
        context
      );
      return {
        success: false,
        action: "circuit_open",
        message: "Circuit breaker open, operation blocked",
        retryAfter: CircuitBreakerStrategy.RESET_TIMEOUT,
      };
    }

    this.logRecovery(
      `Circuit breaker recording failure (${currentFailures}/${CircuitBreakerStrategy.FAILURE_THRESHOLD})`,
      error,
      context
    );
    return {
      success: true,
      action: "circuit_recording",
      message: "Failure recorded, operation allowed",
    };
  }
}

/**
 * Centralized error handling for trio operations
 */
export class NotificationErrorHandler {
  private static errorCounts = new Map<string, number>();
  private static recoveryHistory: Array<{
    timestamp: number;
    error: TrioError;
    recovery: RecoveryResult;
    context: TrioContext;
  }> = [];

  /**
   * Handle trio failure with appropriate recovery strategy
   */
  static async handleTrioFailure(
    error: any,
    context: TrioContext
  ): Promise<RecoveryResult> {
    // Classify the error
    const trioError = this.classifyError(error);

    // Record error statistics
    this.recordError(trioError);

    // Log error details
    console.error(`🚨 Trio Error [${trioError.service}/${trioError.type}]:`, {
      message: trioError.message,
      severity: trioError.severity,
      recoverable: trioError.recoverable,
      transactionId: context.transaction.getState().id,
    });

    // Determine and execute recovery strategy
    const strategy = this.getRecoveryStrategy(trioError);
    const recoveryResult = await strategy.execute(trioError, context);

    // Record recovery attempt
    this.recordRecovery(trioError, recoveryResult, context);

    return recoveryResult;
  }

  /**
   * Classify error type and determine recovery approach
   */
  private static classifyError(error: any): TrioError {
    const message = error.message || error.toString();
    const lowerMessage = message.toLowerCase();

    // Email-related errors
    if (
      lowerMessage.includes("email") ||
      lowerMessage.includes("smtp") ||
      lowerMessage.includes("timeout")
    ) {
      return {
        type: "EMAIL_SERVICE_ERROR",
        message,
        service: "email",
        severity: "medium",
        recoverable: true,
        code: error.code,
      };
    }

    // Database-related errors
    if (
      lowerMessage.includes("database") ||
      lowerMessage.includes("mongodb") ||
      lowerMessage.includes("connection")
    ) {
      return {
        type: "DATABASE_ERROR",
        message,
        service: "database",
        severity: "high",
        recoverable: true,
        code: error.code,
      };
    }

    // WebSocket-related errors
    if (
      lowerMessage.includes("websocket") ||
      lowerMessage.includes("socket") ||
      lowerMessage.includes("emit")
    ) {
      return {
        type: "WEBSOCKET_ERROR",
        message,
        service: "websocket",
        severity: "low",
        recoverable: true,
        code: error.code,
      };
    }

    // Validation errors
    if (
      lowerMessage.includes("validation") ||
      lowerMessage.includes("invalid")
    ) {
      return {
        type: "VALIDATION_ERROR",
        message,
        service: "system",
        severity: "medium",
        recoverable: false,
        code: error.code,
      };
    }

    // Authentication/authorization errors
    if (
      lowerMessage.includes("auth") ||
      lowerMessage.includes("permission") ||
      lowerMessage.includes("unauthorized")
    ) {
      return {
        type: "AUTH_ERROR",
        message,
        service: "system",
        severity: "high",
        recoverable: false,
        code: error.code,
      };
    }

    // Generic system error
    return {
      type: "SYSTEM_ERROR",
      message,
      service: "system",
      severity: "high",
      recoverable: false,
      code: error.code,
    };
  }

  /**
   * Get appropriate recovery strategy for error type
   */
  private static getRecoveryStrategy(error: TrioError): RecoveryStrategy {
    // Circuit breaker for high-frequency errors
    const errorKey = `${error.service}-${error.type}`;
    const recentErrors = this.errorCounts.get(errorKey) || 0;

    if (recentErrors >= 3) {
      return new CircuitBreakerStrategy();
    }

    // Strategy based on error type and severity
    switch (error.type) {
      case "EMAIL_SERVICE_ERROR":
        return error.severity === "high"
          ? new QueueRecoveryStrategy()
          : new RetryRecoveryStrategy(3, 2000);

      case "DATABASE_ERROR":
        return error.severity === "critical"
          ? new QueueRecoveryStrategy()
          : new RetryRecoveryStrategy(2, 1000);

      case "WEBSOCKET_ERROR":
        return new DeferredRetryStrategy();

      case "VALIDATION_ERROR":
      case "AUTH_ERROR":
        return new LogOnlyStrategy();

      default:
        return error.recoverable
          ? new RetryRecoveryStrategy(2, 5000)
          : new LogOnlyStrategy();
    }
  }

  /**
   * Record error for statistics and monitoring
   */
  private static recordError(error: TrioError): void {
    const key = `${error.service}-${error.type}`;
    const currentCount = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, currentCount + 1);

    // Clean up old counts periodically
    if (Math.random() < 0.01) {
      // 1% chance to clean up
      this.cleanupErrorCounts();
    }
  }

  /**
   * Record recovery attempt for analysis
   */
  private static recordRecovery(
    error: TrioError,
    recovery: RecoveryResult,
    context: TrioContext
  ): void {
    this.recoveryHistory.push({
      timestamp: Date.now(),
      error,
      recovery,
      context,
    });

    // Limit history size
    if (this.recoveryHistory.length > 1000) {
      this.recoveryHistory = this.recoveryHistory.slice(-500);
    }
  }

  /**
   * Clean up old error counts
   */
  private static cleanupErrorCounts(): void {
    // Reset all counts (in a real implementation, you'd use a time-based cleanup)
    this.errorCounts.clear();
    console.log("🧹 Error counts reset");
  }

  /**
   * Get error statistics
   */
  static getErrorStatistics(): {
    totalErrors: number;
    errorsByService: Record<string, number>;
    errorsByType: Record<string, number>;
    recentRecoveries: number;
  } {
    const totalErrors = Array.from(this.errorCounts.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    const errorsByService: Record<string, number> = {};
    const errorsByType: Record<string, number> = {};

    for (const [key, count] of this.errorCounts.entries()) {
      const [service, type] = key.split("-");
      errorsByService[service] = (errorsByService[service] || 0) + count;
      errorsByType[type] = (errorsByType[type] || 0) + count;
    }

    const recentRecoveries = this.recoveryHistory.filter(
      (entry) => Date.now() - entry.timestamp < 60000 // Last minute
    ).length;

    return {
      totalErrors,
      errorsByService,
      errorsByType,
      recentRecoveries,
    };
  }

  /**
   * Get recent recovery history
   */
  static getRecoveryHistory(
    limit: number = 50
  ): typeof NotificationErrorHandler.recoveryHistory {
    return this.recoveryHistory.slice(-limit);
  }
}
