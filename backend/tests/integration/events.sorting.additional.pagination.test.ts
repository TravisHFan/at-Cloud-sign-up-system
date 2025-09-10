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

// Additional coverage for global server-side sorting BEFORE pagination.
// Covers: date asc, title desc, organizer desc, tie-breaker stability, case-insensitive collation.

describe("Events Global Sorting + Pagination (extended)", () => {
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

  const baseRole = {
    id: "role-common",
    name: "Common Participant",
    description: "General participants",
    maxParticipants: 50,
  };

  interface SeedEvent {
    title: string;
    organizer: string;
    date: string;
    time?: string;
    endTime?: string;
    status?: string;
    location?: string;
    type?: string;
    format?: string;
  }

  const seed = async (events: SeedEvent[]) => {
    await EventModel.insertMany(
      events.map((e) => ({
        title: e.title,
        description: "Extended sorting test event",
        date: e.date,
        time: e.time || "10:00",
        endTime: e.endTime || "11:00",
        status: e.status || "upcoming",
        location: e.location || "Test Location",
        organizer: e.organizer,
        type: e.type || "Conference",
        format: e.format || "Online",
        roles: [baseRole],
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

  const day = (offset: number) =>
    new Date(Date.now() + offset * 86400000).toISOString().split("T")[0];

  test("global date ascending sort spans pages correctly", async () => {
    await seed([
      { title: "E", organizer: "OrgA", date: day(5) },
      { title: "D", organizer: "OrgA", date: day(4) },
      { title: "C", organizer: "OrgB", date: day(3) },
      { title: "B", organizer: "OrgC", date: day(2) },
      { title: "A", organizer: "OrgD", date: day(1) },
      { title: "F", organizer: "OrgE", date: day(6) },
      { title: "G", organizer: "OrgF", date: day(7) },
      { title: "H", organizer: "OrgG", date: day(8) },
      { title: "I", organizer: "OrgH", date: day(9) },
      { title: "J", organizer: "OrgI", date: day(10) },
      { title: "K", organizer: "OrgJ", date: day(11) },
    ]);
    const all = await collectAllPages({ sortBy: "date", sortOrder: "asc" });
    const dates = all.map((e: any) => e.date);
    for (let i = 1; i < dates.length; i++) {
      expect(new Date(dates[i - 1]) <= new Date(dates[i])).toBe(true);
    }
  });

  test("global title descending sort spans pages correctly", async () => {
    await seed([
      { title: "Alpha", organizer: "OrgA", date: day(1) },
      { title: "Gamma", organizer: "OrgB", date: day(2) },
      { title: "Beta", organizer: "OrgC", date: day(3) },
      { title: "Omega", organizer: "OrgD", date: day(4) },
      { title: "Theta", organizer: "OrgE", date: day(5) },
      { title: "Lambda", organizer: "OrgF", date: day(6) },
      { title: "Delta", organizer: "OrgG", date: day(7) },
      { title: "Sigma", organizer: "OrgH", date: day(8) },
      { title: "Zeta", organizer: "OrgI", date: day(9) },
      { title: "Eta", organizer: "OrgJ", date: day(10) },
      { title: "Chi", organizer: "OrgK", date: day(11) },
    ]);
    const all = await collectAllPages({ sortBy: "title", sortOrder: "desc" });
    const titles = all.map((e: any) => e.title);
    const sorted = [...titles].sort((a, b) => b.localeCompare(a));
    expect(titles).toEqual(sorted);
  });

  test("global organizer descending sort spans pages correctly", async () => {
    await seed([
      { title: "A1", organizer: "OrgA", date: day(1) },
      { title: "B1", organizer: "OrgB", date: day(2) },
      { title: "C1", organizer: "OrgC", date: day(3) },
      { title: "D1", organizer: "OrgD", date: day(4) },
      { title: "E1", organizer: "OrgE", date: day(5) },
      { title: "F1", organizer: "OrgF", date: day(6) },
      { title: "G1", organizer: "OrgG", date: day(7) },
      { title: "H1", organizer: "OrgH", date: day(8) },
      { title: "I1", organizer: "OrgI", date: day(9) },
      { title: "J1", organizer: "OrgJ", date: day(10) },
      { title: "K1", organizer: "OrgK", date: day(11) },
    ]);
    const all = await collectAllPages({
      sortBy: "organizer",
      sortOrder: "desc",
    });
    const organizers = all.map((e: any) => e.organizer);
    const sorted = [...organizers].sort((a, b) => b.localeCompare(a));
    expect(organizers).toEqual(sorted);
  });

  test("title tie-break uses date asc then time asc when titles identical", async () => {
    // Two groups of identical titles; dates intentionally unordered
    await seed([
      { title: "Repeat Title", organizer: "OrgA", date: day(5), time: "11:00" },
      { title: "Repeat Title", organizer: "OrgB", date: day(3), time: "09:00" },
      { title: "Repeat Title", organizer: "OrgC", date: day(3), time: "08:00" }, // earlier time
      { title: "Repeat Title", organizer: "OrgD", date: day(4), time: "10:00" },
      { title: "Repeat Title", organizer: "OrgE", date: day(6), time: "10:00" },
      { title: "Another", organizer: "OrgZ", date: day(2), time: "09:00" },
      { title: "Another", organizer: "OrgY", date: day(1), time: "09:00" }, // earlier date
      { title: "Another", organizer: "OrgX", date: day(1), time: "08:00" }, // earlier time
    ]);
    const all = await collectAllPages({ sortBy: "title", sortOrder: "asc" });
    // Titles will group: "Another" then "Repeat Title"; check intra-group ordering
    const anothers = all.filter((e: any) => e.title === "Another");
    const repeats = all.filter((e: any) => e.title === "Repeat Title");
    const anDatesTimes = anothers.map((e: any) => `${e.date}T${e.time}`);
    const repDatesTimes = repeats.map((e: any) => `${e.date}T${e.time}`);
    const sortedAn = [...anDatesTimes].sort();
    const sortedRep = [...repDatesTimes].sort();
    expect(anDatesTimes).toEqual(sortedAn);
    expect(repDatesTimes).toEqual(sortedRep);
  });

  test("organizer tie-break uses title asc then date asc then time asc", async () => {
    await seed([
      { title: "Zeta", organizer: "SameOrg", date: day(4), time: "11:00" },
      { title: "Alpha", organizer: "SameOrg", date: day(1), time: "10:00" },
      { title: "Alpha", organizer: "SameOrg", date: day(1), time: "09:00" }, // earlier time
      { title: "Beta", organizer: "SameOrg", date: day(2), time: "10:00" },
      { title: "Gamma", organizer: "SameOrg", date: day(3), time: "10:30" },
      { title: "Misc", organizer: "OtherOrg", date: day(5), time: "10:00" },
      { title: "Misc2", organizer: "AnotherOrg", date: day(6), time: "10:00" },
    ]);
    const all = await collectAllPages({
      sortBy: "organizer",
      sortOrder: "asc",
    });
    const sameOrg = all.filter((e: any) => e.organizer === "SameOrg");
    const orderingKeys = sameOrg.map(
      (e: any) => `${e.title}|${e.date}|${e.time}`
    );
    const expected = [...orderingKeys].sort(); // since tie-break chain is title asc, date asc, time asc
    expect(orderingKeys).toEqual(expected);
  });

  test("case-insensitive title ascending uses base-insensitive ordering", async () => {
    await seed([
      { title: "alpha event", organizer: "OrgA", date: day(1) },
      { title: "Alpha Event", organizer: "OrgB", date: day(2) },
      { title: "BETA session", organizer: "OrgC", date: day(3) },
      { title: "beta Session", organizer: "OrgD", date: day(4) },
      { title: "gamma Talk", organizer: "OrgE", date: day(5) },
      { title: "GAMMA talk", organizer: "OrgF", date: day(6) },
      { title: "delta meetup", organizer: "OrgG", date: day(7) },
      { title: "Delta Meetup", organizer: "OrgH", date: day(8) },
    ]);
    const all = await collectAllPages({ sortBy: "title", sortOrder: "asc" });
    const titles = all.map((e: any) => e.title);
    const lower = titles.map((t: string) => t.toLowerCase());
    const sortedLower = [...lower].sort();
    expect(lower).toEqual(sortedLower);
  });
});
