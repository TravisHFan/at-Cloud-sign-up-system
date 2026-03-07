import { describe, it, expect, beforeEach } from "vitest";
import ShortLinkService, {
  __TEST__ as ShortLinkTestHooks,
} from "../../../src/services/ShortLinkService";
import ShortLink from "../../../src/models/ShortLink";
import Event from "../../../src/models/Event";
import User from "../../../src/models/User";
import mongoose from "mongoose";
import app from "../../../src/app";
import request from "supertest";

// Short links no longer expire — this test verifies that links always resolve
// regardless of isExpired flag or expiresAt date.

async function ensureConnection() {
  if (mongoose.connection.readyState === 0) {
    const uri =
      process.env.MONGODB_TEST_URI ||
      "mongodb://127.0.0.1:27017/atcloud-signup-test";
    await mongoose.connect(uri, { family: 4 } as any);
  }
}

describe("ShortLinkService always resolves (no expiration)", () => {
  beforeEach(async () => {
    await ensureConnection();
    await Promise.all([
      ShortLink.deleteMany({}),
      Event.deleteMany({}),
      User.deleteMany({}),
    ]);
    ShortLinkTestHooks.clearCache();
  });

  it("resolves link as active even when isExpired is true and expiresAt is past", async () => {
    // Create minimal event + user via direct model use
    const user = await User.create({
      username: "slmetric_user",
      email: "slmetric_user@example.com",
      password: "Password123!",
      firstName: "Test",
      lastName: "User",
      role: "Participant",
      isVerified: true,
      gender: "male",
      isAtCloudLeader: false,
    } as any);

    const event = await Event.create({
      title: "Metric Event",
      description: "Metric Event Desc",
      publish: true,
      format: "Online",
      organizer: "Org",
      type: "Webinar",
      createdBy: user._id,
      publicSlug: "metric-event",
      date: "2099-01-01",
      endDate: "2099-01-01",
      time: "10:00",
      endTime: "11:00",
      roles: [
        {
          name: "Role",
          description: "R",
          maxParticipants: 5,
          openToPublic: true,
          id: new mongoose.Types.ObjectId().toString(),
        },
      ],
    } as any);

    // Create short link through HTTP
    const createRes = await request(app)
      .post(`/api/public/short-links`)
      .set({ Authorization: `Bearer test-${user._id}` })
      .send({ eventId: event._id.toString() })
      .expect(201);
    const key = createRes.body.data.key as string;

    // Prime cache
    await request(app).get(`/api/public/short-links/${key}`).expect(200);

    // Force stale in cache
    ShortLinkTestHooks.forceCacheExpiry(key);

    // Mark DB record as expired with past expiresAt
    await ShortLink.updateMany(
      { key },
      { $set: { isExpired: true, expiresAt: new Date(Date.now() - 1000) } },
    );

    // Should still resolve as active (200), not expired (410)
    const res = await request(app)
      .get(`/api/public/short-links/${key}`)
      .expect(200);
    expect(res.body.data?.status).toBe("active");
  });
});
