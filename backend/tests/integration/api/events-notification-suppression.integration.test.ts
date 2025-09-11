import { describe, it, beforeEach, expect, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Event from "../../../src/models/Event";
import Registration from "../../../src/models/Registration";
import GuestRegistration from "../../../src/models/GuestRegistration";
import { EmailService } from "../../../src/services/infrastructure/emailService";
import { UnifiedMessageController } from "../../../src/controllers/unifiedMessageController";

/**
 * Integration test to verify the suppressNotifications flag on event creation.
 *
 * Strategy:
 *  - Create two verified users (organizer + participant) so that unsuppressed path would send at least one eventCreated email.
 *  - First create event with suppressNotifications=true and assert no system message or email methods invoked.
 *  - Then create second event without suppression and assert system message and email methods invoked.
 */

// Helper to register + verify + login
async function registerAndLogin(opts: {
  username: string;
  email: string;
  role?: string;
}) {
  const password = "TestPass123!";
  const regRes = await request(app).post("/api/auth/register").send({
    username: opts.username,
    email: opts.email,
    password,
    confirmPassword: password,
    firstName: "T",
    lastName: "U",
    gender: "male",
    isAtCloudLeader: false,
    acceptTerms: true,
  });
  if (regRes.status !== 201) {
    throw new Error(`Registration failed for ${opts.email}: ${regRes.status}`);
  }
  await User.findOneAndUpdate(
    { email: opts.email },
    { isVerified: true, ...(opts.role ? { role: opts.role } : {}) }
  );
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ emailOrUsername: opts.email, password })
    .expect(200);
  return { token: loginRes.body.data.accessToken as string };
}

// Spies (declared outer scope for type narrowing)
// Use loose any types here to avoid Vitest generic signature incompatibility noise;
// we only assert on call counts.
let systemMsgSpy: any;
let eventCreatedEmailSpy: any;
let coOrganizerEmailSpy: any;
let eventUpdatedEmailBulkSpy: any;

