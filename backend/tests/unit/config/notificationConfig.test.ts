import { describe, it, expect, vi, beforeEach } from "vitest";

// Helper to import fresh module with controlled env
const importFresh = async () => {
  vi.resetModules();
  return await import("../../../src/config/notificationConfig");
};

describe("notificationConfig", () => {
  const envBackup = { ...process.env } as NodeJS.ProcessEnv;
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...envBackup };
  });

  it("validateConfig returns valid with sane env", async () => {
    process.env.EMAIL_TIMEOUT = "2000";
    process.env.DB_TIMEOUT = "1000";
    process.env.WS_TIMEOUT = "800";
    process.env.EMAIL_RETRIES = "3";
    process.env.DB_RETRIES = "2";
    process.env.WS_RETRIES = "3";
    process.env.METRICS_INTERVAL = "60000";
    process.env.ALERT_THRESHOLD = "0.9";

    const mod = await importFresh();

    const result = mod.validateConfig();
    expect(result.valid).toBe(true);
  });

  it("validateConfig returns invalid when retries/email is out of range", async () => {
    process.env.EMAIL_RETRIES = "0"; // invalid
    process.env.METRICS_INTERVAL = "60000";

    const mod = await importFresh();

    const result = mod.validateConfig();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes("Email retries"))).toBe(
      true
    );
  });

  it("ConfigManager.updateConfig supports success, validation rollback, bad path, and records history", async () => {
    process.env.EMAIL_RETRIES = "3";
    const mod = await importFresh();

    // success
    const ok = mod.ConfigManager.updateConfig("retries.email", 4, "test");
    expect(ok).toBe(true);
    expect(mod.ConfigManager.getUpdateHistory().length).toBeGreaterThanOrEqual(
      1
    );

    // validation rollback (set timeout too low)
    const bad = mod.ConfigManager.updateConfig(
      "timeouts.email",
      100,
      "too low"
    );
    expect(bad).toBe(false);

    // invalid path
    const badPath = mod.ConfigManager.updateConfig("unknown.path", 1, "nope");
    expect(badPath).toBe(false);

    // resetToDefaults just logs
    const logSpy = vi
      .spyOn(console, "log")
      .mockImplementation((..._args: any[]) => undefined);
    mod.ConfigManager.resetToDefaults();
    logSpy.mockRestore();
  });
});
