/**
 * NOTIFICATION SYSTEM CONFIGURATION - Phase 2 Enhancement
 *
 * ⚠️  CORE CONFIGURATION - DO NOT DELETE ⚠️
 *
 * Centralized configuration for all notification system components.
 * Supports environment-specific settings and runtime configuration updates.
 *
 * PURPOSE: Single source of truth for notification system settings
 * SCOPE: Timeouts, retries, features, monitoring configuration
 * FEATURES: Environment-based config, type safety, validation
 */

/**
 * Centralized configuration for notification system
 * All timing values in milliseconds
 */
export const NOTIFICATION_CONFIG = {
  timeouts: {
    email: parseInt(process.env.EMAIL_TIMEOUT || "15000"), // 15 seconds
    database: parseInt(process.env.DB_TIMEOUT || "5000"), // 5 seconds
    websocket: parseInt(process.env.WS_TIMEOUT || "3000"), // 3 seconds
  },

  retries: {
    email: parseInt(process.env.EMAIL_RETRIES || "3"), // 3 attempts
    database: parseInt(process.env.DB_RETRIES || "2"), // 2 attempts
    websocket: parseInt(process.env.WS_RETRIES || "3"), // 3 attempts
  },

  features: {
    enableRollback: process.env.ENABLE_ROLLBACK !== "false", // Default: enabled
    enableMetrics: process.env.ENABLE_METRICS !== "false", // Default: enabled
    strictMode: process.env.STRICT_MODE === "true", // Default: disabled
    enableQueuing: process.env.ENABLE_QUEUING === "true", // Default: disabled
  },

  monitoring: {
    logLevel: process.env.LOG_LEVEL || "info",
    metricsInterval: parseInt(process.env.METRICS_INTERVAL || "60000"), // 1 minute
    alertThreshold: parseFloat(process.env.ALERT_THRESHOLD || "0.95"), // 95% success rate
    maxMetricsHistory: parseInt(process.env.MAX_METRICS_HISTORY || "1000"), // Keep last 1000 entries
  },

  performance: {
    maxConcurrentTrios: parseInt(process.env.MAX_CONCURRENT_TRIOS || "50"),
    batchSize: parseInt(process.env.BATCH_SIZE || "10"),
    cooldownPeriod: parseInt(process.env.COOLDOWN_PERIOD || "1000"), // 1 second
  },

  security: {
    maxRetriesPerUser: parseInt(process.env.MAX_RETRIES_PER_USER || "5"),
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || "300000"), // 5 minutes
    maxTriosPerWindow: parseInt(process.env.MAX_TRIOS_PER_WINDOW || "20"),
  },
};

/**
 * Validate configuration on startup
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate timeout values
  if (NOTIFICATION_CONFIG.timeouts.email < 1000) {
    errors.push("Email timeout must be at least 1000ms");
  }
  if (NOTIFICATION_CONFIG.timeouts.database < 500) {
    errors.push("Database timeout must be at least 500ms");
  }
  if (NOTIFICATION_CONFIG.timeouts.websocket < 500) {
    errors.push("WebSocket timeout must be at least 500ms");
  }

  // Validate retry values
  if (
    NOTIFICATION_CONFIG.retries.email < 1 ||
    NOTIFICATION_CONFIG.retries.email > 10
  ) {
    errors.push("Email retries must be between 1 and 10");
  }
  if (
    NOTIFICATION_CONFIG.retries.database < 1 ||
    NOTIFICATION_CONFIG.retries.database > 5
  ) {
    errors.push("Database retries must be between 1 and 5");
  }
  if (
    NOTIFICATION_CONFIG.retries.websocket < 1 ||
    NOTIFICATION_CONFIG.retries.websocket > 10
  ) {
    errors.push("WebSocket retries must be between 1 and 10");
  }

  // Validate monitoring values
  if (
    NOTIFICATION_CONFIG.monitoring.alertThreshold < 0 ||
    NOTIFICATION_CONFIG.monitoring.alertThreshold > 1
  ) {
    errors.push("Alert threshold must be between 0 and 1");
  }
  if (NOTIFICATION_CONFIG.monitoring.metricsInterval < 10000) {
    errors.push("Metrics interval must be at least 10 seconds");
  }

  // Validate performance values
  if (NOTIFICATION_CONFIG.performance.maxConcurrentTrios < 1) {
    errors.push("Max concurrent trios must be at least 1");
  }
  if (NOTIFICATION_CONFIG.performance.batchSize < 1) {
    errors.push("Batch size must be at least 1");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Type definitions for configuration
 */
export type NotificationConfigType = typeof NOTIFICATION_CONFIG;

export interface ConfigUpdate {
  path: string;
  value: unknown;
  reason?: string;
}

/**
 * Runtime configuration update capability
 */
export class ConfigManager {
  private static updateHistory: ConfigUpdate[] = [];

  /**
   * Update configuration at runtime
   */
  static updateConfig(path: string, value: unknown, reason?: string): boolean {
    try {
      const pathParts = path.split(".");
      let current: Record<string, unknown> =
        NOTIFICATION_CONFIG as unknown as Record<string, unknown>;

      // Navigate to parent object
      for (let i = 0; i < pathParts.length - 1; i++) {
        if (!(pathParts[i] in current)) {
          throw new Error(`Invalid config path: ${path}`);
        }
        const next = current[pathParts[i]];
        if (typeof next !== "object" || next === null) {
          throw new Error(`Invalid config path: ${path}`);
        }
        current = next as Record<string, unknown>;
      }

      // Update the value
      const lastKey = pathParts[pathParts.length - 1];
      if (!(lastKey in current)) {
        throw new Error(`Invalid config key: ${lastKey}`);
      }

      const oldValue = current[lastKey];
      current[lastKey] = value as never;

      // Validate the update
      const validation = validateConfig();
      if (!validation.valid) {
        // Rollback on validation failure
        current[lastKey] = oldValue;
        throw new Error(
          `Config validation failed: ${validation.errors.join(", ")}`
        );
      }

      // Record the update
      this.updateHistory.push({
        path,
        value,
        reason: reason || "Runtime update",
      });

      console.log(
        `📝 Config updated: ${path} = ${value} (${reason || "Runtime update"})`
      );
      return true;
    } catch (error) {
      console.error(`❌ Config update failed: ${error}`);
      return false;
    }
  }

  /**
   * Get configuration update history
   */
  static getUpdateHistory(): ConfigUpdate[] {
    return [...this.updateHistory];
  }

  /**
   * Reset configuration to defaults
   */
  static resetToDefaults(): void {
    // This would require storing original values,
    // for now just log that reset was requested
    console.log(
      "🔄 Configuration reset requested - restart required for full reset"
    );
  }
}