describe("Event creation notification suppression", () => {
  beforeEach(async () => {
    await User.deleteMany({});
    await Event.deleteMany({});
    await Registration.deleteMany({});
    await GuestRegistration.deleteMany({});
    vi.restoreAllMocks();
    systemMsgSpy = vi
      .spyOn(UnifiedMessageController, "createTargetedSystemMessage")
      .mockResolvedValue({
        _id: { toString: () => "mock-id" },
      } as any);
    eventCreatedEmailSpy = vi
      .spyOn(EmailService, "sendEventCreatedEmail")
      .mockResolvedValue(true as any);
    coOrganizerEmailSpy = vi
      .spyOn(EmailService, "sendCoOrganizerAssignedEmail")
      .mockResolvedValue(true as any);
    eventUpdatedEmailBulkSpy = vi
      .spyOn(EmailService, "sendEventNotificationEmailBulk")
      .mockResolvedValue([true] as any);
  });

  it("skips system messages and emails when suppressNotifications=true, but sends them when false", async () => {
    // Arrange users
    const organizer = await registerAndLogin({
      username: "org1",
      email: "org1@example.com",
      role: "Leader",
    });
    // Additional participant to ensure at least one potential eventCreatedEmail recipient (emails exclude creator)
    // Use a longer username to satisfy username length validation and omit role for default participant role assignment
    await registerAndLogin({
      username: "participant1",
      email: "participant1@example.com",
    });

    const suppressedPayload = {
      title: "Suppressed Event",
      description: "Suppressed event description",
      agenda: "1. Intro and overview\n2. Content deep dive section",
      type: "Effective Communication Workshop",
      date: "2099-12-31",
      endDate: "2099-12-31",
      time: "10:00",
      endTime: "11:00",
      location: "Loc",
      organizer: "Org",
      format: "In-person",
      roles: [
        {
          id: "role-1",
          name: "Zoom Host",
          description: "d",
          maxParticipants: 1,
        },
      ],
      suppressNotifications: true,
    };

    const suppressedRes = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send(suppressedPayload);

    if (suppressedRes.status !== 201) {
      // Dump validation errors for debugging then fail explicitly
      // eslint-disable-next-line no-console
      console.error("Suppressed event creation failed", {
        status: suppressedRes.status,
        body: suppressedRes.body,
        payload: suppressedPayload,
      });
    }
    expect(suppressedRes.status).toBe(201);

    expect(suppressedRes.body.success).toBe(true);

    expect(systemMsgSpy).toHaveBeenCalledTimes(0);
    expect(eventCreatedEmailSpy).toHaveBeenCalledTimes(0);
    expect(coOrganizerEmailSpy).toHaveBeenCalledTimes(0);

    const unsuppressedPayload = {
      title: "Normal Event",
      description: "Normal event description",
      agenda: "1. Intro and overview\n2. Content deep dive section",
      type: "Effective Communication Workshop",
      date: "2099-11-30",
      endDate: "2099-11-30",
      time: "09:00",
      endTime: "10:00",
      location: "Loc",
      organizer: "Org",
      format: "In-person",
      roles: [
        {
          id: "role-1",
          name: "Zoom Host",
          description: "d",
          maxParticipants: 1,
        },
      ],
    };

    const unsuppressedRes = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send(unsuppressedPayload);

    if (unsuppressedRes.status !== 201) {
      // eslint-disable-next-line no-console
      console.error("Unsuppressed event creation failed", {
        status: unsuppressedRes.status,
        body: unsuppressedRes.body,
        payload: unsuppressedPayload,
      });
    }
    expect(unsuppressedRes.status).toBe(201);

    expect(unsuppressedRes.body.success).toBe(true);

    expect(systemMsgSpy).toHaveBeenCalledTimes(1);
    expect(eventCreatedEmailSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(coOrganizerEmailSpy).toHaveBeenCalledTimes(0);
  });

  it("skips update notifications when suppressNotifications=true on edit, but sends them when false", async () => {
    // Arrange users
    const organizer = await registerAndLogin({
      username: "org2",
      email: "org2@example.com",
      role: "Leader",
    });
    const participant = await registerAndLogin({
      username: "participant2",
      email: "participant2@example.com",
    });

    // Create an event with suppression to avoid create-time notifications
    const createPayload = {
      title: "Update Suppression Event",
      description: "Original description",
      agenda: "1. Welcome and setup\n2. Main content section",
      type: "Effective Communication Workshop",
      date: "2099-10-31",
      endDate: "2099-10-31",
      time: "08:00",
      endTime: "09:00",
      location: "Loc",
      organizer: "Org",
      format: "In-person",
      roles: [
        {
          id: "r-host",
          name: "Zoom Host",
          description: "d",
          maxParticipants: 1,
        },
        {
          id: "r-ga",
          name: "Group A Participants",
          description: "group",
          maxParticipants: 3,
        },
      ],
      suppressNotifications: true,
    };

    const createRes = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${organizer.token}`)
      .send(createPayload);

    if (createRes.status !== 201) {
      // eslint-disable-next-line no-console
      console.error("Initial (suppressed) create failed", {
        status: createRes.status,
        body: createRes.body,
      });
    }
    expect(createRes.status).toBe(201);

    // Fetch the created event and find a participant-capable role to sign up
    const createdEvent = await Event.findOne({
      title: createPayload.title,
    }).lean();
    expect(createdEvent).toBeTruthy();
    const roleForSignup = (createdEvent as any).roles.find(
      (r: any) => r.name === "Group A Participants"
    );
    expect(roleForSignup?.id).toBeTruthy();

    // Sign up the participant to ensure update notifications have at least one recipient
    const signupRes = await request(app)
      .post(`/api/events/${(createdEvent as any)._id}/signup`)
      .set("Authorization", `Bearer ${participant.token}`)
      .send({ roleId: roleForSignup.id });
    expect(signupRes.status).toBe(200);

    // Reset counts before update assertions
    systemMsgSpy.mockClear();
    eventUpdatedEmailBulkSpy.mockClear();
    coOrganizerEmailSpy.mockClear();

    // First update with suppression: expect no system messages or update emails
    const suppressedUpdate = await request(app)
      .put(`/api/events/${(createdEvent as any)._id}`)
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({
        title: "Update Suppression Event v2",
        suppressNotifications: true,
      });
    expect(suppressedUpdate.status).toBe(200);
    expect(suppressedUpdate.body.success).toBe(true);

    expect(systemMsgSpy).toHaveBeenCalledTimes(0);
    expect(eventUpdatedEmailBulkSpy).toHaveBeenCalledTimes(0);
    expect(coOrganizerEmailSpy).toHaveBeenCalledTimes(0);

    // Second update without suppression: expect participant system message and at least one update email batch call
    const unsuppressedUpdate = await request(app)
      .put(`/api/events/${(createdEvent as any)._id}`)
      .set("Authorization", `Bearer ${organizer.token}`)
      .send({ description: "Edited description" });

    if (unsuppressedUpdate.status !== 200) {
      // eslint-disable-next-line no-console
      console.error("Unsuppressed update failed", {
        status: unsuppressedUpdate.status,
        body: unsuppressedUpdate.body,
      });
    }
    expect(unsuppressedUpdate.status).toBe(200);
    expect(unsuppressedUpdate.body.success).toBe(true);

    expect(systemMsgSpy).toHaveBeenCalledTimes(1);
    expect(eventUpdatedEmailBulkSpy.mock.calls.length).toBeGreaterThanOrEqual(
      1
    );
    expect(coOrganizerEmailSpy).toHaveBeenCalledTimes(0);
  });
});
