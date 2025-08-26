import request from "supertest";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Event from "../../../src/models/Event";
import Message from "../../../src/models/Message";
import { createAndLoginTestUser } from "../../test-utils/createTestUser";

describe("Recurring Auto-Reschedule", () => {
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    const admin = await createAndLoginTestUser({ role: "Administrator" });
    adminToken = admin.token;
    const me = await request(app)
      .get("/api/auth/profile")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    adminId = me.body.data.user.id;
  });

  afterAll(async () => {
    await User.deleteOne({ _id: adminId });
  });

  beforeEach(async () => {
    await Event.deleteMany({});
    await Message.deleteMany({});
  });

  it("bumps conflicting occurrence by +24h within 6 days", async () => {
    // Base event A at date D 08:00-09:00 (non-conflicting with series 10:00-11:00)
    const baseDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const evA = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Base",
        description: "",
        date: baseDate,
        time: "08:00",
        endTime: "09:00",
        type: "Conference",
        format: "In-person",
        location: "Hall",
        agenda: "Agenda for validation with enough length to pass.",
        organizer: "Org",
        purpose: "Validation purpose",
        roles: [
          {
            id: "r1",
            name: "Common Participant (Zoom)",
            maxParticipants: 5,
            description: "General attendee",
          },
        ],
      })
      .expect(201);
    expect(evA.body.data.event.id).toBeDefined();

    // Now recurring series with first occurrence same slot → initial ok since base is different id/date
    // Create a single occurrence first at same date/time to create a conflict with second desired
    // created event response contains data.event
    expect(evA.body.data.event.id).toBeDefined();

    const conflictDate = new Date(Date.now() + 19 * 24 * 60 * 60 * 1000) // approximately two weeks later + some
      .toISOString()
      .split("T")[0];
    const evConflict = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Conflict",
        description: "",
        date: conflictDate,
        time: "10:00",
        endTime: "11:00",
        type: "Conference",
        format: "In-person",
        location: "Hall",
        agenda: "Agenda for validation with enough length to pass.",
        organizer: "Org",
        purpose: "Validation purpose",
        roles: [
          {
            id: "r1",
            name: "Common Participant (Zoom)",
            maxParticipants: 5,
            description: "General attendee",
          },
        ],
      })
      .expect(201);
    expect(evConflict.body.data.event.id).toBeDefined();

    const res = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Biweekly - auto",
        description: "",
        date: baseDate,
        time: "10:00",
        endTime: "11:00",
        type: "Conference",
        format: "In-person",
        location: "Hall",
        agenda: "Agenda for validation with enough length to pass.",
        organizer: "Org",
        purpose: "Validation purpose",
        roles: [
          {
            id: "r1",
            name: "Common Participant (Zoom)",
            maxParticipants: 5,
            description: "General attendee",
          },
        ],
        recurring: {
          isRecurring: true,
          frequency: "every-two-weeks",
          occurrenceCount: 3,
        },
      })
      .expect(201);

    const seriesIds: string[] = res.body.data.series;
    expect(seriesIds.length).toBe(3);

    // Fetch all and find one scheduled at conflictDate + 1 day
    const events: any[] = [];
    for (const id of seriesIds) {
      const d = await request(app)
        .get(`/api/events/${id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      events.push(d.body.data.event);
    }

    const bumped = events.find(
      (e) =>
        e.date ===
        new Date(new Date(conflictDate).getTime() + 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0]
    );
    expect(bumped).toBeDefined();
  });

  it("skips after 6 days of conflicts and appends an extra occurrence at the tail", async () => {
    // Choose a starting date
    const startDate = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Pre-fill 7 consecutive days at 10-11 to force skip for the second desired occurrence
    for (let i = 0; i <= 6; i++) {
      const d = new Date(
        new Date(startDate).getTime() + (14 + i) * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split("T")[0];
      await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: `Block-${i}`,
          description: "",
          date: d,
          time: "10:00",
          endTime: "11:00",
          type: "Conference",
          format: "In-person",
          location: "Hall",
          agenda: "Agenda for validation with enough length to pass.",
          organizer: "Org",
          purpose: "Validation purpose",
          roles: [
            {
              id: "r1",
              name: "Common Participant (Zoom)",
              maxParticipants: 5,
              description: "General attendee",
            },
          ],
        })
        .expect(201);
    }

    const res = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Biweekly - skip+append",
        description: "",
        date: startDate,
        time: "10:00",
        endTime: "11:00",
        type: "Conference",
        format: "In-person",
        location: "Hall",
        agenda: "Agenda for validation with enough length to pass.",
        organizer: "Org",
        purpose: "Validation purpose",
        roles: [
          {
            id: "r1",
            name: "Common Participant (Zoom)",
            maxParticipants: 5,
            description: "General attendee",
          },
        ],
        recurring: {
          isRecurring: true,
          frequency: "every-two-weeks",
          occurrenceCount: 3,
        },
      })
      .expect(201);

    const seriesIds: string[] = res.body.data.series;
    expect(seriesIds.length).toBe(3);

    // They should not include any on the fully blocked week; and the last one should be appended after the last scheduled
    const fetched: any[] = [];
    for (const id of seriesIds) {
      const d = await request(app)
        .get(`/api/events/${id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      fetched.push(d.body.data.event);
    }

    // Sort by date for inspection
    fetched.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    // Expect the last event to be after the second one by 14 days (append behavior)
    const d1 = new Date(fetched[1].date).getTime();
    const d2 = new Date(fetched[2].date).getTime();
    const diffDays = Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
    expect(diffDays).toBeGreaterThanOrEqual(14);

    // System message should exist for auto-reschedule summary
    const sysMsgs = await Message.find({
      "metadata.kind": "recurring_auto_reschedule",
    });
    expect(sysMsgs.length).toBeGreaterThan(0);
  });
});
