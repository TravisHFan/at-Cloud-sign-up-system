/**
 * Event System Priority 2 Diagnostic Test
 *
 * This test identifies key bugs and issues in the Event System
 * by testing core functionality: Create, Read, Update, Delete, Signup, Cancel
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

describe("Event System Priority 2 Diagnostic", () => {
  let adminUser: any;
  let participantUser: any;
  let adminToken: string;
  let participantToken: string;

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

    console.log("✅ Test setup complete");
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Event.deleteMany({});
    await Registration.deleteMany({});
  });

  it("DIAGNOSTIC: Event Creation - Check if events can be created", async () => {
    console.log("\n📝 TESTING: Event Creation");

    const eventData = {
      title: "Test Event",
      type: "Workshop",
      date: "2025-12-25",
      time: "14:00",
      endTime: "16:00",
      location: "Test Location",
      organizer: "Test Organizer",
      purpose: "Testing purposes",
      format: "In-person",
      agenda: "Test agenda",
      roles: [
        {
          name: "Facilitator",
          description: "Leads the workshop",
          maxParticipants: 1,
        },
        {
          name: "Participant",
          description: "Attends the workshop",
          maxParticipants: 10,
        },
      ],
    };

    console.log("📤 Sending event data:", JSON.stringify(eventData, null, 2));

    const response = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(eventData);

    console.log(`Event creation status: ${response.status}`);
    console.log("📥 Response body:", JSON.stringify(response.body, null, 2));

    if (response.status === 201) {
      console.log("✅ Event creation WORKING");
      console.log(`Created event ID: ${response.body.data.event.id}`);
    } else {
      console.log("❌ Event creation FAILING");
      console.log("Error:", response.body);
    }

    expect(response.status).toBe(201);
  });

  it("DIAGNOSTIC: Event Retrieval - Check if events can be fetched", async () => {
    console.log("\n📖 TESTING: Event Retrieval");

    // First create an event
    const eventData = {
      title: "Retrieval Test Event",
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

    if (createResponse.status !== 201) {
      console.log("❌ Cannot test retrieval - event creation failed");
      return;
    }

    const eventId = createResponse.body.data.event.id;

    // Test getting all events
    const getAllResponse = await request(app)
      .get("/api/v1/events")
      .set("Authorization", `Bearer ${participantToken}`);

    console.log(`Get all events status: ${getAllResponse.status}`);

    if (getAllResponse.status === 200) {
      const events = getAllResponse.body.data.events;
      console.log(`✅ Retrieved ${events.length} events`);

      const foundEvent = events.find((e: any) => e.id === eventId);
      if (foundEvent) {
        console.log("✅ Created event found in list");
      } else {
        console.log("❌ Created event NOT found in list");
      }
    } else {
      console.log("❌ Event retrieval FAILING");
      console.log("Error:", getAllResponse.body);
    }

    // Test getting single event
    const getSingleResponse = await request(app)
      .get(`/api/v1/events/${eventId}`)
      .set("Authorization", `Bearer ${participantToken}`);

    console.log(`Get single event status: ${getSingleResponse.status}`);

    if (getSingleResponse.status === 200) {
      console.log("✅ Single event retrieval WORKING");
    } else {
      console.log("❌ Single event retrieval FAILING");
      console.log("Error:", getSingleResponse.body);
    }
  });

  it("DIAGNOSTIC: Event Signup - Check if users can signup for events", async () => {
    console.log("\n📋 TESTING: Event Signup");

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

    if (createResponse.status !== 201) {
      console.log("❌ Cannot test signup - event creation failed");
      return;
    }

    const event = createResponse.body.data.event;
    const attendeeRole = event.roles.find((r: any) => r.name === "Attendee");

    if (!attendeeRole) {
      console.log("❌ Cannot test signup - no attendee role found");
      return;
    }

    // Test participant signup
    const signupResponse = await request(app)
      .post(`/api/v1/events/${event.id}/signup`)
      .set("Authorization", `Bearer ${participantToken}`)
      .send({
        roleId: attendeeRole.id,
        notes: "Test signup",
      });

    console.log(`Event signup status: ${signupResponse.status}`);

    if (signupResponse.status === 200) {
      console.log("✅ Event signup WORKING");

      // Verify signup by getting updated event
      const verifyResponse = await request(app)
        .get(`/api/v1/events/${event.id}`)
        .set("Authorization", `Bearer ${participantToken}`);

      if (verifyResponse.status === 200) {
        const updatedEvent = verifyResponse.body.data.event;
        const updatedRole = updatedEvent.roles.find(
          (r: any) => r.id === attendeeRole.id
        );

        if (updatedRole && updatedRole.currentSignups.length > 0) {
          console.log("✅ Signup verification WORKING - user added to role");
        } else {
          console.log(
            "❌ Signup verification FAILING - user not found in role"
          );
        }
      }
    } else {
      console.log("❌ Event signup FAILING");
      console.log("Error:", signupResponse.body);
    }
  });

  it("DIAGNOSTIC: User's Events - Check if users can see their registered events", async () => {
    console.log("\n👤 TESTING: User's Registered Events");

    // Create and signup for an event first
    const eventData = {
      title: "User Events Test",
      type: "Workshop",
      date: "2025-12-28",
      time: "17:00",
      endTime: "19:00",
      location: "Test Location",
      organizer: "Test Organizer",
      purpose: "Testing user events",
      format: "In-person",
      agenda: "Test agenda",
      roles: [
        {
          name: "Member",
          description: "Event member",
          maxParticipants: 3,
        },
      ],
    };

    const createResponse = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(eventData);

    if (createResponse.status !== 201) {
      console.log("❌ Cannot test user events - event creation failed");
      return;
    }

    const event = createResponse.body.data.event;
    const memberRole = event.roles[0];

    // Signup participant
    const signupResponse = await request(app)
      .post(`/api/v1/events/${event.id}/signup`)
      .set("Authorization", `Bearer ${participantToken}`)
      .send({
        roleId: memberRole.id,
        notes: "Test membership",
      });

    if (signupResponse.status !== 200) {
      console.log("❌ Cannot test user events - signup failed");
      return;
    }

    // Test getting user's events
    const userEventsResponse = await request(app)
      .get("/api/v1/events/user")
      .set("Authorization", `Bearer ${participantToken}`);

    console.log(`Get user events status: ${userEventsResponse.status}`);

    if (userEventsResponse.status === 200) {
      const userEvents = userEventsResponse.body.data.events;
      console.log(
        `✅ User events retrieval WORKING - found ${userEvents.length} events`
      );

      if (userEvents.length > 0) {
        const registeredEvent = userEvents.find(
          (ue: any) => ue.event.id === event.id
        );
        if (registeredEvent) {
          console.log("✅ Registered event found in user's events");
        } else {
          console.log("❌ Registered event NOT found in user's events");
        }
      }
    } else {
      console.log("❌ User events retrieval FAILING");
      console.log("Error:", userEventsResponse.body);
    }
  });

  it("DIAGNOSTIC: Event Cancellation - Check if users can cancel their signup", async () => {
    console.log("\n❌ TESTING: Event Signup Cancellation");

    // Create event and signup first
    const eventData = {
      title: "Cancellation Test Event",
      type: "Workshop",
      date: "2025-12-29",
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

    if (createResponse.status !== 201) {
      console.log("❌ Cannot test cancellation - event creation failed");
      return;
    }

    const event = createResponse.body.data.event;
    const volunteerRole = event.roles[0];

    // Signup first
    const signupResponse = await request(app)
      .post(`/api/v1/events/${event.id}/signup`)
      .set("Authorization", `Bearer ${participantToken}`)
      .send({
        roleId: volunteerRole.id,
        notes: "Will cancel this",
      });

    if (signupResponse.status !== 200) {
      console.log("❌ Cannot test cancellation - signup failed");
      return;
    }

    // Test cancellation
    const cancelResponse = await request(app)
      .post(`/api/v1/events/${event.id}/cancel`)
      .set("Authorization", `Bearer ${participantToken}`)
      .send({
        roleId: volunteerRole.id,
      });

    console.log(`Event cancellation status: ${cancelResponse.status}`);

    if (cancelResponse.status === 200) {
      console.log("✅ Event cancellation WORKING");

      // Verify cancellation by checking event
      const verifyResponse = await request(app)
        .get(`/api/v1/events/${event.id}`)
        .set("Authorization", `Bearer ${participantToken}`);

      if (verifyResponse.status === 200) {
        const updatedEvent = verifyResponse.body.data.event;
        const updatedRole = updatedEvent.roles.find(
          (r: any) => r.id === volunteerRole.id
        );

        if (updatedRole && updatedRole.currentSignups.length === 0) {
          console.log(
            "✅ Cancellation verification WORKING - user removed from role"
          );
        } else {
          console.log(
            "❌ Cancellation verification FAILING - user still in role"
          );
        }
      }
    } else {
      console.log("❌ Event cancellation FAILING");
      console.log("Error:", cancelResponse.body);
    }
  });

  it("SUMMARY: Event System Health Check", async () => {
    console.log("\n📊 EVENT SYSTEM DIAGNOSTIC SUMMARY");
    console.log("================================================");
    console.log("This test suite checked:");
    console.log("✓ Event Creation");
    console.log("✓ Event Retrieval (All & Single)");
    console.log("✓ Event Signup");
    console.log("✓ User's Registered Events");
    console.log("✓ Signup Cancellation");
    console.log("================================================");
    console.log("If any tests failed above, those are Priority 2 bugs to fix!");
  });
});
