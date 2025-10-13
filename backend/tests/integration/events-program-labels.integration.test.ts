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
 * Integration tests for programLabels field (many-to-many Event-Program relationship)
 *
 * Tests cover:
 * 1. Creating events with programLabels array (0, 1, multiple programs)
 * 2. Updating event programLabels (add, remove, replace)
 * 3. Validation (invalid IDs, non-existent programs)
 * 4. Edge cases (empty array, null values, duplicates, large arrays)
 * 5. Program.events sync verification
 * 6. Backward compatibility
 */

describe("Events with programLabels (many-to-many)", () => {
  let authToken: string;
  let adminToken: string;
  let userId: mongoose.Types.ObjectId;
  let program1Id: string;
  let program2Id: string;
  let program3Id: string;

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
    // Clean up before each test
    await EventModel.deleteMany({});
    await ProgramModel.deleteMany({});

    // Create test programs
    const program1 = await ProgramModel.create({
      title: "Test Program 1",
      programType: "EMBA Mentor Circles",
      createdBy: userId,
      fullPriceTicket: 100,
    });
    program1Id = program1._id.toString();

    const program2 = await ProgramModel.create({
      title: "Test Program 2",
      programType: "Effective Communication Workshops",
      createdBy: userId,
      fullPriceTicket: 200,
    });
    program2Id = program2._id.toString();

    const program3 = await ProgramModel.create({
      title: "Test Program 3",
      programType: "EMBA Mentor Circles",
      createdBy: userId,
      fullPriceTicket: 150,
    });
    program3Id = program3._id.toString();
  });

  // Helper to create valid event data with all required fields
  const createEventData = (overrides: any = {}) => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    return {
      title: "Test Event",
      type: "Effective Communication Workshop", // Valid type from enum
      date: futureDate,
      time: "10:00",
      endTime: "12:00",
      location: "Test Location",
      organizer: "Test Organizer",
      agenda:
        "This is a test agenda for the event with sufficient length to pass validation requirements.",
      format: "In-person",
      roles: [
        {
          id: "role-1",
          name: "Attendee",
          description: "General attendee",
          maxParticipants: 50,
        },
      ],
      ...overrides,
    };
  }; // ============================================================================
  // CREATE EVENT TESTS
  // ============================================================================

  describe("POST /api/events with programLabels", () => {
    test("create event with no programs (empty array)", async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const eventData = {
        title: "Test Event - No Programs",
        type: "Effective Communication Workshop",
        date: futureDate,
        time: "10:00",
        endTime: "12:00",
        location: "Test Location",
        organizer: "Test Organizer",
        agenda: "Test agenda for event with no programs",
        format: "In-person",
        roles: [
          {
            id: "role-1",
            name: "Attendee",
            description: "General attendee",
            maxParticipants: 50,
          },
        ],
        programLabels: [],
      };

      const res = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send(eventData)
        .expect(201);

      expect(res.body.data.event.programLabels).toEqual([]);

      // Verify DB
      const dbEvent = await EventModel.findById(res.body.data.event.id);
      console.log(
        dbEvent?.programLabels
      );
      console.log(
        dbEvent ? Object.keys(dbEvent.toObject()) : "null"
      );
      expect(dbEvent?.programLabels).toEqual([]);
    });

    test("create event with one program", async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const eventData = {
        title: "Test Event - One Program",
        type: "Effective Communication Workshop",
        date: futureDate,
        time: "10:00",
        endTime: "12:00",
        location: "Test Location",
        organizer: "Test Organizer",
        agenda: "Test agenda for event with one program",
        format: "In-person",
        roles: [
          {
            id: "role-1",
            name: "Attendee",
            description: "General attendee",
            maxParticipants: 50,
          },
        ],
        programLabels: [program1Id],
      };

      const res = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send(eventData)
        .expect(201);

      expect(res.body.data.event.programLabels).toHaveLength(1);
      expect(res.body.data.event.programLabels[0]).toBe(program1Id);

      // Verify DB
      const dbEvent = await EventModel.findById(res.body.data.event.id);
      expect(dbEvent?.programLabels).toHaveLength(1);
      expect(dbEvent?.programLabels?.[0].toString()).toBe(program1Id);

      // Verify program.events updated
      const program = await ProgramModel.findById(program1Id);
      expect(program?.events).toBeDefined();
      expect(
        program?.events?.some(
          (id: any) => id.toString() === res.body.data.event.id
        )
      ).toBe(true);
    });

    test("create event with multiple programs", async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const eventData = {
        title: "Test Event - Multiple Programs",
        type: "Effective Communication Workshop",
        date: futureDate,
        time: "10:00",
        endTime: "12:00",
        location: "Test Location",
        organizer: "Test Organizer",
        agenda: "Test agenda for event with multiple programs",
        format: "In-person",
        roles: [
          {
            id: "role-1",
            name: "Attendee",
            description: "General attendee",
            maxParticipants: 50,
          },
        ],
        programLabels: [program1Id, program2Id, program3Id],
      };

      const res = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send(eventData)
        .expect(201);

      expect(res.body.data.event.programLabels).toHaveLength(3);
      expect(res.body.data.event.programLabels).toContain(program1Id);
      expect(res.body.data.event.programLabels).toContain(program2Id);
      expect(res.body.data.event.programLabels).toContain(program3Id);

      // Verify all programs.events updated
      const program1 = await ProgramModel.findById(program1Id);
      const program2 = await ProgramModel.findById(program2Id);
      const program3 = await ProgramModel.findById(program3Id);

      expect(
        program1?.events?.some(
          (id: any) => id.toString() === res.body.data.event.id
        )
      ).toBe(true);
      expect(
        program2?.events?.some(
          (id: any) => id.toString() === res.body.data.event.id
        )
      ).toBe(true);
      expect(
        program3?.events?.some(
          (id: any) => id.toString() === res.body.data.event.id
        )
      ).toBe(true);
    });

    test("reject invalid program ID in array", async () => {
      const eventData = createEventData({
        title: "Test Event - Invalid ID",
        programLabels: ["invalid-id-format"],
      });

      const res = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send(eventData)
        .expect(400);

      expect(res.body.message).toMatch(/invalid/i);
    });

    test("reject non-existent program ID", async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const eventData = createEventData({
        title: "Test Event - Non-existent Program",
        programLabels: [nonExistentId],
      });

      const res = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send(eventData)
        .expect(400);

      expect(res.body.message).toMatch(/not found/i);
    });

    test("handle null/undefined/empty string in array", async () => {
      const eventData = createEventData({
        title: "Test Event - Null Values",
        programLabels: [program1Id, null, "", "none", program2Id] as any,
      });

      const res = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send(eventData)
        .expect(201);

      // Should only have valid IDs
      expect(res.body.data.event.programLabels).toHaveLength(2);
      expect(res.body.data.event.programLabels).toContain(program1Id);
      expect(res.body.data.event.programLabels).toContain(program2Id);
    });

    test("deduplicate program IDs", async () => {
      const eventData = createEventData({
        title: "Test Event - Duplicates",
        programLabels: [program1Id, program1Id, program1Id],
      });

      const res = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send(eventData)
        .expect(201);

      // Should only have one entry
      expect(res.body.data.event.programLabels).toHaveLength(1);
      expect(res.body.data.event.programLabels[0]).toBe(program1Id);

      // Verify program.events has only one reference
      const program = await ProgramModel.findById(program1Id);
      const eventReferences = program?.events?.filter(
        (id: any) => id.toString() === res.body.data.event.id
      );
      expect(eventReferences).toHaveLength(1);
    });

    test("create event with no programLabels field (defaults to empty array)", async () => {
      const eventData = createEventData({
        title: "Test Event - No Field",
        // programLabels omitted
      });

      const res = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send(eventData)
        .expect(201);

      expect(res.body.data.event.programLabels).toEqual([]);
    });
  });

  // ============================================================================
  // UPDATE EVENT TESTS
  // ============================================================================

  describe("PUT /api/events/:id with programLabels", () => {
    let eventId: string;

    beforeEach(async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      // Create a base event with no programs
      const event = await EventModel.create({
        title: "Base Event",
        type: "Effective Communication Workshop",
        date: futureDate,
        time: "10:00",
        endTime: "12:00",
        location: "Test Location",
        organizer: "Test Organizer",
        agenda: "Base event for testing",
        format: "In-person",
        roles: [
          {
            id: "role-1",
            name: "Attendee",
            description: "General attendee",
            maxParticipants: 50,
          },
        ],
        totalSlots: 50,
        signedUp: 0,
        createdBy: userId,
        hostedBy: "@Cloud Marketplace Ministry",
        status: "upcoming",
        programLabels: [],
      });
      eventId = event._id.toString();
    });

    test("add programs to event with no programs", async () => {
      const updateData = {
        programLabels: [program1Id, program2Id],
      };

      const res = await request(app)
        .put(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(res.body.data.event.programLabels).toHaveLength(2);
      expect(res.body.data.event.programLabels).toContain(program1Id);
      expect(res.body.data.event.programLabels).toContain(program2Id);

      // Verify programs.events updated
      const program1 = await ProgramModel.findById(program1Id);
      const program2 = await ProgramModel.findById(program2Id);

      expect(
        program1?.events?.some((id: any) => id.toString() === eventId)
      ).toBe(true);
      expect(
        program2?.events?.some((id: any) => id.toString() === eventId)
      ).toBe(true);
    });

    test("remove programs from event", async () => {
      // First add programs
      await EventModel.findByIdAndUpdate(eventId, {
        programLabels: [program1Id, program2Id],
      });
      await ProgramModel.findByIdAndUpdate(program1Id, {
        $addToSet: { events: eventId },
      });
      await ProgramModel.findByIdAndUpdate(program2Id, {
        $addToSet: { events: eventId },
      });

      // Now remove them
      const updateData = {
        programLabels: [],
      };

      const res = await request(app)
        .put(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(res.body.data.event.programLabels).toEqual([]);

      // Verify programs.events removed
      const program1 = await ProgramModel.findById(program1Id);
      const program2 = await ProgramModel.findById(program2Id);

      expect(
        program1?.events?.some((id: any) => id.toString() === eventId)
      ).toBe(false);
      expect(
        program2?.events?.some((id: any) => id.toString() === eventId)
      ).toBe(false);
    });

    test("change programs (replace)", async () => {
      // Start with program1 and program2
      await EventModel.findByIdAndUpdate(eventId, {
        programLabels: [program1Id, program2Id],
      });
      await ProgramModel.findByIdAndUpdate(program1Id, {
        $addToSet: { events: eventId },
      });
      await ProgramModel.findByIdAndUpdate(program2Id, {
        $addToSet: { events: eventId },
      });

      // Replace with program3
      const updateData = {
        programLabels: [program3Id],
      };

      const res = await request(app)
        .put(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(res.body.data.event.programLabels).toHaveLength(1);
      expect(res.body.data.event.programLabels[0]).toBe(program3Id);

      // Verify old programs.events removed
      const program1 = await ProgramModel.findById(program1Id);
      const program2 = await ProgramModel.findById(program2Id);
      expect(
        program1?.events?.some((id: any) => id.toString() === eventId)
      ).toBe(false);
      expect(
        program2?.events?.some((id: any) => id.toString() === eventId)
      ).toBe(false);

      // Verify new program.events added
      const program3 = await ProgramModel.findById(program3Id);
      expect(
        program3?.events?.some((id: any) => id.toString() === eventId)
      ).toBe(true);
    });

    test("partial update (add + remove)", async () => {
      // Start with program1 and program2
      await EventModel.findByIdAndUpdate(eventId, {
        programLabels: [program1Id, program2Id],
      });
      await ProgramModel.findByIdAndUpdate(program1Id, {
        $addToSet: { events: eventId },
      });
      await ProgramModel.findByIdAndUpdate(program2Id, {
        $addToSet: { events: eventId },
      });

      // Update to program2 and program3 (remove program1, keep program2, add program3)
      const updateData = {
        programLabels: [program2Id, program3Id],
      };

      const res = await request(app)
        .put(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(res.body.data.event.programLabels).toHaveLength(2);
      expect(res.body.data.event.programLabels).toContain(program2Id);
      expect(res.body.data.event.programLabels).toContain(program3Id);

      // Verify program1 removed
      const program1 = await ProgramModel.findById(program1Id);
      expect(
        program1?.events?.some((id: any) => id.toString() === eventId)
      ).toBe(false);

      // Verify program2 still there
      const program2 = await ProgramModel.findById(program2Id);
      expect(
        program2?.events?.some((id: any) => id.toString() === eventId)
      ).toBe(true);

      // Verify program3 added
      const program3 = await ProgramModel.findById(program3Id);
      expect(
        program3?.events?.some((id: any) => id.toString() === eventId)
      ).toBe(true);
    });

    test("update event without changing programLabels", async () => {
      // Set initial programLabels
      await EventModel.findByIdAndUpdate(eventId, {
        programLabels: [program1Id],
      });
      await ProgramModel.findByIdAndUpdate(program1Id, {
        $addToSet: { events: eventId },
      });

      // Update other field without touching programLabels
      const updateData = {
        title: "Updated Title",
      };

      const res = await request(app)
        .put(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      // programLabels should be unchanged
      expect(res.body.data.event.programLabels).toHaveLength(1);
      expect(res.body.data.event.programLabels[0]).toBe(program1Id);

      // Verify program.events unchanged
      const program1 = await ProgramModel.findById(program1Id);
      expect(
        program1?.events?.some((id: any) => id.toString() === eventId)
      ).toBe(true);
    });

    test("reject invalid program IDs in update", async () => {
      const updateData = {
        programLabels: ["invalid-id"],
      };

      const res = await request(app)
        .put(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(res.body.message).toMatch(/invalid/i);
    });

    test("reject non-existent program ID in update", async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const updateData = {
        programLabels: [nonExistentId],
      };

      const res = await request(app)
        .put(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(res.body.message).toMatch(/not found/i);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe("Edge cases", () => {
    test("very large programLabels array (100 programs)", async () => {
      // Create 100 programs
      const programIds: string[] = [];
      for (let i = 0; i < 100; i++) {
        const program = await ProgramModel.create({
          title: `Bulk Program ${i}`,
          programType:
            i % 2 === 0
              ? "EMBA Mentor Circles"
              : "Effective Communication Workshops",
          createdBy: userId,
          fullPriceTicket: 100,
        });
        programIds.push(program._id.toString());
      }

      const eventData = createEventData({
        title: "Event with 100 Programs",
        programLabels: programIds,
      });

      const res = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send(eventData)
        .expect(201);

      expect(res.body.data.event.programLabels).toHaveLength(100);

      // Spot check a few programs.events
      const program1 = await ProgramModel.findById(programIds[0]);
      const program50 = await ProgramModel.findById(programIds[49]);
      const program100 = await ProgramModel.findById(programIds[99]);

      expect(
        program1?.events?.some(
          (id: any) => id.toString() === res.body.data.event.id
        )
      ).toBe(true);
      expect(
        program50?.events?.some(
          (id: any) => id.toString() === res.body.data.event.id
        )
      ).toBe(true);
      expect(
        program100?.events?.some(
          (id: any) => id.toString() === res.body.data.event.id
        )
      ).toBe(true);
    });

    test("event without programLabels field in DB (backward compatibility)", async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      // Create event directly in DB without programLabels
      const event = await EventModel.create({
        title: "Old Event",
        type: "Effective Communication Workshop",
        date: futureDate,
        time: "10:00",
        endTime: "12:00",
        location: "Test Location",
        organizer: "Test Organizer",
        agenda: "Old event for backward compatibility test",
        format: "In-person",
        roles: [
          {
            id: "role-1",
            name: "Attendee",
            description: "General attendee",
            maxParticipants: 50,
          },
        ],
        totalSlots: 50,
        signedUp: 0,
        createdBy: userId,
        hostedBy: "@Cloud Marketplace Ministry",
        status: "upcoming",
        // programLabels NOT set
      });

      // Fetch via API
      const res = await request(app)
        .get(`/api/events/${event._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Should default to empty array
      expect(res.body.data.event.programLabels || []).toEqual([]);
    });

    test("mixing valid and invalid IDs in same request", async () => {
      const eventData = createEventData({
        title: "Test Event - Mixed IDs",
        programLabels: [program1Id, "invalid", program2Id],
      });

      const res = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send(eventData)
        .expect(400);

      expect(res.body.message).toMatch(/invalid/i);
    });
  });

  // ============================================================================
  // FILTER/QUERY TESTS (Task 5)
  // ============================================================================

  describe("GET /api/events with programLabels filter", () => {
    let event1Id: string;
    let event2Id: string;
    let event3Id: string;

    beforeEach(async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      // Event 1: program1 only
      const event1 = await EventModel.create({
        title: "Event 1",
        type: "Effective Communication Workshop",
        date: futureDate,
        time: "10:00",
        endTime: "12:00",
        location: "Test Location",
        organizer: "Test Organizer",
        agenda: "Event 1 agenda",
        format: "In-person",
        roles: [
          {
            id: "role-1",
            name: "Attendee",
            description: "General attendee",
            maxParticipants: 50,
          },
        ],
        totalSlots: 50,
        signedUp: 0,
        createdBy: userId,
        hostedBy: "@Cloud Marketplace Ministry",
        status: "upcoming",
        programLabels: [program1Id],
      });
      event1Id = event1._id.toString();

      // Event 2: program1 and program2
      const event2 = await EventModel.create({
        title: "Event 2",
        type: "Effective Communication Workshop",
        date: futureDate,
        time: "10:00",
        endTime: "12:00",
        location: "Test Location",
        organizer: "Test Organizer",
        agenda: "Event 2 agenda",
        format: "In-person",
        roles: [
          {
            id: "role-1",
            name: "Attendee",
            description: "General attendee",
            maxParticipants: 50,
          },
        ],
        totalSlots: 50,
        signedUp: 0,
        createdBy: userId,
        hostedBy: "@Cloud Marketplace Ministry",
        status: "upcoming",
        programLabels: [program1Id, program2Id],
      });
      event2Id = event2._id.toString();

      // Event 3: program2 only
      const event3 = await EventModel.create({
        title: "Event 3",
        type: "Effective Communication Workshop",
        date: futureDate,
        time: "10:00",
        endTime: "12:00",
        location: "Test Location",
        organizer: "Test Organizer",
        agenda: "Event 3 agenda",
        format: "In-person",
        roles: [
          {
            id: "role-1",
            name: "Attendee",
            description: "General attendee",
            maxParticipants: 50,
          },
        ],
        totalSlots: 50,
        signedUp: 0,
        createdBy: userId,
        hostedBy: "@Cloud Marketplace Ministry",
        status: "upcoming",
        programLabels: [program2Id],
      });
      event3Id = event3._id.toString();
    });

    test("filter by single program - returns all events with that program", async () => {
      const res = await request(app)
        .get(`/api/events?programId=${program1Id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Should return event1 and event2 (both have program1)
      expect(res.body.data.events).toHaveLength(2);
      const eventIds = res.body.data.events.map((e: any) => e._id || e.id);
      expect(eventIds).toContain(event1Id);
      expect(eventIds).toContain(event2Id);
      expect(eventIds).not.toContain(event3Id);
    });

    test("filter returns events with multiple programs", async () => {
      const res = await request(app)
        .get(`/api/events?programId=${program2Id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Should return event2 and event3 (both have program2)
      expect(res.body.data.events).toHaveLength(2);
      const eventIds = res.body.data.events.map((e: any) => e._id || e.id);
      expect(eventIds).toContain(event2Id);
      expect(eventIds).toContain(event3Id);
      expect(eventIds).not.toContain(event1Id);
    });

    test("no results if program not in any event labels", async () => {
      const res = await request(app)
        .get(`/api/events?programId=${program3Id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // No events have program3
      expect(res.body.data.events).toHaveLength(0);
    });

    test("filter with no programId returns all events", async () => {
      const res = await request(app)
        .get("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Should return all 3 events
      expect(res.body.data.events.length).toBeGreaterThanOrEqual(3);
    });
  });
});
