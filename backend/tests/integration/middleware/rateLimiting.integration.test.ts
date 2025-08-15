import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import {
  createAndLoginTestUser,
  createAdminToken,
} from "../../test-utils/createTestUser";

describe("Rate limiting integration", () => {
  let authToken: string | undefined;

  beforeEach(async () => {
    await User.deleteMany({});
    authToken = undefined;
    // Ensure rate limiting is enabled unless emergency disabled explicitly
    process.env.ENABLE_RATE_LIMITING = "true";
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  const registerAndLogin = async () => {
    const { token } = await createAndLoginTestUser({ username: "rluser" });
    return token;
  };

  it("applies standard rate limit headers on auth endpoint (no block under low volume)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ emailOrUsername: "none", password: "none" });

    // Should include standard rate limit headers when configured
    // In dev/test the limits are generous; request should not be blocked
    expect(
      res.headers["ratelimit-limit"] || res.headers["x-ratelimit-limit"]
    ).toBeDefined();
    expect(
      res.headers["ratelimit-remaining"] || res.headers["x-ratelimit-remaining"]
    ).toBeDefined();
  });

  it("applies notifications limiter headers on notifications routes", async () => {
    authToken = await registerAndLogin();
    const res = await request(app)
      .get("/api/notifications/unread-counts")
      .set("Authorization", `Bearer ${authToken}`)
      .expect((r) => {
        // Headers exist though remaining might vary
        expect(
          r.headers["ratelimit-limit"] || r.headers["x-ratelimit-limit"]
        ).toBeDefined();
      });
  });

  it("bypasses rate limiting when emergency disabled via monitor route", async () => {
    const adminToken = await createAdminToken();

    await request(app)
      .post("/api/monitor/emergency-disable")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ emailOrUsername: "none", password: "none" });

    // When skipped, RateLimit-* headers should typically be absent
    const limitHeader =
      res.headers["ratelimit-limit"] || res.headers["x-ratelimit-limit"];
    expect([undefined, null]).toContain(limitHeader);

    // Re-enable to not affect other tests
    await request(app)
      .post("/api/monitor/emergency-enable")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });
});
