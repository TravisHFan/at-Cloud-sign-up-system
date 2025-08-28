import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import mongoose from "mongoose";
import GuestRegistration from "../../../src/models/GuestRegistration";
import Event from "../../../src/models/Event";
import { createAndLoginTestUser } from "../../test-utils/createTestUser";

describe("Guest Migration API", () => {
  const testEmail = `mig_${Math.random().toString(36).slice(2, 8)}@example.com`;
  let adminToken: string;
  let eventId1: mongoose.Types.ObjectId;
  let eventId2: mongoose.Types.ObjectId;
  let roleId1: string;
  let roleId2: string;

  beforeAll(async () => {
    const admin = await createAndLoginTestUser({ role: "Administrator" });
    adminToken = admin.token;
    // Create two separate events via API to ensure required fields (createdBy, organizer, purpose, valid type/date) are satisfied
    const createEvent = async (title: string, roleName: string) => {
      // Use a late afternoon window to minimize overlap with other tests
      const isFirst = /1$/.test(title);
      const time = isFirst ? "15:00" : "16:30";
      const endTime = isFirst ? "16:00" : "17:30";
      const res = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          // Title must be at least 3 characters per validation rules
          title,
          description: `${title} desc`,
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          time,
          endTime,
          // Location must be between 3 and 200 characters
          location: isFirst ? "Location 1" : "Location 2",
          type: "Effective Communication Workshop",
          format: "In-person",
          purpose: `${title} purpose`,
          agenda: "1. Intro\n2. Test\n3. Close",
          organizer: "Org",
          maxParticipants: 10,
          category: "general",
          // Use valid workshop roles from templates to satisfy server-side validation
          roles: [{ name: roleName, maxParticipants: 5, description: "Desc" }],
        })
        .expect(201);
      const ev = res.body.data.event;
      const id = ev.id || ev._id;
      const rId = (ev.roles || []).find((r: any) => r.name === roleName)?.id;
      expect(rId, `roleId should be present for ${title}`).toBeTruthy();
      return { id, roleId: rId } as { id: any; roleId: string };
    };

    // Use template-aligned role names for "Effective Communication Workshop"
    const a = await createEvent("Event 1", "Group A Participants");
    const b = await createEvent("Event 2", "Group B Participants");
    eventId1 = a.id as any;
    eventId2 = b.id as any;
    roleId1 = a.roleId;
    roleId2 = b.roleId;

    // Seed a couple of pending guest registrations for the same email across different events
    const docs = [
      {
        eventId: eventId1,
        roleId: roleId1,
        fullName: "Guest One",
        gender: "male" as const,
        email: testEmail,
        phone: "1234567890",
        status: "active" as const,
        registrationDate: new Date(),
        eventSnapshot: {
          title: "Event 1",
          date: new Date(),
          location: "L1",
          roleName: "Group A Participants",
        },
      },
      {
        eventId: eventId2,
        roleId: roleId2,
        fullName: "Guest Two",
        gender: "female" as const,
        email: testEmail,
        phone: "0987654321",
        status: "active" as const,
        registrationDate: new Date(),
        eventSnapshot: {
          title: "Event 2",
          date: new Date(),
          location: "L2",
          roleName: "Group B Participants",
        },
      },
    ];
    await GuestRegistration.insertMany(docs);
  });

  afterAll(async () => {
    await GuestRegistration.deleteMany({ email: testEmail });
    await Event.deleteMany({ _id: { $in: [eventId1, eventId2] } });
  });

  it("GET /api/guest-migration/eligible returns pending by email (admin)", async () => {
    const res = await request(app)
      .get(`/api/guest-migration/eligible`)
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ email: testEmail })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it("POST /api/guest-migration/validate confirms eligibility (admin)", async () => {
    // We can reuse the admin's user by fetching their profile
    const profile = await request(app)
      .get(`/api/auth/profile`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const userId = profile.body.data.user.id;

    const res = await request(app)
      .post(`/api/guest-migration/validate`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId, email: testEmail })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ok).toBe(true);
    expect(res.body.data.count).toBeGreaterThanOrEqual(2);
  });

  it("POST /api/guest-migration/perform completes migration and returns summary (admin)", async () => {
    const profile = await request(app)
      .get(`/api/auth/profile`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const userId = profile.body.data.user.id;

    const res = await request(app)
      .post(`/api/guest-migration/perform`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId, email: testEmail })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.modified).toBeGreaterThanOrEqual(2);
    expect(res.body.data.remainingPending).toBe(0);

    // Double-check in DB
    const migrated = await GuestRegistration.find({ email: testEmail });
    for (const g of migrated) {
      expect(g.migrationStatus).toBe("completed");
      expect(g.migratedToUserId).toBeDefined();
      expect(g.migrationDate).toBeInstanceOf(Date);
    }
  });
});
