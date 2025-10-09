/**
 * Integration tests for Short Links API & redirect behavior.
 */
import request from "supertest";
import mongoose from "mongoose";
import app from "../../../src/app";
import ShortLinkService, {
  __TEST__ as ShortLinkTestHooks,
} from "../../../src/services/ShortLinkService";
import Event from "../../../src/models/Event";
import ShortLink from "../../../src/models/ShortLink";
import User from "../../../src/models/User";
import {
  createPublishedEvent,
  buildValidEventPayload,
  ensureCreatorUser,
} from "../../test-utils/eventTestHelpers";
import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import { ensureIntegrationDB } from "../setup/connect";

// Helper to ensure DB connection when running file in isolation
let openedLocalConnection = false;
beforeAll(async () => {
  await ensureIntegrationDB();
  openedLocalConnection = true;
});

afterAll(async () => {
  // Connection is shared, don't close it here
});

async function createTestUser() {
  const uname = `u${Math.random().toString(36).slice(2, 8)}`;
  return User.create({
    username: uname,
    email: `${uname}@example.com`,
    password: "Password123!", // meets policy
    firstName: "Test",
    lastName: "User",
    role: "Participant",
    isVerified: true,
    gender: "male",
    isAtCloudLeader: false,
  } as any);
}

async function authHeaders() {
  const user = await createTestUser();
  return { user, headers: { Authorization: `Bearer test-${user._id}` } };
}

describe("Short Links API", () => {
  beforeEach(async () => {
    await ShortLink.deleteMany({});
    await Event.deleteMany({});
    await User.deleteMany({});
  });

  it("creates a short link (201) then returns existing (200) on second call (idempotent)", async () => {
    const { user, headers } = await authHeaders();
    const event = await createPublishedEvent();

    const first = await request(app)
      .post(`/api/public/short-links`)
      .set(headers)
      .send({ eventId: event._id.toString() })
      .expect(201);

    expect(first.body.data.key).toBeTruthy();

    const second = await request(app)
      .post(`/api/public/short-links`)
      .set(headers)
      .send({ eventId: event._id.toString() })
      .expect(200);

    expect(second.body.data.key).toBe(first.body.data.key);
    expect(await ShortLink.countDocuments({ eventId: event._id })).toBe(1);
  });

  it("returns 400 if event not published or lacks public roles", async () => {
    const { headers } = await authHeaders();
    const creatorId = await ensureCreatorUser();
    const payload = buildValidEventPayload({
      format: "Online",
      roles: [
        {
          name: "Closed",
          description: "Not public",
          maxParticipants: 10,
          openToPublic: false,
          id: new mongoose.Types.ObjectId().toString(),
        },
      ],
    });
    const event = await Event.create({
      ...payload,
      publish: false,
      createdBy: creatorId,
    });
    if (!event.publicSlug) {
      event.publicSlug = `draft-${event._id.toString().slice(-6)}`;
      await event.save();
    }

    const res = await request(app)
      .post(`/api/public/short-links`)
      .set(headers)
      .send({ eventId: event._id.toString() })
      .expect(400);

    expect(res.body.message).toMatch(/not published|no public roles/i);
  });

  it("GET status returns active for valid key", async () => {
    const { headers } = await authHeaders();
    const event = await createPublishedEvent();
    const createRes = await request(app)
      .post(`/api/public/short-links`)
      .set(headers)
      .send({ eventId: event._id.toString() })
      .expect(201);
    const key = createRes.body.data.key;

    const statusRes = await request(app)
      .get(`/api/public/short-links/${key}`)
      .expect(200);

    expect(statusRes.body.data.status).toBe("active");
    expect(statusRes.body.data.slug).toBe(event.publicSlug);
  });

  it("GET status returns 410 for expired key", async () => {
    const { headers } = await authHeaders();
    const event = await createPublishedEvent();
    const createRes = await request(app)
      .post(`/api/public/short-links`)
      .set(headers)
      .send({ eventId: event._id.toString() })
      .expect(201);
    const key = createRes.body.data.key;

    // Expire it directly
    await ShortLink.updateMany(
      { key },
      { $set: { isExpired: true, expiresAt: new Date(Date.now() - 1000) } }
    );
    // Clear cache so that manual DB expiration is reflected (production expiration
    // uses service which invalidates cache; this simulates that behavior for the test)
    ShortLinkTestHooks.clearCache();

    await request(app).get(`/api/public/short-links/${key}`).expect(410);
  });

  it("GET status returns 404 for unknown key", async () => {
    await request(app).get(`/api/public/short-links/NOPE123`).expect(404);
  });
});

describe("Short Links Redirect /s/:key", () => {
  beforeEach(async () => {
    await ShortLink.deleteMany({});
    await Event.deleteMany({});
    await User.deleteMany({});
  });

  it("redirects (302) for active key", async () => {
    const { headers } = await authHeaders();
    const event = await createPublishedEvent();
    const createRes = await request(app)
      .post(`/api/public/short-links`)
      .set(headers)
      .send({ eventId: event._id.toString() })
      .expect(201);
    const key = createRes.body.data.key;

    const res = await request(app).get(`/s/${key}`).expect(302);
    expect(res.headers.location).toMatch(new RegExp(event.publicSlug));
  });

  it("returns 410 for expired key redirect", async () => {
    const { headers } = await authHeaders();
    const event = await createPublishedEvent();
    const createRes = await request(app)
      .post(`/api/public/short-links`)
      .set(headers)
      .send({ eventId: event._id.toString() })
      .expect(201);
    const key = createRes.body.data.key;
    await ShortLink.updateMany(
      { key },
      { $set: { isExpired: true, expiresAt: new Date(Date.now() - 1000) } }
    );
    ShortLinkTestHooks.clearCache();

    await request(app).get(`/s/${key}`).expect(410);
  });

  it("returns 404 for unknown key redirect", async () => {
    await request(app).get(`/s/UNKNOWN1`).expect(404);
  });
});
