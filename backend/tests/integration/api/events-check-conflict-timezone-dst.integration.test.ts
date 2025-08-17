import { describe, it, beforeEach, afterEach, expect } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Event from "../../../src/models/Event";

/**
 * /events/check-conflict Time Zone + DST Integration Tests
 *
 * Covers:
 * - Cross-time-zone conflict detection (existing event vs. client zone)
 * - DST spring forward (nonexistent local time)
 * - DST fall back (repeated local hour)
 */

describe("GET /api/events/check-conflict (time zones + DST)", () => {
  let adminToken: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Event.deleteMany({});

    // Create admin user
    const adminData = {
      username: "tzadmin",
      email: "tzadmin@example.com",
      password: "AdminPass123!",
      confirmPassword: "AdminPass123!",
      firstName: "TZ",
      lastName: "Admin",
      role: "Administrator",
      gender: "male",
      isAtCloudLeader: false,
      acceptTerms: true,
    } as any;

    await request(app).post("/api/auth/register").send(adminData);
    await User.findOneAndUpdate(
      { email: adminData.email },
      { isVerified: true, role: "Administrator" }
    );

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ emailOrUsername: adminData.email, password: adminData.password });
    adminToken = loginRes.body.data.accessToken;
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Event.deleteMany({});
  });

  it("detects conflict across different time zones (NY event, LA client)", async () => {
    // Existing event: New York time, 2025-05-10 10:00 - 11:00 ET
    const eventNY = {
      title: "Cross TZ Event NY",
      description: "NY event",
      date: "2025-05-10",
      time: "10:00",
      endTime: "11:00",
      endDate: "2025-05-10",
      timeZone: "America/New_York",
      location: "NYC",
      type: "Effective Communication Workshop",
      format: "In-person",
      purpose: "Test",
      agenda: "Agenda",
      organizer: "Org",
      roles: [
        {
          id: "role-1",
          name: "Zoom Host",
          maxParticipants: 1,
          description: "host",
        },
      ],
    } as any;

    await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(eventNY)
      .expect(201);

    // Client in Los Angeles checks 07:30 on same date (07:30 PT == 10:30 ET) -> conflict
    const conflictRes = await request(app)
      .get("/api/events/check-conflict")
      .query({
        startDate: "2025-05-10",
        startTime: "07:30",
        mode: "point",
        timeZone: "America/Los_Angeles",
      })
      .expect(200);
    expect(conflictRes.body).toMatchObject({
      success: true,
      data: { conflict: true },
    });

    // 06:59 PT (09:59 ET) -> no conflict
    const noConflictRes = await request(app)
      .get("/api/events/check-conflict")
      .query({
        startDate: "2025-05-10",
        startTime: "06:59",
        mode: "point",
        timeZone: "America/Los_Angeles",
      })
      .expect(200);
    expect(noConflictRes.body).toMatchObject({
      success: true,
      data: { conflict: false },
    });
  });

  it("handles DST spring-forward nonexistent local time (LA 2025-03-09 02:30) as overlapping when appropriate", async () => {
    // Existing event in Los Angeles during spring forward day:
    // 2025-03-09 03:00 - 04:00 PT
    const eventLA = {
      title: "LA Spring Forward",
      description: "LA DST start",
      date: "2025-03-09",
      time: "03:00",
      endTime: "04:00",
      endDate: "2025-03-09",
      timeZone: "America/Los_Angeles",
      location: "LA",
      type: "Effective Communication Workshop",
      format: "In-person",
      purpose: "Test",
      agenda: "Agenda",
      organizer: "Org",
      roles: [
        {
          id: "role-1",
          name: "Zoom Host",
          maxParticipants: 1,
          description: "host",
        },
      ],
    } as any;

    await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(eventLA)
      .expect(201);

    // 02:30 PT does not exist on spring-forward day. Our backend maps wall-clock via timeZone; we
    // expect it to resolve within the event window (effectively ~03:30), thus conflict = true.
    const res = await request(app)
      .get("/api/events/check-conflict")
      .query({
        startDate: "2025-03-09",
        startTime: "02:30",
        mode: "point",
        timeZone: "America/Los_Angeles",
      })
      .expect(200);
    expect(res.body).toMatchObject({ success: true, data: { conflict: true } });
  });

  it("handles DST fall-back repeated hour (LA 2025-11-02) correctly", async () => {
    // Event spanning the repeated hour: 00:30 - 02:30 PT on 2025-11-02
    const eventLA = {
      title: "LA Fall Back",
      description: "LA DST end",
      date: "2025-11-02",
      time: "00:30",
      endTime: "02:30",
      endDate: "2025-11-02",
      timeZone: "America/Los_Angeles",
      location: "LA",
      type: "Effective Communication Workshop",
      format: "In-person",
      purpose: "Test",
      agenda: "Agenda",
      organizer: "Org",
      roles: [
        {
          id: "role-1",
          name: "Zoom Host",
          maxParticipants: 1,
          description: "host",
        },
      ],
    } as any;

    await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(eventLA)
      .expect(201);

    // 01:15 PT should fall within the event regardless of which 01:15 instance (DST or standard)
    const conflict = await request(app)
      .get("/api/events/check-conflict")
      .query({
        startDate: "2025-11-02",
        startTime: "01:15",
        mode: "point",
        timeZone: "America/Los_Angeles",
      })
      .expect(200);
    expect(conflict.body).toMatchObject({
      success: true,
      data: { conflict: true },
    });

    // After event window
    const after = await request(app)
      .get("/api/events/check-conflict")
      .query({
        startDate: "2025-11-02",
        startTime: "02:45",
        mode: "point",
        timeZone: "America/Los_Angeles",
      })
      .expect(200);
    expect(after.body).toMatchObject({
      success: true,
      data: { conflict: false },
    });
  });

  it("supports range mode and cross-zone comparisons", async () => {
    // Existing event: New York, 2025-05-10 10:00 - 11:00
    const eventNY = {
      title: "Cross TZ Range NY",
      description: "NY event",
      date: "2025-05-10",
      time: "10:00",
      endTime: "11:00",
      endDate: "2025-05-10",
      timeZone: "America/New_York",
      location: "NYC",
      type: "Effective Communication Workshop",
      format: "In-person",
      purpose: "Test",
      agenda: "Agenda",
      organizer: "Org",
      roles: [
        {
          id: "role-1",
          name: "Zoom Host",
          maxParticipants: 1,
          description: "host",
        },
      ],
    } as any;

    await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(eventNY)
      .expect(201);

    // Candidate range in LA overlapping midway (07:45 - 08:15 PT == 10:45 - 11:15 ET) -> conflict
    const overlap = await request(app)
      .get("/api/events/check-conflict")
      .query({
        startDate: "2025-05-10",
        startTime: "07:45",
        endDate: "2025-05-10",
        endTime: "08:15",
        mode: "range",
        timeZone: "America/Los_Angeles",
      })
      .expect(200);
    expect(overlap.body).toMatchObject({
      success: true,
      data: { conflict: true },
    });

    // Non-overlapping range (05:30 - 06:30 PT == 08:30 - 09:30 ET) -> no conflict
    const clear = await request(app)
      .get("/api/events/check-conflict")
      .query({
        startDate: "2025-05-10",
        startTime: "05:30",
        endDate: "2025-05-10",
        endTime: "06:30",
        mode: "range",
        timeZone: "America/Los_Angeles",
      })
      .expect(200);
    expect(clear.body).toMatchObject({
      success: true,
      data: { conflict: false },
    });
  });
});
