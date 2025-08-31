import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../../../src/app";
import { createAdminToken } from "../../test-utils/createTestUser";

/**
 * Lightweight performance smoke tests for analytics export endpoints.
 * Goal: ensure endpoints respond within a reasonable envelope and
 *       capture baseline timings in test output for tracking.
 */
describe("Perf smoke: /api/analytics/export", () => {
  it("json export should respond quickly with defaults", async () => {
    const adminToken = await createAdminToken();

    const t0 = Date.now();
    const res = await request(app)
      .get("/api/analytics/export?format=json")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const ms = Date.now() - t0;

    // Basic content-type check
    expect(res.headers["content-type"]).toContain("application/json");

    // Soft performance budget (kept generous to avoid flakiness in CI/local):
    expect(ms).toBeLessThan(2500);

    // Emit a clear baseline line for later collection in logs
    // Example: PERF_BASELINE export_json_ms=123
    // Keep the key stable so downstream tooling can parse reliably
    // eslint-disable-next-line no-console
    console.info(`PERF_BASELINE export_json_ms=${ms}`);
  });

  it("xlsx export should respond within a generous budget (with range & row cap)", async () => {
    const adminToken = await createAdminToken();
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);

    const t0 = Date.now();
    const res = await request(app)
      .get(`/api/analytics/export?format=xlsx&from=${from}&to=${to}&maxRows=50`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const ms = Date.now() - t0;

    expect(res.headers["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    // XLSX involves workbook assembly; set a slightly larger soft budget
    expect(ms).toBeLessThan(3000);

    // eslint-disable-next-line no-console
    console.info(`PERF_BASELINE export_xlsx_ms=${ms}`);
  });
});
