import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../../../src/app";

describe("System health (ops)", () => {
  it("GET /api/system/health returns lock diagnostics and uptime", async () => {
    const res = await request(app).get("/api/system/health").expect(200);

    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("uptime");
    expect(typeof res.body.uptime).toBe("number");

    expect(res.body).toHaveProperty("lock");
    expect(res.body.lock).toHaveProperty("implementation");
    expect(typeof res.body.lock.implementation).toBe("string");
    expect(res.body.lock).toHaveProperty("singleInstanceRequired");
    expect(typeof res.body.lock.singleInstanceRequired).toBe("boolean");
    expect(res.body.lock).toHaveProperty("inferredConcurrency");
    expect(typeof res.body.lock.inferredConcurrency).toBe("number");
    expect(res.body.lock).toHaveProperty("enforce");
    expect(typeof res.body.lock.enforce).toBe("boolean");
  });
});
