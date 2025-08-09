import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock auth middlewares to no-op
vi.mock("../../../src/middleware/auth", () => ({
  authenticate: (req: any, res: any, next: any) => next(),
  requireAdmin: (req: any, res: any, next: any) => next(),
}));

// Mock services.lockService
const mockGetLockStats = vi.fn();
vi.mock("../../../src/services", () => ({
  lockService: { getLockStats: (...args: any[]) => mockGetLockStats(...args) },
}));

// Import router after mocks
import systemRouter from "../../../src/routes/system";

const makeApp = () => {
  const app = express();
  app.use("/", systemRouter);
  return app;
};

describe("system routes coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /locks success with performance and recommendations branches", async () => {
    mockGetLockStats.mockReturnValueOnce({
      totalLocks: 10,
      activeLocks: 7,
      averageWaitTime: 150.1234, // > 100 to trigger recommendations branch
    });

    const res = await request(makeApp()).get("/locks");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(res.body.data).toHaveProperty("performance");
    expect(res.body.data.performance.efficiency).toBe("high_contention");
    expect(Array.isArray(res.body.data.recommendations)).toBe(true);
  });

  it("GET /locks handles service error with 500", async () => {
    mockGetLockStats.mockImplementationOnce(() => {
      throw new Error("svc down");
    });

    const res = await request(makeApp()).get("/locks");
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false });
  });

  it("GET /locks efficiency is good when activeLocks <= 5", async () => {
    mockGetLockStats.mockReturnValueOnce({
      totalLocks: 3,
      activeLocks: 5,
      averageWaitTime: 120, // > 100 still gives recommendations
    });
    const res = await request(makeApp()).get("/locks");
    expect(res.status).toBe(200);
    expect(res.body.data.performance.efficiency).toBe("good");
  });

  it("GET /locks efficiency is optimal when activeLocks = 0 and low wait triggers optimal-recommendation path", async () => {
    mockGetLockStats.mockReturnValueOnce({
      totalLocks: 0,
      activeLocks: 0,
      averageWaitTime: 50, // <= 100, alternate recommendations branch
    });
    const res = await request(makeApp()).get("/locks");
    expect(res.status).toBe(200);
    expect(res.body.data.performance.efficiency).toBe("optimal");
    expect(res.body.data.recommendations).toEqual([
      "System performing optimally",
    ]);
  });
});
