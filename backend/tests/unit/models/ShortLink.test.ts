/**
 * ShortLink Model Unit Tests
 *
 * Tests for the ShortLink model schema, validation, and statics.
 * Tests schema definition, field validation, and constraints without database.
 */

import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import ShortLink from "../../../src/models/ShortLink";

describe("ShortLink Model", () => {
  describe("Schema Definition", () => {
    it("should have the correct schema paths", () => {
      const schema = ShortLink.schema;

      expect(schema.path("key")).toBeDefined();
      expect(schema.path("eventId")).toBeDefined();
      expect(schema.path("targetSlug")).toBeDefined();
      expect(schema.path("createdBy")).toBeDefined();
      expect(schema.path("createdAt")).toBeDefined();
      expect(schema.path("expiresAt")).toBeDefined();
      expect(schema.path("isExpired")).toBeDefined();
    });

    it("should have key as required", () => {
      const keyPath = ShortLink.schema.path("key");
      expect(keyPath.isRequired).toBe(true);
    });

    it("should have eventId as required", () => {
      const eventIdPath = ShortLink.schema.path("eventId");
      expect(eventIdPath.isRequired).toBe(true);
    });

    it("should have targetSlug as required", () => {
      const targetSlugPath = ShortLink.schema.path("targetSlug");
      expect(targetSlugPath.isRequired).toBe(true);
    });

    it("should have createdBy as required", () => {
      const createdByPath = ShortLink.schema.path("createdBy");
      expect(createdByPath.isRequired).toBe(true);
    });

    it("should have expiresAt as required", () => {
      const expiresAtPath = ShortLink.schema.path("expiresAt");
      expect(expiresAtPath.isRequired).toBe(true);
    });

    it("should have isExpired with default value of false", () => {
      const shortLink = new ShortLink({
        key: "abc123",
        eventId: new mongoose.Types.ObjectId(),
        targetSlug: "test-slug",
        createdBy: new mongoose.Types.ObjectId(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      expect(shortLink.isExpired).toBe(false);
    });
  });

  describe("Key Validation", () => {
    it("should have minimum length of 6 for key", () => {
      const keyPath = ShortLink.schema.path("key") as any;
      expect(keyPath.options.minlength).toBe(6);
    });

    it("should have maximum length of 16 for key", () => {
      const keyPath = ShortLink.schema.path("key") as any;
      expect(keyPath.options.maxlength).toBe(16);
    });

    it("should have a custom validator for key format", () => {
      const keyPath = ShortLink.schema.path("key") as any;
      expect(keyPath.validators.length).toBeGreaterThan(0);
    });

    it("should validate alphanumeric keys", () => {
      const shortLink = new ShortLink({
        key: "AbC123",
        eventId: new mongoose.Types.ObjectId(),
        targetSlug: "test-slug",
        createdBy: new mongoose.Types.ObjectId(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const validationError = shortLink.validateSync();
      expect(validationError).toBeUndefined();
    });

    it("should validate keys with hyphens", () => {
      const shortLink = new ShortLink({
        key: "abc-12",
        eventId: new mongoose.Types.ObjectId(),
        targetSlug: "test-slug",
        createdBy: new mongoose.Types.ObjectId(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const validationError = shortLink.validateSync();
      expect(validationError).toBeUndefined();
    });

    it("should validate keys with underscores", () => {
      const shortLink = new ShortLink({
        key: "abc_12",
        eventId: new mongoose.Types.ObjectId(),
        targetSlug: "test-slug",
        createdBy: new mongoose.Types.ObjectId(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const validationError = shortLink.validateSync();
      expect(validationError).toBeUndefined();
    });

    it("should reject keys shorter than 6 characters", () => {
      const shortLink = new ShortLink({
        key: "abc12", // 5 chars
        eventId: new mongoose.Types.ObjectId(),
        targetSlug: "test-slug",
        createdBy: new mongoose.Types.ObjectId(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const validationError = shortLink.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError?.errors.key).toBeDefined();
    });

    it("should reject keys longer than 16 characters", () => {
      const shortLink = new ShortLink({
        key: "a".repeat(17), // 17 chars
        eventId: new mongoose.Types.ObjectId(),
        targetSlug: "test-slug",
        createdBy: new mongoose.Types.ObjectId(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const validationError = shortLink.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError?.errors.key).toBeDefined();
    });

    it("should reject keys with invalid characters", () => {
      const shortLink = new ShortLink({
        key: "abc@12",
        eventId: new mongoose.Types.ObjectId(),
        targetSlug: "test-slug",
        createdBy: new mongoose.Types.ObjectId(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const validationError = shortLink.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError?.errors.key.message).toContain("alphanumeric");
    });

    it("should reject keys with spaces", () => {
      const shortLink = new ShortLink({
        key: "abc 12",
        eventId: new mongoose.Types.ObjectId(),
        targetSlug: "test-slug",
        createdBy: new mongoose.Types.ObjectId(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const validationError = shortLink.validateSync();
      expect(validationError).toBeDefined();
    });
  });

  describe("Indexes", () => {
    it("should have index on key (unique)", () => {
      const keyPath = ShortLink.schema.path("key") as any;
      expect(keyPath.options.unique).toBe(true);
    });

    it("should have index on eventId", () => {
      const eventIdPath = ShortLink.schema.path("eventId") as any;
      expect(eventIdPath.options.index).toBe(true);
    });

    it("should have index on targetSlug", () => {
      const targetSlugPath = ShortLink.schema.path("targetSlug") as any;
      expect(targetSlugPath.options.index).toBe(true);
    });

    it("should have index on expiresAt", () => {
      const expiresAtPath = ShortLink.schema.path("expiresAt") as any;
      expect(expiresAtPath.options.index).toBe(true);
    });

    it("should have index on isExpired", () => {
      const isExpiredPath = ShortLink.schema.path("isExpired") as any;
      expect(isExpiredPath.options.index).toBe(true);
    });
  });

  describe("TargetSlug", () => {
    it("should trim whitespace from targetSlug", () => {
      const targetSlugPath = ShortLink.schema.path("targetSlug") as any;
      expect(targetSlugPath.options.trim).toBe(true);
    });
  });

  describe("Static Methods", () => {
    it("should have getActiveByKey static method", () => {
      expect(typeof ShortLink.getActiveByKey).toBe("function");
    });
  });

  describe("Document Creation", () => {
    it("should create a valid document with all fields", () => {
      const eventId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const shortLink = new ShortLink({
        key: "valid1",
        eventId,
        targetSlug: "test-event-slug",
        createdBy: userId,
        expiresAt,
      });

      expect(shortLink.key).toBe("valid1");
      expect(shortLink.eventId.toString()).toBe(eventId.toString());
      expect(shortLink.targetSlug).toBe("test-event-slug");
      expect(shortLink.createdBy.toString()).toBe(userId.toString());
      expect(shortLink.expiresAt).toEqual(expiresAt);
      expect(shortLink.isExpired).toBe(false);
      expect(shortLink.createdAt).toBeDefined();
    });

    it("should pass validation for valid document", () => {
      const shortLink = new ShortLink({
        key: "valid2",
        eventId: new mongoose.Types.ObjectId(),
        targetSlug: "test-slug",
        createdBy: new mongoose.Types.ObjectId(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const validationError = shortLink.validateSync();
      expect(validationError).toBeUndefined();
    });

    it("should fail validation when key is missing", () => {
      const shortLink = new ShortLink({
        eventId: new mongoose.Types.ObjectId(),
        targetSlug: "test-slug",
        createdBy: new mongoose.Types.ObjectId(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const validationError = shortLink.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError?.errors.key).toBeDefined();
    });

    it("should fail validation when eventId is missing", () => {
      const shortLink = new ShortLink({
        key: "valid3",
        targetSlug: "test-slug",
        createdBy: new mongoose.Types.ObjectId(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const validationError = shortLink.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError?.errors.eventId).toBeDefined();
    });

    it("should fail validation when targetSlug is missing", () => {
      const shortLink = new ShortLink({
        key: "valid4",
        eventId: new mongoose.Types.ObjectId(),
        createdBy: new mongoose.Types.ObjectId(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const validationError = shortLink.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError?.errors.targetSlug).toBeDefined();
    });

    it("should fail validation when createdBy is missing", () => {
      const shortLink = new ShortLink({
        key: "valid5",
        eventId: new mongoose.Types.ObjectId(),
        targetSlug: "test-slug",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const validationError = shortLink.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError?.errors.createdBy).toBeDefined();
    });

    it("should fail validation when expiresAt is missing", () => {
      const shortLink = new ShortLink({
        key: "valid6",
        eventId: new mongoose.Types.ObjectId(),
        targetSlug: "test-slug",
        createdBy: new mongoose.Types.ObjectId(),
      });

      const validationError = shortLink.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError?.errors.expiresAt).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should accept exactly 6 character key", () => {
      const shortLink = new ShortLink({
        key: "abc123", // exactly 6 chars
        eventId: new mongoose.Types.ObjectId(),
        targetSlug: "test-slug",
        createdBy: new mongoose.Types.ObjectId(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const validationError = shortLink.validateSync();
      expect(validationError).toBeUndefined();
    });

    it("should accept exactly 16 character key", () => {
      const shortLink = new ShortLink({
        key: "a".repeat(16), // exactly 16 chars
        eventId: new mongoose.Types.ObjectId(),
        targetSlug: "test-slug",
        createdBy: new mongoose.Types.ObjectId(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const validationError = shortLink.validateSync();
      expect(validationError).toBeUndefined();
    });

    it("should handle empty string key", () => {
      const shortLink = new ShortLink({
        key: "",
        eventId: new mongoose.Types.ObjectId(),
        targetSlug: "test-slug",
        createdBy: new mongoose.Types.ObjectId(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const validationError = shortLink.validateSync();
      expect(validationError).toBeDefined();
    });

    it("should set isExpired to true when explicitly provided", () => {
      const shortLink = new ShortLink({
        key: "expkey",
        eventId: new mongoose.Types.ObjectId(),
        targetSlug: "test-slug",
        createdBy: new mongoose.Types.ObjectId(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isExpired: true,
      });

      expect(shortLink.isExpired).toBe(true);
    });

    it("should accept mixed case alphanumeric keys", () => {
      const shortLink = new ShortLink({
        key: "AbCdEf",
        eventId: new mongoose.Types.ObjectId(),
        targetSlug: "test-slug",
        createdBy: new mongoose.Types.ObjectId(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const validationError = shortLink.validateSync();
      expect(validationError).toBeUndefined();
    });

    it("should accept keys with only digits", () => {
      const shortLink = new ShortLink({
        key: "123456",
        eventId: new mongoose.Types.ObjectId(),
        targetSlug: "test-slug",
        createdBy: new mongoose.Types.ObjectId(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const validationError = shortLink.validateSync();
      expect(validationError).toBeUndefined();
    });

    it("should accept keys with only letters", () => {
      const shortLink = new ShortLink({
        key: "abcdef",
        eventId: new mongoose.Types.ObjectId(),
        targetSlug: "test-slug",
        createdBy: new mongoose.Types.ObjectId(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const validationError = shortLink.validateSync();
      expect(validationError).toBeUndefined();
    });
  });
});
