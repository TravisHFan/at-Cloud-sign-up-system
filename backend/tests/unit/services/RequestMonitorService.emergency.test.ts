import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import RequestMonitorService from "../../../src/middleware/RequestMonitorService";

// Spy on fs appendFileSync to avoid real file writes
vi.spyOn(fs, "appendFileSync").mockImplementation(() => undefined);

describe("RequestMonitorService emergency rate limiting toggles", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.ENABLE_RATE_LIMITING;
    process.env.ENABLE_RATE_LIMITING = "true"; // reset to enabled
  });

  it("disables then re-enables rate limiting via emergency methods", () => {
    const svc = RequestMonitorService.getInstance();

    expect(svc.getRateLimitingStatus().enabled).toBe(true);

    svc.emergencyDisableRateLimit();
    expect(svc.getRateLimitingStatus()).toEqual({
      enabled: false,
      status: "emergency_disabled",
    });

    svc.emergencyEnableRateLimit();
    expect(svc.getRateLimitingStatus()).toEqual({
      enabled: true,
      status: "enabled",
    });
  });

  it("logs to alert file (appendFileSync called) on emergency disable/enable", () => {
    const svc = RequestMonitorService.getInstance();
    (fs.appendFileSync as any).mockClear();

    svc.emergencyDisableRateLimit();
    svc.emergencyEnableRateLimit();

    expect((fs.appendFileSync as any).mock.calls.length).toBeGreaterThanOrEqual(
      2
    );
  });

  afterEach(() => {
    process.env.ENABLE_RATE_LIMITING = originalEnv;
  });
});
