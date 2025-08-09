import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app";

describe("App and Routes smoke", () => {
  it("GET /health responds 200 with status payload", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "healthy");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("uptime");
  });

  it("GET /api/health responds 200 with API status payload", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: "@Cloud Sign-up System API is running",
    });
  });

  it("GET /api/v1 responds 200 with API info", async () => {
    const res = await request(app).get("/api/v1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("endpoints");
  });

  it("GET /api/unknown returns 404 from router fallback", async () => {
    const res = await request(app).get("/api/unknown");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("success", false);
  });
});
