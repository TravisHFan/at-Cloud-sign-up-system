import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import mongoose from "mongoose";
import GuestRegistration from "../../../src/models/GuestRegistration";
import { createAndLoginTestUser } from "../../test-utils/createTestUser";

describe("Guest Migration API", () => {
  const testEmail = `mig_${Math.random().toString(36).slice(2, 8)}@example.com`;
  let adminToken: string;
  let eventId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    const admin = await createAndLoginTestUser({ role: "Administrator" });
    adminToken = admin.token;
    eventId = new mongoose.Types.ObjectId();

    // Seed a couple of pending guest registrations for the same email
    const docs = [
      {
        eventId,
        roleId: "r1",
        fullName: "Guest One",
        gender: "male" as const,
        email: testEmail,
        phone: "1234567890",
        status: "active" as const,
        registrationDate: new Date(),
        eventSnapshot: {
          title: "E1",
          date: new Date(),
          location: "L1",
          roleName: "Role1",
        },
      },
      {
        eventId,
        roleId: "r2",
        fullName: "Guest Two",
        gender: "female" as const,
        email: testEmail,
        phone: "0987654321",
        status: "active" as const,
        registrationDate: new Date(),
        eventSnapshot: {
          title: "E2",
          date: new Date(),
          location: "L2",
          roleName: "Role2",
        },
      },
    ];
    await GuestRegistration.insertMany(docs);
  });

  afterAll(async () => {
    await GuestRegistration.deleteMany({ email: testEmail });
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
