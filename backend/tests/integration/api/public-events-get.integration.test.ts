import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Event from "../../../src/models/Event";

/**
 * Integration tests for GET /api/public/events/:slug
 * Pattern aligns with other API integration tests:
 *  - Use auth flows to create events (ensures controller validations run)
 *  - Cleanup collections between tests
 */

describe("Public Events API - GET /api/public/events/:slug", () => {
  let adminToken: string;

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Event.deleteMany({})]);

    // Register & promote admin
    const adminData = {
      username: "publicadmin",
      email: "publicadmin@example.com",
      password: "AdminPass123!",
      confirmPassword: "AdminPass123!",
      firstName: "Public",
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
    const loginRes = await request(app).post("/api/auth/login").send({
      emailOrUsername: adminData.email,
      password: adminData.password,
    });
    adminToken = loginRes.body.data.accessToken;
  });

  it("returns 404 for missing slug", async () => {
    const res = await request(app).get("/api/public/events/non-existent");
    expect(res.status).toBe(404);
  });

  it("returns 404 for existing but unpublished event", async () => {
    // Create event (unpublished) directly via model (simpler) respecting required fields
    await Event.create({
      title: "Unpublished Event",
      type: "Webinar",
      date: "2025-10-10",
      endDate: "2025-10-10",
      time: "10:00",
      endTime: "11:00",
      location: "Online",
      format: "Online",
      organizer: "Org",
      createdBy: (await User.findOne({ email: "publicadmin@example.com" }))!
        ._id,
      roles: [
        {
          id: "r1",
          name: "Attendee",
          description: "Role",
          maxParticipants: 10,
          openToPublic: true,
        },
      ],
      publish: false,
      publicSlug: "unpub-test",
    });

    const res = await request(app).get("/api/public/events/unpub-test");
    expect(res.status).toBe(404);
  });

  it("returns sanitized public payload for published event", async () => {
    await Event.create({
      title: "  Public Event  ",
      type: "Webinar",
      date: "2025-10-11",
      endDate: "2025-10-11",
      time: "09:00",
      endTime: "10:30",
      location: "Online",
      format: "Online",
      organizer: "Org",
      createdBy: (await User.findOne({ email: "publicadmin@example.com" }))!
        ._id,
      purpose: " Purpose with extra   spaces ",
      agenda: " Agenda content ",
      roles: [
        {
          id: "r1",
          name: "Attendee",
          description: "Att role",
          maxParticipants: 25,
          openToPublic: true,
        },
        {
          id: "r2",
          name: "Internal",
          description: "Hidden role",
          maxParticipants: 5,
          openToPublic: false,
        },
      ],
      publish: true,
      publicSlug: "public-event",
    });

    const res = await request(app).get("/api/public/events/public-event");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.title).toBe("Public Event");
    expect(data.purpose).toBe("Purpose with extra spaces");
    expect(data.roles.length).toBe(1);
    expect(data.roles[0].roleId).toBe("r1");
    expect(data.roles[0].name).toBe("Attendee");
    expect(data.slug).toBe("public-event");
    expect(data.start).toContain("2025-10-11T09:00:00Z");
  });
});
