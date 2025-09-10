/**
 * Mentor Circle – Attendee eligibility (Participant)
 *
 * Ensures a Participant user can sign up for the "Attendee" role
 * on Mentor Circle events (parity with Webinar behavior).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Event from "../../../src/models/Event";
import Registration from "../../../src/models/Registration";

// NOTE: Feature reverted — Mentor Circle no longer has a universal Attendee role.
// Disabling this test to reflect the current product behavior.
describe.skip("Mentor Circle – Attendee eligibility (Participant)", () => {
  let userToken: string;
  let userId: string;
  let eventId: string;

  beforeAll(async () => {
    await User.deleteMany({});
    await Event.deleteMany({});
    await Registration.deleteMany({});

    // Register & verify Participant user
    const userRes = await request(app).post("/api/auth/register").send({
      username: "mc_attendee_user",
      email: "mc_attendee_user@example.com",
      password: "StrongPass123!",
      confirmPassword: "StrongPass123!",
      firstName: "MC",
      lastName: "User",
      role: "Participant",
      gender: "female",
      isAtCloudLeader: false,
      acceptTerms: true,
    });
    userId = userRes.body.data.user.id;
    await User.findByIdAndUpdate(userId, { isVerified: true });

    const loginRes = await request(app).post("/api/auth/login").send({
      emailOrUsername: "mc_attendee_user@example.com",
      password: "StrongPass123!",
    });
    userToken = loginRes.body.data.accessToken;

    // Create Mentor Circle event with Attendee role at top (default 25)
    const event = await Event.create({
      title: "Mentor Circle – Attendee Parity",
      description: "Ensure Participant can sign up as Attendee",
      date: new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      time: "10:00",
      endTime: "11:00",
      location: "HQ",
      type: "Mentor Circle",
      format: "In-person",
      purpose: "Parity test",
      organizer: "QA",
      createdBy: userId,
      roles: [
        {
          id: "role-attendee",
          name: "Attendee",
          maxParticipants: 25,
          description: "No special role",
        },
        {
          id: "role-mentor",
          name: "Mentor",
          maxParticipants: 5,
          description: "Mentor role",
        },
      ],
      status: "upcoming",
    } as any);
    eventId = (event as any)._id.toString();
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Event.deleteMany({});
    await Registration.deleteMany({});
  });

  it("allows Participant to sign up for Mentor Circle Attendee", async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/signup`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        roleId: "role-attendee",
      })
      .expect(200);

    expect(res.body?.success).toBe(true);

    // Fetch event to assert registration is recorded under Attendee
    const eventRes = await request(app)
      .get(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);

    const roles = eventRes.body?.data?.event?.roles || [];
    const attendeeRole = roles.find((r: any) => r.id === "role-attendee");
    expect(attendeeRole).toBeTruthy();
    expect(attendeeRole.registrations?.length).toBe(1);
  });
});
