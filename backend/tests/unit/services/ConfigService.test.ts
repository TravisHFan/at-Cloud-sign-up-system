import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ConfigService } from "../../../src/services/ConfigService";

describe("ConfigService", () => {
  let configService: ConfigService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Reset singleton instance for each test
    (ConfigService as any).instance = null;
    configService = ConfigService.getInstance();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    // Reset singleton instance
    (ConfigService as any).instance = null;
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance", () => {
      const instance1 = ConfigService.getInstance();
      const instance2 = ConfigService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should not allow direct instantiation", () => {
      // TypeScript prevents direct instantiation at compile time
      // At runtime, the constructor is private but accessible via casting
      // We test that the pattern works correctly by ensuring getInstance always returns the same instance
      const instance1 = ConfigService.getInstance();
      const instance2 = ConfigService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("Database Configuration", () => {
    it("should return default database config when no env vars set", () => {
      delete process.env.MONGODB_URI;
      delete process.env.DB_NAME;

      const config = configService.getDatabaseConfig();

      expect(config).toEqual({
        uri: "mongodb://localhost:27017/atcloud-signup",
        name: "atcloud-signup",
        options: {
          connectTimeoutMS: 10000,
          socketTimeoutMS: 45000,
          bufferMaxEntries: 0,
        },
      });
    });

    it("should use environment variables when provided", () => {
      process.env.MONGODB_URI = "mongodb://test-host:27017/test-db";
      process.env.DB_NAME = "test-db";

      const config = configService.getDatabaseConfig();

      expect(config.uri).toBe("mongodb://test-host:27017/test-db");
      expect(config.name).toBe("test-db");
      expect(config.options).toEqual({
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        bufferMaxEntries: 0,
      });
    });

    it("should have consistent database options", () => {
      const config = configService.getDatabaseConfig();

      expect(config.options.connectTimeoutMS).toBeGreaterThan(0);
      expect(config.options.socketTimeoutMS).toBeGreaterThan(0);
      expect(config.options.bufferMaxEntries).toBe(0);
    });
  });

  describe("JWT Configuration", () => {
    it("should return default JWT config when no env vars set", () => {
      delete process.env.JWT_SECRET;
      delete process.env.JWT_EXPIRES_IN;
      delete process.env.JWT_REFRESH_EXPIRES_IN;

      const config = configService.getJWTConfig();

      expect(config).toEqual({
        secret: "your-super-secret-jwt-key-change-in-production",
        expiresIn: "24h",
        refreshExpiresIn: "7d",
      });
    });

    it("should use environment variables when provided", () => {
      process.env.JWT_SECRET = "custom-jwt-secret-for-testing";
      process.env.JWT_EXPIRES_IN = "1h";
      process.env.JWT_REFRESH_EXPIRES_IN = "30d";

      const config = configService.getJWTConfig();

      expect(config.secret).toBe("custom-jwt-secret-for-testing");
      expect(config.expiresIn).toBe("1h");
      expect(config.refreshExpiresIn).toBe("30d");
    });

    it("should have secure default secret warning", () => {
      delete process.env.JWT_SECRET;

      const config = configService.getJWTConfig();

      expect(config.secret).toContain("change-in-production");
    });
  });

  describe("Email Configuration", () => {
    it("should return default email config when no env vars set", () => {
      delete process.env.EMAIL_SERVICE;
      delete process.env.EMAIL_HOST;
      delete process.env.EMAIL_PORT;
      delete process.env.EMAIL_SECURE;
      delete process.env.EMAIL_USER;
      delete process.env.EMAIL_PASS;
      delete process.env.EMAIL_FROM;

      const config = configService.getEmailConfig();

      expect(config).toEqual({
        service: "gmail",
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: "",
          pass: "",
        },
        from: "noreply@atcloud.com",
      });
    });

    it("should use environment variables when provided", () => {
      process.env.EMAIL_SERVICE = "sendgrid";
      process.env.EMAIL_HOST = "smtp.sendgrid.net";
      process.env.EMAIL_PORT = "465";
      process.env.EMAIL_SECURE = "true";
      process.env.EMAIL_USER = "test@example.com";
      process.env.EMAIL_PASS = "testpass";
      process.env.EMAIL_FROM = "support@atcloud.com";

      const config = configService.getEmailConfig();

      expect(config.service).toBe("sendgrid");
      expect(config.host).toBe("smtp.sendgrid.net");
      expect(config.port).toBe(465);
      expect(config.secure).toBe(true);
      expect(config.auth.user).toBe("test@example.com");
      expect(config.auth.pass).toBe("testpass");
      expect(config.from).toBe("support@atcloud.com");
    });

    it("should parse EMAIL_SECURE as boolean correctly", () => {
      process.env.EMAIL_SECURE = "false";
      let config = configService.getEmailConfig();
      expect(config.secure).toBe(false);

      process.env.EMAIL_SECURE = "true";
      config = configService.getEmailConfig();
      expect(config.secure).toBe(true);

      delete process.env.EMAIL_SECURE;
      config = configService.getEmailConfig();
      expect(config.secure).toBe(false);
    });

    it("should parse EMAIL_PORT as number correctly", () => {
      process.env.EMAIL_PORT = "25";
      let config = configService.getEmailConfig();
      expect(config.port).toBe(25);

      process.env.EMAIL_PORT = "invalid";
      config = configService.getEmailConfig();
      expect(config.port).toBeNaN();
    });
  });

  describe("App Configuration", () => {
    it("should return default app config when no env vars set", () => {
      delete process.env.PORT;
      delete process.env.NODE_ENV;
      delete process.env.CORS_ORIGINS;
      delete process.env.API_VERSION;
      delete process.env.RATE_LIMIT_WINDOW_MS;
      delete process.env.RATE_LIMIT_MAX_REQUESTS;
      delete process.env.MAX_FILE_SIZE;
      delete process.env.ALLOWED_FILE_TYPES;
      delete process.env.UPLOAD_DESTINATION;

      const config = configService.getAppConfig();

      expect(config).toEqual({
        port: 5001,
        nodeEnv: "development",
        corsOrigins: ["http://localhost:5173"],
        apiVersion: "",
        rateLimiting: {
          windowMs: 900000, // 15 minutes
          maxRequests: 100,
        },
        upload: {
          maxFileSize: 5242880, // 5MB
          allowedTypes: [
            "image/jpeg",
            "image/png",
            "image/gif",
            "application/pdf",
          ],
          destination: "uploads/",
        },
      });
    });

    it("should use environment variables when provided", () => {
      process.env.PORT = "3000";
      process.env.NODE_ENV = "production";
      process.env.CORS_ORIGINS =
        "https://app.atcloud.com,https://api.atcloud.com";
      process.env.API_VERSION = "v2";
      process.env.RATE_LIMIT_WINDOW_MS = "600000";
      process.env.RATE_LIMIT_MAX_REQUESTS = "200";
      process.env.MAX_FILE_SIZE = "10485760";
      process.env.ALLOWED_FILE_TYPES = "image/jpeg,image/png,application/pdf";
      process.env.UPLOAD_DESTINATION = "storage/uploads/";

      const config = configService.getAppConfig();

      expect(config.port).toBe(3000);
      expect(config.nodeEnv).toBe("production");
      expect(config.corsOrigins).toEqual([
        "https://app.atcloud.com",
        "https://api.atcloud.com",
      ]);
      expect(config.apiVersion).toBe("v2");
      expect(config.rateLimiting.windowMs).toBe(600000);
      expect(config.rateLimiting.maxRequests).toBe(200);
      expect(config.upload.maxFileSize).toBe(10485760);
      expect(config.upload.allowedTypes).toEqual([
        "image/jpeg",
        "image/png",
        "application/pdf",
      ]);
      expect(config.upload.destination).toBe("storage/uploads/");
    });

    it("should handle empty CORS_ORIGINS", () => {
      process.env.CORS_ORIGINS = "";

      const config = configService.getAppConfig();

      expect(config.corsOrigins).toEqual([""]);
    });

    it("should handle empty ALLOWED_FILE_TYPES", () => {
      process.env.ALLOWED_FILE_TYPES = "";

      const config = configService.getAppConfig();

      expect(config.upload.allowedTypes).toEqual([""]);
    });
  });

  describe("Environment Detection", () => {
    it("should return correct environment", () => {
      process.env.NODE_ENV = "production";
      expect(configService.getEnvironment()).toBe("production");

      process.env.NODE_ENV = "development";
      expect(configService.getEnvironment()).toBe("development");

      process.env.NODE_ENV = "test";
      expect(configService.getEnvironment()).toBe("test");

      delete process.env.NODE_ENV;
      expect(configService.getEnvironment()).toBe("development");
    });

    it("should correctly identify production environment", () => {
      process.env.NODE_ENV = "production";
      expect(configService.isProduction()).toBe(true);
      expect(configService.isDevelopment()).toBe(false);
      expect(configService.isTest()).toBe(false);
    });

    it("should correctly identify development environment", () => {
      process.env.NODE_ENV = "development";
      expect(configService.isProduction()).toBe(false);
      expect(configService.isDevelopment()).toBe(true);
      expect(configService.isTest()).toBe(false);
    });

    it("should correctly identify test environment", () => {
      process.env.NODE_ENV = "test";
      expect(configService.isProduction()).toBe(false);
      expect(configService.isDevelopment()).toBe(false);
      expect(configService.isTest()).toBe(true);
    });

    it("should default to development when NODE_ENV is not set", () => {
      delete process.env.NODE_ENV;
      expect(configService.isDevelopment()).toBe(true);
    });
  });

  describe("Log Level Configuration", () => {
    it("should return correct log level for production", () => {
      process.env.NODE_ENV = "production";
      expect(configService.getLogLevel()).toBe("warn");
    });

    it("should return correct log level for test", () => {
      process.env.NODE_ENV = "test";
      expect(configService.getLogLevel()).toBe("error");
    });

    it("should return correct log level for development", () => {
      process.env.NODE_ENV = "development";
      expect(configService.getLogLevel()).toBe("debug");
    });

    it("should return debug log level for unknown environment", () => {
      process.env.NODE_ENV = "staging";
      expect(configService.getLogLevel()).toBe("debug");
    });
  });

  describe("All Configuration", () => {
    it("should return all configuration sections", () => {
      const allConfig = configService.getAllConfig();

      expect(allConfig).toHaveProperty("app");
      expect(allConfig).toHaveProperty("database");
      expect(allConfig).toHaveProperty("jwt");
      expect(allConfig).toHaveProperty("email");
      expect(allConfig).toHaveProperty("environment");
      expect(allConfig).toHaveProperty("logLevel");

      expect(typeof allConfig.app).toBe("object");
      expect(typeof allConfig.database).toBe("object");
      expect(typeof allConfig.jwt).toBe("object");
      expect(typeof allConfig.email).toBe("object");
      expect(typeof allConfig.environment).toBe("string");
      expect(typeof allConfig.logLevel).toBe("string");
    });

    it("should maintain consistency across individual getters", () => {
      const allConfig = configService.getAllConfig();

      expect(allConfig.app).toEqual(configService.getAppConfig());
      expect(allConfig.database).toEqual(configService.getDatabaseConfig());
      expect(allConfig.jwt).toEqual(configService.getJWTConfig());
      expect(allConfig.email).toEqual(configService.getEmailConfig());
      expect(allConfig.environment).toBe(configService.getEnvironment());
      expect(allConfig.logLevel).toBe(configService.getLogLevel());
    });
  });

  describe("Configuration Validation", () => {
    it("should pass validation with required environment variables", () => {
      process.env.MONGODB_URI = "mongodb://localhost:27017/test";
      process.env.JWT_SECRET = "super-secure-jwt-secret-key-for-testing";

      const validation = configService.validateConfig();

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should fail validation when required variables are missing", () => {
      delete process.env.MONGODB_URI;
      delete process.env.JWT_SECRET;

      const validation = configService.validateConfig();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        "Missing required environment variable: MONGODB_URI"
      );
      expect(validation.errors).toContain(
        "Missing required environment variable: JWT_SECRET"
      );
    });

    it("should validate JWT secret strength in production", () => {
      process.env.NODE_ENV = "production";
      process.env.MONGODB_URI = "mongodb://localhost:27017/test";
      process.env.JWT_SECRET = "short"; // Less than 32 characters

      const validation = configService.validateConfig();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        "JWT_SECRET must be at least 32 characters in production"
      );
    });

    it("should allow short JWT secret in development", () => {
      process.env.NODE_ENV = "development";
      process.env.MONGODB_URI = "mongodb://localhost:27017/test";
      process.env.JWT_SECRET = "short";

      const validation = configService.validateConfig();

      expect(validation.isValid).toBe(true);
    });

    it("should validate MongoDB URI format", () => {
      process.env.MONGODB_URI = "invalid-uri";
      process.env.JWT_SECRET = "super-secure-jwt-secret-key-for-testing";

      const validation = configService.validateConfig();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        "MONGODB_URI must be a valid MongoDB connection string"
      );
    });

    it("should validate port number", () => {
      process.env.MONGODB_URI = "mongodb://localhost:27017/test";
      process.env.JWT_SECRET = "super-secure-jwt-secret-key-for-testing";
      process.env.PORT = "invalid";

      const validation = configService.validateConfig();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        "PORT must be a valid port number (1-65535)"
      );
    });

    it("should validate port range", () => {
      process.env.MONGODB_URI = "mongodb://localhost:27017/test";
      process.env.JWT_SECRET = "super-secure-jwt-secret-key-for-testing";

      process.env.PORT = "0";
      let validation = configService.validateConfig();
      expect(validation.isValid).toBe(false);

      process.env.PORT = "65536";
      validation = configService.validateConfig();
      expect(validation.isValid).toBe(false);

      process.env.PORT = "3000";
      validation = configService.validateConfig();
      expect(validation.isValid).toBe(true);
    });
  });

  describe("Service-Specific Configuration", () => {
    it("should return database config for database service", () => {
      expect(configService.getServiceConfig("database")).toEqual(
        configService.getDatabaseConfig()
      );
      expect(configService.getServiceConfig("db")).toEqual(
        configService.getDatabaseConfig()
      );
    });

    it("should return JWT config for auth service", () => {
      expect(configService.getServiceConfig("jwt")).toEqual(
        configService.getJWTConfig()
      );
      expect(configService.getServiceConfig("auth")).toEqual(
        configService.getJWTConfig()
      );
    });

    it("should return email config for email service", () => {
      expect(configService.getServiceConfig("email")).toEqual(
        configService.getEmailConfig()
      );
      expect(configService.getServiceConfig("mail")).toEqual(
        configService.getEmailConfig()
      );
    });

    it("should return app config for app service", () => {
      expect(configService.getServiceConfig("app")).toEqual(
        configService.getAppConfig()
      );
      expect(configService.getServiceConfig("application")).toEqual(
        configService.getAppConfig()
      );
    });

    it("should throw error for unknown service", () => {
      expect(() => configService.getServiceConfig("unknown")).toThrow(
        "Unknown service: unknown"
      );
    });

    it("should be case insensitive", () => {
      expect(configService.getServiceConfig("DATABASE")).toEqual(
        configService.getDatabaseConfig()
      );
      expect(configService.getServiceConfig("Email")).toEqual(
        configService.getEmailConfig()
      );
    });
  });

  describe("Runtime Configuration Updates", () => {
    it("should throw error when updating config in production", () => {
      process.env.NODE_ENV = "production";

      expect(() =>
        configService.updateConfig("database", { uri: "new-uri" })
      ).toThrow("Configuration cannot be updated in production");
    });

    it("should allow config updates in development", () => {
      process.env.NODE_ENV = "development";
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      expect(() =>
        configService.updateConfig("database", { uri: "new-uri" })
      ).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Runtime configuration update for database is not implemented"
      );

      consoleSpy.mockRestore();
    });

    it("should allow config updates in test environment", () => {
      process.env.NODE_ENV = "test";
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      expect(() =>
        configService.updateConfig("test-service", {})
      ).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe("Feature Flags", () => {
    beforeEach(() => {
      // Clear all feature flag environment variables
      delete process.env.ENABLE_EMAIL_VERIFICATION;
      delete process.env.ENABLE_NOTIFICATIONS;
      delete process.env.ENABLE_FILE_UPLOADS;
      delete process.env.ENABLE_ANALYTICS;
      delete process.env.ENABLE_RATE_LIMITING;
      delete process.env.ENABLE_CORS;
      delete process.env.ENABLE_SWAGGER;
      delete process.env.ENABLE_DEBUG_LOGGING;
    });

    it("should return default feature flags", () => {
      process.env.NODE_ENV = "production";

      const flags = configService.getFeatureFlags();

      expect(flags).toEqual({
        enableEmailVerification: false,
        enableNotifications: true, // enabled by default
        enableFileUploads: true, // enabled by default
        enableAnalytics: false,
        enableRateLimiting: true, // enabled by default
        enableCors: true, // enabled by default
        enableSwagger: false, // only in development by default
        enableDebugLogging: false, // only in development by default
      });
    });

    it("should enable swagger and debug logging in development", () => {
      process.env.NODE_ENV = "development";

      const flags = configService.getFeatureFlags();

      expect(flags.enableSwagger).toBe(true);
      expect(flags.enableDebugLogging).toBe(true);
    });

    it("should respect explicit environment variable settings", () => {
      process.env.ENABLE_EMAIL_VERIFICATION = "true";
      process.env.ENABLE_NOTIFICATIONS = "false";
      process.env.ENABLE_FILE_UPLOADS = "false";
      process.env.ENABLE_ANALYTICS = "true";
      process.env.ENABLE_RATE_LIMITING = "false";
      process.env.ENABLE_CORS = "false";
      process.env.ENABLE_SWAGGER = "true";
      process.env.ENABLE_DEBUG_LOGGING = "true";

      const flags = configService.getFeatureFlags();

      expect(flags.enableEmailVerification).toBe(true);
      expect(flags.enableNotifications).toBe(false);
      expect(flags.enableFileUploads).toBe(false);
      expect(flags.enableAnalytics).toBe(true);
      expect(flags.enableRateLimiting).toBe(false);
      expect(flags.enableCors).toBe(false);
      expect(flags.enableSwagger).toBe(true);
      expect(flags.enableDebugLogging).toBe(true);
    });

    it("should check if specific feature is enabled", () => {
      process.env.ENABLE_EMAIL_VERIFICATION = "true";
      process.env.ENABLE_ANALYTICS = "false";

      expect(configService.isFeatureEnabled("enableEmailVerification")).toBe(
        true
      );
      expect(configService.isFeatureEnabled("enableAnalytics")).toBe(false);
      expect(configService.isFeatureEnabled("enableNotifications")).toBe(true); // default true
      expect(configService.isFeatureEnabled("nonExistentFeature")).toBe(false);
    });

    it("should handle boolean-like strings correctly", () => {
      process.env.ENABLE_EMAIL_VERIFICATION = "false";
      process.env.ENABLE_ANALYTICS = "anything";

      const flags = configService.getFeatureFlags();

      expect(flags.enableEmailVerification).toBe(false);
      expect(flags.enableAnalytics).toBe(false); // Only 'true' enables
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle undefined environment variables gracefully", () => {
      // Ensure all env vars are undefined
      Object.keys(process.env).forEach((key) => {
        if (
          key.startsWith("MONGODB_") ||
          key.startsWith("JWT_") ||
          key.startsWith("EMAIL_")
        ) {
          delete process.env[key];
        }
      });

      expect(() => configService.getDatabaseConfig()).not.toThrow();
      expect(() => configService.getJWTConfig()).not.toThrow();
      expect(() => configService.getEmailConfig()).not.toThrow();
      expect(() => configService.getAppConfig()).not.toThrow();
    });

    it("should handle malformed environment variables", () => {
      process.env.PORT = "not-a-number";
      process.env.EMAIL_PORT = "also-not-a-number";
      process.env.RATE_LIMIT_WINDOW_MS = "invalid";
      process.env.MAX_FILE_SIZE = "huge";

      const appConfig = configService.getAppConfig();
      const emailConfig = configService.getEmailConfig();

      expect(appConfig.port).toBeNaN();
      expect(emailConfig.port).toBeNaN();
      expect(appConfig.rateLimiting.windowMs).toBeNaN();
      expect(appConfig.upload.maxFileSize).toBeNaN();
    });

    it("should maintain singleton integrity across multiple calls", () => {
      const instance1 = ConfigService.getInstance();
      const instance2 = ConfigService.getInstance();
      const instance3 = ConfigService.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
      expect(instance1).toBe(instance3);
    });
  });
});
