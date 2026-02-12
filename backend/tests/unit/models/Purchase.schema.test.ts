// Purchase.schema.test.ts - Unit tests for Purchase schema conditional required validators
import { describe, test, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";
import Purchase from "../../../src/models/Purchase";

describe("Purchase Schema Conditional Required Fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test the conditional required function logic for programId and eventId
  // Access the schema path and test the required function directly

  describe("programId conditional required", () => {
    test("should require programId when purchaseType is 'program'", () => {
      // Access the programId path's required validator
      const programIdPath = Purchase.schema.path("programId");
      const requiredFn = programIdPath.options.required as (
        this: { purchaseType: string }
      ) => boolean;

      const context = { purchaseType: "program" };
      expect(requiredFn.call(context)).toBe(true);
    });

    test("should not require programId when purchaseType is 'event'", () => {
      const programIdPath = Purchase.schema.path("programId");
      const requiredFn = programIdPath.options.required as (
        this: { purchaseType: string }
      ) => boolean;

      const context = { purchaseType: "event" };
      expect(requiredFn.call(context)).toBe(false);
    });
  });

  describe("eventId conditional required", () => {
    test("should require eventId when purchaseType is 'event'", () => {
      const eventIdPath = Purchase.schema.path("eventId");
      const requiredFn = eventIdPath.options.required as (
        this: { purchaseType: string }
      ) => boolean;

      const context = { purchaseType: "event" };
      expect(requiredFn.call(context)).toBe(true);
    });

    test("should not require eventId when purchaseType is 'program'", () => {
      const eventIdPath = Purchase.schema.path("eventId");
      const requiredFn = eventIdPath.options.required as (
        this: { purchaseType: string }
      ) => boolean;

      const context = { purchaseType: "program" };
      expect(requiredFn.call(context)).toBe(false);
    });
  });

  describe("purchaseType enum validation", () => {
    test("should only allow 'program' and 'event' values", () => {
      const purchaseTypePath = Purchase.schema.path("purchaseType");
      const enumValues = purchaseTypePath.options.enum;
      expect(enumValues).toContain("program");
      expect(enumValues).toContain("event");
      expect(enumValues).toHaveLength(2);
    });

    test("should default to 'program' for backward compatibility", () => {
      const purchaseTypePath = Purchase.schema.path("purchaseType");
      expect(purchaseTypePath.options.default).toBe("program");
    });
  });
});
