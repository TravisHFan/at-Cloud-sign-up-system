import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import { createAndLoginTestUser } from "../../test-utils/createTestUser";

describe("GET /api/analytics/donations - donation analytics", () => {
  it("rejects unauthenticated requests with 401", async () => {
    await request(app).get("/api/analytics/donations").expect(401);
  });

  it("rejects users without required role with 403", async () => {
    const { token } = await createAndLoginTestUser({ role: "Participant" });

    await request(app)
      .get("/api/analytics/donations")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("returns donation analytics data for authorized user", async () => {
    const { token } = await createAndLoginTestUser({ role: "Administrator" });

    const res = await request(app)
      .get("/api/analytics/donations")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        totalRevenue: expect.any(Number),
        totalGifts: expect.any(Number),
        uniqueDonors: expect.any(Number),
        avgGiftsPerDonor: expect.any(Number),
        retentionRate: expect.any(Number),
        oneTime: expect.objectContaining({
          revenue: expect.any(Number),
          gifts: expect.any(Number),
          avgGiftSize: expect.any(Number),
        }),
        recurring: expect.objectContaining({
          revenue: expect.any(Number),
          gifts: expect.any(Number),
          avgGiftSize: expect.any(Number),
          activeDonations: expect.any(Number),
          scheduledDonations: expect.any(Number),
          onHoldDonations: expect.any(Number),
          activeRecurringRevenue: expect.any(Number),
          frequencyBreakdown: expect.any(Array),
        }),
      })
    );
  });

  it("allows Super Admin to access donation analytics", async () => {
    const { token } = await createAndLoginTestUser({ role: "Super Admin" });

    const res = await request(app)
      .get("/api/analytics/donations")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });
});
