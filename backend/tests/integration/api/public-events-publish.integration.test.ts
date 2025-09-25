import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Event from "../../../src/models/Event";

/**
 * Integration tests for publish / unpublish lifecycle endpoints
 */

describe("Public Events API - publish/unpublish lifecycle", () => {
  let adminToken: string;
  let eventId: string;

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Event.deleteMany({})]);

    const adminData = {
      username: "pubadmin",
      email: "pubadmin@example.com",
      password: "AdminPass123!",
      confirmPassword: "AdminPass123!",
      firstName: "Pub",
      lastName: "Admin",
      role: "Administrator",
      gender: "male",
      isAtCloudLeader: false,
      acceptTerms: true,
    } as const;
    await request(app).post("/api/auth/register").send(adminData);
    await User.findOneAndUpdate(
      { email: adminData.email },
      { isVerified: true, role: "Administrator" }
    );
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ emailOrUsername: adminData.email, password: adminData.password });
    adminToken = loginRes.body.data.accessToken;

    // Create base event via controller to ensure validations
    const createRes = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Lifecycle Event",
        type: "Webinar",
        date: "2025-11-10",
        endDate: "2025-11-10",
        time: "10:00",
        endTime: "11:00",
        location: "Online",
        format: "Online",
        organizer: "Org",
        roles: [
          { name: "Attendee", description: "Desc", maxParticipants: 10 },
          { name: "Internal", description: "Desc", maxParticipants: 5 },
        ],
        purpose: "Testing lifecycle",
      });
    expect(createRes.status).toBe(201);
    eventId = createRes.body.data.id;
  });

  it("rejects publish when no role is openToPublic", async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/publish`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send();
    expect(res.status).toBe(400);
  });

  it("publishes when at least one role openToPublic and generates slug once", async () => {
    // Make one role open to public directly (simpler than update route for test purpose)
    await Event.findByIdAndUpdate(eventId, { "roles.0.openToPublic": true });

    const first = await request(app)
      .post(`/api/events/${eventId}/publish`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send();
    expect(first.status).toBe(200);
    const slug = first.body?.data?.slug;
    expect(slug).toBeTruthy();

    // Calling publish again is idempotent and keeps same slug
    const second = await request(app)
      .post(`/api/events/${eventId}/publish`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send();
    expect(second.status).toBe(200);
    expect(second.body.data.slug).toBe(slug);

    // Public GET works
    const getRes = await request(app).get(`/api/public/events/${slug}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.title).toBe("Lifecycle Event");
  });

  it("unpublishes and public GET returns 404", async () => {
    await Event.findByIdAndUpdate(eventId, { "roles.0.openToPublic": true });
    const pub = await request(app)
      .post(`/api/events/${eventId}/publish`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send();
    const slug = pub.body.data.slug;
    const unpub = await request(app)
      .post(`/api/events/${eventId}/unpublish`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send();
    expect(unpub.status).toBe(200);
    const getRes = await request(app).get(`/api/public/events/${slug}`);
    expect(getRes.status).toBe(404);
  });
});
