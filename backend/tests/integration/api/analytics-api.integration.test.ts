import request from "supertest";
import { describe, it, beforeEach, afterEach, expect } from "vitest";
import app from "../../../src/app";
import User from "../../../src/models/User";

describe("Analytics API integration", () => {
  let participantToken: string;
  let adminToken: string;

  beforeEach(async () => {
    await User.deleteMany({});

    // participant
    const p = {
      username: "an_participant",
      email: "an_participant@example.com",
      password: "Passw0rd!",
      confirmPassword: "Passw0rd!",
      firstName: "Parti",
      lastName: "User",
      gender: "male",
      isAtCloudLeader: false,
      acceptTerms: true,
    };
    await request(app).post("/api/auth/register").send(p).expect(201);
    await User.findOneAndUpdate({ email: p.email }, { isVerified: true });
    const lp = await request(app)
      .post("/api/auth/login")
      .send({ emailOrUsername: p.email, password: p.password })
      .expect(200);
    participantToken = lp.body.data.accessToken;

    // admin
    const a = {
      username: "an_admin",
      email: "an_admin@example.com",
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

  afterEach(async () => {
    await User.deleteMany({});
  });

  it("GET /api/v1/analytics -> 401 without token", async () => {
    await request(app).get("/api/v1/analytics").expect(401);
  });

  it("GET /api/v1/analytics -> 403 for participant", async () => {
    const res = await request(app)
      .get("/api/v1/analytics")
      .set("Authorization", `Bearer ${participantToken}`)
      .expect(403);
    expect(res.body.success).toBe(false);
  });

  it("GET /api/v1/analytics -> 200 for admin", async () => {
    const res = await request(app)
      .get("/api/v1/analytics")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toMatchObject({ success: true });
  });

  it("GET /api/v1/analytics/users -> 200 for admin", async () => {
    const res = await request(app)
      .get("/api/v1/analytics/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.success).toBe(true);
  });

  it("GET /api/v1/analytics/events -> 200 for admin", async () => {
    const res = await request(app)
      .get("/api/v1/analytics/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.success).toBe(true);
  });
});
