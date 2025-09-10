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

// Basic pagination integration tests for GET /api/events and /api/events/user/registered

describe("Events Pagination Integration", () => {
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
    // fetch user to get id
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

  const makeEvent = (idx: number) => ({
    title: `Paginated Event ${idx}`,
    description: "Test event for pagination",
    date: new Date(Date.now() + idx * 86400000).toISOString().split("T")[0],
    time: "10:00",
    endTime: "11:00",
    status: "upcoming",
    location: "Online Location", // acceptable even for Online format
    organizer: "Test Organizer",
    type: "Conference",
    format: "Online",
    roles: [
      {
        id: "role-common",
        name: "Common Participant (Zoom)",
        description: "General participants",
        // Must be <= 100 per EventRole schema validation
        maxParticipants: 50,
      },
    ],
    createdBy: userId,
  });

  test("GET /api/events returns correct pagination meta and slicing", async () => {
    const total = 13;
    await EventModel.insertMany(
      Array.from({ length: total }, (_, i) => makeEvent(i + 1))
    );

    const page1 = await request(app)
      .get("/api/events")
      .set("Authorization", `Bearer ${authToken}`)
      .query({ statuses: "upcoming", page: 1, limit: 10 });

    expect(page1.status).toBe(200);
    expect(page1.body.data.events).toHaveLength(10);
    expect(page1.body.data.pagination.totalEvents).toBe(total);
    expect(page1.body.data.pagination.hasNext).toBe(true);
    expect(page1.body.data.pagination.currentPage).toBe(1);

    const page2 = await request(app)
      .get("/api/events")
      .set("Authorization", `Bearer ${authToken}`)
      .query({ statuses: "upcoming", page: 2, limit: 10 });

    expect(page2.status).toBe(200);
    expect(page2.body.data.events).toHaveLength(3);
    expect(page2.body.data.pagination.totalEvents).toBe(total);
    expect(page2.body.data.pagination.hasPrev).toBe(true);
    expect(page2.body.data.pagination.currentPage).toBe(2);
  });

  test("GET /api/events/user/registered paginated response", async () => {
    const total = 11;
    const events = await EventModel.insertMany(
      Array.from({ length: total }, (_, i) => makeEvent(i + 1))
    );

    // Register the user for each event via API to create proper Registration docs
    for (const ev of events) {
      await request(app)
        .post(`/api/events/${(ev as any)._id.toString()}/register`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ roleId: "role-common" })
        .expect(200);
    }

    const page1 = await request(app)
      .get("/api/events/user/registered")
      .set("Authorization", `Bearer ${authToken}`)
      .query({ page: 1, limit: 10 });

    expect(page1.status).toBe(200);
    expect(page1.body.data.events).toHaveLength(10);
    expect(page1.body.data.pagination.totalEvents).toBe(total);
    expect(page1.body.data.pagination.hasNext).toBe(true);

    const page2 = await request(app)
      .get("/api/events/user/registered")
      .set("Authorization", `Bearer ${authToken}`)
      .query({ page: 2, limit: 10 });

    expect(page2.status).toBe(200);
    expect(page2.body.data.events).toHaveLength(1);
    expect(page2.body.data.pagination.totalEvents).toBe(total);
    expect(page2.body.data.pagination.hasPrev).toBe(true);
  });
});
