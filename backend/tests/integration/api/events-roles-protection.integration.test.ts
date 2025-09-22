import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Event from "../../../src/models/Event";

describe("Events API — role deletion/capacity protections", () => {
  let adminToken: string;
  let userToken: string;
  let adminId: string;
  let userId: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Event.deleteMany({});

    // Admin
    const adminResp = await request(app).post("/api/auth/register").send({
      username: "admin",
      email: "admin@example.com",
      password: "AdminPass123!",
      confirmPassword: "AdminPass123!",
      firstName: "Admin",
      lastName: "User",
      role: "Administrator",
      gender: "male",
      isAtCloudLeader: false,
      acceptTerms: true,
    });
    await User.findOneAndUpdate(
      { email: "admin@example.com" },
      { isVerified: true, role: "Administrator" }
    );
    const adminLogin = await request(app).post("/api/auth/login").send({
      emailOrUsername: "admin@example.com",
      password: "AdminPass123!",
    });
    adminToken = adminLogin.body.data.accessToken;
    adminId = adminResp.body.data.user.id;

    // Regular user
    const userResp = await request(app).post("/api/auth/register").send({
      username: "user1",
      email: "user1@example.com",
      password: "UserPass123!",
      confirmPassword: "UserPass123!",
      firstName: "User",
      lastName: "One",
      role: "Participant",
      gender: "female",
      isAtCloudLeader: false,
      acceptTerms: true,
    });
    await User.findOneAndUpdate(
      { email: "user1@example.com" },
      { isVerified: true, role: "Participant" }
    );
    const userLogin = await request(app).post("/api/auth/login").send({
      emailOrUsername: "user1@example.com",
      password: "UserPass123!",
    });
    userToken = userLogin.body.data.accessToken;
    userId = userResp.body.data.user.id;
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Event.deleteMany({});
  });

  it("409 when deleting a role that has registrants", async () => {
    // Create event
    const create = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Protected Roles",
        description: "",
        date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        time: "10:00",
        endTime: "11:00",
        location: "Online",
        type: "Conference",
        format: "Online",
        timeZone: "America/Los_Angeles",
        roles: [
          { id: "r1", name: "Zoom Host", maxParticipants: 1 },
          { id: "r2", name: "Attendee", maxParticipants: 5 },
        ],
      });
    expect(create.status, JSON.stringify(create.body)).toBe(201);
    const eventId = create.body.data.event.id as string;

    // Register user into r2
    const reg = await request(app)
      .post(`/api/events/${eventId}/register`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ roleId: "r2" });
    expect(reg.status, JSON.stringify(reg.body)).toBe(200);

    // Attempt to update removing r2
    const update = await request(app)
      .put(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        roles: [{ id: "r1", name: "Zoom Host", maxParticipants: 1 }],
      });
    expect(update.status).toBe(409);
    expect(update.body).toMatchObject({
      success: false,
      message: expect.stringContaining("cannot be removed"),
      errors: expect.arrayContaining([
        expect.stringContaining('Cannot delete role "Attendee"'),
      ]),
    });
  });

  it("409 when reducing capacity below current registrations", async () => {
    const create = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Capacity Guard",
        description: "",
        date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        time: "12:00",
        endTime: "13:00",
        location: "Online",
        type: "Conference",
        format: "Online",
        timeZone: "America/Los_Angeles",
        roles: [{ id: "ra", name: "Attendee", maxParticipants: 2 }],
      });
    expect(create.status, JSON.stringify(create.body)).toBe(201);
    const eventId = create.body.data.event.id as string;

    // Register user into ra
    const reg = await request(app)
      .post(`/api/events/${eventId}/register`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ roleId: "ra" });
    expect(reg.status, JSON.stringify(reg.body)).toBe(200);

    // Attempt to reduce capacity below 1
    const update = await request(app)
      .put(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        roles: [{ id: "ra", name: "Attendee", maxParticipants: 0 }],
      });
    expect(update.status).toBe(409);
    expect(update.body).toMatchObject({
      success: false,
      message: expect.stringContaining("Capacity cannot be reduced"),
      errors: expect.arrayContaining([
        expect.stringContaining(
          'Cannot reduce capacity for role "Attendee" below 1'
        ),
      ]),
    });
  });
});
