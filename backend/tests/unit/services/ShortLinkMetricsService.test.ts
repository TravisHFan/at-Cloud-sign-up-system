/**
 * ShortLinkMetricsService Unit Tests
 *
 * Tests for the in-memory metrics service for short links.
 * This service provides lightweight counters for short link operations.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ShortLinkMetricsService,
  ShortLinkMetricKey,
} from "../../../src/services/ShortLinkMetricsService";

describe("ShortLinkMetricsService", () => {
  beforeEach(() => {
    // Reset counters before each test
    ShortLinkMetricsService.reset();
  });

  describe("increment", () => {
    it("should increment 'created' counter", () => {
      ShortLinkMetricsService.increment("created");
      const metrics = ShortLinkMetricsService.getAll();

      expect(metrics.created).toBe(1);
    });

    it("should increment counter multiple times", () => {
      ShortLinkMetricsService.increment("created");
      ShortLinkMetricsService.increment("created");
      ShortLinkMetricsService.increment("created");
      const metrics = ShortLinkMetricsService.getAll();

      expect(metrics.created).toBe(3);
    });

    it("should increment 'resolved_active' counter", () => {
      ShortLinkMetricsService.increment("resolved_active");
      const metrics = ShortLinkMetricsService.getAll();

      expect(metrics.resolved_active).toBe(1);
    });

    it("should increment 'resolved_expired' counter", () => {
      ShortLinkMetricsService.increment("resolved_expired");
      const metrics = ShortLinkMetricsService.getAll();

      expect(metrics.resolved_expired).toBe(1);
    });

    it("should increment 'resolved_not_found' counter", () => {
      ShortLinkMetricsService.increment("resolved_not_found");
      const metrics = ShortLinkMetricsService.getAll();

      expect(metrics.resolved_not_found).toBe(1);
    });

    it("should increment 'redirect_active' counter", () => {
      ShortLinkMetricsService.increment("redirect_active");
      const metrics = ShortLinkMetricsService.getAll();

      expect(metrics.redirect_active).toBe(1);
    });

    it("should increment 'redirect_expired' counter", () => {
      ShortLinkMetricsService.increment("redirect_expired");
      const metrics = ShortLinkMetricsService.getAll();

      expect(metrics.redirect_expired).toBe(1);
    });

    it("should increment 'redirect_not_found' counter", () => {
      ShortLinkMetricsService.increment("redirect_not_found");
      const metrics = ShortLinkMetricsService.getAll();

      expect(metrics.redirect_not_found).toBe(1);
    });

    it("should track multiple different counters independently", () => {
      ShortLinkMetricsService.increment("created");
      ShortLinkMetricsService.increment("created");
      ShortLinkMetricsService.increment("resolved_active");
      ShortLinkMetricsService.increment("redirect_not_found");
      ShortLinkMetricsService.increment("redirect_not_found");
      ShortLinkMetricsService.increment("redirect_not_found");

      const metrics = ShortLinkMetricsService.getAll();

      expect(metrics.created).toBe(2);
      expect(metrics.resolved_active).toBe(1);
      expect(metrics.redirect_not_found).toBe(3);
    });
  });

  describe("getAll", () => {
    it("should return empty object when no counters have been incremented", () => {
      const metrics = ShortLinkMetricsService.getAll();

      expect(Object.keys(metrics)).toHaveLength(0);
    });

    it("should return a copy of the counters (not a reference)", () => {
      ShortLinkMetricsService.increment("created");
      const metrics1 = ShortLinkMetricsService.getAll();
      const metrics2 = ShortLinkMetricsService.getAll();

      // Modify the returned object
      metrics1.created = 999;

      // Original counters should not be affected
      expect(metrics2.created).toBe(1);
      expect(ShortLinkMetricsService.getAll().created).toBe(1);
    });

    it("should include all incremented counters", () => {
      const keysToIncrement: ShortLinkMetricKey[] = [
        "created",
        "resolved_active",
        "resolved_expired",
        "resolved_not_found",
        "redirect_active",
        "redirect_expired",
        "redirect_not_found",
      ];

      keysToIncrement.forEach((key) => {
        ShortLinkMetricsService.increment(key);
      });

      const metrics = ShortLinkMetricsService.getAll();

      keysToIncrement.forEach((key) => {
        expect(metrics[key]).toBe(1);
      });
    });
  });

  describe("reset", () => {
    it("should clear all counters", () => {
      ShortLinkMetricsService.increment("created");
      ShortLinkMetricsService.increment("resolved_active");
      ShortLinkMetricsService.increment("redirect_not_found");

      ShortLinkMetricsService.reset();
      const metrics = ShortLinkMetricsService.getAll();

      expect(Object.keys(metrics)).toHaveLength(0);
    });

    it("should allow incrementing after reset", () => {
      ShortLinkMetricsService.increment("created");
      ShortLinkMetricsService.reset();
      ShortLinkMetricsService.increment("created");

      const metrics = ShortLinkMetricsService.getAll();

      expect(metrics.created).toBe(1);
    });

    it("should be idempotent (multiple resets have no effect)", () => {
      ShortLinkMetricsService.increment("created");
      ShortLinkMetricsService.reset();
      ShortLinkMetricsService.reset();
      ShortLinkMetricsService.reset();

      const metrics = ShortLinkMetricsService.getAll();

      expect(Object.keys(metrics)).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("should handle high volume of increments", () => {
      const iterations = 10000;
      for (let i = 0; i < iterations; i++) {
        ShortLinkMetricsService.increment("created");
      }

      const metrics = ShortLinkMetricsService.getAll();

      expect(metrics.created).toBe(iterations);
    });

    it("should handle rapid sequential operations", () => {
      // Simulate rapid operations
      ShortLinkMetricsService.increment("created");
      ShortLinkMetricsService.increment("resolved_active");
      ShortLinkMetricsService.getAll();
      ShortLinkMetricsService.increment("redirect_not_found");
      ShortLinkMetricsService.getAll();
      ShortLinkMetricsService.increment("created");

      const metrics = ShortLinkMetricsService.getAll();

      expect(metrics.created).toBe(2);
      expect(metrics.resolved_active).toBe(1);
      expect(metrics.redirect_not_found).toBe(1);
    });
  });
});
