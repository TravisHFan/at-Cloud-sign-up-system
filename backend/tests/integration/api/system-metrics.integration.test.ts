import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../../../src/app";

describe("System metrics (ops)", () => {
  it("GET /api/system/metrics returns PII-safe stats snapshot", async () => {
    const res = await request(app).get("/api/system/metrics").expect(200);

    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("uptime");

    // requests summary
    expect(res.body).toHaveProperty("requests");
    expect(res.body.requests).toHaveProperty("perSecond");
    expect(res.body.requests).toHaveProperty("lastMinute");
    expect(res.body.requests).toHaveProperty("lastHour");

    // uniques (Phase 6 enrichment)
    expect(res.body).toHaveProperty("uniques");
    expect(res.body.uniques).toHaveProperty("ipsLastHour");
    expect(res.body.uniques).toHaveProperty("userAgentsLastHour");
    expect(typeof res.body.uniques.ipsLastHour).toBe("number");
    expect(typeof res.body.uniques.userAgentsLastHour).toBe("number");

    // errors (Phase 6 enrichment)
    expect(res.body).toHaveProperty("errors");
    expect(res.body.errors).toHaveProperty("lastHour");
    expect(res.body.errors).toHaveProperty("rateLastHour");
    expect(typeof res.body.errors.lastHour).toBe("number");
    expect(typeof res.body.errors.rateLastHour).toBe("number");

    // endpointsTop5 array with safe fields
    expect(Array.isArray(res.body.endpointsTop5)).toBe(true);
    if (res.body.endpointsTop5.length > 0) {
      const e = res.body.endpointsTop5[0];
      expect(e).toHaveProperty("endpoint");
      expect(e).toHaveProperty("count");
      expect(e).toHaveProperty("averageResponseTime");
      expect(e).toHaveProperty("errorCount");
      // No PII fields allowed
      expect(e).not.toHaveProperty("userId");
      expect(e).not.toHaveProperty("ip");
      expect(e).not.toHaveProperty("userAgent");
    }

    expect(typeof res.body.suspiciousPatterns).toBe("number");
  });
});
