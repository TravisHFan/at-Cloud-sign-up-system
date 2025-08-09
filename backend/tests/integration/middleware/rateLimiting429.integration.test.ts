import express from "express";
import request from "supertest";
import rateLimit from "express-rate-limit";
import { describe, it, expect } from "vitest";

// Focused 429 limiter test using an isolated tiny app (does not modify prod app)
describe("Rate limiting 429 integration (isolated app)", () => {
  it("returns 429 when exceeding max requests", async () => {
    const app = express();

    const limiter = rateLimit({
      windowMs: 500,
      max: 1,
      message: { error: "Too many requests" },
      standardHeaders: true,
      legacyHeaders: false,
      skip: () => false,
    });

    app.use("/limited", limiter, (_req, res) => res.json({ ok: true }));

    await request(app).get("/limited").expect(200);
    const res = await request(app).get("/limited").expect(429);
    expect(res.body).toEqual({ error: "Too many requests" });
  });
});
