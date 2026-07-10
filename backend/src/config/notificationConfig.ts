/**
 * NOTIFICATION SYSTEM CONFIGURATION - Phase 2 Enhancement
 *
 * ⚠️  CORE CONFIGURATION - DO NOT DELETE ⚠️
 *
 * Centralized configuration for all notification system components.
 * Supports environment-specific settings.
 *
 * PURPOSE: Single source of truth for notification system settings
 * SCOPE: Timeouts, retries, features, monitoring configuration
 * FEATURES: Environment-based config and type safety
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
