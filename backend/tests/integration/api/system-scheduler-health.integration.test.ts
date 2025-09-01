import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../../../src/app";

describe("System scheduler health", () => {
  it("GET /api/system/scheduler returns status payload", async () => {
    const res = await request(app).get("/api/system/scheduler").expect(200);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("status");
    expect(res.body.status).toHaveProperty("isRunning");
  });
});
