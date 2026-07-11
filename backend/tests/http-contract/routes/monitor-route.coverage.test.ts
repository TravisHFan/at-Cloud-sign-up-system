import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const getStats = vi.fn();
const emergencyDisableRateLimit = vi.fn();
const emergencyEnableRateLimit = vi.fn();
const getRateLimitingStatus = vi.fn(() => ({ enabled: true }));

vi.mock("../../../src/middleware/RequestMonitorService", () => ({
  default: {
    getInstance: () => ({
      getStats,
      emergencyDisableRateLimit,
      emergencyEnableRateLimit,
      getRateLimitingStatus,
    }),
  },
}));

// Mock auth middlewares to no-op so we can directly test route logic without auth concerns
vi.mock("../../../src/middleware/auth", () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

import monitorRouter from "../../../src/routes/monitor";

const makeApp = () => {
  const app = express();
  app.use("/", monitorRouter);
  return app;
};

describe("monitor routes coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /stats returns stats", async () => {
    getStats.mockReturnValueOnce({
      requestsPerSecond: 1,
      totalRequestsLastMinute: 10,
      suspiciousPatterns: [],
    });
    const res = await request(makeApp()).get("/stats");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  it("POST /emergency-disable toggles and returns ok", async () => {
    const res = await request(makeApp()).post("/emergency-disable");
    expect(res.status).toBe(200);
    expect(emergencyDisableRateLimit).toHaveBeenCalled();
  });

  it("POST /emergency-enable toggles and returns ok", async () => {
    const res = await request(makeApp()).post("/emergency-enable");
    expect(res.status).toBe(200);
    expect(emergencyEnableRateLimit).toHaveBeenCalled();
  });

  it("GET /rate-limiting-status returns status", async () => {
    const res = await request(makeApp()).get("/rate-limiting-status");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  it("GET /health evaluates isHealthy logic and returns payload", async () => {
    getStats.mockReturnValueOnce({
      requestsPerSecond: 10,
      totalRequestsLastMinute: 100,
      suspiciousPatterns: [],
    });
    const res = await request(makeApp()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(typeof res.body.healthy).toBe("boolean");
  });

  it("GET /stats returns 500 on error", async () => {
    getStats.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const res = await request(makeApp()).get("/stats");
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false });
  });

  it("POST /emergency-disable returns 500 on error", async () => {
    emergencyDisableRateLimit.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const res = await request(makeApp()).post("/emergency-disable");
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false });
  });

  it("POST /emergency-enable returns 500 on error", async () => {
    emergencyEnableRateLimit.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const res = await request(makeApp()).post("/emergency-enable");
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false });
  });

  it("GET /rate-limiting-status returns 500 on error", async () => {
    getRateLimitingStatus.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const res = await request(makeApp()).get("/rate-limiting-status");
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false });
  });

  it("GET /health returns 500 when getStats throws", async () => {
    getStats.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const res = await request(makeApp()).get("/health");
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false });
  });
});
