import request from "supertest";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import mongoose from "mongoose";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Event from "../../../src/models/Event";

async function createAdminAndLogin() {
  const admin = {
    username: "autounpubadmin",
    email: "autounpubadmin@example.com",
    password: "AdminPass123!",
    confirmPassword: "AdminPass123!",
    firstName: "Auto",
    lastName: "Unpub",
    role: "Administrator",
    gender: "male",
    isAtCloudLeader: false,
    acceptTerms: true,
  } as const;
  await request(app).post("/api/auth/register").send(admin);
  await User.findOneAndUpdate(
    { email: admin.email },
    { isVerified: true, role: "Administrator" }
  );
  const login = await request(app)
    .post("/api/auth/login")
    .send({ emailOrUsername: admin.email, password: admin.password });
  return login.body.data.accessToken as string;
}

describe("Auto-unpublish on update when necessary fields removed", () => {
  let token: string;
  let openedLocal = false;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_TEST_URI ||
          "mongodb://127.0.0.1:27017/atcloud-signup-test"
      );
      openedLocal = true;
    }
    await Promise.all([User.deleteMany({}), Event.deleteMany({})]);
    token = await createAdminAndLogin();
  });

  afterAll(async () => {
    if (openedLocal && mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  async function publishEvent(eventId: string) {
    const res = await request(app)
      .post(`/api/events/${eventId}/publish`)
      .set("Authorization", `Bearer ${token}`)
      .send();
    expect(res.status).toBe(200);
  }

  // Online: remove meetingId (credential) triggers auto-unpublish (zoomLink remains)
  it("auto-unpublishes Online event after meetingId removal", async () => {
    const create = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Online Auto Unpublish",
        type: "Webinar",
        date: "2025-12-01",
        endDate: "2025-12-01",
        time: "09:00",
        endTime: "10:00",
        location: "Online",
        format: "Online",
        organizer: "Org",
        roles: [{ name: "Attendee", description: "Desc", maxParticipants: 5 }],
        purpose:
          "Long enough purpose statement for tests to pass length checks.",
        timeZone: "America/Los_Angeles",
        zoomLink: "https://zoom.example/ok",
        meetingId: "123456",
        passcode: "abc",
        suppressNotifications: true,
      });
    expect(create.status).toBe(201);
    const eventId = create.body.data.event.id;
    await Event.findByIdAndUpdate(eventId, {
      $set: { "roles.0.openToPublic": true },
    });
    await publishEvent(eventId);
    // Now remove meetingId (blank it)
    const update = await request(app)
      .put(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ meetingId: "" });
    expect(update.status).toBe(200);
    expect(update.body.data.event.publish).toBe(false);
    expect(update.body.data.event.autoUnpublishedReason).toBe(
      "MISSING_REQUIRED_FIELDS"
    );
    expect(update.body.data.event.autoUnpublishedAt).toBeTruthy();
  });

  it("auto-unpublishes In-person event after location cleared", async () => {
    const create = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "In-person Auto Unpublish",
        type: "Webinar",
        date: "2025-12-02",
        endDate: "2025-12-02",
        time: "09:00",
        endTime: "10:00",
        location: "Hall A",
        format: "In-person",
        organizer: "Org",
        roles: [{ name: "Attendee", description: "Desc", maxParticipants: 5 }],
        purpose:
          "Long enough purpose statement for tests to pass length checks.",
        timeZone: "America/Los_Angeles",
        suppressNotifications: true,
      });
    expect(create.status).toBe(201);
    const eventId = create.body.data.event.id;
    await Event.findByIdAndUpdate(eventId, {
      $set: { "roles.0.openToPublic": true },
    });
    await publishEvent(eventId);
    // Clear location
    const update = await request(app)
      .put(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ location: "" });
    expect(update.status).toBe(200);
    expect(update.body.data.event.publish).toBe(false);
    expect(update.body.data.event.autoUnpublishedReason).toBe(
      "MISSING_REQUIRED_FIELDS"
    );
  });

  // Hybrid: remove zoomLink (one of multiple necessary fields) triggers auto-unpublish
  it("auto-unpublishes Hybrid event after zoomLink removed", async () => {
    const create = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Hybrid Auto Unpublish",
        type: "Conference",
        date: "2025-12-03",
        endDate: "2025-12-03",
        time: "09:00",
        endTime: "10:00",
        location: "Campus Center",
        format: "Hybrid Participation",
        organizer: "Org",
        roles: [{ name: "Attendee", description: "Desc", maxParticipants: 5 }],
        purpose:
          "Long enough purpose statement for tests to pass length checks.",
        timeZone: "America/Los_Angeles",
        zoomLink: "https://zoom.example/hybrid",
        meetingId: "ABCDEF",
        passcode: "pass1",
        suppressNotifications: true,
      });
    expect(create.status).toBe(201);
    const eventId = create.body.data.event.id;
    await Event.findByIdAndUpdate(eventId, {
      $set: { "roles.0.openToPublic": true },
    });
    await publishEvent(eventId);
    // Remove zoomLink (set blank)
    const update = await request(app)
      .put(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ zoomLink: "" });
    expect(update.status).toBe(200);
    expect(update.body.data.event.publish).toBe(false);
    expect(update.body.data.event.autoUnpublishedReason).toBe(
      "MISSING_REQUIRED_FIELDS"
    );
  });
});
