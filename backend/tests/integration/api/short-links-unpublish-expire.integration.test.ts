/**
 * Integration test: short link becomes expired after event unpublish.
 */
import request from "supertest";
import mongoose from "mongoose";
import app from "../../../src/app";
import Event from "../../../src/models/Event";
import ShortLink from "../../../src/models/ShortLink";
import User from "../../../src/models/User";
import {
  createPublishedEvent,
  ensureCreatorUser,
} from "../../test-utils/eventTestHelpers";
import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import { ensureIntegrationDB } from "../setup/connect";

beforeAll(async () => {
  await ensureIntegrationDB();
});

afterAll(async () => {
  // Connection is shared, don't close it
});

async function createTestUser() {
  const uname = `u${Math.random().toString(36).slice(2, 8)}`;
  return User.create({
    username: uname,
    email: `${uname}@example.com`,
    password: "Password123!",
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

describe("Short Link expiration via unpublish", () => {
  beforeEach(async () => {
    await ShortLink.deleteMany({});
    await Event.deleteMany({});
    await User.deleteMany({});
  });

  it("returns 410 after event is unpublished", async () => {
    // Ensure we act as the creator (Administrator) so unpublish is authorized
    const creatorId = await ensureCreatorUser();
    const creatorHeaders = { Authorization: `Bearer test-admin-${creatorId}` };
    const event = await createPublishedEvent();

    // Create short link
    const createRes = await request(app)
      .post(`/api/public/short-links`)
      .set(creatorHeaders)
      .send({ eventId: event._id.toString() })
      .expect(201);
    const key = createRes.body.data.key;

    // Sanity: status active
    await request(app).get(`/api/public/short-links/${key}`).expect(200);

    // Unpublish event
    await request(app)
      .post(`/api/events/${event._id.toString()}/unpublish`)
      .set(creatorHeaders)
      .send({})
      .expect(200);

    // Now status should be expired (410)
    const expired = await request(app)
      .get(`/api/public/short-links/${key}`)
      .expect(410);

    expect(expired.body.status || expired.body.data?.status).toBe("expired");

    // Redirect should also 410
    await request(app).get(`/s/${key}`).expect(410);
  });

  it("restores the same short link after event is republished", async () => {
    // Ensure we act as the creator (Administrator)
    const creatorId = await ensureCreatorUser();
    const creatorHeaders = { Authorization: `Bearer test-admin-${creatorId}` };
    const event = await createPublishedEvent();

    // Create short link
    const createRes = await request(app)
      .post(`/api/public/short-links`)
      .set(creatorHeaders)
      .send({ eventId: event._id.toString() })
      .expect(201);
    const originalKey = createRes.body.data.key;

    // Sanity: status active
    await request(app)
      .get(`/api/public/short-links/${originalKey}`)
      .expect(200);

    // Unpublish event
    await request(app)
      .post(`/api/events/${event._id.toString()}/unpublish`)
      .set(creatorHeaders)
      .send({})
      .expect(200);

    // Confirm status is expired
    await request(app)
      .get(`/api/public/short-links/${originalKey}`)
      .expect(410);

    // Republish event directly in DB (simulates publish action)
    await Event.findByIdAndUpdate(event._id, {
      publish: true,
      publishedAt: new Date(),
    });

    // Request short link again - should return the SAME key (restored)
    const reCreateRes = await request(app)
      .post(`/api/public/short-links`)
      .set(creatorHeaders)
      .send({ eventId: event._id.toString() })
      .expect(200); // 200 because it's idempotent (not created)

    expect(reCreateRes.body.data.key).toBe(originalKey);

    // Status should now be active again
    const activeRes = await request(app)
      .get(`/api/public/short-links/${originalKey}`)
      .expect(200);
    expect(activeRes.body.data?.status).toBe("active");

    // Redirect should work again
    const redirectRes = await request(app).get(`/s/${originalKey}`).expect(302);
    expect(redirectRes.headers.location).toContain(event.publicSlug);
  });
});
