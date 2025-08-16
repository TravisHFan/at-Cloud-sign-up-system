import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../../../src/app";
import Event from "../../../src/models/Event";
import User from "../../../src/models/User";

describe("Event virtual meeting fields", () => {
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    // Register and promote an admin user
    const reg = await request(app).post("/api/auth/register").send({
      firstName: "Admin",
      lastName: "User",
      email: "virtual.admin@example.com",
      username: "virtualadmin",
      password: "AdminPass123!",
      confirmPassword: "AdminPass123!",
      gender: "male",
      isAtCloudLeader: false,
      acceptTerms: true,
    });
    adminId = reg.body.data.user.id;
    await User.findByIdAndUpdate(adminId, {
      isVerified: true,
      role: "Administrator",
    });
    const login = await request(app).post("/api/auth/login").send({
      emailOrUsername: "virtual.admin@example.com",
      password: "AdminPass123!",
    });
    adminToken = login.body.data.accessToken;
  });

  afterAll(async () => {
    await User.deleteOne({ _id: adminId });
  });

  it("allows adding zoom fields later for Online events created empty", async () => {
    const createRes = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Online Event",
        description: "Test",
        date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        time: "10:00",
        endTime: "11:00",
        type: "Conference",
        format: "Online",
        agenda: "Intro, main content, discussion, Q&A, and closing remarks.",
        organizer: "Org",
        purpose: "Event purpose for testing",
        roles: [
          {
            id: "r1",
            name: "Common Participant (Zoom)",
            maxParticipants: 5,
            description: "General attendee",
          },
        ],
        zoomLink: "",
        meetingId: "",
        passcode: "",
      })
      .expect(201);

    const id = createRes.body.data.event.id;
    const updateRes = await request(app)
      .put(`/api/events/${id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        zoomLink: "https://zoom.us/j/123456789",
        meetingId: "123 456 789",
        passcode: "secret",
      })
      .expect(200);

    expect(updateRes.body.data.event.zoomLink).toBe(
      "https://zoom.us/j/123456789"
    );
    expect(updateRes.body.data.event.meetingId).toBe("123 456 789");
    expect(updateRes.body.data.event.passcode).toBe("secret");

    const fromDb = (await Event.findById(id).lean()) as any;
    expect(fromDb?.zoomLink).toBe("https://zoom.us/j/123456789");
    expect(fromDb?.meetingId).toBe("123 456 789");
    expect(fromDb?.passcode).toBe("secret");
  });

  it("allows adding zoom fields later for Hybrid events created empty", async () => {
    const createRes = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Hybrid Event",
        description: "Test",
        date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        time: "12:00",
        endTime: "13:00",
        type: "Conference",
        format: "Hybrid Participation",
        location: "Headquarters",
        agenda: "Intro, main content, discussion, Q&A, and closing remarks.",
        organizer: "Org",
        purpose: "Event purpose for testing",
        roles: [
          {
            id: "r1",
            name: "Common Participant (Zoom)",
            maxParticipants: 5,
            description: "General attendee",
          },
        ],
        zoomLink: "",
        meetingId: "",
        passcode: "",
      })
      .expect(201);

    const id = createRes.body.data.event.id;
    const updateRes = await request(app)
      .put(`/api/events/${id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        zoomLink: "https://zoom.us/j/987654321",
        meetingId: "987 654 321",
        passcode: "hybrid",
      })
      .expect(200);

    expect(updateRes.body.data.event.zoomLink).toBe(
      "https://zoom.us/j/987654321"
    );
    expect(updateRes.body.data.event.meetingId).toBe("987 654 321");
    expect(updateRes.body.data.event.passcode).toBe("hybrid");

    const fromDb = (await Event.findById(id).lean()) as any;
    expect(fromDb?.zoomLink).toBe("https://zoom.us/j/987654321");
    expect(fromDb?.meetingId).toBe("987 654 321");
    expect(fromDb?.passcode).toBe("hybrid");
  });

  it("clears virtual fields when switching to In-person", async () => {
    const createRes = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Switch Event",
        description: "Test",
        date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        time: "15:00",
        endTime: "16:00",
        type: "Conference",
        format: "Online",
        agenda: "Intro, main content, discussion, Q&A, and closing remarks.",
        organizer: "Org",
        purpose: "Event purpose for testing",
        roles: [
          {
            id: "r1",
            name: "Common Participant (Zoom)",
            maxParticipants: 5,
            description: "General attendee",
          },
        ],
        zoomLink: "https://zoom.us/j/abc",
        meetingId: "m",
        passcode: "p",
      })
      .expect(201);

    const id = createRes.body.data.event.id;
    const updateRes = await request(app)
      .put(`/api/events/${id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        format: "In-person",
        location: "Hall",
      })
      .expect(200);

    expect(updateRes.body.data.event.zoomLink).toBeUndefined();
    expect(updateRes.body.data.event.meetingId).toBeUndefined();
    expect(updateRes.body.data.event.passcode).toBeUndefined();

    const fromDb = (await Event.findById(id).lean()) as any;
    expect(fromDb?.zoomLink).toBeUndefined();
    expect(fromDb?.meetingId).toBeUndefined();
    expect(fromDb?.passcode).toBeUndefined();
  });
});
