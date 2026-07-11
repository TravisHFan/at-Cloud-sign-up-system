import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Event from "../../../src/models/Event";
import { GuestRegistration } from "../../../src/models";
import { ROLES } from "../../../src/utils/roleUtils";
import { ensureIntegrationDB } from "../setup/connect";
import { TokenService } from "../../../src/middleware/auth";
import mongoose from "mongoose";

describe("GuestListController - GET /api/events/:eventId/guests", () => {
  // Helper to create a valid event with all required fields
  const createTestEvent = async (createdBy: mongoose.Types.ObjectId) => {
    return Event.create({
      title: "Test Event",
      slug: "test-event-" + Date.now(),
      type: "Conference",
      date: "2025-12-01",
      time: "10:00",
      endTime: "12:00",
      location: "Test Location",
      organizer: "Test Organizer",
      format: "In-person",
      startDate: new Date("2025-12-01"),
      createdBy,
      isPublished: true,
      roles: [
        {
          id: "attendee",
          name: "Attendee",
          description: "General attendee",
          capacity: 100,
          maxParticipants: 100,
          price: 0,
          currency: "USD",
        },
      ],
    });
  };

  // Helper to create a valid guest registration
  const createTestGuest = async (
    event: {
      _id: mongoose.Types.ObjectId;
      title?: string;
      date?: string;
      location?: string;
    },
    overrides: Partial<{
      fullName: string;
      email: string;
      phone: string;
      gender: string;
      status: string;
    }> = {}
  ) => {
    return GuestRegistration.create({
      eventId: event._id,
      roleId: "attendee",
      fullName: overrides.fullName || "Guest User",
      gender: overrides.gender || "male",
      email: overrides.email || "guest@test.com",
      phone: overrides.phone,
      status: overrides.status || "active",
      eventSnapshot: {
        title: event.title || "Test Event",
        date: event.date ? new Date(event.date) : new Date("2025-12-01"),
        location: event.location || "Test Location",
        roleName: "Attendee",
      },
    });
  };

  beforeEach(async () => {
    await ensureIntegrationDB();
    await User.deleteMany({});
    await Event.deleteMany({});
    await GuestRegistration.deleteMany({});
  });

  // Note: This endpoint uses authenticateOptional, so authentication is not required
  // Tests focus on role-based response filtering

  // ========== Success Cases - Privileged Users ==========
  describe("Success Cases - Privileged Users (Admin View)", () => {
    it("should return full guest details for Super Admin", async () => {
      const admin = await User.create({
        name: "Super Admin",
        username: "superadmin",
        email: "superadmin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const event = await createTestEvent(admin._id);
      await createTestGuest(event, {
        fullName: "Guest User",
        email: "guest@test.com",
        phone: "1234567890",
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get(`/api/events/${event._id}/guests`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.guests).toHaveLength(1);
      expect(response.body.data.count).toBe(1);
      // Admin view should include email and phone
      expect(response.body.data.guests[0].email).toBe("guest@test.com");
      expect(response.body.data.guests[0].phone).toBe("1234567890");
    });

    it("should return full guest details for Administrator", async () => {
      const admin = await User.create({
        name: "Administrator",
        username: "administrator",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.ADMINISTRATOR,
        isActive: true,
        isVerified: true,
      });

      const event = await createTestEvent(admin._id);
      await createTestGuest(event, {
        email: "guest@test.com",
        phone: "1234567890",
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get(`/api/events/${event._id}/guests`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.guests[0].email).toBe("guest@test.com");
      expect(response.body.data.guests[0].phone).toBe("1234567890");
    });

    it("should return full guest details for Leader", async () => {
      const leader = await User.create({
        name: "Leader",
        username: "leader",
        email: "leader@test.com",
        password: "Password123",
        role: ROLES.LEADER,
        isActive: true,
        isVerified: true,
      });

      const event = await createTestEvent(leader._id);
      await createTestGuest(event, {
        email: "guest@test.com",
        phone: "1234567890",
      });

      const token = TokenService.generateTokenPair(leader).accessToken;

      const response = await request(app)
        .get(`/api/events/${event._id}/guests`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.guests[0].email).toBe("guest@test.com");
      expect(response.body.data.guests[0].phone).toBe("1234567890");
    });

    it("should not expose sensitive fields even for admins", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const event = await createTestEvent(admin._id);
      await createTestGuest(event);

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get(`/api/events/${event._id}/guests`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.guests[0]).not.toHaveProperty("manageToken");
      expect(response.body.data.guests[0]).not.toHaveProperty(
        "manageTokenExpires"
      );
      expect(response.body.data.guests[0]).not.toHaveProperty("__v");
    });
  });

  // ========== Success Cases - Non-Privileged Users ==========
  describe("Success Cases - Non-Privileged Users (Public View)", () => {
    it("should return sanitized guest list for Participant", async () => {
      const participant = await User.create({
        name: "Participant",
        username: "participant",
        email: "participant@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const event = await createTestEvent(participant._id);
      await createTestGuest(event, {
        email: "guest@test.com",
        phone: "1234567890",
      });

      const token = TokenService.generateTokenPair(participant).accessToken;

      const response = await request(app)
        .get(`/api/events/${event._id}/guests`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.guests).toHaveLength(1);
      expect(response.body.data.guests[0].fullName).toBe("Guest User");
      // Public view should not expose sensitive fields
      expect(response.body.data.guests[0]).not.toHaveProperty("manageToken");
      expect(response.body.data.guests[0]).not.toHaveProperty("ipAddress");
      expect(response.body.data.guests[0]).not.toHaveProperty("userAgent");
    });
  });

  // ========== Edge Cases ==========
  describe("Edge Cases", () => {
    it("should return empty list when event has no guests", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const event = await createTestEvent(admin._id);
      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get(`/api/events/${event._id}/guests`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.guests).toEqual([]);
      expect(response.body.data.count).toBe(0);
    });

    it("should only return active guests", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const event = await createTestEvent(admin._id);

      await createTestGuest(event, {
        fullName: "Active Guest",
        email: "active@test.com",
        status: "active",
      });

      await createTestGuest(event, {
        fullName: "Cancelled Guest",
        email: "cancelled@test.com",
        status: "cancelled",
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get(`/api/events/${event._id}/guests`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.guests).toHaveLength(1);
      expect(response.body.data.guests[0].email).toBe("active@test.com");
    });

    it("should handle non-existent event gracefully", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const fakeEventId = new mongoose.Types.ObjectId();
      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get(`/api/events/${fakeEventId}/guests`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.guests).toEqual([]);
      expect(response.body.data.count).toBe(0);
    });

    it("should handle multiple guests for same event", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const event = await createTestEvent(admin._id);

      await createTestGuest(event, {
        fullName: "Guest 1",
        email: "guest1@test.com",
      });
      await createTestGuest(event, {
        fullName: "Guest 2",
        email: "guest2@test.com",
      });
      await createTestGuest(event, {
        fullName: "Guest 3",
        email: "guest3@test.com",
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get(`/api/events/${event._id}/guests`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.guests).toHaveLength(3);
      expect(response.body.data.count).toBe(3);
    });

    it("should only return guests for specified event", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const event1 = await createTestEvent(admin._id);
      const event2 = await createTestEvent(admin._id);

      await createTestGuest(event1, {
        fullName: "Guest Event 1",
        email: "guest1@test.com",
      });
      await createTestGuest(event2, {
        fullName: "Guest Event 2",
        email: "guest2@test.com",
      });

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get(`/api/events/${event1._id}/guests`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.guests).toHaveLength(1);
      expect(response.body.data.guests[0].email).toBe("guest1@test.com");
    });

    it("should handle many guests efficiently", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const event = await createTestEvent(admin._id);

      const guestPromises = [];
      for (let i = 0; i < 30; i++) {
        guestPromises.push(
          createTestGuest(event, {
            fullName: `Guest ${i}`,
            email: `guest${i}@test.com`,
          })
        );
      }
      await Promise.all(guestPromises);

      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get(`/api/events/${event._id}/guests`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.guests).toHaveLength(30);
      expect(response.body.data.count).toBe(30);
    });
  });

  // ========== Response Format ==========
  describe("Response Format", () => {
    it("should have correct response structure", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const event = await createTestEvent(admin._id);
      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get(`/api/events/${event._id}/guests`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success");
      expect(response.body).toHaveProperty("data");
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("guests");
      expect(response.body.data).toHaveProperty("count");
      expect(Array.isArray(response.body.data.guests)).toBe(true);
      expect(typeof response.body.data.count).toBe("number");
    });

    it("should not include message field on success", async () => {
      const admin = await User.create({
        name: "Admin",
        username: "admin",
        email: "admin@test.com",
        password: "Password123",
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      });

      const event = await createTestEvent(admin._id);
      const token = TokenService.generateTokenPair(admin).accessToken;

      const response = await request(app)
        .get(`/api/events/${event._id}/guests`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty("message");
    });
  });
});
