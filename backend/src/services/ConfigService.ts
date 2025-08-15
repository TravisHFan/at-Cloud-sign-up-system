/**
 * Configuration Service
 * Centralizes all application configuration
 * Follows Single Responsibility Principle
 */

export interface DatabaseConfig {
  uri: string;
  name: string;
  options: {
    connectTimeoutMS: number;
    socketTimeoutMS: number;
    bufferMaxEntries: number;
  };
}

export interface JWTConfig {
  secret: string;
  expiresIn: string;
  refreshExpiresIn: string;
}

export interface EmailConfig {
  service: string;
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  apiVersion: string;
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
  };
  upload: {
    maxFileSize: number;
    allowedTypes: string[];
    destination: string;
  };
}

export class ConfigService {
  private static instance: ConfigService;

  private constructor() {}

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * Get database configuration
   */
  getDatabaseConfig(): DatabaseConfig {
    return {
      uri: process.env.MONGODB_URI || "mongodb://localhost:27017",
      name: process.env.DB_NAME || "atcloud-signup",
      options: {
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        bufferMaxEntries: 0,
      },
    };
  }

  /**
   * Get JWT configuration
   */
  getJWTConfig(): JWTConfig {
    return {
      secret:
        process.env.JWT_SECRET ||
        "your-super-secret-jwt-key-change-in-production",
      expiresIn: process.env.JWT_EXPIRES_IN || "24h",
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    };
  }

  /**
   * Get email configuration
   */
  getEmailConfig(): EmailConfig {
    return {
      service: process.env.EMAIL_SERVICE || "gmail",
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: parseInt(process.env.EMAIL_PORT || "587"),
      secure: process.env.EMAIL_SECURE === "true",
      auth: {
        user: process.env.EMAIL_USER || "",
        pass: process.env.EMAIL_PASS || "",
      },
      from: process.env.EMAIL_FROM || "noreply@atcloud.com",
    };
  }

  /**
   * Get application configuration
   */
  getAppConfig(): AppConfig {
    return {
      port: parseInt(process.env.PORT || "5001"),
      nodeEnv: process.env.NODE_ENV || "development",
      corsOrigins: process.env.CORS_ORIGINS?.split(",") || [
        "http://localhost:5173",
      ],
      apiVersion: process.env.API_VERSION || "",
      rateLimiting: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"),
      },
      upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "5242880"), // 5MB
        allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(",") || [
          "image/jpeg",
          "image/png",
          "image/gif",
          "application/pdf",
        ],
        destination: process.env.UPLOAD_DESTINATION || 
          (process.env.NODE_ENV === 'production' ? '/uploads/' : 'uploads/'),
      },
    };
  }

  /**
   * Get environment
   */
  getEnvironment(): string {
    return process.env.NODE_ENV || "development";
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.getEnvironment() === "production";
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.getEnvironment() === "development";
  }

  /**
   * Check if running in test environment
   */
  isTest(): boolean {
    return this.getEnvironment() === "test";
  }

  /**
   * Get log level based on environment
   */
  getLogLevel(): string {
    switch (this.getEnvironment()) {
      case "production":
        return "warn";
      case "test":
        return "error";
      default:
        return "debug";
    }
  }

  /**
   * Get all configuration
   */
  getAllConfig() {
    return {
      app: this.getAppConfig(),
      database: this.getDatabaseConfig(),
      jwt: this.getJWTConfig(),
      email: this.getEmailConfig(),
      environment: this.getEnvironment(),
      logLevel: this.getLogLevel(),
    };
  }

  /**
   * Validate required environment variables
   */
  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required environment variables
    const requiredVars = ["MONGODB_URI", "JWT_SECRET"];

    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        errors.push(`Missing required environment variable: ${varName}`);
      }
    }

    // Validate JWT secret strength in production
    if (this.isProduction()) {
      const jwtSecret = process.env.JWT_SECRET;
      if (jwtSecret && jwtSecret.length < 32) {
        errors.push("JWT_SECRET must be at least 32 characters in production");
      }
    }

    // Validate database URI format
    const dbUri = process.env.MONGODB_URI;
    if (dbUri && !dbUri.startsWith("mongodb")) {
      errors.push("MONGODB_URI must be a valid MongoDB connection string");
    }

    // Validate port
    const port = parseInt(process.env.PORT || "5001");
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push("PORT must be a valid port number (1-65535)");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get configuration for specific service
   */
  getServiceConfig(serviceName: string): any {
    switch (serviceName.toLowerCase()) {
      case "database":
      case "db":
        return this.getDatabaseConfig();
      case "jwt":
      case "auth":
        return this.getJWTConfig();
      case "email":
      case "mail":
        return this.getEmailConfig();
      case "app":
      case "application":
        return this.getAppConfig();
      default:
        throw new Error(`Unknown service: ${serviceName}`);
    }
  }

  /**
   * Update configuration at runtime (for testing purposes)
   */
  updateConfig(service: string, config: any): void {
    if (this.isProduction()) {
      throw new Error("Configuration cannot be updated in production");
    }

    // This would update the configuration in memory
    // Implementation depends on how you want to handle runtime config updates
    console.warn(
      `Runtime configuration update for ${service} is not implemented`
    );
  }

  /**
   * Get feature flags
   */
  getFeatureFlags(): Record<string, boolean> {
    return {
      enableEmailVerification: process.env.ENABLE_EMAIL_VERIFICATION === "true",
      enableNotifications: process.env.ENABLE_NOTIFICATIONS !== "false", // enabled by default
      enableFileUploads: process.env.ENABLE_FILE_UPLOADS !== "false", // enabled by default
      enableAnalytics: process.env.ENABLE_ANALYTICS === "true",
      enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== "false", // enabled by default
      enableCors: process.env.ENABLE_CORS !== "false", // enabled by default
      enableSwagger:
        process.env.ENABLE_SWAGGER === "true" || this.isDevelopment(),
      enableDebugLogging:
        process.env.ENABLE_DEBUG_LOGGING === "true" || this.isDevelopment(),
    };
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(featureName: string): boolean {
    const flags = this.getFeatureFlags();
    return flags[featureName] || false;
  }
}
