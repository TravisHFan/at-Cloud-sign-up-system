import request from "supertest";
import { describe, it, beforeEach, expect } from "vitest";
import app from "../../../src/app";
import User from "../../../src/models/User";

describe("Analytics export endpoint", () => {
  let adminToken: string;

  beforeEach(async () => {
    await User.deleteMany({});

    const a = {
      username: "an_admin_export",
      email: "an_admin_export@example.com",
      password: "AdminPass123!",
      confirmPassword: "AdminPass123!",
      firstName: "Admin",
      lastName: "User",
      gender: "male",
      isAtCloudLeader: false,
      acceptTerms: true,
    };
    await request(app).post("/api/auth/register").send(a).expect(201);
    await User.findOneAndUpdate(
      { email: a.email },
      { isVerified: true, role: "Administrator" }
    );
    const la = await request(app)
      .post("/api/auth/login")
      .send({ emailOrUsername: a.email, password: a.password })
      .expect(200);
    adminToken = la.body.data.accessToken;
  });

  it("GET /api/analytics/export (json) with defaults -> 200", async () => {
    const res = await request(app)
      .get("/api/analytics/export?format=json")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(res.headers["content-type"]).toContain("application/json");
  });

  it("GET /api/analytics/export (xlsx) with range and row cap -> 200", async () => {
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/analytics/export?format=xlsx&from=${from}&to=${to}&maxRows=10`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(res.headers["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });
});
