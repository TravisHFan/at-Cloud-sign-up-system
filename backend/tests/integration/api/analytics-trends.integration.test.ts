import request from "supertest";
import app from "../../../src/app";
import { createAndLoginTestUser } from "../../test-utils/createTestUser";

describe("GET /api/analytics/trends - financial trends analytics", () => {
  it("rejects unauthenticated requests with 401", async () => {
    await request(app).get("/api/analytics/trends").expect(401);
  });

  it("rejects users without required role with 403", async () => {
    const { token } = await createAndLoginTestUser({ role: "Participant" });

    await request(app)
      .get("/api/analytics/trends")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("returns trends data for authorized user with default 6months period", async () => {
    const { token } = await createAndLoginTestUser({ role: "Administrator" });

    const res = await request(app)
      .get("/api/analytics/trends")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        period: "6months",
        startDate: expect.any(String),
        endDate: expect.any(String),
        labels: expect.any(Array),
        programRevenue: expect.any(Array),
        donationRevenue: expect.any(Array),
        combinedRevenue: expect.any(Array),
      })
    );
  });

  it("respects period query parameter (12months)", async () => {
    const { token } = await createAndLoginTestUser({ role: "Super Admin" });

    const res = await request(app)
      .get("/api/analytics/trends")
      .set("Authorization", `Bearer ${token}`)
      .query({ period: "12months" })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.period).toBe("12months");
  });

  it("handles invalid period parameter without error", async () => {
    const { token } = await createAndLoginTestUser({ role: "Administrator" });

    const res = await request(app)
      .get("/api/analytics/trends")
      .set("Authorization", `Bearer ${token}`)
      .query({ period: "not-a-valid-period" })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        period: "not-a-valid-period",
        labels: expect.any(Array),
        programRevenue: expect.any(Array),
        donationRevenue: expect.any(Array),
        combinedRevenue: expect.any(Array),
      })
    );
  });
});
