import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../../src/app";
import User from "../../../src/models/User";

describe("Authorization wiring integration", () => {
  let participantToken: string;
  let adminToken: string;
  let superAdminToken: string;
  let participantId: string;

  beforeEach(async () => {
    await User.deleteMany({});

    // Create participant
    const userData = {
      username: "aw_participant",
      email: "aw_participant@example.com",
      password: "TestPass123!",
      confirmPassword: "TestPass123!",
      firstName: "Parti",
      lastName: "User",
      gender: "male",
      isAtCloudLeader: false,
      acceptTerms: true,
    };
    const regRes = await request(app)
      .post("/api/auth/register")
      .send(userData)
      .expect(201);
    participantId = regRes.body.data.user.id;
    await User.findOneAndUpdate(
      { email: userData.email },
      { isVerified: true }
    );
    const loginP = await request(app)
      .post("/api/auth/login")
      .send({ emailOrUsername: userData.email, password: userData.password })
      .expect(200);
    participantToken = loginP.body.data.accessToken;

    // Create admin
    const adminData = {
      username: "aw_admin",
      email: "aw_admin@example.com",
      password: "AdminPass123!",
      confirmPassword: "AdminPass123!",
      firstName: "Admin",
      lastName: "User",
      gender: "male",
      isAtCloudLeader: false,
      acceptTerms: true,
    };
    await request(app).post("/api/auth/register").send(adminData).expect(201);
    await User.findOneAndUpdate(
      { email: adminData.email },
      { isVerified: true, role: "Administrator" }
    );
    const loginA = await request(app)
      .post("/api/auth/login")
      .send({ emailOrUsername: adminData.email, password: adminData.password })
      .expect(200);
    adminToken = loginA.body.data.accessToken;

    // Create super admin
    const saData = {
      username: "aw_super",
      email: "aw_super@example.com",
      password: "SuperPass123!",
      confirmPassword: "SuperPass123!",
      firstName: "Super",
      lastName: "Admin",
      gender: "male",
      isAtCloudLeader: false,
      acceptTerms: true,
    };
    await request(app).post("/api/auth/register").send(saData).expect(201);
    await User.findOneAndUpdate(
      { email: saData.email },
      { isVerified: true, role: "Super Admin" }
    );
    const loginSA = await request(app)
      .post("/api/auth/login")
      .send({ emailOrUsername: saData.email, password: saData.password })
      .expect(200);
    superAdminToken = loginSA.body.data.accessToken;
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  describe("/api/v1/users/stats (permission-protected)", () => {
    it("returns 401 without token", async () => {
      await request(app).get("/api/v1/users/stats").expect(401);
    });

    it("returns 403 for participant token", async () => {
      const res = await request(app)
        .get("/api/v1/users/stats")
        .set("Authorization", `Bearer ${participantToken}`)
        .expect(403);
      expect(res.body).toMatchObject({ success: false });
    });

    it("returns 200 for admin token", async () => {
      const res = await request(app)
        .get("/api/v1/users/stats")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body).toMatchObject({ success: true });
    });
  });

  describe("/api/v1/users/:id/role (requireAdmin)", () => {
    it("returns 403 for participant token", async () => {
      const res = await request(app)
        .put(`/api/v1/users/${participantId}/role`)
        .set("Authorization", `Bearer ${participantToken}`)
        .send({ role: "Leader" })
        .expect(403);
      expect(res.body).toMatchObject({ success: false });
    });

    it("returns 200 for admin token", async () => {
      const res = await request(app)
        .put(`/api/v1/users/${participantId}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "Leader" })
        .expect(200);
      expect(res.body).toMatchObject({ success: true });
    });
  });

  describe("/api/v1/users/:id/deletion-impact (requireSuperAdmin)", () => {
    it("returns 403 for admin token", async () => {
      const targetId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/v1/users/${targetId}/deletion-impact`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(403);
      expect(res.body).toMatchObject({ success: false });
    });

    it("returns 200 for super admin token", async () => {
      // Use an existing user id so the service can compute deletion impact without 500
      const targetId = participantId;
      const res = await request(app)
        .get(`/api/v1/users/${targetId}/deletion-impact`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(200);
      expect(res.body).toMatchObject({ success: true });
    });
  });
});
