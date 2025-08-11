import { describe, it, expect, vi, beforeEach } from "vitest";

// Helper to import fresh module with controlled env
const importFresh = async () => {
  vi.resetModules();
  return await import("../../../src/config/notificationConfig");
};

describe("notificationConfig more branches", () => {
  const envBackup = { ...process.env } as NodeJS.ProcessEnv;
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...envBackup };
  });

  it("validateConfig flags too-low timeouts for email/database/websocket", async () => {
    process.env.EMAIL_TIMEOUT = "999"; // < 1000 invalid
    process.env.DB_TIMEOUT = "499"; // < 500 invalid
    process.env.WS_TIMEOUT = "499"; // < 500 invalid
    // Keep other critical values sane to avoid extra noise
    process.env.EMAIL_RETRIES = "3";
    process.env.DB_RETRIES = "2";
    process.env.WS_RETRIES = "3";
    process.env.METRICS_INTERVAL = "60000";

    const mod = await importFresh();
    const result = mod.validateConfig();
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Email timeout must be at least 1000ms",
        "Database timeout must be at least 500ms",
        "WebSocket timeout must be at least 500ms",
      ])
    );
  });

  it("validateConfig flags retry ranges for email/db/ws when out of bounds", async () => {
    process.env.EMAIL_RETRIES = "11"; // > 10 invalid
    process.env.DB_RETRIES = "0"; // < 1 invalid
    process.env.WS_RETRIES = "0"; // < 1 invalid
    // Ensure timeouts/monitoring are valid to isolate retry failures
    process.env.EMAIL_TIMEOUT = "2000";
    process.env.DB_TIMEOUT = "1000";
    process.env.WS_TIMEOUT = "800";
    process.env.METRICS_INTERVAL = "60000";

    const mod = await importFresh();
    const result = mod.validateConfig();
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Email retries must be between 1 and 10",
        "Database retries must be between 1 and 5",
        "WebSocket retries must be between 1 and 10",
      ])
    );
  });

  it("validateConfig flags monitoring bounds and intervals", async () => {
    process.env.ALERT_THRESHOLD = "1.1"; // > 1 invalid
    process.env.METRICS_INTERVAL = "5000"; // < 10000 invalid
    // Keep timeouts/retries valid
    process.env.EMAIL_TIMEOUT = "2000";
    process.env.DB_TIMEOUT = "1000";
    process.env.WS_TIMEOUT = "800";
    process.env.EMAIL_RETRIES = "3";
    process.env.DB_RETRIES = "2";
    process.env.WS_RETRIES = "3";

    const mod = await importFresh();
    const result = mod.validateConfig();
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Alert threshold must be between 0 and 1",
        "Metrics interval must be at least 10 seconds",
      ])
    );
  });

  it("validateConfig flags performance limits (maxConcurrentTrios/batchSize) when < 1", async () => {
    process.env.MAX_CONCURRENT_TRIOS = "0"; // invalid
    process.env.BATCH_SIZE = "0"; // invalid
    // Keep other values valid
    process.env.EMAIL_TIMEOUT = "2000";
    process.env.DB_TIMEOUT = "1000";
    process.env.WS_TIMEOUT = "800";
    process.env.EMAIL_RETRIES = "3";
    process.env.DB_RETRIES = "2";
    process.env.WS_RETRIES = "3";
    process.env.METRICS_INTERVAL = "60000";

    const mod = await importFresh();
    const result = mod.validateConfig();
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Max concurrent trios must be at least 1",
        "Batch size must be at least 1",
      ])
    );
  });

  it("ConfigManager.updateConfig returns false for invalid last key under a valid path", async () => {
    const mod = await importFresh();
    const ok = mod.ConfigManager.updateConfig("timeouts.unknown", 123, "nope");
    expect(ok).toBe(false);
  });

  it("ConfigManager.updateConfig records default reason when omitted", async () => {
    process.env.EMAIL_RETRIES = "3";
    const mod = await importFresh();
    const ok = mod.ConfigManager.updateConfig("retries.email", 5);
    expect(ok).toBe(true);
    const history = mod.ConfigManager.getUpdateHistory();
    const last = history[history.length - 1];
    expect(last).toBeDefined();
    expect(last.reason).toBe("Runtime update");
  });
});
