import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Event from "../../../src/models/Event";
import GuestRegistration from "../../../src/models/GuestRegistration";
import { createPublishedEvent } from "../../test-utils/eventTestHelpers";
import mongoose from "mongoose";
import { ensureIntegrationDB } from "../setup/connect";

// Integration tests for guest (email-only) 1-role limit in public event registration
// NEW POLICY (2025-10-10): Unauthenticated guests limited to 1 role per event

describe("Public event guest 1-role limit", () => {
  let eventId: string;
  let eventSlug: string;
  const roleIds: string[] = [];
  const guestEmail = "guest_single_role@example.com";

  beforeAll(async () => {
    await ensureIntegrationDB();
    console.log("[guest-1-role] Clearing collections...");
    await User.deleteMany({});
    await Event.deleteMany({});
    await GuestRegistration.deleteMany({});

    console.log(
      "[guest-1-role] Creating published event with multiple public roles..."
    );

    const event = await createPublishedEvent({
      title: "Guest 1-Role Limit Event",
      roles: [
        {
          name: "Public Role 1",
          description: "Public role 1 description",
          maxParticipants: 10,
          openToPublic: true,
        },
        {
          name: "Public Role 2",
          description: "Public role 2 description",
          maxParticipants: 10,
          openToPublic: true,
        },
        {
          name: "Public Role 3",
          description: "Public role 3 description",
          maxParticipants: 10,
          openToPublic: true,
        },
      ],
    });

    eventId = event.id;
    eventSlug = event.publicSlug;
    event.roles.forEach((r: any) => roleIds.push(r.id));
    console.log(`[guest-1-role] Event published with slug: ${eventSlug}`);
  }, 30000);

  afterAll(async () => {
    await User.deleteMany({});
    await Event.deleteMany({});
    await GuestRegistration.deleteMany({});
    await mongoose.connection.close();
  });

  it("allows guest (email-only) to register for 1 role, blocks 2nd role", async () => {
    // First registration should succeed
    const res1 = await request(app)
      .post(`/api/public/events/${eventSlug}/register`)
      .send({
        roleId: roleIds[0],
        attendee: {
          name: "Guest Single Role",
          email: guestEmail,
          phone: "1234567890",
        },
        consent: {
          termsAccepted: true,
        },
      })
      .expect(200);

    expect(res1.body.data.status).toBe("ok");
    expect(res1.body.data.type).toBe("guest");

    // Second role registration should be rejected
    const res2 = await request(app)
      .post(`/api/public/events/${eventSlug}/register`)
      .send({
        roleId: roleIds[1],
        attendee: {
          name: "Guest Single Role",
          email: guestEmail,
          phone: "1234567890",
        },
        consent: {
          termsAccepted: true,
        },
      })
      .expect(400);

    expect(res2.body.success).toBe(false);
    expect(res2.body.message).toMatch(/1-role limit/i);
  });

  it("duplicate registration for same role is idempotent (allowed)", async () => {
    // Try to register for the same role again (should be idempotent)
    const resDupe = await request(app)
      .post(`/api/public/events/${eventSlug}/register`)
      .send({
        roleId: roleIds[0],
        attendee: {
          name: "Guest Single Role",
          email: guestEmail,
          phone: "1234567890",
        },
        consent: {
          termsAccepted: true,
        },
      })
      .expect(200);

    expect(resDupe.body.data.status).toBe("ok");
    expect(resDupe.body.data.duplicate).toBe(true);
  });

  it("different guest email can register for same role", async () => {
    const differentGuestEmail = "different_guest@example.com";

    const res = await request(app)
      .post(`/api/public/events/${eventSlug}/register`)
      .send({
        roleId: roleIds[0],
        attendee: {
          name: "Different Guest",
          email: differentGuestEmail,
          phone: "0987654321",
        },
        consent: {
          termsAccepted: true,
        },
      })
      .expect(200);

    expect(res.body.data.status).toBe("ok");
    expect(res.body.data.type).toBe("guest");
    expect(res.body.data.duplicate).toBe(false);
  });
});
