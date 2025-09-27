/**
 * Integration tests for public registration rate limiting (IP + email).
 */
import request from "supertest";
import app from "../../../src/app";
import mongoose from "mongoose";
import Event from "../../../src/models/Event";
import User from "../../../src/models/User";
import Registration from "../../../src/models/Registration";
import GuestRegistration from "../../../src/models/GuestRegistration";
import { createPublishedEvent } from "../../test-utils/eventTestHelpers";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

let openedLocal = false;

beforeAll(async () => {
  process.env.TEST_DISABLE_PUBLIC_RL = "false"; // ensure limiter active
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(
      process.env.MONGODB_TEST_URI ||
        "mongodb://127.0.0.1:27017/atcloud-signup-test"
    );
    openedLocal = true;
  }
});

afterAll(async () => {
  if (openedLocal && mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});

afterEach(async () => {
  await Registration.deleteMany({});
  await GuestRegistration.deleteMany({});
  await User.deleteMany({});
  await Event.deleteMany({});
});

describe("Public registration rate limiting", () => {
  test("blocks after exceeding per-email limit but keeps duplicates idempotent", async () => {
    process.env.RESET_RATE_LIMITER = "true";
    // Lower limits via env for deterministic test
    process.env.PUBLIC_REG_LIMIT_PER_EMAIL = "3"; // allow 3
    process.env.PUBLIC_REG_LIMIT_PER_IP = "100"; // large to avoid IP block

    const event = await createPublishedEvent({
      roles: [
        {
          name: "Limited",
          description: "limited",
          maxParticipants: 50,
          openToPublic: true,
          id: new mongoose.Types.ObjectId().toString(),
        },
      ],
    });
    const role = event.roles[0];
    const base = `/api/public/events/${event.publicSlug}/register`;

    // First unique email attempts (same email) should pass until limit reached
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post(base)
        .send({
          roleId: role.id,
          attendee: { name: "User", email: "rl@example.com" },
          consent: { termsAccepted: true },
        })
        .expect(200);
      expect(res.body.success).toBe(true);
    }

    // 4th attempt with same email should 429
    const blocked = await request(app)
      .post(base)
      .send({
        roleId: role.id,
        attendee: { name: "User", email: "rl@example.com" },
        consent: { termsAccepted: true },
      })
      .expect(429);
    expect(blocked.body.code).toBe("RATE_LIMIT_EMAIL");

    // A duplicate idempotent registration (already created) still counts as an attempt under email limit policy.
  });

  test("per-IP limit blocks distinct emails", async () => {
    process.env.RESET_RATE_LIMITER = "true";
    process.env.PUBLIC_REG_LIMIT_PER_EMAIL = "100"; // high so only IP triggers
    process.env.PUBLIC_REG_LIMIT_PER_IP = "5"; // small IP limit

    const event = await createPublishedEvent();
    const role = event.roles[0];
    const base = `/api/public/events/${event.publicSlug}/register`;

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post(base)
        .send({
          roleId: role.id,
          attendee: { name: `User${i}`, email: `user${i}@example.com` },
          consent: { termsAccepted: true },
        })
        .expect(200);
      expect(res.body.success).toBe(true);
    }

    const blocked = await request(app)
      .post(base)
      .send({
        roleId: role.id,
        attendee: { name: "UserX", email: "userX@example.com" },
        consent: { termsAccepted: true },
      })
      .expect(429);
    expect(blocked.body.code).toBe("RATE_LIMIT_IP");
  });
});
