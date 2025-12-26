/**
 * PublicAbuseMetricsService Unit Tests
 *
 * Tests lightweight in-memory counters for public endpoint abuse tracking.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PublicAbuseMetricsService } from "../../../src/services/PublicAbuseMetricsService";

describe("PublicAbuseMetricsService", () => {
  beforeEach(() => {
    // Reset counters before each test
    PublicAbuseMetricsService.reset();
  });

  describe("increment", () => {
    it("should increment registration_attempt counter", () => {
      PublicAbuseMetricsService.increment("registration_attempt");

      const counters = PublicAbuseMetricsService.getAll();
      expect(counters.registration_attempt).toBe(1);
    });

    it("should increment multiple times", () => {
      PublicAbuseMetricsService.increment("registration_attempt");
      PublicAbuseMetricsService.increment("registration_attempt");
      PublicAbuseMetricsService.increment("registration_attempt");

      const counters = PublicAbuseMetricsService.getAll();
      expect(counters.registration_attempt).toBe(3);
    });

    it("should track registration_block_rate_limit", () => {
      PublicAbuseMetricsService.increment("registration_block_rate_limit");

      const counters = PublicAbuseMetricsService.getAll();
      expect(counters.registration_block_rate_limit).toBe(1);
    });

    it("should track shortlink_create_attempt", () => {
      PublicAbuseMetricsService.increment("shortlink_create_attempt");

      const counters = PublicAbuseMetricsService.getAll();
      expect(counters.shortlink_create_attempt).toBe(1);
    });

    it("should track shortlink_create_block_rate_limit", () => {
      PublicAbuseMetricsService.increment("shortlink_create_block_rate_limit");

      const counters = PublicAbuseMetricsService.getAll();
      expect(counters.shortlink_create_block_rate_limit).toBe(1);
    });

    it("should track multiple different metrics independently", () => {
      PublicAbuseMetricsService.increment("registration_attempt");
      PublicAbuseMetricsService.increment("registration_attempt");
      PublicAbuseMetricsService.increment("shortlink_create_attempt");
      PublicAbuseMetricsService.increment("registration_block_rate_limit");

      const counters = PublicAbuseMetricsService.getAll();
      expect(counters.registration_attempt).toBe(2);
      expect(counters.shortlink_create_attempt).toBe(1);
      expect(counters.registration_block_rate_limit).toBe(1);
    });
  });

  describe("getAll", () => {
    it("should return empty object when no metrics", () => {
      const counters = PublicAbuseMetricsService.getAll();
      expect(Object.keys(counters).length).toBe(0);
    });

    it("should return a copy of counters (not reference)", () => {
      PublicAbuseMetricsService.increment("registration_attempt");

      const counters = PublicAbuseMetricsService.getAll();
      counters.registration_attempt = 999;

      // Original should be unchanged
      const freshCounters = PublicAbuseMetricsService.getAll();
      expect(freshCounters.registration_attempt).toBe(1);
    });
  });

  describe("reset", () => {
    it("should clear all counters", () => {
      PublicAbuseMetricsService.increment("registration_attempt");
      PublicAbuseMetricsService.increment("shortlink_create_attempt");

      PublicAbuseMetricsService.reset();

      const counters = PublicAbuseMetricsService.getAll();
      expect(Object.keys(counters).length).toBe(0);
    });

    it("should allow incrementing after reset", () => {
      PublicAbuseMetricsService.increment("registration_attempt");
      PublicAbuseMetricsService.reset();
      PublicAbuseMetricsService.increment("registration_attempt");

      const counters = PublicAbuseMetricsService.getAll();
      expect(counters.registration_attempt).toBe(1);
    });
  });
});
