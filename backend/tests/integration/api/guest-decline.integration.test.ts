import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import mongoose from "mongoose";
import { Event } from "../../../src/models";
import { createGuestInvitationDeclineToken } from "../../../src/utils/guestInvitationDeclineToken";

// Helper to create a basic, schema-valid event (minimal required fields)
async function createEvent(overrides: Partial<Record<string, any>> = {}) {
  const dateStr = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const base = {
    title: "Guest Decline Test Event",
    type: "Effective Communication Workshop", // valid enum value
    date: dateStr,
    endDate: dateStr,
    location: "Test Location",
    time: "10:00",
    endTime: "11:00",
    // Use a valid IANA time zone (schema expects Area/Location style)
    timeZone: "Etc/UTC",
    format: "In-person",
    organizer: "Test Organizer",
    purpose: "Decline flow test",
    agenda: "Intro -> Content -> Close",
    createdBy: new mongoose.Types.ObjectId(),
    roles: [
      {
        id: new mongoose.Types.ObjectId().toString(),
        name: "Attendee",
        description: "General attendee",
        maxParticipants: 25,
        openToPublic: true,
      },
    ],
  };
  return Event.create({ ...base, ...overrides });
}

describe("Guest Invitation Decline Flow", () => {
  let event: any;
  let roleId: string;
  beforeAll(async () => {
    event = await createEvent();
    roleId = event.roles[0].id || event.roles[0]._id; // support both shapes just in case
  });

  it("returns info for a valid decline token then processes decline", async () => {
    // First, register a guest (invitation style) -> we simulate by hitting signup and then minting token
    const resSignup = await request(app)
      .post(`/api/events/${event._id.toString()}/guest-signup`)
      .send({
        roleId,
        fullName: "Guest User",
        gender: "male",
        email: "guest.decline@example.com",
      })
      .expect(201);

    const registrationId = resSignup.body?.data?.registrationId;
    expect(registrationId).toBeTruthy();

    const declineToken = createGuestInvitationDeclineToken({ registrationId });

    // GET info
    const info = await request(app)
      .get(`/api/guest/decline/${declineToken}`)
      .expect(200);
    expect(info.body.success).toBe(true);
    expect(info.body.data.roleName).toBe("Attendee");

    // POST decline with reason
    const post = await request(app)
      .post(`/api/guest/decline/${declineToken}`)
      .send({ reason: "Cannot attend" })
      .expect(200);
    expect(post.body.success).toBe(true);
    expect(post.body.data.declinedAt).toBeTruthy();

    // Re-play should fail (already declined)
    await request(app)
      .post(`/api/guest/decline/${declineToken}`)
      .send({ reason: "repeat" })
      .expect(409);
  });

  it("handles invalid token", async () => {
    await request(app).get("/api/guest/decline/invalidtoken").expect(400);
  });
});
