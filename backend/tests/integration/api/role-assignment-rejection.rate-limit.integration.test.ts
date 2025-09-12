import request from "supertest";
import app from "../../../src/app";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { createRoleAssignmentRejectionToken } from "../../../src/utils/roleAssignmentRejectionToken";
import Registration from "../../../src/models/Registration";
import Event from "../../../src/models/Event";
import User from "../../../src/models/User";
import { RejectionMetricsService } from "../../../src/services/RejectionMetricsService";

// Ensure rate limiter active in test
process.env.TEST_ENABLE_REJECTION_RATE_LIMIT = "true";

describe("Role assignment rejection rate limiting", () => {
  let eventId: string;
  let userId: string;
  let assignmentId: string;
  beforeAll(async () => {
    RejectionMetricsService.reset();
    // create user & event & registration
    const user = await User.create({
      firstName: "Rate",
      lastName: "Tester",
      email: `ratelimit-${Date.now()}@example.com`,
      password: "x", // simplified
      username: `rl_${Date.now()}`,
    } as any);
    userId = String(user._id);
    const event = await Event.create({
      title: "RL Event",
      date: "2030-01-01",
      time: "10:00",
      timeZone: "UTC",
      createdBy: user._id,
    } as any);
    eventId = String(event._id);
    const reg = await Registration.create({
      userId: user._id,
      eventId: event._id,
      eventSnapshot: {
        title: event.title,
        date: event.date,
        time: event.time,
        roleName: "Helper",
      },
      registeredBy: user._id,
    } as any);
    assignmentId = String(reg._id);
  });

  afterAll(async () => {
    if (mongoose.connection?.db) {
      await mongoose.connection.db.dropDatabase();
    }
  });

  it("enforces rate limit after threshold", async () => {
    const token = createRoleAssignmentRejectionToken({
      assignmentId,
      assigneeId: userId,
    });
    // Hit validate endpoint until limit triggers (limit small enough for test config)
    let limited = false;
    for (let i = 0; i < 30; i++) {
      const res = await request(app).get(
        `/api/role-assignments/reject/validate?token=${token}`
      );
      if (res.status === 429) {
        limited = true;
        expect(res.body.code).toBe("ASSIGNMENT_REJECTION_RATE_LIMIT");
        break;
      } else {
        expect([200, 429]).toContain(res.status);
      }
    }
    expect(limited).toBe(true);
    const metrics = RejectionMetricsService.getAll();
    expect(metrics.rate_limited).toBeGreaterThanOrEqual(1);
  });
});
