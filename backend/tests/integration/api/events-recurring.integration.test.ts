import request from "supertest";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Event from "../../../src/models/Event";
import Message from "../../../src/models/Message";
import { createAndLoginTestUser } from "../../test-utils/createTestUser";

/**
 * Helpers
 */
const toUtcMidnight = (dateStr: string) => new Date(`${dateStr}T00:00:00Z`);
const getWeekday = (dateStr: string) => toUtcMidnight(dateStr).getUTCDay(); // 0-6
const daysBetween = (a: string, b: string) =>
  Math.round(
    (toUtcMidnight(b).getTime() - toUtcMidnight(a).getTime()) /
      (24 * 60 * 60 * 1000)
  );
const minutesFromHHMM = (hhmm: string) => {
  const [hh, mm] = hhmm.split(":").map((n) => parseInt(n, 10));
  return hh * 60 + mm;
};
const durationMinutes = (
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string
) => {
  const dayDiff = daysBetween(startDate, endDate);
  return (
    dayDiff * 24 * 60 + (minutesFromHHMM(endTime) - minutesFromHHMM(startTime))
  );
};

/**
 * Admin bootstrap for this suite
 */
describe("Recurring Events - series creation and notifications", () => {
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    // Use robust helper to satisfy current registration validation rules
    const admin = await createAndLoginTestUser({ role: "Administrator" });
    adminToken = admin.token;
    // Fetch profile to get user id for cleanup
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

  it("creates biweekly series with exact 14-day spacing and same weekday", async () => {
    // pick next Monday to stabilize weekday expectations
    const now = new Date();
    const day = now.getDay(); // 0-6
    const daysUntilMonday = (1 - day + 7) % 7 || 7; // at least next week
    const nextMonday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + daysUntilMonday,
      0,
      0,
      0,
      0
    )
      .toISOString()
      .split("T")[0];

    const res = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Biweekly Series",
        description: "Test biweekly recurring",
        date: nextMonday,
        time: "12:15", // avoid conflicts with other tests
        endTime: "13:45",
        type: "Conference", // Use a type compatible with the role below
        format: "In-person",
        location: "Main Hall", // Required for In-person
        agenda: "Intro sessions and demos",
        organizer: "Org",
        purpose: "Testing biweekly",
        roles: [
          {
            id: "r1",
            name: "Common Participant (Zoom)",
            maxParticipants: 5,
            description: "General",
          },
        ],
        recurring: {
          isRecurring: true,
          frequency: "every-two-weeks",
          occurrenceCount: 4,
        },
      })
      .expect(201);

    expect(res.body.data.series).toBeDefined();
    expect(res.body.data.series.length).toBe(4);

    const seriesIds: string[] = res.body.data.series;
    const events = [] as any[];
    for (const id of seriesIds) {
      const detail = await request(app)
        .get(`/api/events/${id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      events.push(detail.body.data.event);
    }

    const weekday0 = getWeekday(events[0].date);
    events.forEach((e) => expect(getWeekday(e.date)).toBe(weekday0));

    for (let i = 1; i < events.length; i++) {
      expect(daysBetween(events[i - 1].date, events[i].date)).toBe(14);
    }

    // Single system message for the series
    const msgCount = await Message.countDocuments({
      "metadata.kind": "new_event",
    });
    expect(msgCount).toBe(1);
  });

  it("creates monthly series and preserves duration including overnight (multi-day)", async () => {
    // choose a start date 10 days from now
    const startDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const res = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Monthly Overnight Series",
        description: "Monthly, overnight duration",
        date: startDate,
        endDate: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0], // next day
        time: "22:00",
        endTime: "01:30",
        type: "Webinar",
        format: "In-person",
        location: "Main Hall", // Required for In-person
        agenda: "Evening into morning",
        organizer: "Org",
        purpose: "Validate monthly overnight duration preservation",
        roles: [
          {
            id: "r1",
            name: "Speakers", // Valid role for Webinar
            maxParticipants: 4,
            description: "Talks",
          },
        ],
        recurring: {
          isRecurring: true,
          frequency: "monthly",
          occurrenceCount: 3,
        },
      })
      .expect(201);

    const seriesIds: string[] = res.body.data.series;
    expect(seriesIds.length).toBe(3);

    const events = [] as any[];
    for (const id of seriesIds) {
      const detail = await request(app)
        .get(`/api/events/${id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      events.push(detail.body.data.event);
    }

    const weekday0 = getWeekday(events[0].date);
    events.forEach((e) => expect(getWeekday(e.date)).toBe(weekday0));

    const baseDuration = durationMinutes(
      events[0].date,
      events[0].time,
      events[0].endDate,
      events[0].endTime
    );
    expect(baseDuration).toBeGreaterThan(0);

    // every occurrence should preserve the same total duration and remain multi-day (endDate != date)
    events.forEach((e) => {
      const dur = durationMinutes(e.date, e.time, e.endDate, e.endTime);
      expect(dur).toBe(baseDuration);
      expect(daysBetween(e.date, e.endDate)).toBeGreaterThan(0);
    });
  });

  it("creates every-two-months series keeping the same weekday", async () => {
    const startDate = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000) // push further out to avoid overlaps
      .toISOString()
      .split("T")[0];

    const res = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Bi-monthly Series",
        description: "Every two months",
        date: startDate,
        time: "07:10", // unique time to avoid conflicts
        endTime: "08:10",
        type: "Conference",
        format: "Online",
        location: "Auditorium",
        agenda: "Talks and Q&A sessions",
        organizer: "Org",
        purpose: "Validate bi-monthly weekday adherence",
        roles: [
          {
            id: "r1",
            name: "Common Participant (Zoom)", // Valid role for Conference
            maxParticipants: 10,
            description: "General",
          },
        ],
        recurring: {
          isRecurring: true,
          frequency: "every-two-months",
          occurrenceCount: 3,
        },
      })
      .expect(201);

    const seriesIds: string[] = res.body.data.series;
    expect(seriesIds.length).toBe(3);

    const events = [] as any[];
    for (const id of seriesIds) {
      const detail = await request(app)
        .get(`/api/events/${id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      events.push(detail.body.data.event);
    }

    const weekday0 = getWeekday(events[0].date);
    events.forEach((e) => expect(getWeekday(e.date)).toBe(weekday0));

    // Single system message for the series
    const msgCount = await Message.countDocuments({
      "metadata.kind": "new_event",
    });
    expect(msgCount).toBe(1);
  });
});
