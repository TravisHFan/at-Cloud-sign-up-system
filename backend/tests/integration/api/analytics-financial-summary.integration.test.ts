import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import { createAndLoginTestUser } from "../../test-utils/createTestUser";

describe("GET /api/analytics/financial-summary - financial summary analytics", () => {
  it("rejects unauthenticated requests with 401", async () => {
    await request(app).get("/api/analytics/financial-summary").expect(401);
  });

  it("rejects users without required role with 403", async () => {
    const { token } = await createAndLoginTestUser({ role: "Participant" });

    await request(app)
      .get("/api/analytics/financial-summary")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("returns financial summary data for authorized user", async () => {
    const { token } = await createAndLoginTestUser({ role: "Administrator" });

    const res = await request(app)
      .get("/api/analytics/financial-summary")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        totalRevenue: expect.any(Number),
        totalTransactions: expect.any(Number),
        uniqueParticipants: expect.any(Number),
        growthRate: expect.any(Number),
        programs: expect.objectContaining({
          revenue: expect.any(Number),
          purchases: expect.any(Number),
          uniqueBuyers: expect.any(Number),
          last30Days: expect.objectContaining({
            revenue: expect.any(Number),
            purchases: expect.any(Number),
          }),
        }),
        donations: expect.objectContaining({
          revenue: expect.any(Number),
          gifts: expect.any(Number),
          uniqueDonors: expect.any(Number),
          last30Days: expect.objectContaining({
            revenue: expect.any(Number),
            donations: expect.any(Number),
          }),
        }),
        last30Days: expect.objectContaining({
          revenue: expect.any(Number),
          transactions: expect.any(Number),
          percentage: expect.any(Number),
        }),
      })
    );
  });

  it("allows Super Admin to access financial summary", async () => {
    const { token } = await createAndLoginTestUser({ role: "Super Admin" });

    const res = await request(app)
      .get("/api/analytics/financial-summary")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });
});
