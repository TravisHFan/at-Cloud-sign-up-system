/**
 * Event System Integration Test - Priority 2 Fix Validation
 *
 * Tests all core Event System functionality after fixing the date parsing bug.
 * This validates that the Event System is working correctly.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import express from "express";
import { User, Event, Registration } from "../../../src/models";
import routes from "../../../src/routes";

const app = express();
app.use(express.json());
app.use(routes);

describe("Event System - Core Functionality Tests", () => {
  let adminUser: any;
  let participantUser: any;
  let adminToken: string;
  let participantToken: string;
  let testEvent: any;

  beforeAll(async () => {
    if (!process.env.MONGODB_URI_TEST) {
      throw new Error("MONGODB_URI_TEST environment variable is not set");
    }
    await mongoose.connect(process.env.MONGODB_URI_TEST);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Event.deleteMany({});
    await Registration.deleteMany({});

    // Create test users
    adminUser = await User.create({
      firstName: "Admin",
      lastName: "User",
      username: "admin-test",
      email: "admin@test.com",
      password: "TestPassword123!",
      gender: "male",
      role: "Administrator",
      isActive: true,
      isVerified: true,
    });

    participantUser = await User.create({
      firstName: "Participant",
      lastName: "User",
      username: "participant-test",
      email: "participant@test.com",
      password: "TestPassword123!",
      gender: "female",
      role: "Participant",
      isActive: true,
      isVerified: true,
    });

    // Login both users
    const adminLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ emailOrUsername: "admin-test", password: "TestPassword123!" });

    const participantLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({
        emailOrUsername: "participant-test",
        password: "TestPassword123!",
      });

    adminToken = adminLogin.body.data.accessToken;
    participantToken = participantLogin.body.data.accessToken;
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Event.deleteMany({});
    await Registration.deleteMany({});
  });

  it("should successfully create an event with proper date formatting", async () => {
    const eventData = {
      title: "Communication Workshop",
      type: "Workshop",
      date: "2025-12-25",
      time: "14:00",
      endTime: "16:00",
      location: "@Cloud Meeting Room",
      organizer: "Dr. Hunter",
      purpose: "Improve communication skills",
      format: "In-person",
      agenda: "1. Welcome 2. Exercises 3. Discussion",
      roles: [
        {
          name: "Facilitator",
          description: "Leads the workshop",
          maxParticipants: 1,
        },
        {
          name: "Participant",
          description: "Attends the workshop",
          maxParticipants: 8,
        },
      ],
    };

    const response = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(eventData);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.event.title).toBe("Communication Workshop");
    expect(response.body.data.event.date).toBe("2025-12-25");
    expect(response.body.data.event.roles).toHaveLength(2);
    expect(response.body.data.event.totalSlots).toBe(9);

    testEvent = response.body.data.event;
  });

  it("should retrieve all events successfully", async () => {
    // First create a test event
    const eventData = {
      title: "Test Retrieval Event",
      type: "Workshop",
      date: "2025-12-26",
      time: "15:00",
      endTime: "17:00",
      location: "Test Location",
      organizer: "Test Organizer",
      purpose: "Testing retrieval",
      format: "In-person",
      agenda: "Test agenda",
      roles: [
        {
          name: "Host",
          description: "Hosts the event",
          maxParticipants: 1,
        },
      ],
    };

    const createResponse = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(eventData);

    expect(createResponse.status).toBe(201);
    const eventId = createResponse.body.data.event.id;

    // Test getting all events
    const getAllResponse = await request(app)
      .get("/api/v1/events")
      .set("Authorization", `Bearer ${participantToken}`);

    expect(getAllResponse.status).toBe(200);
    expect(getAllResponse.body.success).toBe(true);
    expect(getAllResponse.body.data.events).toHaveLength(1);
    expect(getAllResponse.body.data.events[0].id).toBe(eventId);

    // Test getting single event
    const getSingleResponse = await request(app)
      .get(`/api/v1/events/${eventId}`)
      .set("Authorization", `Bearer ${participantToken}`);

    expect(getSingleResponse.status).toBe(200);
    expect(getSingleResponse.body.success).toBe(true);
    expect(getSingleResponse.body.data.event.id).toBe(eventId);
  });

  it("should allow users to signup for events", async () => {
    // Create an event first
    const eventData = {
      title: "Signup Test Event",
      type: "Workshop",
      date: "2025-12-27",
      time: "16:00",
      endTime: "18:00",
      location: "Test Location",
      organizer: "Test Organizer",
      purpose: "Testing signup",
      format: "In-person",
      agenda: "Test agenda",
      roles: [
        {
          name: "Organizer",
          description: "Organizes the event",
          maxParticipants: 1,
        },
        {
          name: "Attendee",
          description: "Attends the event",
          maxParticipants: 5,
        },
      ],
    };

    const createResponse = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(eventData);

    expect(createResponse.status).toBe(201);
    const event = createResponse.body.data.event;
    const attendeeRole = event.roles.find((r: any) => r.name === "Attendee");

    // Test participant signup
    const signupResponse = await request(app)
      .post(`/api/v1/events/${event.id}/signup`)
      .set("Authorization", `Bearer ${participantToken}`)
      .send({
        roleId: attendeeRole.id,
        notes: "Excited to attend!",
      });

    expect(signupResponse.status).toBe(200);
    expect(signupResponse.body.success).toBe(true);

    // Verify signup by getting updated event
    const verifyResponse = await request(app)
      .get(`/api/v1/events/${event.id}`)
      .set("Authorization", `Bearer ${participantToken}`);

    expect(verifyResponse.status).toBe(200);
    const updatedEvent = verifyResponse.body.data.event;
    const updatedRole = updatedEvent.roles.find(
      (r: any) => r.id === attendeeRole.id
    );

    expect(updatedRole.currentSignups).toHaveLength(1);
    expect(updatedRole.currentSignups[0].username).toBe("participant-test");
  });

  it("should allow users to cancel their event signup", async () => {
    // Create event and signup first
    const eventData = {
      title: "Cancellation Test Event",
      type: "Workshop",
      date: "2025-12-28",
      time: "18:00",
      endTime: "20:00",
      location: "Test Location",
      organizer: "Test Organizer",
      purpose: "Testing cancellation",
      format: "In-person",
      agenda: "Test agenda",
      roles: [
        {
          name: "Volunteer",
          description: "Event volunteer",
          maxParticipants: 2,
        },
      ],
    };

    const createResponse = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(eventData);

    expect(createResponse.status).toBe(201);
    const event = createResponse.body.data.event;
    const volunteerRole = event.roles[0];

    // Signup first
    const signupResponse = await request(app)
      .post(`/api/v1/events/${event.id}/signup`)
      .set("Authorization", `Bearer ${participantToken}`)
      .send({
        roleId: volunteerRole.id,
        notes: "Will help with setup",
      });

    expect(signupResponse.status).toBe(200);

    // Test cancellation
    const cancelResponse = await request(app)
      .post(`/api/v1/events/${event.id}/cancel`)
      .set("Authorization", `Bearer ${participantToken}`)
      .send({
        roleId: volunteerRole.id,
      });

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.success).toBe(true);

    // Verify cancellation by checking event
    const verifyResponse = await request(app)
      .get(`/api/v1/events/${event.id}`)
      .set("Authorization", `Bearer ${participantToken}`);

    expect(verifyResponse.status).toBe(200);
    const updatedEvent = verifyResponse.body.data.event;
    const updatedRole = updatedEvent.roles.find(
      (r: any) => r.id === volunteerRole.id
    );

    expect(updatedRole.currentSignups).toHaveLength(0);
  });

  it("should handle role capacity limits correctly", async () => {
    // Create an event with limited capacity
    const eventData = {
      title: "Limited Capacity Event",
      type: "Workshop",
      date: "2025-12-29",
      time: "19:00",
      endTime: "21:00",
      location: "Small Room",
      organizer: "Test Organizer",
      purpose: "Testing capacity limits",
      format: "In-person",
      agenda: "Limited space event",
      roles: [
        {
          name: "Participant",
          description: "Event participant",
          maxParticipants: 1, // Only 1 slot available
        },
      ],
    };

    const createResponse = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(eventData);

    expect(createResponse.status).toBe(201);
    const event = createResponse.body.data.event;
    const participantRole = event.roles[0];

    // First signup should succeed
    const firstSignupResponse = await request(app)
      .post(`/api/v1/events/${event.id}/signup`)
      .set("Authorization", `Bearer ${participantToken}`)
      .send({
        roleId: participantRole.id,
        notes: "First signup",
      });

    expect(firstSignupResponse.status).toBe(200);

    // Create another user to test capacity limit
    const secondUser = await User.create({
      firstName: "Second",
      lastName: "User",
      username: "second-test",
      email: "second@test.com",
      password: "TestPassword123!",
      gender: "male",
      role: "Participant",
      isActive: true,
      isVerified: true,
    });

    const secondLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ emailOrUsername: "second-test", password: "TestPassword123!" });

    const secondToken = secondLogin.body.data.accessToken;

    // Second signup should fail due to capacity
    const secondSignupResponse = await request(app)
      .post(`/api/v1/events/${event.id}/signup`)
      .set("Authorization", `Bearer ${secondToken}`)
      .send({
        roleId: participantRole.id,
        notes: "Second signup - should fail",
      });

    expect(secondSignupResponse.status).toBe(400);
    expect(secondSignupResponse.body.success).toBe(false);
  });
});
