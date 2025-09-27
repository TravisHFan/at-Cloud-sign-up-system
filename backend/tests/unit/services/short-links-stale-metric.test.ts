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
import { prometheusRegistry } from "../../../src/services/PrometheusMetricsService";

// This is a lightweight (still uses DB models) unit-style test focusing specifically on the stale eviction metric
// without needing the broader integration suite assertions. It runs faster than full integration because it
// only exercises one narrow path and minimal endpoints.

async function ensureConnection() {
  if (mongoose.connection.readyState === 0) {
    const uri =
      process.env.MONGODB_TEST_URI ||
      "mongodb://127.0.0.1:27017/atcloud-signup-test";
    await mongoose.connect(uri, { family: 4 } as any);
  }
}

describe("ShortLinkService stale eviction metric (unit focus)", () => {
  beforeEach(async () => {
    await ensureConnection();
    await Promise.all([
      ShortLink.deleteMany({}),
      Event.deleteMany({}),
      User.deleteMany({}),
    ]);
    ShortLinkTestHooks.clearCache();
  });

  it("increments short_link_cache_stale_evictions_total when a stale cached entry is encountered", async () => {
    // Create minimal event + user via direct model use rather than helper to keep this tight
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
      organizer: "Org", // schema expects string (object used elsewhere for extended organizer details)
      type: "Webinar",
      createdBy: user._id,
      publicSlug: "metric-event",
      // Use a far-future date so the event is unquestionably active relative to current test runtime
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

    // Create short link through service path (HTTP) to populate cache consistent with real flow
    const createRes = await request(app)
      .post(`/api/public/short-links`)
      .set({ Authorization: `Bearer test-${user._id}` })
      .send({ eventId: event._id.toString() })
      .expect(201);
    const key = createRes.body.data.key as string;

    // Prime cache (ensure link still active in DB)
    const beforeMetrics = await prometheusRegistry.getSingleMetricAsString(
      "short_link_cache_stale_evictions_total"
    );
    await request(app).get(`/api/public/short-links/${key}`).expect(200);

    // Force stale in cache
    ShortLinkTestHooks.forceCacheExpiry(key);

    // Expire DB record to drive 410 on second lookup
    await ShortLink.updateMany(
      { key },
      { $set: { isExpired: true, expiresAt: new Date(Date.now() - 1000) } }
    );
    const beforeMatch = beforeMetrics.match(
      /short_link_cache_stale_evictions_total\{reason="expired"}\s+(\d+)/
    );
    const beforeVal = beforeMatch ? parseInt(beforeMatch[1], 10) : 0;

    await request(app).get(`/api/public/short-links/${key}`).expect(410);

    const afterMetrics = await prometheusRegistry.getSingleMetricAsString(
      "short_link_cache_stale_evictions_total"
    );
    const afterMatch = afterMetrics.match(
      /short_link_cache_stale_evictions_total\{reason="expired"}\s+(\d+)/
    );
    const afterVal = afterMatch ? parseInt(afterMatch[1], 10) : 0;

    expect(afterVal).toBe(beforeVal + 1);
  });
});
