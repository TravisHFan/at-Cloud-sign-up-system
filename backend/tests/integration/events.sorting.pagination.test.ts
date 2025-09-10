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

// Validates that server-side sorting is applied globally BEFORE pagination.
// We insert events with titles & organizers purposely out-of-order relative to dates
// then verify ordering across page boundaries for date, title, and organizer sorts.

describe("Events Global Sorting + Pagination", () => {
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
    idx: number;
    title: string;
    organizer: string;
    dateOffset: number; // days from now
  }

  const specs: SeedSpec[] = [
    { idx: 1, title: "Zeta Gathering", organizer: "Orchard", dateOffset: 5 },
    { idx: 2, title: "Alpha Summit", organizer: "Beta Org", dateOffset: 15 },
    { idx: 3, title: "Lambda Meetup", organizer: "Alpha Org", dateOffset: 2 },
    { idx: 4, title: "Beta Workshop", organizer: "Gamma Org", dateOffset: 20 },
    { idx: 5, title: "Omega Forum", organizer: "Zebra Org", dateOffset: 1 },
    { idx: 6, title: "Delta Retreat", organizer: "Delta Org", dateOffset: 30 },
    { idx: 7, title: "Gamma Panel", organizer: "Epsilon Org", dateOffset: 12 },
    {
      idx: 8,
      title: "Epsilon Conference",
      organizer: "Alpha Org",
      dateOffset: 8,
    },
    { idx: 9, title: "Kappa Hackday", organizer: "Kappa Org", dateOffset: 3 },
    { idx: 10, title: "Eta Connect", organizer: "Theta Org", dateOffset: 11 },
    {
      idx: 11,
      title: "Theta Fireside",
      organizer: "Lambda Org",
      dateOffset: 18,
    },
    { idx: 12, title: "Iota Open", organizer: "Iota Org", dateOffset: 6 },
    { idx: 13, title: "Chi Expo", organizer: "Chi Org", dateOffset: 14 },
  ];

  const seedEvents = async () => {
    const role = {
      id: "role-common",
      name: "Common Participant",
      description: "General participants",
      maxParticipants: 50,
    };
    await EventModel.insertMany(
      specs.map((s) => ({
        title: s.title,
        description: "Sorting test event",
        date: new Date(Date.now() + s.dateOffset * 86400000)
          .toISOString()
          .split("T")[0],
        time: "10:00",
        endTime: "11:00",
        status: "upcoming",
        location: "Test Location",
        organizer: s.organizer,
        type: "Conference",
        format: "Online",
        roles: [role],
        createdBy: userId,
      }))
    );
  };

  const collectAllPages = async (query: Record<string, string | number>) => {
    const page1 = await request(app)
      .get("/api/events")
      .set("Authorization", `Bearer ${authToken}`)
      .query({ statuses: "upcoming", page: 1, limit: 5, ...query });
    expect(page1.status).toBe(200);
    const page2 = await request(app)
      .get("/api/events")
      .set("Authorization", `Bearer ${authToken}`)
      .query({ statuses: "upcoming", page: 2, limit: 5, ...query });
    expect(page2.status).toBe(200);
    const page3 = await request(app)
      .get("/api/events")
      .set("Authorization", `Bearer ${authToken}`)
      .query({ statuses: "upcoming", page: 3, limit: 5, ...query });
    expect(page3.status).toBe(200);
    return [
      page1.body.data.events,
      page2.body.data.events,
      page3.body.data.events,
    ].flat();
  };

  test("global date descending sort spans pages correctly", async () => {
    await seedEvents();
    const all = await collectAllPages({ sortBy: "date", sortOrder: "desc" });
    const dates = all.map((e: any) => e.date);
    // Ensure non-increasing (desc) order
    for (let i = 1; i < dates.length; i++) {
      expect(new Date(dates[i - 1]) >= new Date(dates[i])).toBe(true);
    }
  });

  test("global title ascending sort spans pages correctly", async () => {
    await seedEvents();
    const all = await collectAllPages({ sortBy: "title", sortOrder: "asc" });
    const titles = all.map((e: any) => e.title);
    const copy = [...titles].sort((a, b) => a.localeCompare(b));
    expect(titles).toEqual(copy);
  });

  test("global organizer ascending sort spans pages correctly", async () => {
    await seedEvents();
    const all = await collectAllPages({
      sortBy: "organizer",
      sortOrder: "asc",
    });
    const organizers = all.map((e: any) => e.organizer);
    const sorted = [...organizers].sort((a, b) => a.localeCompare(b));
    expect(organizers).toEqual(sorted);
  });
});
