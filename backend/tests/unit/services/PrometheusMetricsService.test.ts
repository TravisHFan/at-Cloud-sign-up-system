/**
 * PrometheusMetricsService Unit Tests
 *
 * Tests for the Prometheus metrics registration and exposition.
 * Verifies counters, histograms, and gauges are properly configured.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// We need to dynamically import to handle environment variable changes
describe("PrometheusMetricsService", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.ENABLE_PROMETHEUS;
  });

  describe("short link counters", () => {
    it("should export shortLinkCreatedCounter", async () => {
      const { shortLinkCreatedCounter } = await import(
        "../../../src/services/PrometheusMetricsService"
      );

      expect(shortLinkCreatedCounter).toBeDefined();
      expect(typeof shortLinkCreatedCounter.inc).toBe("function");
    });

    it("should export shortLinkResolveCounter with status label", async () => {
      const { shortLinkResolveCounter } = await import(
        "../../../src/services/PrometheusMetricsService"
      );

      expect(shortLinkResolveCounter).toBeDefined();
      expect(typeof shortLinkResolveCounter.inc).toBe("function");

      // Should be able to increment with status label
      shortLinkResolveCounter.inc({ status: "active" });
      shortLinkResolveCounter.inc({ status: "expired" });
      shortLinkResolveCounter.inc({ status: "not_found" });
    });

    it("should export shortLinkRedirectCounter with status label", async () => {
      const { shortLinkRedirectCounter } = await import(
        "../../../src/services/PrometheusMetricsService"
      );

      expect(shortLinkRedirectCounter).toBeDefined();
      expect(typeof shortLinkRedirectCounter.inc).toBe("function");

      // Should be able to increment with status label
      shortLinkRedirectCounter.inc({ status: "success" });
    });
  });

  describe("short link duration histogram", () => {
    it("should export shortLinkResolveDuration histogram", async () => {
      const { shortLinkResolveDuration } = await import(
        "../../../src/services/PrometheusMetricsService"
      );

      expect(shortLinkResolveDuration).toBeDefined();
      expect(typeof shortLinkResolveDuration.observe).toBe("function");
    });

    it("should accept observations with status label", async () => {
      const { shortLinkResolveDuration } = await import(
        "../../../src/services/PrometheusMetricsService"
      );

      // Should not throw
      shortLinkResolveDuration.observe({ status: "active" }, 0.05);
      shortLinkResolveDuration.observe({ status: "expired" }, 0.1);
    });
  });

  describe("short link cache metrics", () => {
    it("should export shortLinkCacheHitCounter with type label", async () => {
      const { shortLinkCacheHitCounter } = await import(
        "../../../src/services/PrometheusMetricsService"
      );

      expect(shortLinkCacheHitCounter).toBeDefined();
      expect(typeof shortLinkCacheHitCounter.inc).toBe("function");

      shortLinkCacheHitCounter.inc({ type: "positive" });
      shortLinkCacheHitCounter.inc({ type: "negative" });
    });

    it("should export shortLinkCacheMissCounter", async () => {
      const { shortLinkCacheMissCounter } = await import(
        "../../../src/services/PrometheusMetricsService"
      );

      expect(shortLinkCacheMissCounter).toBeDefined();
      expect(typeof shortLinkCacheMissCounter.inc).toBe("function");
    });

    it("should export shortLinkCacheEvictionCounter", async () => {
      const { shortLinkCacheEvictionCounter } = await import(
        "../../../src/services/PrometheusMetricsService"
      );

      expect(shortLinkCacheEvictionCounter).toBeDefined();
      expect(typeof shortLinkCacheEvictionCounter.inc).toBe("function");
    });

    it("should export shortLinkCacheStaleEvictionCounter with reason label", async () => {
      const { shortLinkCacheStaleEvictionCounter } = await import(
        "../../../src/services/PrometheusMetricsService"
      );

      expect(shortLinkCacheStaleEvictionCounter).toBeDefined();
      expect(typeof shortLinkCacheStaleEvictionCounter.inc).toBe("function");

      shortLinkCacheStaleEvictionCounter.inc({ reason: "expired_lifecycle" });
    });

    it("should export shortLinkCacheEntriesGauge", async () => {
      const { shortLinkCacheEntriesGauge } = await import(
        "../../../src/services/PrometheusMetricsService"
      );

      expect(shortLinkCacheEntriesGauge).toBeDefined();
      expect(typeof shortLinkCacheEntriesGauge.set).toBe("function");
      expect(typeof shortLinkCacheEntriesGauge.inc).toBe("function");
      expect(typeof shortLinkCacheEntriesGauge.dec).toBe("function");

      // Test gauge operations
      shortLinkCacheEntriesGauge.set(10);
      shortLinkCacheEntriesGauge.inc();
      shortLinkCacheEntriesGauge.dec();
    });
  });

  describe("registration metrics", () => {
    it("should export registrationAttemptCounter", async () => {
      const { registrationAttemptCounter } = await import(
        "../../../src/services/PrometheusMetricsService"
      );

      expect(registrationAttemptCounter).toBeDefined();
      expect(typeof registrationAttemptCounter.inc).toBe("function");
    });

    it("should export registrationFailureCounter with reason label", async () => {
      const { registrationFailureCounter } = await import(
        "../../../src/services/PrometheusMetricsService"
      );

      expect(registrationFailureCounter).toBeDefined();
      expect(typeof registrationFailureCounter.inc).toBe("function");

      registrationFailureCounter.inc({ reason: "capacity_exceeded" });
      registrationFailureCounter.inc({ reason: "invalid_role" });
    });
  });

  describe("short link create metrics", () => {
    it("should export shortLinkCreateAttemptCounter", async () => {
      const { shortLinkCreateAttemptCounter } = await import(
        "../../../src/services/PrometheusMetricsService"
      );

      expect(shortLinkCreateAttemptCounter).toBeDefined();
      expect(typeof shortLinkCreateAttemptCounter.inc).toBe("function");
    });

    it("should export shortLinkCreateFailureCounter with reason label", async () => {
      const { shortLinkCreateFailureCounter } = await import(
        "../../../src/services/PrometheusMetricsService"
      );

      expect(shortLinkCreateFailureCounter).toBeDefined();
      expect(typeof shortLinkCreateFailureCounter.inc).toBe("function");

      shortLinkCreateFailureCounter.inc({ reason: "db_error" });
    });

    it("should export shortLinkExpireCounter", async () => {
      const { shortLinkExpireCounter } = await import(
        "../../../src/services/PrometheusMetricsService"
      );

      expect(shortLinkExpireCounter).toBeDefined();
      expect(typeof shortLinkExpireCounter.inc).toBe("function");
    });
  });

  describe("getMetrics", () => {
    it("should return metrics text when Prometheus is enabled", async () => {
      process.env.ENABLE_PROMETHEUS = "true";
      vi.resetModules();

      const { getMetrics, isPromEnabled } = await import(
        "../../../src/services/PrometheusMetricsService"
      );

      expect(isPromEnabled()).toBe(true);

      const metricsText = await getMetrics();

      expect(typeof metricsText).toBe("string");
      // Should contain some metric definitions
      expect(metricsText.length).toBeGreaterThan(0);
    });

    it("should return empty string when Prometheus is disabled", async () => {
      process.env.ENABLE_PROMETHEUS = "false";
      vi.resetModules();

      const { getMetrics, isPromEnabled } = await import(
        "../../../src/services/PrometheusMetricsService"
      );

      expect(isPromEnabled()).toBe(false);

      const metricsText = await getMetrics();

      expect(metricsText).toBe("");
    });
  });

  describe("isPromEnabled", () => {
    it("should return true when ENABLE_PROMETHEUS is not set", async () => {
      delete process.env.ENABLE_PROMETHEUS;
      vi.resetModules();

      const { isPromEnabled } = await import(
        "../../../src/services/PrometheusMetricsService"
      );

      // Default behavior: enabled when not explicitly disabled
      expect(isPromEnabled()).toBe(true);
    });

    it("should return true when ENABLE_PROMETHEUS is 'true'", async () => {
      process.env.ENABLE_PROMETHEUS = "true";
      vi.resetModules();

      const { isPromEnabled } = await import(
        "../../../src/services/PrometheusMetricsService"
      );

      expect(isPromEnabled()).toBe(true);
    });

    it("should return false when ENABLE_PROMETHEUS is 'false'", async () => {
      process.env.ENABLE_PROMETHEUS = "false";
      vi.resetModules();

      const { isPromEnabled } = await import(
        "../../../src/services/PrometheusMetricsService"
      );

      expect(isPromEnabled()).toBe(false);
    });
  });

  describe("prometheusRegistry", () => {
    it("should export the registry for external use", async () => {
      const { prometheusRegistry } = await import(
        "../../../src/services/PrometheusMetricsService"
      );

      expect(prometheusRegistry).toBeDefined();
      expect(typeof prometheusRegistry.metrics).toBe("function");
    });
  });
});
