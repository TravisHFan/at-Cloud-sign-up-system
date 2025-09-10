import request from "supertest";
import mongoose from "mongoose";
import {
  describe,
  test,
  beforeAll,
  afterAll,
  beforeEach,
  expect,
} from "vitest";
import app from "../../src/app";
import EventModel from "../../src/models/Event";
import { createAndLoginTestUser } from "../test-utils/createTestUser";

// Validates global sorting by 'type' (new field) is applied before pagination
// and that deterministic tie-breakers (title asc -> date asc -> time asc) hold

describe("Events Global Sorting by Type + Pagination", () => {
  let authToken: string;
  let userId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI ||
          "mongodb://127.0.0.1:27017/atcloud-signup-test"
      );
    }
    const { token } = await createAndLoginTestUser({ role: "Participant" });
    authToken = token;
    const userDoc = await (mongoose.connection as any).db
      .collection("users")
      .findOne({});
    if (!userDoc?._id) throw new Error("Failed to get test user id");
    userId = userDoc._id as mongoose.Types.ObjectId;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await EventModel.deleteMany({});
  });

  interface SeedSpec {
    type: string;
    title: string;
    dateOffset: number;
    time: string;
  }

  const seedSpecs: SeedSpec[] = [
    // Use only allowed enum values: Conference, Webinar, Effective Communication Workshop, Mentor Circle
    { type: "Conference", title: "Zeta", dateOffset: 5, time: "10:00" },
    { type: "Webinar", title: "Alpha", dateOffset: 2, time: "10:00" },
    { type: "Mentor Circle", title: "Beta", dateOffset: 7, time: "09:00" },
    { type: "Webinar", title: "Gamma", dateOffset: 3, time: "09:30" },
    { type: "Conference", title: "Beta", dateOffset: 1, time: "11:00" },
    { type: "Mentor Circle", title: "Alpha", dateOffset: 4, time: "08:30" },
    {
      type: "Effective Communication Workshop",
      title: "Delta",
      dateOffset: 6,
      time: "13:00",
    },
    { type: "Conference", title: "Alpha", dateOffset: 8, time: "12:00" },
    { type: "Webinar", title: "Beta", dateOffset: 9, time: "14:00" },
  ];

  const seed = async () => {
    const role = {
      id: "r1",
      name: "Participant",
      description: "General",
      maxParticipants: 50,
    };
    await EventModel.insertMany(
      seedSpecs.map((s) => ({
        title: s.title + " Title", // ensure uniqueness with suffix while preserving lexical order start
        description: "Type sort test",
        date: new Date(Date.now() + s.dateOffset * 86400000)
          .toISOString()
          .split("T")[0],
        time: s.time,
        endTime: "18:00",
        status: "upcoming",
        location: "Test",
        organizer: "Org",
        type: s.type,
        format: "Online",
        roles: [role],
        createdBy: userId,
      }))
    );
  };

  const collectAllPages = async (query: Record<string, string | number>) => {
    const p1 = await request(app)
      .get("/api/events")
      .set("Authorization", `Bearer ${authToken}`)
      .query({ statuses: "upcoming", page: 1, limit: 3, ...query });
    expect(p1.status).toBe(200);
    const p2 = await request(app)
      .get("/api/events")
      .set("Authorization", `Bearer ${authToken}`)
      .query({ statuses: "upcoming", page: 2, limit: 3, ...query });
    expect(p2.status).toBe(200);
    const p3 = await request(app)
      .get("/api/events")
      .set("Authorization", `Bearer ${authToken}`)
      .query({ statuses: "upcoming", page: 3, limit: 3, ...query });
    expect(p3.status).toBe(200);
    return [
      p1.body.data.events,
      p2.body.data.events,
      p3.body.data.events,
    ].flat();
  };

  test("global type ascending sort spans pages with deterministic tie-breaks", async () => {
    await seed();
    const all = await collectAllPages({ sortBy: "type", sortOrder: "asc" });
    const triples = all.map((e: any) => [e.type, e.title, e.date, e.time]);
    const sorted = [...triples].sort((a, b) => {
      // type asc, title asc, date asc, time asc
      for (const idx of [0, 1]) {
        const cmp = String(a[idx]).localeCompare(String(b[idx]));
        if (cmp !== 0) return cmp;
      }
      const dateCmp = new Date(a[2]).getTime() - new Date(b[2]).getTime();
      if (dateCmp !== 0) return dateCmp;
      return String(a[3]).localeCompare(String(b[3]));
    });
    expect(triples).toEqual(sorted);
  });

  test("global type descending sort spans pages with deterministic tie-breaks", async () => {
    await seed();
    const all = await collectAllPages({ sortBy: "type", sortOrder: "desc" });
    const triples = all.map((e: any) => [e.type, e.title, e.date, e.time]);
    const sorted = [...triples].sort((a, b) => {
      // type desc, then remaining tie-breakers same (title asc, date asc, time asc)
      const typeCmp = String(b[0]).localeCompare(String(a[0]));
      if (typeCmp !== 0) return typeCmp;
      const titleCmp = String(a[1]).localeCompare(String(b[1]));
      if (titleCmp !== 0) return titleCmp;
      const dateCmp = new Date(a[2]).getTime() - new Date(b[2]).getTime();
      if (dateCmp !== 0) return dateCmp;
      return String(a[3]).localeCompare(String(b[3]));
    });
    expect(triples).toEqual(sorted);
  });
});
