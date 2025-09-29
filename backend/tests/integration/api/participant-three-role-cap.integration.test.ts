import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Event from "../../../src/models/Event";
import { buildValidEventPayload } from "../../test-utils/eventTestHelpers";
import mongoose from "mongoose";

// Integration test for new 3-role per-event cap.
// Expect: user can register for 3 distinct roles, 4th attempt rejected with 400.

describe("Participant three-role cap (policy update)", () => {
  let participantToken: string;
  let eventId: string;
  const roleIds: string[] = [];

  beforeAll(async () => {
    const uri =
      process.env.MONGO_URI || "mongodb://127.0.0.1:27017/atcloud-signup-test";
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri, { autoIndex: true });
    }
    // Diagnostic log sequence to help identify slow/stuck step in CI
    // (Hook timeout previously observed at 10s default)
    console.log("[three-role-cap] Clearing collections...");
    await User.deleteMany({});
    await Event.deleteMany({});

    console.log("[three-role-cap] Creating participant user...");

    console.log("[three-role-cap] Creating admin user...");
    await request(app)
      .post("/api/auth/register")
      .send({
        username: "cap_participant",
        email: "cap_participant@example.com",
        password: "Password123!",
        confirmPassword: "Password123!",
        firstName: "Cap",
        lastName: "Participant",
        role: "Participant",
        gender: "male",
        isAtCloudLeader: false,
        acceptTerms: true,
      })
      .expect(201);

    await User.updateOne(
      { email: "cap_participant@example.com" },
      { $set: { isVerified: true } }
    );

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        emailOrUsername: "cap_participant@example.com",
        password: "Password123!",
      })
      .expect(200);
    participantToken =
      loginRes.body?.data?.accessToken ||
      loginRes.body?.accessToken ||
      loginRes.body?.token;

    // Create admin to create event
    await request(app)
      .post("/api/auth/register")
      .send({
        username: "admincapper",
        email: "admin_capper@example.com",
        password: "Password123!",
        confirmPassword: "Password123!",
        firstName: "Admin",
        lastName: "Capper",
        role: "Administrator",
        gender: "male",
        isAtCloudLeader: false,
        acceptTerms: true,
      })
      .expect(201);

    // Force elevate to Administrator (registration defaults everyone to Participant)
    await User.updateOne(
      { email: "admin_capper@example.com" },
      { $set: { isVerified: true, role: "Administrator" } }
    );

    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({
        emailOrUsername: "admin_capper@example.com",
        password: "Password123!",
      })
      .expect(200);
    const adminToken =
      adminLogin.body?.data?.accessToken ||
      adminLogin.body?.accessToken ||
      adminLogin.body?.token;

    console.log("[three-role-cap] Building event payload...");
    const payload = buildValidEventPayload({
      title: "Three Role Cap Event",
      roles: [
        { name: "Role One", description: "R1", maxParticipants: 5 },
        { name: "Role Two", description: "R2", maxParticipants: 5 },
        { name: "Role Three", description: "R3", maxParticipants: 5 },
        { name: "Role Four", description: "R4", maxParticipants: 5 },
      ],
      overrides: { suppressNotifications: true },
    });

    console.log("[three-role-cap] Creating event via API...");
    const createRes = await request(app)
      .post(`/api/events`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);
    console.log(
      "[three-role-cap] Event created",
      createRes.body?.data?.event?.id
    );
    eventId = createRes.body.data.event.id;
    createRes.body.data.event.roles.forEach((r: any) => roleIds.push(r.id));
  }, 30000); // Extend hook timeout to 30s

  afterAll(async () => {
    await User.deleteMany({});
    await Event.deleteMany({});
    await mongoose.connection.close();
  });

  it("allows 3 distinct role registrations then blocks the 4th", async () => {
    // Roles 1-3 succeed
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post(`/api/events/${eventId}/register`)
        .set("Authorization", `Bearer ${participantToken}`)
        .send({ roleId: roleIds[i] })
        .expect(200);
      expect(res.body.success).toBe(true);
    }

    // 4th attempt rejected
    const resFourth = await request(app)
      .post(`/api/events/${eventId}/register`)
      .set("Authorization", `Bearer ${participantToken}`)
      .send({ roleId: roleIds[3] })
      .expect(400);
    expect(resFourth.body.message).toMatch(/Role limit reached/i);
  });
});
