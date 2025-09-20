import request from "supertest";
import mongoose from "mongoose";
import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import app from "../../../src/app";
import EventModel from "../../../src/models/Event";
import ProgramModel from "../../../src/models/Program";
import { createAndLoginTestUser } from "../../test-utils/createTestUser";

/**
 * Tests GET /api/programs/:id/events with server-side pagination and sorting
 */

describe("GET /api/programs/:id/events (paged)", () => {
  let adminToken: string;
  let programId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI ||
          "mongodb://127.0.0.1:27017/atcloud-signup-test"
      );
    }
    const { token } = await createAndLoginTestUser({ role: "Administrator" });
    adminToken = token;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await EventModel.deleteMany({});
    await ProgramModel.deleteMany({});

    const createdProgram = await ProgramModel.create({
      title: "Paged Program",
      programType: "Effective Communication Workshops",
      fullPriceTicket: 1000,
      createdBy: new mongoose.Types.ObjectId(),
    } as any);
    programId = createdProgram._id.toString();

    // Create 25 events linked to the program with consecutive dates
    const baseDate = new Date("2025-01-01T00:00:00Z");
    const docs = Array.from({ length: 25 }).map((_, i) => {
      const d = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
      const date = d.toISOString().split("T")[0];
      return {
        title: `Event ${i + 1}`,
        type: "Effective Communication Workshop",
        date,
        endDate: date,
        time: "10:00",
        endTime: "11:00",
        location: "Room 1",
        organizer: "Org",
        agenda:
          "Welcome and introductions. Session focusing on effective communication skills and practice.",
        format: "In-person",
        roles: [
          {
            id: `r-${i + 1}-1`,
            name: "Participants",
            description: "Attendees",
            maxParticipants: 10,
          },
        ],
        status: "upcoming",
        createdBy: new mongoose.Types.ObjectId(),
        programId: createdProgram._id,
      } as any;
    });
    await EventModel.insertMany(docs);
  });

  it("returns paged items with totals and default asc sort", async () => {
    const res = await request(app)
      .get(`/api/programs/${programId}/events?page=1&limit=20&sort=date:asc`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    const data = res.body?.data;
    expect(Array.isArray(data?.items)).toBe(true);
    expect(data.items.length).toBe(20);
    expect(data.page).toBe(1);
    expect(data.limit).toBe(20);
    expect(data.total).toBe(25);
    expect(data.totalPages).toBe(2);
    expect(data.sort?.dir).toBe("asc");
    // First item should be Event 1 on 2025-01-01
    expect(data.items[0].title).toBe("Event 1");
  });

  it("returns second page and honors desc sort", async () => {
    const res = await request(app)
      .get(`/api/programs/${programId}/events?page=2&limit=20&sort=date:desc`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    const data = res.body?.data;
    expect(data.items.length).toBe(5);
    expect(data.page).toBe(2);
    expect(data.total).toBe(25);
    expect(data.totalPages).toBe(2);
    expect(data.sort?.dir).toBe("desc");
    // In desc, page 1 has Event 25..6; page 2 has Event 5..1
    expect(data.items[0].title).toBe("Event 5");
    expect(data.items[data.items.length - 1].title).toBe("Event 1");
  });

  it("returns legacy array when no paging params provided", async () => {
    const res = await request(app)
      .get(`/api/programs/${programId}/events`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.data)).toBe(true);
    expect(res.body.data.length).toBe(25);
  });
});
