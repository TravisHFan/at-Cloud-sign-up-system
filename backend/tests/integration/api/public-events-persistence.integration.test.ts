import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Event from "../../../src/models/Event";

/**
 * Ensures openToPublic on roles persists through create & update controller paths.
 * Also verifies that toggling openToPublic via update enables publish without direct model mutation.
 */

describe("Public Events API - openToPublic persistence", () => {
  let adminToken: string;
  let eventId: string;

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Event.deleteMany({})]);

    const adminData = {
      username: "persistadmin",
      email: "persistadmin@example.com",
      password: "AdminPass123!",
      confirmPassword: "AdminPass123!",
      firstName: "Persist",
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
  });

  it("persists openToPublic on create and update, enabling publish", async () => {
    // 1. Create event with one role explicitly openToPublic true and one false
    const createRes = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Persistence Event",
        type: "Webinar",
        date: "2025-09-30",
        endDate: "2025-09-30",
        time: "10:00",
        endTime: "11:00",
        location: "Online",
        format: "Online",
        organizer: "Org",
        roles: [
          {
            name: "Public Role",
            description: "Desc",
            maxParticipants: 10,
            openToPublic: true,
          },
          {
            name: "Hidden Role",
            description: "Desc",
            maxParticipants: 5,
            openToPublic: false,
          },
        ],
        purpose: "Testing persistence",
        suppressNotifications: true,
      });
    expect(createRes.status).toBe(201);
    const created = createRes.body?.data?.event;
    expect(created?.roles?.length).toBe(2);
    // Ensure controller response reflects openToPublic flags
    const publicRoleResp = created.roles.find(
      (r: any) => r.name === "Public Role"
    );
    const hiddenRoleResp = created.roles.find(
      (r: any) => r.name === "Hidden Role"
    );
    expect(publicRoleResp?.openToPublic).toBe(true);
    expect(hiddenRoleResp?.openToPublic).toBe(false);
    eventId = created.id || created._id;

    // 2. Fetch from DB to ensure persistence
    const persisted: any = await Event.findById(eventId).lean();
    const prDb = persisted.roles.find((r: any) => r.name === "Public Role");
    const hrDb = persisted.roles.find((r: any) => r.name === "Hidden Role");
    expect(prDb?.openToPublic).toBe(true);
    expect(hrDb?.openToPublic).toBe(false);

    // 3. Update: flip flags (public -> false, hidden -> true) via PUT route
    const updateRes = await request(app)
      .put(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        roles: [
          {
            id: prDb.id,
            name: "Public Role",
            description: "Desc",
            maxParticipants: 10,
            openToPublic: false,
          },
          {
            id: hrDb.id,
            name: "Hidden Role",
            description: "Desc",
            maxParticipants: 5,
            openToPublic: true,
          },
        ],
        suppressNotifications: true,
      });
    expect(updateRes.status).toBe(200);
    const updated = updateRes.body?.data?.event;
    const prUpdated = updated.roles.find((r: any) => r.name === "Public Role");
    const hrUpdated = updated.roles.find((r: any) => r.name === "Hidden Role");
    expect(prUpdated?.openToPublic).toBe(false);
    expect(hrUpdated?.openToPublic).toBe(true);

    // 4. Publish should now succeed because at least one role openToPublic (Hidden Role now)
    const publishRes = await request(app)
      .post(`/api/events/${eventId}/publish`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send();
    expect(publishRes.status).toBe(200);
    expect(publishRes.body?.data?.slug).toBeTruthy();
  });
});
