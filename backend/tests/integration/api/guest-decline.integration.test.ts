/**
 * Guest Invitation Decline API Integration Tests
 *
 * Tests the guest invitation decline endpoints:
 * - GET /api/guest/decline/:token - Get decline token information
 * - POST /api/guest/decline/:token - Submit decline with optional reason
 *
 * Coverage includes:
 * - Token validation (valid, invalid, expired, wrong type)
 * - Registration state validation (not found, already declined/cancelled)
 * - Successful decline flow (with and without reason)
 * - Notification routing:
 *   - invitedBy user notification (when guest was invited by authenticated user)
 *   - Organizer email notification (when guest self-registered)
 * - TrioNotificationService integration (email + system message)
 * - Socket service real-time events
 * - Edge cases and error handling
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import request from "supertest";
import app from "../../../src/app";
import mongoose from "mongoose";
import { Event, GuestRegistration, User } from "../../../src/models";
import { ensureIntegrationDB } from "../setup/connect";
import {
  createGuestInvitationDeclineToken,
  verifyGuestInvitationDeclineToken,
} from "../../../src/utils/guestInvitationDeclineToken";
import { EmailService } from "../../../src/services/infrastructure/EmailServiceFacade";
import { TrioNotificationService } from "../../../src/services/notifications/TrioNotificationService";
import { socketService } from "../../../src/services/infrastructure/SocketService";
import { buildValidEventPayload } from "../../test-utils/eventTestHelpers";
import { ROLES } from "../../../src/utils/roleUtils";

// Mock email and notification services
vi.mock("../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendGuestDeclineNotification: vi.fn(),
  },
}));

vi.mock("../../../src/services/notifications/TrioNotificationService", () => ({
  TrioNotificationService: {
    createTrio: vi.fn(),
  },
}));

const emailSpy = vi.mocked(EmailService.sendGuestDeclineNotification);
const trioSpy = vi.mocked(TrioNotificationService.createTrio);
const socketSpy = vi.spyOn(socketService, "emitEventUpdate");

describe("Guest Invitation Decline API Integration Tests", () => {
  let event: any;
  let roleId: string;
  let creatorUser: any;
  let inviterUser: any;
  let guestRegistration: any;
  let declineToken: string;

  beforeAll(async () => {
    await ensureIntegrationDB();
  });

  beforeEach(async () => {
    // Clean up
    await User.deleteMany({});
    await Event.deleteMany({});
    await GuestRegistration.deleteMany({});

    // Clear mocks
    emailSpy.mockClear();
    trioSpy.mockClear();
    socketSpy.mockClear();

    // Mock implementations to succeed by default
    emailSpy.mockResolvedValue(undefined as any);
    trioSpy.mockResolvedValue(undefined as any);
    socketSpy.mockReturnValue(undefined as any);

    // Create creator user for event
    creatorUser = await User.create({
      firstName: "Event",
      lastName: "Creator",
      username: "eventcreator",
      email: "creator@test.com",
      password: "Password123!",
      gender: "male",
      role: ROLES.ADMINISTRATOR,
      isAtCloudLeader: false,
      isVerified: true,
    });

    // Create inviter user (will use for invitedBy scenarios)
    inviterUser = await User.create({
      firstName: "Guest",
      lastName: "Inviter",
      username: "guestinviter",
      email: "inviter@test.com",
      password: "Password123!",
      gender: "female",
      role: ROLES.PARTICIPANT,
      isAtCloudLeader: false,
      isVerified: true,
    });

    // Create event with proper organizer details
    const eventPayload = {
      ...buildValidEventPayload({
        title: "Guest Decline Test Event",
        location: "Test Location",
        roles: [
          {
            id: new mongoose.Types.ObjectId().toString(),
            name: "Test Attendee",
            description: "Test role for attendee",
            maxParticipants: 20,
            openToPublic: true,
          },
        ],
      }),
      createdBy: creatorUser._id,
      organizerDetails: [
        {
          name: "Organizer One",
          role: "Event Coordinator",
          email: "organizer1@test.com",
          phone: "+1-555-0001",
        },
        {
          name: "Organizer Two",
          role: "Technical Lead",
          email: "organizer2@test.com",
          phone: "+1-555-0002",
        },
      ],
    };

    event = await Event.create(eventPayload);
    roleId = event.roles[0].id;

    // Create base guest registration (will customize per test)
    guestRegistration = await GuestRegistration.create({
      eventId: event._id,
      roleId: roleId,
      fullName: "Test Guest",
      gender: "male",
      email: "guest@test.com",
      status: "active",
      eventSnapshot: {
        title: event.title,
        date: event.date,
        location: event.location,
        roleName: event.roles[0].name,
      },
    });

    declineToken = createGuestInvitationDeclineToken({
      registrationId: guestRegistration._id.toString(),
    });
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Event.deleteMany({});
    await GuestRegistration.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe("GET /api/guest/decline/:token - Get Decline Token Info", () => {
    describe("Token Validation", () => {
      it("should return 400 for invalid token format", async () => {
        const response = await request(app)
          .get("/api/guest/decline/invalidtoken123")
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/invalid decline link/i);
        expect(response.body.reason).toBe("invalid");
      });

      it("should return 410 for expired token", async () => {
        // Create token with past expiry
        const expiredToken = createGuestInvitationDeclineToken({
          registrationId: guestRegistration._id.toString(),
          expiresInDays: -1, // Already expired
        });

        const response = await request(app)
          .get(`/api/guest/decline/${expiredToken}`)
          .expect(410);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/decline link has expired/i);
        expect(response.body.reason).toBe("expired");
      });

      it("should trim whitespace from token parameter", async () => {
        const tokenWithSpaces = `  ${declineToken}  `;
        const response = await request(app)
          .get(`/api/guest/decline/${tokenWithSpaces}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe("Registration State Validation", () => {
      it("should return 404 if registration not found", async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const fakeToken = createGuestInvitationDeclineToken({
          registrationId: fakeId.toString(),
        });

        const response = await request(app)
          .get(`/api/guest/decline/${fakeToken}`)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/registration not found/i);
      });

      it("should return 409 if registration is already cancelled", async () => {
        await GuestRegistration.findByIdAndUpdate(guestRegistration._id, {
          status: "cancelled",
        });

        const response = await request(app)
          .get(`/api/guest/decline/${declineToken}`)
          .expect(409);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/already declined or cancelled/i);
      });

      it("should return 409 if registration already has declinedAt timestamp", async () => {
        await GuestRegistration.findByIdAndUpdate(guestRegistration._id, {
          declinedAt: new Date(),
        });

        const response = await request(app)
          .get(`/api/guest/decline/${declineToken}`)
          .expect(409);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/already declined or cancelled/i);
      });
    });

    describe("Success Response", () => {
      it("should return registration and event info for valid token", async () => {
        const response = await request(app)
          .get(`/api/guest/decline/${declineToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          registrationId: guestRegistration._id.toString(),
          eventTitle: event.title,
          roleName: event.roles[0].name,
          guestName: guestRegistration.fullName,
          location: event.location,
        });
        expect(response.body.data.eventDate).toBeDefined();
      });

      it("should fallback to eventSnapshot if event deleted", async () => {
        // Delete event
        await Event.findByIdAndDelete(event._id);

        const response = await request(app)
          .get(`/api/guest/decline/${declineToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.eventTitle).toBe(
          guestRegistration.eventSnapshot.title
        );
        expect(response.body.data.roleName).toBe(
          guestRegistration.eventSnapshot.roleName
        );
        expect(response.body.data.location).toBe(
          guestRegistration.eventSnapshot.location
        );
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database errors", async () => {
        // Use invalid ObjectId in token payload
        const badToken = createGuestInvitationDeclineToken({
          registrationId: "invalid-id",
        });

        const response = await request(app)
          .get(`/api/guest/decline/${badToken}`)
          .expect(500);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/server error/i);
      });
    });
  });

  describe("POST /api/guest/decline/:token - Submit Decline", () => {
    describe("Token Validation", () => {
      it("should return 400 for invalid token format", async () => {
        const response = await request(app)
          .post("/api/guest/decline/invalidtoken123")
          .send({ reason: "Cannot attend" })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/invalid decline link/i);
      });

      it("should return 410 for expired token", async () => {
        const expiredToken = createGuestInvitationDeclineToken({
          registrationId: guestRegistration._id.toString(),
          expiresInDays: -1,
        });

        const response = await request(app)
          .post(`/api/guest/decline/${expiredToken}`)
          .send({ reason: "Cannot attend" })
          .expect(410);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/decline link has expired/i);
      });
    });

    describe("Registration State Validation", () => {
      it("should return 404 if registration not found", async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const fakeToken = createGuestInvitationDeclineToken({
          registrationId: fakeId.toString(),
        });

        const response = await request(app)
          .post(`/api/guest/decline/${fakeToken}`)
          .send({ reason: "Cannot attend" })
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/registration not found/i);
      });

      it("should return 409 if already declined", async () => {
        await GuestRegistration.findByIdAndUpdate(guestRegistration._id, {
          status: "cancelled",
          declinedAt: new Date(),
        });

        const response = await request(app)
          .post(`/api/guest/decline/${declineToken}`)
          .send({ reason: "Cannot attend" })
          .expect(409);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/already declined or cancelled/i);
      });
    });

    describe("Successful Decline", () => {
      it("should successfully decline with reason", async () => {
        const response = await request(app)
          .post(`/api/guest/decline/${declineToken}`)
          .send({ reason: "Schedule conflict" })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toMatch(/declined successfully/i);
        expect(response.body.data.registrationId).toBe(
          guestRegistration._id.toString()
        );
        expect(response.body.data.declinedAt).toBeDefined();
      });

      it("should successfully decline without reason", async () => {
        const response = await request(app)
          .post(`/api/guest/decline/${declineToken}`)
          .send({})
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it("should update registration status to cancelled", async () => {
        await request(app)
          .post(`/api/guest/decline/${declineToken}`)
          .send({ reason: "Cannot attend" })
          .expect(200);

        const updated = await GuestRegistration.findById(guestRegistration._id);
        expect(updated?.status).toBe("cancelled");
        expect(updated?.migrationStatus).toBe("declined");
        expect(updated?.declinedAt).toBeDefined();
      });

      it("should store decline reason if provided", async () => {
        const reason = "I have a scheduling conflict";

        await request(app)
          .post(`/api/guest/decline/${declineToken}`)
          .send({ reason })
          .expect(200);

        const updated = await GuestRegistration.findById(guestRegistration._id);
        expect(updated?.declineReason).toBe(reason);
      });

      it("should truncate long decline reason to 500 characters", async () => {
        const longReason = "x".repeat(600);

        await request(app)
          .post(`/api/guest/decline/${declineToken}`)
          .send({ reason: longReason })
          .expect(200);

        const updated = await GuestRegistration.findById(guestRegistration._id);
        expect(updated?.declineReason).toHaveLength(500);
      });
    });

    describe("Notification Routing - Self-Registered Guest (No invitedBy)", () => {
      it("should send email to organizers when guest is self-registered", async () => {
        // Ensure no invitedBy field
        await GuestRegistration.findByIdAndUpdate(guestRegistration._id, {
          $unset: { invitedBy: 1 },
        });

        await request(app)
          .post(`/api/guest/decline/${declineToken}`)
          .send({ reason: "Cannot attend" })
          .expect(200);

        expect(emailSpy).toHaveBeenCalledTimes(1);
        expect(emailSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            organizerEmails: ["organizer1@test.com", "organizer2@test.com"],
            guest: expect.objectContaining({
              name: guestRegistration.fullName,
              email: guestRegistration.email,
            }),
            reason: "Cannot attend",
          })
        );
      });

      it("should not send email if event has no organizer emails", async () => {
        // Remove organizer emails
        await Event.findByIdAndUpdate(event._id, {
          organizerDetails: [],
        });

        await request(app)
          .post(`/api/guest/decline/${declineToken}`)
          .send({ reason: "Cannot attend" })
          .expect(200);

        expect(emailSpy).not.toHaveBeenCalled();
      });
    });

    describe("Notification Routing - Invited Guest (With invitedBy)", () => {
      beforeEach(async () => {
        // Set invitedBy field
        await GuestRegistration.findByIdAndUpdate(guestRegistration._id, {
          invitedBy: inviterUser._id,
        });
      });

      it("should NOT send email to organizers when guest was invited by user", async () => {
        await request(app)
          .post(`/api/guest/decline/${declineToken}`)
          .send({ reason: "Cannot attend" })
          .expect(200);

        expect(emailSpy).not.toHaveBeenCalled();
      });

      it("should create TrioNotification for inviter user", async () => {
        await request(app)
          .post(`/api/guest/decline/${declineToken}`)
          .send({ reason: "Schedule conflict" })
          .expect(200);

        expect(trioSpy).toHaveBeenCalledTimes(1);

        // Get the actual call arguments
        const callArgs = trioSpy.mock.calls[0][0];

        // Verify key fields exist with correct values
        expect(callArgs).toMatchObject({
          email: expect.objectContaining({
            to: inviterUser.email,
            template: "event-role-rejected",
            data: expect.objectContaining({
              event: expect.objectContaining({
                id: event._id.toString(),
                title: event.title,
              }),
              roleName: event.roles[0].name,
              rejectedBy: expect.objectContaining({
                id: "guest",
                firstName: guestRegistration.fullName.split(" ")[0],
              }),
              assigner: expect.objectContaining({
                id: inviterUser._id.toString(),
                firstName: inviterUser.firstName,
              }),
              noteProvided: true,
              noteText: "Schedule conflict",
            }),
          }),
          systemMessage: expect.objectContaining({
            title: "Guest Invitation Declined",
            content: expect.stringContaining(guestRegistration.fullName),
            type: "event_role_change",
            priority: "medium",
          }),
          recipients: [inviterUser._id.toString()],
        });
      });

      it("should handle TrioNotification without reason", async () => {
        await request(app)
          .post(`/api/guest/decline/${declineToken}`)
          .send({})
          .expect(200);

        expect(trioSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            email: expect.objectContaining({
              data: expect.objectContaining({
                noteProvided: false,
              }),
            }),
          })
        );
      });

      it("should not create notification if inviter email matches guest email", async () => {
        // Edge case: inviter and guest have same email
        await User.findByIdAndUpdate(inviterUser._id, {
          email: guestRegistration.email,
        });

        await request(app)
          .post(`/api/guest/decline/${declineToken}`)
          .send({ reason: "Cannot attend" })
          .expect(200);

        expect(trioSpy).not.toHaveBeenCalled();
      });
    });

    describe("Notification Routing - Fallback to Event Creator", () => {
      it("should use event.createdBy when no invitedBy exists", async () => {
        // Remove invitedBy
        await GuestRegistration.findByIdAndUpdate(guestRegistration._id, {
          $unset: { invitedBy: 1 },
        });

        await request(app)
          .post(`/api/guest/decline/${declineToken}`)
          .send({ reason: "Cannot attend" })
          .expect(200);

        // Should have attempted TrioNotification with creator user
        expect(trioSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            recipients: [creatorUser._id.toString()],
            email: expect.objectContaining({
              to: creatorUser.email,
            }),
          })
        );
      });
    });

    describe("Socket Real-Time Events", () => {
      it("should emit guest_declined socket event", async () => {
        await request(app)
          .post(`/api/guest/decline/${declineToken}`)
          .send({ reason: "Cannot attend" })
          .expect(200);

        expect(socketSpy).toHaveBeenCalledWith(
          event._id.toString(),
          "guest_declined",
          expect.objectContaining({
            roleId: roleId,
            guestName: guestRegistration.fullName,
          })
        );
      });

      it("should continue if socket emit fails", async () => {
        socketSpy.mockImplementation(() => {
          throw new Error("Socket error");
        });

        const response = await request(app)
          .post(`/api/guest/decline/${declineToken}`)
          .send({ reason: "Cannot attend" })
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe("Error Handling", () => {
      it("should succeed even if email notification fails", async () => {
        emailSpy.mockRejectedValue(new Error("Email service down"));

        const response = await request(app)
          .post(`/api/guest/decline/${declineToken}`)
          .send({ reason: "Cannot attend" })
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify registration was still updated
        const updated = await GuestRegistration.findById(guestRegistration._id);
        expect(updated?.status).toBe("cancelled");
      });

      it("should succeed even if TrioNotification fails", async () => {
        await GuestRegistration.findByIdAndUpdate(guestRegistration._id, {
          invitedBy: inviterUser._id,
        });

        trioSpy.mockRejectedValue(new Error("Notification service down"));

        const response = await request(app)
          .post(`/api/guest/decline/${declineToken}`)
          .send({ reason: "Cannot attend" })
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it("should return 500 on database errors", async () => {
        const badToken = createGuestInvitationDeclineToken({
          registrationId: "invalid-id",
        });

        const response = await request(app)
          .post(`/api/guest/decline/${badToken}`)
          .send({ reason: "Cannot attend" })
          .expect(500);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/server error/i);
      });
    });

    describe("Idempotency", () => {
      it("should prevent double decline", async () => {
        // First decline succeeds
        await request(app)
          .post(`/api/guest/decline/${declineToken}`)
          .send({ reason: "First decline" })
          .expect(200);

        // Second decline fails
        const response = await request(app)
          .post(`/api/guest/decline/${declineToken}`)
          .send({ reason: "Second decline" })
          .expect(409);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/already declined or cancelled/i);
      });
    });
  });
});
