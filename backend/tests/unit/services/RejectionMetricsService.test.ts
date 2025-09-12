import { describe, it, expect, beforeEach } from "vitest";
import { RejectionMetricsService } from "../../../src/services/RejectionMetricsService";

describe("RejectionMetricsService", () => {
  beforeEach(() => RejectionMetricsService.reset());

  it("increments and retrieves counters", () => {
    RejectionMetricsService.increment("success");
    RejectionMetricsService.increment("invalid");
    RejectionMetricsService.increment("invalid");
    const all = RejectionMetricsService.getAll();
    expect(all.success).toBe(1);
    expect(all.invalid).toBe(2);
  });

  it("resets counters", () => {
    RejectionMetricsService.increment("expired");
    RejectionMetricsService.reset();
    const all = RejectionMetricsService.getAll();
    expect(all.expired).toBeUndefined();
  });
});
