import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../../src/index";
import User from "../../src/models/User";
import Event from "../../src/models/Event";
import { ROLES } from "../../src/utils/roleUtils";
import { createAuthenticatedRequest } from "../utils/authHelpers";

describe("Event Co-Organizer Authorization", () => {
  let creatorUser: any;
  let coOrganizerUser: any;
  let nonOrganizerUser: any;
  let testEvent: any;
  let creatorToken: string;
  let coOrganizerToken: string;
  let nonOrganizerToken: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-test"
      );
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up
    await User.deleteMany({});
    await Event.deleteMany({});

    // Create test users
    creatorUser = await User.create({
      username: "creator",
      firstName: "Event",
      lastName: "Creator",
      email: "creator@test.com",
      password: "Password123",
      role: ROLES.LEADER,
      phoneNumber: "1234567890",
      dateOfBirth: new Date("1990-01-01"),
      isActive: true,
      isVerified: true,
    });

    coOrganizerUser = await User.create({
      username: "coorganizer",
      firstName: "Co",
      lastName: "Organizer",
      email: "coorganizer@test.com",
      password: "Password123",
      role: ROLES.LEADER,
      phoneNumber: "1234567891",
      dateOfBirth: new Date("1990-01-02"),
      isActive: true,
      isVerified: true,
    });

    nonOrganizerUser = await User.create({
      username: "nonorganizer",
      firstName: "Non",
      lastName: "Organizer",
      email: "nonorganizer@test.com",
      password: "Password123",
      role: ROLES.LEADER,
      phoneNumber: "1234567892",
      dateOfBirth: new Date("1990-01-03"),
      isActive: true,
      isVerified: true,
    });

    // Create JWT tokens using the authHelpers utility
    creatorToken = await createAuthenticatedRequest(creatorUser);
    coOrganizerToken = await createAuthenticatedRequest(coOrganizerUser);
    nonOrganizerToken = await createAuthenticatedRequest(nonOrganizerUser);

    // Create test event with co-organizer
    testEvent = await Event.create({
      title: "Test Event",
      description: "Test Description",
      date: new Date("2025-12-25"),
      time: "10:00",
      endTime: "12:00",
      location: "Test Location",
      type: "Workshop",
      organizer: `${creatorUser.firstName} ${creatorUser.lastName} (${creatorUser.role})`,
      organizerDetails: [
        {
          userId: creatorUser._id,
          name: `${creatorUser.firstName} ${creatorUser.lastName}`,
          role: creatorUser.role,
          email: creatorUser.email,
          phone: creatorUser.phoneNumber,
        },
        {
          userId: coOrganizerUser._id,
          name: `${coOrganizerUser.firstName} ${coOrganizerUser.lastName}`,
          role: coOrganizerUser.role,
          email: coOrganizerUser.email,
          phone: coOrganizerUser.phoneNumber,
        },
      ],
      format: "In-person",
      purpose: "Test Purpose",
      agenda: "Test Agenda",
      roles: [
        {
          id: "test-role",
          name: "Participant",
          description: "Test participant role",
          maxParticipants: 10,
          currentSignups: [],
        },
      ],
      createdBy: creatorUser._id,
      hostedBy: "@Cloud Marketplace Ministry",
    });
  });

  describe("Event Update Authorization", () => {
    it("should allow event creator to update event", async () => {
      const updateData = {
        title: "Updated Event Title",
        description: "Updated Description",
      };

      const response = await request(app)
        .put(`/api/v1/events/${testEvent._id}`)
        .set("Authorization", `Bearer ${creatorToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Event updated successfully!");
    });

    it("should allow co-organizer to update event", async () => {
      const updateData = {
        title: "Updated by Co-Organizer",
        description: "Updated by co-organizer",
      };

      const response = await request(app)
        .put(`/api/v1/events/${testEvent._id}`)
        .set("Authorization", `Bearer ${coOrganizerToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Event updated successfully!");
    });

    it("should deny non-organizer from updating event", async () => {
      const updateData = {
        title: "Unauthorized Update",
        description: "This should fail",
      };

      const response = await request(app)
        .put(`/api/v1/events/${testEvent._id}`)
        .set("Authorization", `Bearer ${nonOrganizerToken}`)
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access denied");
    });

    it("should deny unauthenticated requests", async () => {
      const updateData = {
        title: "Unauthorized Update",
      };

      const response = await request(app)
        .put(`/api/v1/events/${testEvent._id}`)
        .send(updateData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe("Event Delete Authorization", () => {
    it("should allow event creator to delete event", async () => {
      const response = await request(app)
        .delete(`/api/v1/events/${testEvent._id}`)
        .set("Authorization", `Bearer ${creatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should allow co-organizer to delete event", async () => {
      const response = await request(app)
        .delete(`/api/v1/events/${testEvent._id}`)
        .set("Authorization", `Bearer ${coOrganizerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should deny non-organizer from deleting event", async () => {
      const response = await request(app)
        .delete(`/api/v1/events/${testEvent._id}`)
        .set("Authorization", `Bearer ${nonOrganizerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access denied");
    });
  });
});
