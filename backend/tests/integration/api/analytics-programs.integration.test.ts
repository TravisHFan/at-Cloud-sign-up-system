import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import { createAndLoginTestUser } from "../../test-utils/createTestUser";

describe("GET /api/analytics/programs - program analytics", () => {
  it("rejects unauthenticated requests with 401", async () => {
    await request(app).get("/api/analytics/programs").expect(401);
  });

  it("rejects users without required role with 403", async () => {
    const { token } = await createAndLoginTestUser({ role: "Participant" });

    await request(app)
      .get("/api/analytics/programs")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("returns program analytics data for authorized user", async () => {
    const { token } = await createAndLoginTestUser({ role: "Administrator" });

    const res = await request(app)
      .get("/api/analytics/programs")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        totalRevenue: expect.any(Number),
        totalPurchases: expect.any(Number),
        programTypeBreakdown: expect.any(Array),
        classRepPurchases: expect.any(Number),
        earlyBirdPurchases: expect.any(Number),
        last30Days: expect.objectContaining({
          purchases: expect.any(Number),
          revenue: expect.any(Number),
        }),
      })
    );
  });

  it("allows Super Admin to access program analytics", async () => {
    const { token } = await createAndLoginTestUser({ role: "Super Admin" });

    const res = await request(app)
      .get("/api/analytics/programs")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });
});
