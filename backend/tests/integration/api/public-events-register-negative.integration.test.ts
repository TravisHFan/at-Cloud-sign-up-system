/**
 * Additional negative & edge case tests for POST /api/public/events/:slug/register
 * Focus: missing consent, capacity full idempotent duplicate behavior after full, closed role, role not found.
 */
import request from "supertest";
import app from "../../../src/app";
import Event from "../../../src/models/Event";
import User from "../../../src/models/User";
import Registration from "../../../src/models/Registration";
import GuestRegistration from "../../../src/models/GuestRegistration";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { createPublishedEvent } from "../../test-utils/eventTestHelpers";
import { ensureIntegrationDB } from "../setup/connect";

beforeAll(async () => {
  await ensureIntegrationDB();
});

afterAll(async () => {
  // Connection is shared, don't close it
});

describe("Public Events API - negative registration cases", () => {
  afterEach(async () => {
    await Registration.deleteMany({});
    await GuestRegistration.deleteMany({});
    await User.deleteMany({});
    await Event.deleteMany({});
  });

  test("missing consent (termsAccepted false) returns 400", async () => {
    const event = await createPublishedEvent();
    const role = event.roles[0];

    const res = await request(app)
      .post(`/api/public/events/${event.publicSlug}/register`)
      .send({
        roleId: role.id,
        attendee: { name: "Guest", email: "neg1@example.com" },
        consent: { termsAccepted: false },
      })
      .expect(400);

    expect(res.body.message).toMatch(/termsAccepted/i);
  });

  test("duplicate guest after capacity reached stays idempotent (second returns duplicate 200)", async () => {
    const event = await createPublishedEvent({
      roles: [
        {
          name: "Tiny Role",
          description: "Only one slot",
          maxParticipants: 1,
          openToPublic: true,
          id: new mongoose.Types.ObjectId().toString(),
        },
      ],
    });
    const role = event.roles[0];
    const payload = {
      roleId: role.id,
      attendee: { name: "Solo", email: "solo@example.com" },
      consent: { termsAccepted: true },
    };

    // First fills capacity
    const first = await request(app)
      .post(`/api/public/events/${event.publicSlug}/register`)
      .send(payload)
      .expect(200);
    expect(first.body.data.duplicate).toBe(false);

    // Capacity now full; same guest again -> should still be 200 duplicate (not 400 capacity)
    const second = await request(app)
      .post(`/api/public/events/${event.publicSlug}/register`)
      .send(payload)
      .expect(200);
    expect(second.body.data).toMatchObject({
      duplicate: true,
      message: /Already registered/i,
    });

    // Different guest should fail with capacity full
    const third = await request(app)
      .post(`/api/public/events/${event.publicSlug}/register`)
      .send({
        roleId: role.id,
        attendee: { name: "Another", email: "another@example.com" },
        consent: { termsAccepted: true },
      })
      .expect(400);
    expect(third.body.message).toMatch(/full capacity|at full capacity/i);
  });

  test("duplicate existing user after capacity reached is idempotent", async () => {
    const event = await createPublishedEvent({
      roles: [
        {
          name: "User Tiny",
          description: "One slot for user",
          maxParticipants: 1,
          openToPublic: true,
          id: new mongoose.Types.ObjectId().toString(),
        },
      ],
    });
    const role = event.roles[0];

    const user = await User.create({
      username: "tinyuser",
      firstName: "Tiny",
      lastName: "User",
      email: "tiny@example.com",
      password: "ValidPass123",
      role: "Participant",
      isVerified: true,
      gender: "male",
      isAtCloudLeader: false,
    } as any);

    const first = await request(app)
      .post(`/api/public/events/${event.publicSlug}/register`)
      .send({
        roleId: role.id,
        attendee: { name: "Tiny User", email: user.email },
        consent: { termsAccepted: true },
      })
      .expect(200);
    expect(first.body.data.duplicate).toBe(false);

    // Second attempt (duplicate) after capacity full should be idempotent success
    const second = await request(app)
      .post(`/api/public/events/${event.publicSlug}/register`)
      .send({
        roleId: role.id,
        attendee: { name: "Tiny User Again", email: user.email },
        consent: { termsAccepted: true },
      })
      .expect(200);
    expect(second.body.data).toMatchObject({
      duplicate: true,
      message: /Already registered/i,
    });

    // Different user (new email) should fail due to capacity
    const third = await request(app)
      .post(`/api/public/events/${event.publicSlug}/register`)
      .send({
        roleId: role.id,
        attendee: { name: "Other", email: "other@example.com" },
        consent: { termsAccepted: true },
      })
      .expect(400);
    expect(third.body.message).toMatch(/full capacity|at full capacity/i);
  });
});
