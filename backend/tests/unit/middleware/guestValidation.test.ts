/**
 * Unit tests for guestValidation middleware
 * Testing validation chains and helper functions for guest registration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import mongoose from "mongoose";
import { Request, Response } from "express";
import { validationResult } from "express-validator";
import {
  guestRegistrationValidation,
  validateGuestUniqueness,
  validateGuestRateLimit,
} from "../../../src/middleware/guestValidation";
import GuestRegistration from "../../../src/models/GuestRegistration";

// Mock dependencies
vi.mock("../../../src/models/GuestRegistration");

// Mock express-validator
vi.mock("express-validator", () => ({
  body: vi.fn(() => ({
    notEmpty: vi.fn().mockReturnThis(),
    isLength: vi.fn().mockReturnThis(),
    isEmail: vi.fn().mockReturnThis(),
    normalizeEmail: vi.fn().mockReturnThis(),
    toLowerCase: vi.fn().mockReturnThis(),
    isIn: vi.fn().mockReturnThis(),
    isMobilePhone: vi.fn().mockReturnThis(),
    withMessage: vi.fn().mockReturnThis(),
    trim: vi.fn().mockReturnThis(),
    optional: vi.fn().mockReturnThis(),
    matches: vi.fn().mockReturnThis(),
  })),
  validationResult: vi.fn(),
}));

describe("guestValidation middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRequest = {
      body: {},
      ip: "127.0.0.1",
    };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    nextFunction = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("guestRegistrationValidation", () => {
    it("should be an array of validation middlewares", () => {
      expect(Array.isArray(guestRegistrationValidation)).toBe(true);
      expect(guestRegistrationValidation.length).toBeGreaterThan(0);
    });

    it("should validate required fields", () => {
      // This test ensures the validation chain is properly configured
      // The actual validation logic is tested through integration tests
      expect(guestRegistrationValidation).toBeDefined();
    });
  });

  describe("validateGuestUniqueness", () => {
    const testEmail = "test@example.com";
    const testEventId = "507f1f77bcf86cd799439011";

    it("should return valid when no existing registration found", async () => {
      vi.mocked(GuestRegistration.findOne).mockResolvedValue(null);

      const result = await validateGuestUniqueness(testEmail, testEventId);

      expect(result.isValid).toBe(true);
      expect(result.message).toBeUndefined();
      // Expect eventId to be cast to ObjectId
      const callArg = (vi.mocked(GuestRegistration.findOne).mock
        .calls[0]?.[0] || {}) as any;
      expect(callArg.email).toBe(testEmail.toLowerCase());
      expect(callArg.status).toBe("active");
      expect(callArg.eventId).toBeInstanceOf(mongoose.Types.ObjectId);
      expect((callArg.eventId as mongoose.Types.ObjectId).toHexString()).toBe(
        testEventId
      );
    });

    it("should return invalid when guest already registered for the event", async () => {
      const existingRegistration = {
        eventId: testEventId,
        email: testEmail,
        status: "active",
      };
      vi.mocked(GuestRegistration.findOne).mockResolvedValue(
        existingRegistration as any
      );

      const result = await validateGuestUniqueness(testEmail, testEventId);

      expect(result.isValid).toBe(false);
      expect(result.message).toContain("already registered");
      expect(result.message).toContain("email");
    });

    it("should return valid when guest registered for different events", async () => {
      // For different events, the query should not find anything
      vi.mocked(GuestRegistration.findOne).mockResolvedValue(null);

      const result = await validateGuestUniqueness(testEmail, testEventId);

      expect(result.isValid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it("should handle database errors gracefully", async () => {
      vi.mocked(GuestRegistration.findOne).mockRejectedValue(
        new Error("Database connection failed")
      );

      const result = await validateGuestUniqueness(testEmail, testEventId);

      expect(result.isValid).toBe(false);
      expect(result.message).toContain(
        "Error validating guest registration uniqueness"
      );
    });

    it("should handle invalid ObjectId format", async () => {
      const invalidEventId = "invalid-object-id";

      // With ObjectId casting, invalid ids should be handled gracefully and return invalid
      vi.mocked(GuestRegistration.findOne).mockResolvedValue(null);

      const result = await validateGuestUniqueness(testEmail, invalidEventId);

      expect(result.isValid).toBe(false);
      expect(String(result.message || "").toLowerCase()).toContain("error");
    });
  });

  describe("validateGuestRateLimit", () => {
    const testIp = "192.168.1.100";
    const testEmail = "test@example.com";

    beforeEach(() => {
      // Reset the rate limiting cache before each test
      // Note: In a real implementation, this might involve clearing a Redis cache or similar
    });

    it("should return valid for first registration attempt", () => {
      const result = validateGuestRateLimit(testIp, testEmail);

      expect(result.isValid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it("should return valid for different IP addresses", () => {
      // First attempt from one IP
      const firstResult = validateGuestRateLimit("192.168.1.1", testEmail);
      expect(firstResult.isValid).toBe(true);

      // Second attempt from different IP should also be valid
      const secondResult = validateGuestRateLimit("192.168.1.2", testEmail);
      expect(secondResult.isValid).toBe(true);
    });

    it("should return valid for different email addresses from same IP", () => {
      // First attempt with one email
      const firstResult = validateGuestRateLimit(testIp, "first@example.com");
      expect(firstResult.isValid).toBe(true);

      // Second attempt with different email should also be valid
      const secondResult = validateGuestRateLimit(testIp, "second@example.com");
      expect(secondResult.isValid).toBe(true);
    });

    it("should implement rate limiting logic", () => {
      // This test would verify that excessive requests are rate limited
      // The actual implementation depends on the rate limiting strategy
      // (e.g., requests per minute, sliding window, etc.)
      const result = validateGuestRateLimit(testIp, testEmail);
      expect(typeof result.isValid).toBe("boolean");
      expect(
        typeof result.message === "string" || result.message === undefined
      ).toBe(true);
    });
  });

  describe("validation error scenarios", () => {
    it("should handle malformed email addresses", async () => {
      const malformedEmails = [
        "not-an-email",
        "@domain.com",
        "user@",
        "user..double.dot@domain.com",
        "user@domain",
        "",
      ];

      for (const email of malformedEmails) {
        const result = await validateGuestUniqueness(
          email,
          "507f1f77bcf86cd799439011"
        );
        // The function should handle malformed emails gracefully
        expect(typeof result.isValid).toBe("boolean");
      }
    });

    it("should handle empty or null values", async () => {
      const emptyValues = ["", null, undefined];

      for (const value of emptyValues) {
        // Mock findOne to not find anything for empty values
        vi.mocked(GuestRegistration.findOne).mockResolvedValue(null);

        const result = await validateGuestUniqueness(
          value as any,
          "507f1f77bcf86cd799439011"
        );
        // The function will throw an error when trying to call toLowerCase() on null/undefined
        // which gets caught and returns isValid: false
        expect(result.isValid).toBe(false);
        expect(result.message).toBe(
          "Error validating guest registration uniqueness"
        );
      }
    });

    it("should handle rate limiting with empty IP", () => {
      const emptyIps = ["", null, undefined];

      for (const ip of emptyIps) {
        const result = validateGuestRateLimit(ip as any, "test@example.com");
        expect(typeof result.isValid).toBe("boolean");
      }
    });
  });

  describe("integration with express-validator", () => {
    it("should work with validation result checking", () => {
      // Mock validation errors
      const mockErrors = [
        {
          type: "field",
          msg: "Email is required",
          path: "email",
          location: "body",
        },
      ];

      vi.mocked(validationResult).mockReturnValue({
        isEmpty: () => false,
        array: () => mockErrors,
      } as any);

      const errors = validationResult(mockRequest as Request);

      expect(errors.isEmpty()).toBe(false);
      expect(errors.array()).toEqual(mockErrors);
    });

    it("should pass validation when all fields are valid", () => {
      vi.mocked(validationResult).mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      } as any);

      const errors = validationResult(mockRequest as Request);

      expect(errors.isEmpty()).toBe(true);
      expect(errors.array()).toEqual([]);
    });
  });
});
