import request from "supertest";
import { describe, it, beforeEach, afterEach, expect } from "vitest";
import app from "../../../src/app";
import User from "../../../src/models/User";

// Note: validation middleware already covered; here we do happy paths and auth behavior

// Run this suite sequentially to avoid concurrent beforeEach collisions
describe.sequential("Search API integration", () => {
  let token: string;
  // Track the unique email pattern we generate so cleanup is scoped and safe for parallel suites
  const emailPrefix = "srch_user_";

  beforeEach(async () => {
    // Only delete users created by this spec to avoid cross-file interference
    await User.deleteMany({ email: { $regex: `^${emailPrefix}` } });

    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const u = {
      username: `${emailPrefix}${suffix}`,
      email: `${emailPrefix}${suffix}@example.com`,
      password: "Passw0rd!",
      confirmPassword: "Passw0rd!",
      firstName: "Search",
      lastName: "User",
      gender: "female",
      isAtCloudLeader: false,
      acceptTerms: true,
    };
    await request(app).post("/api/auth/register").send(u).expect(201);
    await User.findOneAndUpdate({ email: u.email }, { isVerified: true });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ emailOrUsername: u.email, password: u.password })
      .expect(200);
    token = login.body.data.accessToken;
  });

  afterEach(async () => {
    // Clean up only users created by this spec
    await User.deleteMany({ email: { $regex: `^${emailPrefix}` } });
  });

  it("users: 401 without token", async () => {
    await request(app).get("/api/search/users?q=sea").expect(401);
  });

  it("users: 200 with token", async () => {
    const res = await request(app)
      .get("/api/search/users?q=sea")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("users");
  });

  it("events: 200 with token", async () => {
    const res = await request(app)
      .get("/api/search/events?q=event")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("events");
  });

  it("global: 200 with token", async () => {
    const res = await request(app)
      .get("/api/search/global?q=all")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("users");
    expect(res.body.data).toHaveProperty("events");
  });
});
