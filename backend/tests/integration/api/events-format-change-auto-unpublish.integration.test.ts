import request from "supertest";
import { describe, it, beforeAll, afterAll, expect, vi } from "vitest";
import mongoose from "mongoose";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Event from "../../../src/models/Event";
import { EmailService } from "../../../src/services/infrastructure/EmailServiceFacade";
import {
  domainEvents,
  EVENT_AUTO_UNPUBLISHED,
} from "../../../src/services/domainEvents";

async function createAdminAndLogin() {
  const admin = {
    username: "fmtchangeadmin",
    email: "fmtchangeadmin@example.com",
    password: "AdminPass123!",
    confirmPassword: "AdminPass123!",
    firstName: "Format",
    lastName: "Changer",
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

describe("Auto-unpublish on format change introducing new missing necessary fields", () => {
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

  it("auto-unpublishes when changing In-person -> Hybrid Participation without adding virtual fields", async () => {
    const spy = vi
      .spyOn(
        EmailService as unknown as { sendEventAutoUnpublishNotification: any },
        "sendEventAutoUnpublishNotification"
      )
      .mockResolvedValue(true);
    const domainSpy = vi.fn();
    domainEvents.once(EVENT_AUTO_UNPUBLISHED, domainSpy);

    const create = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Format Change Auto Unpublish",
        type: "Webinar",
        date: "2026-06-15",
        endDate: "2026-06-15",
        time: "09:00",
        endTime: "10:00",
        location: "Room 1",
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

    // Now change format to Hybrid Participation WITHOUT zoomLink/meetingId/passcode
    const update = await request(app)
      .put(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ format: "Hybrid Participation" });
    expect(update.status).toBe(200);
    expect(update.body.data.event.publish).toBe(false);
    expect(update.body.data.event.autoUnpublishedReason).toBe(
      "MISSING_REQUIRED_FIELDS"
    );
    // Notification hook (if implemented) should have been invoked
    expect(spy.mock.calls.length).toBe(1);
    expect(domainSpy).toHaveBeenCalledOnce();
  });
});
