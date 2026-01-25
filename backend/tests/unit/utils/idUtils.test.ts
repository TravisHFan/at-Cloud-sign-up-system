/**
 * ID Utilities Unit Tests
 *
 * Tests utility functions for MongoDB ObjectId handling:
 * - toIdString: Convert various ID types to strings
 * - isValidObjectId: Check if value is valid ObjectId
 * - validateObjectId: Validate ObjectId with error messages
 */

import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import {
  toIdString,
  isValidObjectId,
  validateObjectId,
} from "../../../src/utils/idUtils";

describe("idUtils", () => {
  describe("toIdString", () => {
    it("should return string as-is", () => {
      const id = "507f1f77bcf86cd799439011";
      expect(toIdString(id)).toBe(id);
    });

    it("should convert ObjectId to string", () => {
      const objectId = new mongoose.Types.ObjectId("507f1f77bcf86cd799439011");
      expect(toIdString(objectId)).toBe("507f1f77bcf86cd799439011");
    });

    it("should handle object with toString method", () => {
      const obj = { toString: () => "custom-id" };
      expect(toIdString(obj)).toBe("custom-id");
    });

    it("should handle object with throwing toString - falls through to String(val)", () => {
      // Create an object where the first toString call throws, but String(val) works
      // This is tricky because String(val) also calls toString
      // We need an object where first call throws, subsequent doesn't
      let callCount = 0;
      const obj = {
        toString: () => {
          callCount++;
          if (callCount === 1) {
            throw new Error("First call throws");
          }
          return "recovered";
        },
      };
      // First call in the try block throws, catch block falls through
      // Then String(val) calls toString again, which returns "recovered"
      const result = toIdString(obj);
      expect(result).toBe("recovered");
    });

    it("should handle null", () => {
      expect(toIdString(null)).toBe("");
    });

    it("should handle undefined", () => {
      expect(toIdString(undefined)).toBe("");
    });

    it("should handle numbers", () => {
      expect(toIdString(123)).toBe("123");
    });
  });

  describe("isValidObjectId", () => {
    it("should return true for valid ObjectId string", () => {
      expect(isValidObjectId("507f1f77bcf86cd799439011")).toBe(true);
    });

    it("should return true for new ObjectId hex string", () => {
      const id = new mongoose.Types.ObjectId().toHexString();
      expect(isValidObjectId(id)).toBe(true);
    });

    it("should return false for invalid format", () => {
      expect(isValidObjectId("not-an-objectid")).toBe(false);
    });

    it("should return false for too short string", () => {
      expect(isValidObjectId("507f1f77")).toBe(false);
    });

    it("should return false for null", () => {
      expect(isValidObjectId(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isValidObjectId(undefined)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isValidObjectId("")).toBe(false);
    });

    it("should return false for number", () => {
      expect(isValidObjectId(123)).toBe(false);
    });

    it("should return false for object", () => {
      expect(isValidObjectId({})).toBe(false);
    });
  });

  describe("validateObjectId", () => {
    it("should return valid for correct ObjectId", () => {
      const result = validateObjectId("507f1f77bcf86cd799439011");
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it("should return invalid with message for null", () => {
      const result = validateObjectId(null);
      expect(result.valid).toBe(false);
      expect(result.message).toBe("ID is required");
    });

    it("should return invalid with message for undefined", () => {
      const result = validateObjectId(undefined);
      expect(result.valid).toBe(false);
      expect(result.message).toBe("ID is required");
    });

    it("should return invalid with message for empty string", () => {
      const result = validateObjectId("");
      expect(result.valid).toBe(false);
      expect(result.message).toBe("ID is required");
    });

    it("should return invalid with format message for bad format", () => {
      const result = validateObjectId("invalid-id");
      expect(result.valid).toBe(false);
      expect(result.message).toBe("Invalid ID format");
    });

    it("should use custom field name in error messages", () => {
      const result = validateObjectId(null, "EventId");
      expect(result.valid).toBe(false);
      expect(result.message).toBe("EventId is required");
    });

    it("should use custom field name for format error", () => {
      const result = validateObjectId("bad", "UserId");
      expect(result.valid).toBe(false);
      expect(result.message).toBe("Invalid UserId format");
    });
  });
});
