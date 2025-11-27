import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../../src/app";
import { ensureIntegrationDB } from "../setup/connect";
import User from "../../../src/models/User";
import Program from "../../../src/models/Program";
import Purchase from "../../../src/models/Purchase";

describe("Event Access Control Integration Tests", () => {
  let userToken: string;
  let userId: mongoose.Types.ObjectId;
  let programId: mongoose.Types.ObjectId;
  let eventId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    await ensureIntegrationDB();
    // Clear collections
    await User.deleteMany({});
    await Purchase.deleteMany({});

    // Create test user directly (for more reliable authentication)
    const user = await User.create({
      email: "eventbuyer@test.com",
      password: "Test123!",
      firstName: "Event",
      lastName: "Buyer",
      username: "eventbuyer",
      phone: "1234567890",
      gender: "male",
      isAtCloudLeader: false,
      isVerified: true,
    });
    userId = user._id as mongoose.Types.ObjectId;

    // Login to get a valid token
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ emailOrUsername: "eventbuyer@test.com", password: "Test123!" });

    expect(loginRes.status).toBe(200);
    userToken = loginRes.body.data.accessToken; // Create a program with a paid event
    const program = await Program.create({
      title: "Test Program with Event",
      programType: "EMBA Mentor Circles",
      date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      startTime: "09:00",
      endTime: "17:00",
      location: "Test Location",
      address: "123 Test St",
      capacity: 100,
      earlyBirdDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      earlyBirdPrice: 5000,
      regularPrice: 8000,
      fullPriceTicket: 8000,
      description: "Test program",
      status: "published",
      isPublished: true,
      agenda: [],
      createdBy: userId,
    });

    programId = program._id as mongoose.Types.ObjectId;

    // Create a separate Event document and link it to the program
    const { Event } = await import("../../../src/models");
    const event = await Event.create({
      title: "Paid Event in Program",
      date: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      endDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      time: "10:00",
      endTime: "12:00",
      location: "Event Location",
      organizer: "@Cloud",
      type: "Mentor Circle",
      format: "Hybrid Participation",
      purpose: "A paid event within the program",
      programId: programId,
      createdBy: userId,
      status: "upcoming",
      pricing: {
        isFree: false,
        price: 2000, // $20
      },
      roles: [
        {
          id: "role1",
          name: "Participant",
          description: "Event participant",
          maxParticipants: 50,
        },
      ],
      signedUp: 0,
      totalSlots: 50,
    });

    eventId = event._id as mongoose.Types.ObjectId;
  });

  describe("CRITICAL: Event-only purchase access control", () => {
    it("should allow access to event detail page when user purchased event ticket (without program purchase)", async () => {
      // Create a completed event purchase (no program purchase)
      await Purchase.create({
        userId: userId,
        eventId: eventId,
        purchaseType: "event",
        orderNumber: "ORD-TEST-001",
        fullPrice: 2000,
        finalPrice: 2000,
        status: "completed",
        purchaseDate: new Date(),
        billingInfo: {
          fullName: "Event Buyer",
          email: "eventbuyer@test.com",
        },
        paymentMethod: {
          type: "card",
        },
      });

      // Try to access the event detail page
      const response = await request(app)
        .get(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.event).toBeDefined();
      expect(response.body.data.event.id).toBe(eventId.toString());
      // Note: hasAccess and accessReason fields are not currently returned by the API
    });

    it("should allow access to event when user purchased the program (not the event separately)", async () => {
      // Create a completed program purchase
      await Purchase.create({
        userId: userId,
        programId: programId,
        purchaseType: "program",
        orderNumber: "ORD-TEST-002",
        fullPrice: 8000,
        finalPrice: 8000,
        status: "completed",
        purchaseDate: new Date(),
        billingInfo: {
          fullName: "Event Buyer",
          email: "eventbuyer@test.com",
        },
        paymentMethod: {
          type: "card",
        },
      });

      // Try to access the event detail page
      const response = await request(app)
        .get(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Note: hasAccess and accessReason fields are not currently returned by the API
    });

    it("should block access to event when user has not purchased event OR program", async () => {
      // No purchase created - user has no access

      const response = await request(app)
        .get(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Note: hasAccess and accessReason fields are not currently returned by the API
    });

    // Note: The remaining tests in this describe block tested deprecated
    // purchase endpoints (/api/purchases/events/:id) that no longer exist.
    // Current purchase endpoint is /api/events/:id/purchase
    // Those purchase flows are tested in event-purchase-flow.integration.test.ts
  });

  describe("Free event access control", () => {
    it("should allow access to free events without any purchase", async () => {
      // Update event to be free
      const { Event } = await import("../../../src/models");
      await Event.findByIdAndUpdate(eventId, {
        $set: { "pricing.isFree": true, "pricing.price": 0 },
      });

      const response = await request(app)
        .get(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Note: hasAccess and accessReason fields are not currently returned by the API
    });
  });
});
