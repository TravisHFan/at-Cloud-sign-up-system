/**
 * Integration Tests: Co-Organizer Program Access Validation
 *
 * Tests the complete flow of validating co-organizers have access to paid programs
 * when creating or editing events.
 *
 * Scenarios covered:
 * - Creating event with co-organizers who lack program access
 * - Creating event with co-organizers who have program access (purchase/mentor)
 * - Editing event to add co-organizers without program access
 * - Mixed scenarios with free and paid programs
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../../src/app";
import {
  User,
  Event,
  Program,
  Purchase,
  Registration,
} from "../../../src/models";

describe("Co-Organizer Program Access Integration Tests", () => {
  let authToken: string;
  let superAdminToken: string;
  let creatorId: string;
  let leaderUserId: string;
  let leaderUser2Id: string;
  let paidProgramId: string;
  let freeProgramId: string;

  beforeAll(async () => {
    // Clean up any existing test data
    await User.deleteMany({
      email: {
        $in: [
          "superadmin-coorg@test.com",
          "creator-coorg@test.com",
          "leader1-coorg@test.com",
          "leader2-coorg@test.com",
        ],
      },
    });
    await Event.deleteMany({});
    await Program.deleteMany({});
    await Purchase.deleteMany({});
    await Registration.deleteMany({});

    // Create Super Admin user for setup
    const superAdminData = {
      email: "superadmin-coorg@test.com",
      username: "superadmin-coorg",
      password: "Admin123!",
      firstName: "Super",
      lastName: "Admin",
      role: "Super Admin",
      roleInAtCloud: "Super Admin",
      isVerified: true,
    };
    const regResponse = await request(app)
      .post("/api/auth/register")
      .send(superAdminData);

    // If registration fails due to existing user, just proceed with login
    if (regResponse.status !== 201) {
      console.log("Super admin already exists, proceeding with login");
    }

    const superAdminLoginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        emailOrUsername: "superadmin-coorg@test.com",
        password: "Admin123!",
      });
    superAdminToken = superAdminLoginResponse.body.data.accessToken;

    // Create event creator (Leader)
    const creatorData = {
      email: "creator-coorg@test.com",
      username: "creator-coorg",
      password: "Creator123!",
      firstName: "Event",
      lastName: "Creator",
      role: "Leader",
      roleInAtCloud: "Leader",
      isVerified: true,
    };
    await request(app).post("/api/auth/register").send(creatorData);
    await User.findOneAndUpdate(
      { email: "creator-coorg@test.com" },
      { isVerified: true }
    );
    const creatorLoginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        emailOrUsername: "creator-coorg@test.com",
        password: "Creator123!",
      });
    authToken = creatorLoginResponse.body.data.accessToken;
    creatorId = creatorLoginResponse.body.data.user.id;

    // Create Leader users to be co-organizers
    const leader1Data = {
      email: "leader1-coorg@test.com",
      username: "leader1-coorg",
      password: "Leader123!",
      firstName: "Leader",
      lastName: "One",
      role: "Leader",
      roleInAtCloud: "Leader",
      isVerified: true,
    };
    await request(app).post("/api/auth/register").send(leader1Data);
    await User.findOneAndUpdate(
      { email: "leader1-coorg@test.com" },
      { isVerified: true }
    );
    const leader1 = await User.findOne({ email: "leader1-coorg@test.com" });
    leaderUserId = leader1!._id.toString();

    const leader2Data = {
      email: "leader2-coorg@test.com",
      username: "leader2-coorg",
      password: "Leader123!",
      firstName: "Leader",
      lastName: "Two",
      role: "Leader",
      roleInAtCloud: "Leader",
      isVerified: true,
    };
    await request(app).post("/api/auth/register").send(leader2Data);
    await User.findOneAndUpdate(
      { email: "leader2-coorg@test.com" },
      { isVerified: true }
    );
    const leader2 = await User.findOne({ email: "leader2-coorg@test.com" });
    leaderUser2Id = leader2!._id.toString();

    // Create a paid program
    const paidProgram = await Program.create({
      title: "Paid Program",
      description: "This is a paid program",
      programType: "series",
      isFree: false,
      fullPriceTicket: 5000,
      createdBy: new mongoose.Types.ObjectId(creatorId),
      mentors: [],
    });
    paidProgramId = paidProgram._id.toString();

    // Create a free program
    const freeProgram = await Program.create({
      title: "Free Program",
      description: "This is a free program",
      programType: "series",
      isFree: true,
      createdBy: new mongoose.Types.ObjectId(creatorId),
      mentors: [],
    });
    freeProgramId = freeProgram._id.toString();

    // Give event creator access to paid program
    await Purchase.create({
      userId: new mongoose.Types.ObjectId(creatorId),
      programId: new mongoose.Types.ObjectId(paidProgramId),
      fullPrice: 5000,
      finalPrice: 5000,
      isClassRep: false,
      isEarlyBird: false,
      status: "completed",
      orderNumber: "ORD-CREATOR-001",
      stripeSessionId: "sess_creator_001",
      purchaseDate: new Date(),
      paymentMethod: { type: "card", cardBrand: "visa", last4: "4242" },
      billingInfo: {
        fullName: "Event Creator",
        email: "creator-coorg@test.com",
      },
    });
  });

  afterEach(async () => {
    // Clean up events and registrations after each test
    await Event.deleteMany({});
    await Registration.deleteMany({});
  });

  describe("POST /api/events - Create Event", () => {
    it("should reject event creation when co-organizer lacks access to paid program", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const dateStr = futureDate.toISOString().split("T")[0];

      const eventData = {
        title: "Test Event with Unauthorized Co-Organizer",
        type: "Effective Communication Workshop",
        date: dateStr,
        time: "14:00",
        endTime: "16:00",
        format: "In-person",
        location: "Conference Room",
        organizer: "Event Creator (Leader)",
        purpose: "Test purpose",
        programLabels: [paidProgramId],
        organizerDetails: [
          {
            userId: leaderUserId,
            name: "Leader One",
            role: "Co-organizer",
          },
        ],
        roles: [
          {
            name: "Zoom Host",
            description: "Host the event",
            maxParticipants: 1,
          },
        ],
      };

      const response = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send(eventData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Leader One");
      expect(response.body.message).toContain("do not have access");
      expect(response.body.data?.unauthorizedCoOrganizers).toHaveLength(1);
    });

    it("should allow event creation when co-organizer purchased the paid program", async () => {
      // Give leader1 access to paid program
      await Purchase.create({
        userId: new mongoose.Types.ObjectId(leaderUserId),
        programId: new mongoose.Types.ObjectId(paidProgramId),
        fullPrice: 5000,
        finalPrice: 5000,
        isClassRep: false,
        isEarlyBird: false,
        status: "completed",
        orderNumber: "ORD-LEADER1-001",
        stripeSessionId: "sess_leader1_001",
        purchaseDate: new Date(),
        paymentMethod: { type: "card", cardBrand: "visa", last4: "4242" },
        billingInfo: { fullName: "Leader One", email: "leader1@test.com" },
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const dateStr = futureDate.toISOString().split("T")[0];

      const eventData = {
        title: "Test Event with Authorized Co-Organizer",
        type: "Effective Communication Workshop",
        date: dateStr,
        time: "14:00",
        endTime: "16:00",
        format: "In-person",
        location: "Conference Room",
        organizer: "Event Creator (Leader)",
        purpose: "Test purpose",
        programLabels: [paidProgramId],
        organizerDetails: [
          {
            userId: leaderUserId,
            name: "Leader One",
            role: "Co-organizer",
          },
        ],
        roles: [
          {
            name: "Zoom Host",
            description: "Host the event",
            maxParticipants: 1,
          },
        ],
      };

      const response = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send(eventData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it("should allow event creation when co-organizer is a mentor of the paid program", async () => {
      // Make leader1 a mentor of paid program
      await Program.findByIdAndUpdate(paidProgramId, {
        $push: {
          mentors: {
            userId: new mongoose.Types.ObjectId(leaderUserId),
            name: "Leader One",
            email: "leader1-coorg@test.com",
          },
        },
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const dateStr = futureDate.toISOString().split("T")[0];

      const eventData = {
        title: "Test Event with Mentor Co-Organizer",
        type: "Effective Communication Workshop",
        date: dateStr,
        time: "14:00",
        endTime: "16:00",
        format: "In-person",
        location: "Conference Room",
        organizer: "Event Creator (Leader)",
        purpose: "Test purpose",
        programLabels: [paidProgramId],
        organizerDetails: [
          {
            userId: leaderUserId,
            name: "Leader One",
            role: "Co-organizer",
          },
        ],
        roles: [
          {
            name: "Zoom Host",
            description: "Host the event",
            maxParticipants: 1,
          },
        ],
      };

      const response = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send(eventData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it("should allow event creation with free program and any co-organizers", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const dateStr = futureDate.toISOString().split("T")[0];

      const eventData = {
        title: "Test Event with Free Program",
        type: "Effective Communication Workshop",
        date: dateStr,
        time: "14:00",
        endTime: "16:00",
        format: "In-person",
        location: "Conference Room",
        organizer: "Event Creator (Leader)",
        purpose: "Test purpose",
        programLabels: [freeProgramId],
        organizerDetails: [
          {
            userId: leaderUserId,
            name: "Leader One",
            role: "Co-organizer",
          },
        ],
        roles: [
          {
            name: "Zoom Host",
            description: "Host the event",
            maxParticipants: 1,
          },
        ],
      };

      const response = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send(eventData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it("should allow event creation with no programs and any co-organizers", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const dateStr = futureDate.toISOString().split("T")[0];

      const eventData = {
        title: "Test Event with No Program",
        type: "Effective Communication Workshop",
        date: dateStr,
        time: "14:00",
        endTime: "16:00",
        format: "In-person",
        location: "Conference Room",
        organizer: "Event Creator (Leader)",
        purpose: "Test purpose",
        programLabels: [],
        organizerDetails: [
          {
            userId: leaderUserId,
            name: "Leader One",
            role: "Co-organizer",
          },
        ],
        roles: [
          {
            name: "Zoom Host",
            description: "Host the event",
            maxParticipants: 1,
          },
        ],
      };

      const response = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send(eventData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it("should validate OR logic - co-organizer needs access to only ONE paid program", async () => {
      // Create second paid program
      const paidProgram2 = await Program.create({
        title: "Second Paid Program",
        description: "Another paid program",
        programType: "series",
        isFree: false,
        fullPriceTicket: 3000,
        createdBy: new mongoose.Types.ObjectId(creatorId),
        mentors: [],
      });
      const paidProgram2Id = paidProgram2._id.toString();

      // Give creator access to both programs
      await Purchase.create({
        userId: new mongoose.Types.ObjectId(creatorId),
        programId: new mongoose.Types.ObjectId(paidProgram2Id),
        fullPrice: 3000,
        finalPrice: 3000,
        isClassRep: false,
        isEarlyBird: false,
        status: "completed",
        orderNumber: "ORD-CREATOR-002",
        stripeSessionId: "sess_creator_002",
        purchaseDate: new Date(),
        paymentMethod: { type: "card", cardBrand: "visa", last4: "4242" },
        billingInfo: {
          fullName: "Event Creator",
          email: "creator-coorg@test.com",
        },
      });

      // Give leader1 access to ONLY second program (not first)
      await Purchase.create({
        userId: new mongoose.Types.ObjectId(leaderUserId),
        programId: new mongoose.Types.ObjectId(paidProgram2Id),
        fullPrice: 3000,
        finalPrice: 3000,
        isClassRep: false,
        isEarlyBird: false,
        status: "completed",
        orderNumber: "ORD-LEADER1-002",
        stripeSessionId: "sess_leader1_002",
        purchaseDate: new Date(),
        paymentMethod: { type: "card", cardBrand: "visa", last4: "4242" },
        billingInfo: { fullName: "Leader One", email: "leader1@test.com" },
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const dateStr = futureDate.toISOString().split("T")[0];

      const eventData = {
        title: "Test Event with Multiple Programs",
        type: "Effective Communication Workshop",
        date: dateStr,
        time: "14:00",
        endTime: "16:00",
        format: "In-person",
        location: "Conference Room",
        organizer: "Event Creator (Leader)",
        purpose: "Test purpose",
        programLabels: [paidProgramId, paidProgram2Id],
        organizerDetails: [
          {
            userId: leaderUserId,
            name: "Leader One",
            role: "Co-organizer",
          },
        ],
        roles: [
          {
            name: "Zoom Host",
            description: "Host the event",
            maxParticipants: 1,
          },
        ],
      };

      const response = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send(eventData);

      // Should succeed because leader1 has access to at least ONE of the programs
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  describe("PUT /api/events/:id - Edit Event", () => {
    it("should reject editing event to add co-organizer without program access", async () => {
      // First create an event without co-organizers
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const dateStr = futureDate.toISOString().split("T")[0];

      const createResponse = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          title: "Initial Event",
          type: "Effective Communication Workshop",
          date: dateStr,
          time: "14:00",
          endTime: "16:00",
          format: "In-person",
          location: "Conference Room",
          organizer: "Event Creator (Leader)",
          purpose: "Test purpose",
          programLabels: [paidProgramId],
          organizerDetails: [],
          roles: [
            {
              name: "Zoom Host",
              description: "Host the event",
              maxParticipants: 1,
            },
          ],
        });

      expect(createResponse.status).toBe(201);
      const eventId = createResponse.body.data._id;

      // Now try to edit and add co-organizer without access
      const updateResponse = await request(app)
        .put(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          organizerDetails: [
            {
              userId: leaderUserId,
              name: "Leader One",
              role: "Co-organizer",
            },
          ],
        });

      expect(updateResponse.status).toBe(403);
      expect(updateResponse.body.success).toBe(false);
      expect(updateResponse.body.message).toContain("Leader One");
      expect(updateResponse.body.message).toContain("do not have access");
    });

    it("should allow editing event to add co-organizer with program access", async () => {
      // Give leader1 access to paid program
      await Purchase.create({
        userId: new mongoose.Types.ObjectId(leaderUserId),
        programId: new mongoose.Types.ObjectId(paidProgramId),
        fullPrice: 5000,
        finalPrice: 5000,
        isClassRep: false,
        isEarlyBird: false,
        status: "completed",
        orderNumber: "ORD-LEADER1-EDIT-001",
        stripeSessionId: "sess_leader1_edit_001",
        purchaseDate: new Date(),
        paymentMethod: { type: "card", cardBrand: "visa", last4: "4242" },
        billingInfo: {
          fullName: "Leader One",
          email: "leader1-coorg@test.com",
        },
      });

      // First create an event without co-organizers
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const dateStr = futureDate.toISOString().split("T")[0];

      const createResponse = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          title: "Initial Event for Edit",
          type: "Effective Communication Workshop",
          date: dateStr,
          time: "14:00",
          endTime: "16:00",
          format: "In-person",
          location: "Conference Room",
          organizer: "Event Creator (Leader)",
          purpose: "Test purpose",
          programLabels: [paidProgramId],
          organizerDetails: [],
          roles: [
            {
              name: "Zoom Host",
              description: "Host the event",
              maxParticipants: 1,
            },
          ],
        });

      expect(createResponse.status).toBe(201);
      const eventId = createResponse.body.data._id;

      // Now edit and add co-organizer with access
      const updateResponse = await request(app)
        .put(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          organizerDetails: [
            {
              userId: leaderUserId,
              name: "Leader One",
              role: "Co-organizer",
            },
          ],
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.success).toBe(true);
    });
  });
});
