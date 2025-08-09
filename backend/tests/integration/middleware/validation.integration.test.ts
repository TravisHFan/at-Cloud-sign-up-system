import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import User from "../../../src/models/User";

describe("Validation middleware integration", () => {
  let authToken: string | undefined;

  beforeEach(async () => {
    await User.deleteMany({});
    authToken = undefined;
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  const registerAndLogin = async () => {
    const userData = {
      username: "valtestuser",
      email: "valtest@example.com",
      password: "ValTestPass123!",
      confirmPassword: "ValTestPass123!",
      firstName: "Val",
      lastName: "User",
      gender: "male",
      isAtCloudLeader: false,
      acceptTerms: true,
    };

    await request(app).post("/api/auth/register").send(userData).expect(201);
    // Mark verified to allow login
    await User.findOneAndUpdate(
      { email: userData.email },
      { isVerified: true }
    );

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ emailOrUsername: userData.email, password: userData.password })
      .expect(200);

    return loginRes.body.data.accessToken as string;
  };

  it("POST /api/auth/register -> 400 with errors on invalid body", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        username: "a", // too short
        email: "not-an-email",
        password: "weak",
        confirmPassword: "weak",
        firstName: "",
        lastName: "",
        gender: "other",
        isAtCloudLeader: "no",
      })
      .expect(400);

    expect(res.body).toMatchObject({
      success: false,
      message: "Validation failed",
      errors: expect.any(Array),
    });
  });

  it("POST /api/auth/login -> 400 when password missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ emailOrUsername: "someone" })
      .expect(400);

    expect(res.body).toMatchObject({
      success: false,
      message: "Validation failed",
      errors: expect.arrayContaining([
        expect.objectContaining({ path: "password" }),
      ]),
    });
  });

  it("GET /api/v1/users/:id -> 400 on invalid ObjectId", async () => {
    authToken = await registerAndLogin();

    const res = await request(app)
      .get("/api/v1/users/not-a-valid-objectid")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(400);

    expect(res.body).toMatchObject({
      success: false,
      message: "Validation failed",
      errors: expect.arrayContaining([expect.objectContaining({ path: "id" })]),
    });
  });

  it("GET /api/v1/search/users -> 400 when q too short", async () => {
    authToken = await registerAndLogin();

    const res = await request(app)
      .get("/api/v1/search/users?q=a")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(400);

    expect(res.body).toMatchObject({
      success: false,
      message: "Validation failed",
      errors: expect.arrayContaining([expect.objectContaining({ path: "q" })]),
    });
  });

  it("POST /api/v1/events -> 400 on invalid body (validation runs before role)", async () => {
    authToken = await registerAndLogin();

    const res = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${authToken}`)
      .send({})
      .expect(400);

    expect(res.body).toMatchObject({
      success: false,
      message: "Validation failed",
      errors: expect.any(Array),
    });
  });

  it("POST /api/v1/notifications/system -> 400 on missing required fields", async () => {
    authToken = await registerAndLogin();

    const res = await request(app)
      .post("/api/v1/notifications/system")
      .set("Authorization", `Bearer ${authToken}`)
      .send({})
      .expect(400);

    expect(res.body).toMatchObject({
      success: false,
      message: "Validation failed",
      errors: expect.any(Array),
    });
  });
});
