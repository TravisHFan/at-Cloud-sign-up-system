import request from "supertest";
import mongoose from "mongoose";
import { describe, it, beforeEach, beforeAll, afterAll, expect } from "vitest";
import app from "../../../src/app";
import ShortLinkService, {
  __TEST__ as ShortLinkTestHooks,
} from "../../../src/services/ShortLinkService";
import ShortLink from "../../../src/models/ShortLink";
import Event from "../../../src/models/Event";
import User from "../../../src/models/User";
import { prometheusRegistry } from "../../../src/services/PrometheusMetricsService";
import { createPublishedEvent } from "../../test-utils/eventTestHelpers";
import { ensureIntegrationDB } from "../setup/connect";

/**
 * Focused integration test: ensure a cached positive entry that has passed its per-link expiry
 * is evicted lazily on read and increments stale eviction counter, returning 410.
 */

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

describe("Short Links stale cached entry eviction", () => {
  beforeEach(async () => {
    await ShortLink.deleteMany({});
    await Event.deleteMany({});
    await User.deleteMany({});
    ShortLinkTestHooks.clearCache();
  });

  it("evicts stale cached positive entry on lookup and reports metric", async () => {
    const { headers } = await authHeaders();
    const event = await createPublishedEvent();
    // Create short link (active)
    const createRes = await request(app)
      .post(`/api/public/short-links`)
      .set(headers)
      .send({ eventId: event._id.toString() })
      .expect(201);
    const key = createRes.body.data.key as string;

    // Prime cache by resolving once (status endpoint) -> 200 active
    await request(app).get(`/api/public/short-links/${key}`).expect(200);

    // Force the cached entry's per-link expiry into the past without touching DB record
    ShortLinkTestHooks.forceCacheExpiry(key);

    // Capture metric value before
    const beforeMetrics = await prometheusRegistry.getSingleMetricAsString(
      "short_link_cache_stale_evictions_total"
    );
    const beforeMatch = beforeMetrics.match(
      /short_link_cache_stale_evictions_total\{reason="expired"}\s+(\d+)/
    );
    const beforeVal = beforeMatch ? parseInt(beforeMatch[1], 10) : 0;

    // Also expire in DB so that post-eviction path returns 410 (expired vs 404)
    await ShortLink.updateMany(
      { key },
      { $set: { isExpired: true, expiresAt: new Date(Date.now() - 1000) } }
    );

    // Second lookup should detect stale cached entry (expiresAtMs past), evict, increment metric,
    // then DB lookup sees expired document -> 410
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
