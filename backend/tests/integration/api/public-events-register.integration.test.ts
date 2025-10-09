/**
 * Integration tests for POST /api/public/events/:slug/register
 */
import request from "supertest";
import app from "../../../src/app";
import Event from "../../../src/models/Event";
import User from "../../../src/models/User";
import Registration from "../../../src/models/Registration";
import GuestRegistration from "../../../src/models/GuestRegistration";
import {
  buildValidEventPayload,
  createPublishedEvent,
  ensureCreatorUser,
} from "../../test-utils/eventTestHelpers";
import mongoose from "mongoose";
import { describe, test, expect, afterEach, beforeAll, afterAll } from "vitest";
import { ensureIntegrationDB } from "../setup/connect";

// Ensure DB connection when running this file in isolation (some npm scripts set VITEST_SCOPE, others may not)
let openedLocalConnection = false;
beforeAll(async () => {
  await ensureIntegrationDB();
  openedLocalConnection = true;
});

afterAll(async () => {
  // Connection is shared, don't close it here
});

describe("Public Events API - POST /api/public/events/:slug/register", () => {
  afterEach(async () => {
    await Registration.deleteMany({});
    await GuestRegistration.deleteMany({});
    await User.deleteMany({});
    await Event.deleteMany({});
  });

  test("guest registration happy path", async () => {
    const event = await createPublishedEvent();
    const role = event.roles[0];

    const res = await request(app)
      .post(`/api/public/events/${event.publicSlug}/register`)
      .send({
        roleId: role.id,
        attendee: { name: "Guest One", email: "guest1@example.com" },
        consent: { termsAccepted: true },
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ duplicate: false, type: "guest" });

    const guestCount = await GuestRegistration.countDocuments({
      eventId: event._id,
    });
    expect(guestCount).toBe(1);
  });

  test("existing user matched by email creates user registration", async () => {
    const event = await createPublishedEvent();
    const role = event.roles[0];

    const user = await User.create({
      username: "testuser",
      firstName: "Test",
      lastName: "User",
      email: "member@example.com",
      password: "ValidPass123",
      role: "Participant",
      isVerified: true,
      gender: "male",
      isAtCloudLeader: false,
    } as any);

    const res = await request(app)
      .post(`/api/public/events/${event.publicSlug}/register`)
      .send({
        roleId: role.id,
        attendee: { name: "Some Name", email: user.email },
        consent: { termsAccepted: true },
      })
      .expect(200);

    expect(res.body.data).toMatchObject({ duplicate: false, type: "user" });

    const reg = await Registration.findOne({
      eventId: event._id,
      userId: user._id,
    });
    expect(reg).toBeTruthy();
  });

  test("duplicate guest registration returns already registered (idempotent)", async () => {
    const event = await createPublishedEvent();
    const role = event.roles[0];
    const payload = {
      roleId: role.id,
      attendee: { name: "Guest D", email: "dup@example.com" },
      consent: { termsAccepted: true },
    };
    await request(app)
      .post(`/api/public/events/${event.publicSlug}/register`)
      .send(payload)
      .expect(200);
    const second = await request(app)
      .post(`/api/public/events/${event.publicSlug}/register`)
      .send(payload)
      .expect(200);

    expect(second.body.data).toMatchObject({
      duplicate: true,
      message: "Already registered",
    });
    const guestCount = await GuestRegistration.countDocuments({
      eventId: event._id,
      email: "dup@example.com",
    });
    expect(guestCount).toBe(1);
  });

  test("role not open to public rejected", async () => {
    const event = await createPublishedEvent({
      roles: [
        {
          name: "Closed Role",
          description: "Internal role",
          maxParticipants: 3,
          openToPublic: false,
          id: new mongoose.Types.ObjectId().toString(),
        },
      ],
    });
    const role = event.roles[0];
    const res = await request(app)
      .post(`/api/public/events/${event.publicSlug}/register`)
      .send({
        roleId: role.id,
        attendee: { name: "Guest", email: "guest@example.com" },
        consent: { termsAccepted: true },
      })
      .expect(400);

    expect(res.body.message).toMatch(/not open/i);
  });

  test("unpublished event returns 404", async () => {
    const creatorId = await ensureCreatorUser();
    const event = await Event.create({
      ...buildValidEventPayload(),
      publish: false,
      roles: [
        {
          name: "Attendee",
          description: "General attendee",
          maxParticipants: 5,
          openToPublic: true,
          id: new mongoose.Types.ObjectId().toString(),
        },
      ],
      createdBy: creatorId,
    });
    if (!event.publicSlug) {
      event.publicSlug = `unpub-event-${event._id.toString().slice(-6)}`;
    }
    await event.save();

    const res = await request(app)
      .post(`/api/public/events/${event.publicSlug}/register`)
      .send({
        roleId: event.roles[0].id,
        attendee: { name: "Guest", email: "g@example.com" },
        consent: { termsAccepted: true },
      })
      .expect(404);

    expect(res.body.message).toMatch(/not found/i);
  });

  test("capacity full returns 400", async () => {
    const event = await createPublishedEvent({
      roles: [
        {
          name: "Full Role",
          description: "Only two allowed",
          maxParticipants: 1,
          openToPublic: true,
          id: new mongoose.Types.ObjectId().toString(),
        },
      ],
    });
    const role = event.roles[0];

    // First registration fills capacity
    await request(app)
      .post(`/api/public/events/${event.publicSlug}/register`)
      .send({
        roleId: role.id,
        attendee: { name: "One", email: "one@example.com" },
        consent: { termsAccepted: true },
      })
      .expect(200);

    // Second should fail
    const res = await request(app)
      .post(`/api/public/events/${event.publicSlug}/register`)
      .send({
        roleId: role.id,
        attendee: { name: "Two", email: "two@example.com" },
        consent: { termsAccepted: true },
      })
      .expect(400);

    expect(res.body.message).toMatch(/full capacity|at full capacity/i);
  });

  test("duplicate existing user registration returns already registered", async () => {
    const event = await createPublishedEvent();
    const role = event.roles[0];
    const user = await User.create({
      username: "dupuser",
      firstName: "Dup",
      lastName: "User",
      email: "dupuser@example.com",
      password: "ValidPass123",
      role: "Participant",
      isVerified: true,
      gender: "male",
      isAtCloudLeader: false,
    } as any);

    // First registration
    await request(app)
      .post(`/api/public/events/${event.publicSlug}/register`)
      .send({
        roleId: role.id,
        attendee: { name: "Dup User", email: user.email },
        consent: { termsAccepted: true },
      })
      .expect(200);

    // Second registration attempt
    const second = await request(app)
      .post(`/api/public/events/${event.publicSlug}/register`)
      .send({
        roleId: role.id,
        attendee: { name: "Dup User Again", email: user.email },
        consent: { termsAccepted: true },
      })
      .expect(200);

    expect(second.body.data).toMatchObject({
      duplicate: true,
      message: "Already registered",
    });
  });
});
