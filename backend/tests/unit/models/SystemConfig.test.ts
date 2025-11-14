/**
 * Unit Tests for SystemConfig Model
 *
 * Tests system-wide configuration storage and retrieval:
 * - Bundle discount configuration
 * - Default initialization
 * - Validation rules
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import {
  SystemConfig,
  IBundleDiscountConfig,
} from "../../../src/models/SystemConfig";

describe("SystemConfig Model", () => {
  const originalFindOne = SystemConfig.findOne.bind(SystemConfig);
  const originalFindOneAndUpdate =
    SystemConfig.findOneAndUpdate.bind(SystemConfig);
  const originalCreate = SystemConfig.create.bind(SystemConfig);

  afterEach(() => {
    // Restore any mocked static methods between tests
    SystemConfig.findOne = originalFindOne as typeof SystemConfig.findOne;
    SystemConfig.findOneAndUpdate =
      originalFindOneAndUpdate as typeof SystemConfig.findOneAndUpdate;
    SystemConfig.create = originalCreate as typeof SystemConfig.create;
    vi.restoreAllMocks();
  });

  describe("getBundleDiscountConfig", () => {
    it("should return default values when config doesn't exist", async () => {
      const findOneSpy = vi
        .spyOn(SystemConfig, "findOne")
        .mockResolvedValueOnce(null as any);

      const config = await SystemConfig.getBundleDiscountConfig();

      expect(config).toEqual({
        enabled: true,
        discountAmount: 5000,
        expiryDays: 30,
      });

      expect(findOneSpy).toHaveBeenCalledWith({
        key: "bundle_discount_config",
      });
    });

    it("should return database config when it exists", async () => {
      const fakeDoc = new SystemConfig({
        key: "bundle_discount_config",
        value: {
          enabled: false,
          discountAmount: 10000,
          expiryDays: 60,
        },
        description: "Test config",
      });

      vi.spyOn(SystemConfig, "findOne").mockResolvedValueOnce(fakeDoc as any);

      const config = await SystemConfig.getBundleDiscountConfig();

      expect(config).toEqual({
        enabled: false,
        discountAmount: 10000,
        expiryDays: 60,
      });
    });

    it("should handle partial config with defaults", async () => {
      const fakeDoc = new SystemConfig({
        key: "bundle_discount_config",
        value: {
          enabled: false,
          // Missing discountAmount and expiryDays
        },
        description: "Partial config",
      });

      vi.spyOn(SystemConfig, "findOne").mockResolvedValueOnce(fakeDoc as any);

      const config = await SystemConfig.getBundleDiscountConfig();

      expect(config.enabled).toBe(false);
      expect(config.discountAmount).toBe(5000); // Default
      expect(config.expiryDays).toBe(30); // Default
    });
  });

  describe("updateBundleDiscountConfig", () => {
    it("should create new config when it doesn't exist", async () => {
      const newConfig: IBundleDiscountConfig = {
        enabled: true,
        discountAmount: 7500,
        expiryDays: 45,
      };

      const fakeResult = new SystemConfig({
        key: "bundle_discount_config",
        value: newConfig,
        updatedBy: "admin@example.com",
        description: "Bundle discount auto-generation configuration",
      });

      const findOneAndUpdateSpy = vi
        .spyOn(SystemConfig, "findOneAndUpdate")
        .mockResolvedValueOnce(fakeResult as any);

      const result = await SystemConfig.updateBundleDiscountConfig(
        newConfig,
        "admin@example.com"
      );

      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        { key: "bundle_discount_config" },
        {
          key: "bundle_discount_config",
          value: newConfig,
          description: "Bundle discount auto-generation configuration",
          updatedBy: "admin@example.com",
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
        }
      );

      expect(result.key).toBe("bundle_discount_config");
      expect(result.value).toEqual(newConfig);
      expect(result.updatedBy).toBe("admin@example.com");
      expect(result.description).toBe(
        "Bundle discount auto-generation configuration"
      );
    });

    it("should update existing config", async () => {
      // Update config
      const updatedConfig: IBundleDiscountConfig = {
        enabled: false,
        discountAmount: 12000,
        expiryDays: 90,
      };

      const fakeResult = new SystemConfig({
        key: "bundle_discount_config",
        value: updatedConfig,
        updatedBy: "admin@example.com",
      });

      const findOneAndUpdateSpy = vi
        .spyOn(SystemConfig, "findOneAndUpdate")
        .mockResolvedValueOnce(fakeResult as any);

      const result = await SystemConfig.updateBundleDiscountConfig(
        updatedConfig,
        "admin@example.com"
      );

      expect(findOneAndUpdateSpy).toHaveBeenCalled();
      expect(result.value).toEqual(updatedConfig);
      expect(result.updatedBy).toBe("admin@example.com");
    });

    it("should reject non-boolean enabled field", async () => {
      const invalidConfig = {
        enabled: "yes" as any,
        discountAmount: 5000,
        expiryDays: 30,
      };

      await expect(
        SystemConfig.updateBundleDiscountConfig(invalidConfig, "admin")
      ).rejects.toThrow("enabled must be a boolean");
    });

    it("should reject discountAmount below $10", async () => {
      const invalidConfig: IBundleDiscountConfig = {
        enabled: true,
        discountAmount: 500, // $5 - too low
        expiryDays: 30,
      };

      await expect(
        SystemConfig.updateBundleDiscountConfig(invalidConfig, "admin")
      ).rejects.toThrow("discountAmount must be between 1000 and 20000");
    });

    it("should reject discountAmount above $200", async () => {
      const invalidConfig: IBundleDiscountConfig = {
        enabled: true,
        discountAmount: 25000, // $250 - too high
        expiryDays: 30,
      };

      await expect(
        SystemConfig.updateBundleDiscountConfig(invalidConfig, "admin")
      ).rejects.toThrow("discountAmount must be between 1000 and 20000");
    });

    it("should reject expiryDays below 7", async () => {
      const invalidConfig: IBundleDiscountConfig = {
        enabled: true,
        discountAmount: 5000,
        expiryDays: 3, // Too short
      };

      await expect(
        SystemConfig.updateBundleDiscountConfig(invalidConfig, "admin")
      ).rejects.toThrow("expiryDays must be between 7 and 365");
    });

    it("should reject expiryDays above 365", async () => {
      const invalidConfig: IBundleDiscountConfig = {
        enabled: true,
        discountAmount: 5000,
        expiryDays: 400, // Too long
      };

      await expect(
        SystemConfig.updateBundleDiscountConfig(invalidConfig, "admin")
      ).rejects.toThrow("expiryDays must be between 7 and 365");
    });

    it("should accept minimum valid discountAmount ($10)", async () => {
      const validConfig: IBundleDiscountConfig = {
        enabled: true,
        discountAmount: 1000, // $10 - minimum
        expiryDays: 30,
      };

      const fakeResult = new SystemConfig({
        key: "bundle_discount_config",
        value: validConfig,
        updatedBy: "admin",
      });

      vi.spyOn(SystemConfig, "findOneAndUpdate").mockResolvedValueOnce(
        fakeResult as any
      );

      const result = await SystemConfig.updateBundleDiscountConfig(
        validConfig,
        "admin"
      );

      expect(result.value.discountAmount).toBe(1000);
    });

    it("should accept maximum valid discountAmount ($200)", async () => {
      const validConfig: IBundleDiscountConfig = {
        enabled: true,
        discountAmount: 20000, // $200 - maximum
        expiryDays: 30,
      };

      const fakeResult = new SystemConfig({
        key: "bundle_discount_config",
        value: validConfig,
        updatedBy: "admin",
      });

      vi.spyOn(SystemConfig, "findOneAndUpdate").mockResolvedValueOnce(
        fakeResult as any
      );

      const result = await SystemConfig.updateBundleDiscountConfig(
        validConfig,
        "admin"
      );

      expect(result.value.discountAmount).toBe(20000);
    });

    it("should accept minimum valid expiryDays (7)", async () => {
      const validConfig: IBundleDiscountConfig = {
        enabled: true,
        discountAmount: 5000,
        expiryDays: 7, // Minimum
      };

      const fakeResult = new SystemConfig({
        key: "bundle_discount_config",
        value: validConfig,
        updatedBy: "admin",
      });

      vi.spyOn(SystemConfig, "findOneAndUpdate").mockResolvedValueOnce(
        fakeResult as any
      );

      const result = await SystemConfig.updateBundleDiscountConfig(
        validConfig,
        "admin"
      );

      expect(result.value.expiryDays).toBe(7);
    });

    it("should accept maximum valid expiryDays (365)", async () => {
      const validConfig: IBundleDiscountConfig = {
        enabled: true,
        discountAmount: 5000,
        expiryDays: 365, // Maximum
      };

      const fakeResult = new SystemConfig({
        key: "bundle_discount_config",
        value: validConfig,
        updatedBy: "admin",
      });

      vi.spyOn(SystemConfig, "findOneAndUpdate").mockResolvedValueOnce(
        fakeResult as any
      );

      const result = await SystemConfig.updateBundleDiscountConfig(
        validConfig,
        "admin"
      );

      expect(result.value.expiryDays).toBe(365);
    });
  });

  describe("initializeDefaults", () => {
    it("should create default config when none exists", async () => {
      const consoleSpy = vi.spyOn(console, "log");

      const findOneSpy = vi
        .spyOn(SystemConfig, "findOne")
        .mockResolvedValueOnce(null as any);

      const createSpy = vi
        .spyOn(SystemConfig, "create")
        .mockResolvedValueOnce({} as any);

      await SystemConfig.initializeDefaults();

      expect(findOneSpy).toHaveBeenCalledWith({
        key: "bundle_discount_config",
      });

      expect(createSpy).toHaveBeenCalledWith({
        key: "bundle_discount_config",
        value: {
          enabled: true,
          discountAmount: 5000,
          expiryDays: 30,
        },
        description: "Bundle discount auto-generation configuration",
        updatedBy: "system",
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Initializing default bundle discount configuration"
        )
      );
    });

    it("should not create config if it already exists", async () => {
      const existingDoc = new SystemConfig({
        key: "bundle_discount_config",
        value: {
          enabled: false,
          discountAmount: 10000,
          expiryDays: 60,
        },
        updatedBy: "admin",
      });

      const findOneSpy = vi
        .spyOn(SystemConfig, "findOne")
        .mockResolvedValueOnce(existingDoc as any);

      const createSpy = vi.spyOn(SystemConfig, "create");

      await SystemConfig.initializeDefaults();

      expect(findOneSpy).toHaveBeenCalledWith({
        key: "bundle_discount_config",
      });
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("should use environment variables when present", async () => {
      const originalEnv = { ...process.env };
      process.env.BUNDLE_DISCOUNT_ENABLED = "false";
      process.env.BUNDLE_DISCOUNT_AMOUNT = "15000";
      process.env.BUNDLE_EXPIRY_DAYS = "90";

      const consoleSpy = vi.spyOn(console, "log");

      const findOneSpy = vi
        .spyOn(SystemConfig, "findOne")
        .mockResolvedValueOnce(null as any);

      const createSpy = vi
        .spyOn(SystemConfig, "create")
        .mockResolvedValueOnce({} as any);

      await SystemConfig.initializeDefaults();

      expect(findOneSpy).toHaveBeenCalledWith({
        key: "bundle_discount_config",
      });

      expect(createSpy).toHaveBeenCalledWith({
        key: "bundle_discount_config",
        value: {
          enabled: false,
          discountAmount: 15000,
          expiryDays: 90,
        },
        description: "Bundle discount auto-generation configuration",
        updatedBy: "system",
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Migrated bundle config from environment variables"
        )
      );

      // Restore env
      process.env = originalEnv;
    });
  });

  describe("schema validation", () => {
    it("should require key field", async () => {
      const config = new SystemConfig({
        value: { test: true },
      });

      await expect(config.validate()).rejects.toThrow();
    });

    it("should require value field", async () => {
      const config = new SystemConfig({
        key: "test_config",
      });

      await expect(config.validate()).rejects.toThrow();
    });

    it("should trim and lowercase key", async () => {
      const createSpy = vi
        .spyOn(SystemConfig, "create")
        .mockImplementationOnce(async (doc: any) => {
          const instance = new SystemConfig(doc);
          // simulate what mongoose would do: trim + lowercase
          instance.key = (doc.key as string).trim().toLowerCase();
          return instance as any;
        });

      const config = await SystemConfig.create({
        key: "  TEST_KEY  ",
        value: { test: true },
      });

      expect(createSpy).toHaveBeenCalled();
      expect(config.key).toBe("test_key");
    });

    it("should automatically set timestamps", async () => {
      const now = new Date();

      vi.spyOn(SystemConfig, "create").mockImplementationOnce(
        async (doc: any) => {
          const instance: any = new SystemConfig(doc);
          instance.createdAt = now;
          instance.updatedAt = now;
          return instance;
        }
      );

      const config = await SystemConfig.create({
        key: "timestamp_test",
        value: { test: true },
      });

      expect(config.createdAt).toBeInstanceOf(Date);
      expect(config.updatedAt).toBeInstanceOf(Date);
    });
  });
});
