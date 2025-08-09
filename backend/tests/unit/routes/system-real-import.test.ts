import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import systemRouter from "../../../src/routes/system";

// Minimal app mounting the real system router to cover lines 19–26 in system.ts

describe("System router (real import)", () => {
  it("GET /api/v1/system/health responds with status and metrics", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/v1/system", systemRouter);

    const res = await request(app).get("/api/v1/system/health").expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("System is healthy");
    expect(typeof res.body.timestamp).toBe("string");
    expect(typeof res.body.uptime).toBe("number");
    expect(res.body.memory).toBeDefined();
  });
});
