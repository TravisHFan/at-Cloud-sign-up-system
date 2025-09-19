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
import ProgramModel from "../../src/models/Program";
import { createAndLoginTestUser } from "../test-utils/createTestUser";

/**
 * Integration test covering:
 * 1. Create a Program (EMBA Mentor Circles) via direct model to keep scope tight
 * 2. Create a Mentor Circle event linked to that program via API
 * 3. Fetch the event via API and verify mentors snapshot exists
 */

describe("Programs integration with Events", () => {
  let authToken: string;
  let adminToken: string;
  let userId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI ||
          "mongodb://127.0.0.1:27017/atcloud-signup-test"
      );
    }
    const { token } = await createAndLoginTestUser({ role: "Administrator" });
    authToken = token;
    adminToken = token;

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
    await ProgramModel.deleteMany({});
  });

  test("mentor snapshot applied when creating Mentor Circle event with programId + circle", async () => {
    // Create Program with mentorsByCircle
    const program = await ProgramModel.create({
      title: "EMBA 2025 Mentors",
      programType: "EMBA Mentor Circles",
      fullPriceTicket: 0,
      mentorsByCircle: {
        E: [
          {
            userId: new mongoose.Types.ObjectId(),
            firstName: "Alice",
            lastName: "Mentor",
            email: "alice@example.com",
            gender: "female",
          },
        ],
      },
      createdBy: userId,
    } as any);

    // Create event via API
    const futureDateStr = new Date(Date.now() + 7 * 86400000)
      .toISOString()
      .split("T")[0];

    const createRes = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        title: "Mentor Circle E",
        type: "Mentor Circle",
        date: futureDateStr,
        time: "10:00",
        endTime: "11:00",
        location: "Room 1",
        organizer: "Org",
        // agenda is required by validation (20-2000 chars)
        agenda:
          "Welcome and introductions. Mentor circle E session covering key topics and Q&A.",
        format: "In-person",
        // Use valid roles for Mentor Circle type
        roles: [
          {
            name: "Mentees",
            description: "Participants receiving mentorship",
            maxParticipants: 5,
          },
        ],
        programId: program._id.toString(),
        mentorCircle: "E",
      });
    if (createRes.status !== 201) {
      // eslint-disable-next-line no-console
      console.error("Mentor Circle create failed", {
        status: createRes.status,
        body: createRes.body,
      });
    }
    expect(createRes.status).toBe(201);
    const eventId =
      createRes.body?.data?.event?._id || createRes.body?.data?.event?.id;
    expect(eventId).toBeTruthy();

    // Fetch event by id
    const getRes = await request(app)
      .get(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(getRes.status).toBe(200);
    const event = getRes.body?.data?.event;
    expect(event).toBeTruthy();
    // mentors snapshot should be present with Alice Mentor
    expect(event.mentors?.length).toBeGreaterThan(0);
    const found = event.mentors.find(
      (m: any) => m.email === "alice@example.com"
    );
    expect(found).toBeTruthy();
    expect(found.name).toBe("Alice Mentor");
  });
});
