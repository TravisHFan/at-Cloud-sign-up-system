// api.test.ts - Unit tests for API types and utilities
import { describe, test, expect } from "vitest";
import {
  parsePaginationParams,
  createErrorResponse,
} from "../../../src/types/api";
import type { Request } from "express";

describe("API Types and Utilities", () => {
  describe("parsePaginationParams", () => {
    test("should return default values when no query params provided", () => {
      const req = { query: {} } as unknown as Request;
      const result = parsePaginationParams(req);

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.skip).toBe(0);
    });

    test("should parse page from query string", () => {
      const req = { query: { page: "3" } } as unknown as Request;
      const result = parsePaginationParams(req);

      expect(result.page).toBe(3);
      expect(result.skip).toBe(40); // (3-1) * 20
    });

    test("should parse limit from query string", () => {
      const req = { query: { limit: "50" } } as unknown as Request;
      const result = parsePaginationParams(req);

      expect(result.limit).toBe(50);
    });

    test("should enforce minimum page of 1", () => {
      const req = { query: { page: "0" } } as unknown as Request;
      const result = parsePaginationParams(req);

      expect(result.page).toBe(1);
    });

    test("should enforce minimum page of 1 for negative values", () => {
      const req = { query: { page: "-5" } } as unknown as Request;
      const result = parsePaginationParams(req);

      expect(result.page).toBe(1);
    });

    test("should use default limit when limit is 0", () => {
      const req = { query: { limit: "0" } } as unknown as Request;
      const result = parsePaginationParams(req);

      // parseInt("0") = 0, 0 || 20 = 20
      expect(result.limit).toBe(20);
    });

    test("should enforce minimum limit of 1 for negative values", () => {
      const req = { query: { limit: "-10" } } as unknown as Request;
      const result = parsePaginationParams(req);

      // Math.max(1, -10) = 1
      expect(result.limit).toBe(1);
    });

    test("should enforce maximum limit of 100", () => {
      const req = { query: { limit: "500" } } as unknown as Request;
      const result = parsePaginationParams(req);

      expect(result.limit).toBe(100);
    });

    test("should calculate correct skip value", () => {
      const testCases = [
        { page: "1", limit: "10", expectedSkip: 0 },
        { page: "2", limit: "10", expectedSkip: 10 },
        { page: "5", limit: "20", expectedSkip: 80 },
        { page: "10", limit: "100", expectedSkip: 900 },
      ];

      testCases.forEach(({ page, limit, expectedSkip }) => {
        const req = { query: { page, limit } } as unknown as Request;
        const result = parsePaginationParams(req);
        expect(result.skip).toBe(expectedSkip);
      });
    });

    test("should handle non-numeric values gracefully", () => {
      const req = {
        query: { page: "abc", limit: "xyz" },
      } as unknown as Request;
      const result = parsePaginationParams(req);

      // NaN || 1 = 1, NaN || 20 = 20
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    test("should handle floating point values by truncating", () => {
      const req = {
        query: { page: "2.7", limit: "10.9" },
      } as unknown as Request;
      const result = parsePaginationParams(req);

      // parseInt truncates the decimal part
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });
  });

  describe("createErrorResponse", () => {
    test("should create error response with default status code", () => {
      const response = createErrorResponse("Something went wrong");

      expect(response.success).toBe(false);
      expect(response.message).toBe("Something went wrong");
      expect(response.statusCode).toBe(500);
      expect(response.meta?.timestamp).toBeDefined();
    });

    test("should create error response with custom status code", () => {
      const response = createErrorResponse("Not found", 404);

      expect(response.success).toBe(false);
      expect(response.message).toBe("Not found");
      expect(response.statusCode).toBe(404);
    });

    test("should include ISO timestamp in meta", () => {
      const response = createErrorResponse("Error");
      const timestamp = response.meta?.timestamp as string;

      // Should be a valid ISO date string
      expect(() => new Date(timestamp)).not.toThrow();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });
  });
});
