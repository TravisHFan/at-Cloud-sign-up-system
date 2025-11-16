import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import { GuestRegistration, Event, User } from "../../../src/models";
import { ensureIntegrationDB } from "../setup/connect";
import * as crypto from "crypto";
import { ROLES } from "../../../src/utils/roleUtils";

describe("GuestTokenRetrievalController - GET /api/guest/manage/:token", () => {
  beforeEach(async () => {
    await ensureIntegrationDB();
    await GuestRegistration.deleteMany({});
    await Event.deleteMany({});
    await User.deleteMany({});
  });

  // Helper function to create test event
  const createTestEvent = async () => {
    const creator = await User.create({
      name: "Event Creator",
      username: "eventcreator",
      email: "creator@test.com",
      password: "Password123",
      role: ROLES.PARTICIPANT,
      isActive: true,
      isVerified: true,
    });

    const eventDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const year = eventDate.getFullYear();
    const month = String(eventDate.getMonth() + 1).padStart(2, "0");
    const day = String(eventDate.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    return await Event.create({
      title: "Test Event",
      type: "Conference",
      date: dateStr,
      endDate: dateStr,
      time: "10:00",
      endTime: "12:00",
      location: "Test Location",
      organizer: "Test Organizer",
      format: "In-person",
      createdBy: creator._id,
      roles: [
        {
          id: "participant-role-1",
          name: "Participant",
          description: "Event participant",
          maxParticipants: 100,
          signups: [],
        },
      ],
      isPaid: false,
      published: true,
    });
  };

  // Helper function to create test guest with manage token
  const createGuestWithToken = async (eventId: any, options: any = {}) => {
    const guest = await GuestRegistration.create({
      eventId,
      roleId: options.roleId || "participant-role-1",
      fullName: `${options.firstName || "Test"} ${options.lastName || "Guest"}`,
      gender: options.gender || "male",
      email: options.email || "guest@test.com",
      phone: options.phone || "1234567890",
      status: options.status || "active",
      registrationDate: new Date(),
      eventSnapshot: {
        title: "Test Event",
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        location: "Test Location",
        roleName: "Participant",
      },
    });

    // Generate manage token
    const rawToken = guest.generateManageToken();
    await guest.save();

    return { guest, rawToken };
  };

  // ========== Authentication Tests ==========
  describe("Authentication", () => {
    it("should not require authentication (public endpoint)", async () => {
      const event = await createTestEvent();
      const { rawToken } = await createGuestWithToken(event._id);

      const response = await request(app).get(`/api/guest/manage/${rawToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ========== Success Cases ==========
  describe("Success Cases", () => {
    it("should return guest registration with valid token", async () => {
      const event = await createTestEvent();
      const { guest, rawToken } = await createGuestWithToken(event._id);

      const response = await request(app).get(`/api/guest/manage/${rawToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.guest).toBeDefined();
      expect(response.body.data.guest._id).toBe((guest as any)._id.toString());
      expect(response.body.data.guest.fullName).toBe("Test Guest");
      expect(response.body.data.guest.gender).toBe("male");
      expect(response.body.data.guest.email).toBe("guest@test.com");
    });

    it("should return guest with all public fields", async () => {
      const event = await createTestEvent();
      const { guest, rawToken } = await createGuestWithToken(event._id, {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@test.com",
        phone: "9876543210",
        gender: "female",
        status: "active",
      });

      const response = await request(app).get(`/api/guest/manage/${rawToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.guest.fullName).toBe("John Doe");
      expect(response.body.data.guest.gender).toBe("female");
      expect(response.body.data.guest.email).toBe("john.doe@test.com");
      expect(response.body.data.guest.phone).toBe("9876543210");
      expect(response.body.data.guest.status).toBe("active");
    });

    it("should not expose sensitive fields (manageToken, ipAddress, userAgent)", async () => {
      const event = await createTestEvent();
      const { rawToken } = await createGuestWithToken(event._id);

      const response = await request(app).get(`/api/guest/manage/${rawToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.guest.manageToken).toBeUndefined();
      expect(response.body.data.guest.manageTokenExpires).toBeUndefined();
      expect(response.body.data.guest.ipAddress).toBeUndefined();
      expect(response.body.data.guest.userAgent).toBeUndefined();
      expect(response.body.data.guest.__v).toBeUndefined();
    });

    it("should work with recently generated token", async () => {
      const event = await createTestEvent();
      const { rawToken } = await createGuestWithToken(event._id);

      // Use token immediately
      const response = await request(app).get(`/api/guest/manage/${rawToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should return guest with active status", async () => {
      const event = await createTestEvent();
      const { rawToken } = await createGuestWithToken(event._id, {
        status: "active",
      });

      const response = await request(app).get(`/api/guest/manage/${rawToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.guest.status).toBe("active");
    });
  });

  // ========== Edge Cases ==========
  describe("Edge Cases", () => {
    it("should return 404 for invalid token format", async () => {
      const response = await request(app).get(
        "/api/guest/manage/invalid-token-123"
      );

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Invalid or expired link");
    });

    it("should return 404 for non-existent token", async () => {
      const fakeToken = crypto.randomBytes(24).toString("hex");

      const response = await request(app).get(`/api/guest/manage/${fakeToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Invalid or expired link");
    });

    it("should return 404 for expired token", async () => {
      const event = await createTestEvent();
      const guest = await GuestRegistration.create({
        eventId: event._id,
        roleId: "participant-role-1",
        fullName: "Test Guest",
        gender: "male",
        email: "guest@test.com",
        phone: "1234567890",
        status: "active",
        registrationDate: new Date(),
        eventSnapshot: {
          title: "Test Event",
          date: new Date(),
          location: "Test Location",
          roleName: "Participant",
        },
      });

      // Generate expired token (set expiry in the past)
      const rawToken = crypto.randomBytes(24).toString("hex");
      const hashed = crypto.createHash("sha256").update(rawToken).digest("hex");
      guest.manageToken = hashed;
      guest.manageTokenExpires = new Date(Date.now() - 1000); // Expired 1 second ago
      await guest.save();

      const response = await request(app).get(`/api/guest/manage/${rawToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Invalid or expired link");
    });

    it("should return 404 for cancelled guest registration", async () => {
      const event = await createTestEvent();
      const { rawToken } = await createGuestWithToken(event._id, {
        status: "cancelled",
      });

      const response = await request(app).get(`/api/guest/manage/${rawToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Invalid or expired link");
    });

    it("should return 404 for empty token", async () => {
      const response = await request(app).get("/api/guest/manage/");

      expect(response.status).toBe(404); // Route not found
    });

    it("should handle token case sensitivity correctly", async () => {
      const event = await createTestEvent();
      const { rawToken } = await createGuestWithToken(event._id);

      // Try with uppercase token (should fail - tokens are case-sensitive)
      const response = await request(app).get(
        `/api/guest/manage/${rawToken.toUpperCase()}`
      );

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("should use SHA-256 hashing for token validation", async () => {
      const event = await createTestEvent();
      const { guest, rawToken } = await createGuestWithToken(event._id);

      // Verify the stored token is hashed
      const expectedHash = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");
      const storedGuest = await GuestRegistration.findById(guest._id);
      expect(storedGuest?.manageToken).toBe(expectedHash);

      // Verify original token works
      const response = await request(app).get(`/api/guest/manage/${rawToken}`);
      expect(response.status).toBe(200);
    });

    it("should return different guests for different tokens", async () => {
      const event = await createTestEvent();
      const { guest: guest1, rawToken: token1 } = await createGuestWithToken(
        event._id,
        { firstName: "Alice", email: "alice@test.com" }
      );
      const { guest: guest2, rawToken: token2 } = await createGuestWithToken(
        event._id,
        { firstName: "Bob", email: "bob@test.com" }
      );

      const response1 = await request(app).get(`/api/guest/manage/${token1}`);
      const response2 = await request(app).get(`/api/guest/manage/${token2}`);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.data.guest._id).toBe(
        (guest1 as any)._id.toString()
      );
      expect(response2.body.data.guest._id).toBe(
        (guest2 as any)._id.toString()
      );
      expect(response1.body.data.guest.fullName).toBe("Alice Guest");
      expect(response2.body.data.guest.fullName).toBe("Bob Guest");
    });

    it("should handle token expiry window (30 days)", async () => {
      const event = await createTestEvent();
      const guest = await GuestRegistration.create({
        eventId: event._id,
        roleId: "participant-role-1",
        fullName: "Test Guest",
        gender: "male",
        email: "guest@test.com",
        phone: "1234567890",
        status: "active",
        registrationDate: new Date(),
        eventSnapshot: {
          title: "Test Event",
          date: new Date(),
          location: "Test Location",
          roleName: "Participant",
        },
      });

      // Generate token with 29 days 23 hours validity (should still work)
      const rawToken = crypto.randomBytes(24).toString("hex");
      const hashed = crypto.createHash("sha256").update(rawToken).digest("hex");
      guest.manageToken = hashed;
      guest.manageTokenExpires = new Date(
        Date.now() + 29 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000
      );
      await guest.save();

      const response = await request(app).get(`/api/guest/manage/${rawToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ========== Response Format ==========
  describe("Response Format", () => {
    it("should have correct success response structure", async () => {
      const event = await createTestEvent();
      const { rawToken } = await createGuestWithToken(event._id);

      const response = await request(app).get(`/api/guest/manage/${rawToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success");
      expect(response.body).toHaveProperty("data");
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("guest");
    });

    it("should have correct error response structure", async () => {
      const response = await request(app).get(
        "/api/guest/manage/invalid-token"
      );

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("success");
      expect(response.body).toHaveProperty("message");
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Invalid or expired link");
    });

    it("should not include message field on success", async () => {
      const event = await createTestEvent();
      const { rawToken } = await createGuestWithToken(event._id);

      const response = await request(app).get(`/api/guest/manage/${rawToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBeUndefined();
    });
  });
});
