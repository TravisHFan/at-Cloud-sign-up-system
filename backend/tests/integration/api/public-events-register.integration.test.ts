/**
 * Integration tests for POST /api/public/events/:slug/register
 */
import request from "supertest";
import app from "../../../src/app";
import Event from "../../../src/models/Event";
import User from "../../../src/models/User";
import Registration from "../../../src/models/Registration";
import GuestRegistration from "../../../src/models/GuestRegistration";
import { buildValidEventPayload } from "../../test-utils/eventTestHelpers";
import mongoose from "mongoose";
import { describe, test, expect, afterEach, beforeAll, afterAll } from "vitest";

// Ensure DB connection when running this file in isolation (some npm scripts set VITEST_SCOPE, others may not)
let openedLocalConnection = false;
beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    const uri =
      process.env.MONGODB_TEST_URI ||
      "mongodb://127.0.0.1:27017/atcloud-signup-test";
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      family: 4,
    } as any);
    openedLocalConnection = true;
  }
});

afterAll(async () => {
  if (openedLocalConnection && mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});

// Utility to create an admin/creator user and return its id
async function ensureCreatorUser() {
  const user = await User.create({
    username: "creatoradmin",
    email: `creatoradmin-${Date.now()}@example.com`,
    password: "Password123!", // hashed via middleware (if present) else raw acceptable for tests
    firstName: "Creator",
    lastName: "Admin",
    role: "Administrator",
    isVerified: true,
    gender: "male",
    isAtCloudLeader: false,
  } as any);
  return (user as any)._id;
}

// Utility to create and publish an event with a single public role (requires createdBy)
async function createPublishedEvent(overrides: Partial<any> = {}) {
  const creatorId = await ensureCreatorUser();
  const base = buildValidEventPayload();
  (base as any).publish = true; // ensure publish flag (schema supports publish)
  base.roles = [
    {
      name: "Attendee",
      description: "General attendee",
      maxParticipants: 5,
      openToPublic: true,
      id: new mongoose.Types.ObjectId().toString(),
    },
  ];
  const evt = await Event.create({
    ...base,
    createdBy: creatorId,
    ...overrides,
  });
  if (!evt.publicSlug) {
    evt.publicSlug = `test-event-${evt._id.toString().slice(-6)}`;
  }
  if (!evt.publishedAt) {
    evt.publishedAt = new Date();
  }
  await evt.save();
  return evt;
}

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
});
