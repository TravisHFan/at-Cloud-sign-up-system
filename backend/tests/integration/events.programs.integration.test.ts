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
 * 1. Create multiple Programs via direct model
 * 2. Create an event linked to multiple programs via API (programLabels array)
 * 3. Verify event has all programLabels
 * 4. Verify all programs have the event in their events array
 */

describe("Programs integration with Events (programLabels)", () => {
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

  test("event can be linked to multiple programs via programLabels array", async () => {
    // Create multiple programs
    const program1 = await ProgramModel.create({
      title: "Leadership Program 2025",
      programType: "EMBA Mentor Circles",
      fullPriceTicket: 100,
      createdBy: userId,
    });

    const program2 = await ProgramModel.create({
      title: "Communication Workshop Series",
      programType: "Effective Communication Workshops",
      fullPriceTicket: 200,
      createdBy: userId,
    });

    const program3 = await ProgramModel.create({
      title: "Executive Development",
      programType: "EMBA Mentor Circles",
      fullPriceTicket: 150,
      createdBy: userId,
    });

    // Create event via API with multiple programLabels
    const futureDateStr = new Date(Date.now() + 7 * 86400000)
      .toISOString()
      .split("T")[0];

    const createRes = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        title: "Multi-Program Event",
        type: "Workshop",
        date: futureDateStr,
        time: "10:00",
        endTime: "11:00",
        location: "Room 1",
        organizer: "Org",
        agenda:
          "Welcome and introductions. Workshop session covering key topics from multiple programs.",
        format: "In-person",
        roles: [
          {
            name: "Attendee",
            description: "No special role",
            maxParticipants: 30,
          },
        ],
        programLabels: [
          program1._id.toString(),
          program2._id.toString(),
          program3._id.toString(),
        ],
      });

    if (createRes.status !== 201) {
      // eslint-disable-next-line no-console
      console.error("Multi-program event create failed", {
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

    // Verify programLabels contains all 3 programs
    expect(event.programLabels).toHaveLength(3);
    expect(event.programLabels).toContain(program1._id.toString());
    expect(event.programLabels).toContain(program2._id.toString());
    expect(event.programLabels).toContain(program3._id.toString());

    // Verify all programs have this event in their events array
    const updatedProgram1 = await ProgramModel.findById(program1._id);
    const updatedProgram2 = await ProgramModel.findById(program2._id);
    const updatedProgram3 = await ProgramModel.findById(program3._id);

    expect(
      updatedProgram1?.events?.some((id: any) => id.toString() === eventId)
    ).toBe(true);
    expect(
      updatedProgram2?.events?.some((id: any) => id.toString() === eventId)
    ).toBe(true);
    expect(
      updatedProgram3?.events?.some((id: any) => id.toString() === eventId)
    ).toBe(true);
  });

  test("event with single program still works (backward compatible)", async () => {
    const program = await ProgramModel.create({
      title: "Single Program",
      programType: "EMBA Mentor Circles",
      fullPriceTicket: 100,
      createdBy: userId,
    });

    const futureDateStr = new Date(Date.now() + 7 * 86400000)
      .toISOString()
      .split("T")[0];

    const createRes = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        title: "Single Program Event",
        type: "Workshop",
        date: futureDateStr,
        time: "10:00",
        endTime: "11:00",
        location: "Room 1",
        organizer: "Org",
        agenda:
          "Welcome and introductions. Workshop session for single program.",
        format: "In-person",
        roles: [
          {
            name: "Attendee",
            description: "No special role",
            maxParticipants: 30,
          },
        ],
        programLabels: [program._id.toString()],
      });

    expect(createRes.status).toBe(201);
    const eventId =
      createRes.body?.data?.event?._id || createRes.body?.data?.event?.id;

    // Fetch event
    const getRes = await request(app)
      .get(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${authToken}`);

    const event = getRes.body?.data?.event;
    expect(event.programLabels).toHaveLength(1);
    expect(event.programLabels[0]).toBe(program._id.toString());

    // Verify program has event
    const updatedProgram = await ProgramModel.findById(program._id);
    expect(
      updatedProgram?.events?.some((id: any) => id.toString() === eventId)
    ).toBe(true);
  });

  test("event with no programs (empty programLabels) works", async () => {
    const futureDateStr = new Date(Date.now() + 7 * 86400000)
      .toISOString()
      .split("T")[0];

    const createRes = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        title: "No Program Event",
        type: "Workshop",
        date: futureDateStr,
        time: "10:00",
        endTime: "11:00",
        location: "Room 1",
        organizer: "Org",
        agenda: "Welcome and introductions. Workshop with no program linkage.",
        format: "In-person",
        roles: [
          {
            name: "Attendee",
            description: "No special role",
            maxParticipants: 30,
          },
        ],
        programLabels: [],
      });

    expect(createRes.status).toBe(201);
    const eventId =
      createRes.body?.data?.event?._id || createRes.body?.data?.event?.id;

    // Fetch event
    const getRes = await request(app)
      .get(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${authToken}`);

    const event = getRes.body?.data?.event;
    expect(event.programLabels || []).toHaveLength(0);
  });
});
