import request from "supertest";
import { describe, it, beforeEach, expect } from "vitest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Event from "../../../src/models/Event";

/**
 * Regression tests for openToPublic role flag update behavior.
 * - Preserves existing flag when omitted
 * - Allows toggling flag from false -> true via update
 */

describe("Public Events API - openToPublic role update behavior", () => {
  let adminToken: string;
  let eventId: string;
  let roleId: string;

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Event.deleteMany({})]);

    const adminData = {
      username: "roleupdateadmin",
      email: "roleupdateadmin@example.com",
      password: "AdminPass123!",
      confirmPassword: "AdminPass123!",
      firstName: "RoleUpdate",
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

    // Create event with role initially NOT open to public to avoid any creation-time validation edge cases.
    const createRes = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Flag Update Event",
        type: "Webinar",
        date: "2025-10-05",
        endDate: "2025-10-05",
        time: "10:00",
        endTime: "11:00",
        location: "Online",
        format: "Online",
        organizer: "Org",
        roles: [
          {
            name: "Participant",
            description: "Desc",
            maxParticipants: 5,
            // openToPublic intentionally omitted / false by default
          },
        ],
        purpose: "Test",
        suppressNotifications: true,
      });
    expect(createRes.status).toBe(201);
    let ev = createRes.body.data.event;
    eventId = ev.id || ev._id;
    roleId = ev.roles[0].id;
    expect(ev.roles[0].openToPublic).toBe(false);

    // Immediately update to set openToPublic true so each test starts from true baseline
    const primeRes = await request(app)
      .put(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        roles: [
          {
            id: roleId,
            name: "Participant",
            description: "Desc",
            maxParticipants: 5,
            openToPublic: true,
          },
        ],
        suppressNotifications: true,
      });
    expect(primeRes.status).toBe(200);
    ev = primeRes.body.data.event;
    expect(ev.roles[0].openToPublic).toBe(true);
  });

  it("preserves openToPublic when omitted from update payload", async () => {
    const updateRes = await request(app)
      .put(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        roles: [
          {
            id: roleId,
            name: "Participant",
            description: "Desc",
            maxParticipants: 5,
          }, // omit openToPublic
        ],
        suppressNotifications: true,
      });
    expect(updateRes.status).toBe(200);
    const updatedRole = updateRes.body.data.event.roles.find(
      (r: any) => r.id === roleId
    );
    expect(updatedRole.openToPublic).toBe(true); // should remain true
  });

  it("can toggle openToPublic false -> true via update", async () => {
    // First set it false explicitly
    let toggleRes = await request(app)
      .put(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        roles: [
          {
            id: roleId,
            name: "Participant",
            description: "Desc",
            maxParticipants: 5,
            openToPublic: false,
          },
        ],
        suppressNotifications: true,
      });
    expect(toggleRes.status).toBe(200);
    let toggledRole = toggleRes.body.data.event.roles[0];
    expect(toggledRole.openToPublic).toBe(false);

    // Now omit flag -> should stay false
    toggleRes = await request(app)
      .put(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        roles: [
          {
            id: roleId,
            name: "Participant",
            description: "Desc",
            maxParticipants: 5,
          },
        ],
        suppressNotifications: true,
      });
    expect(toggleRes.status).toBe(200);
    toggledRole = toggleRes.body.data.event.roles[0];
    expect(toggledRole.openToPublic).toBe(false);

    // Finally set true explicitly
    toggleRes = await request(app)
      .put(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        roles: [
          {
            id: roleId,
            name: "Participant",
            description: "Desc",
            maxParticipants: 5,
            openToPublic: true,
          },
        ],
        suppressNotifications: true,
      });
    expect(toggleRes.status).toBe(200);
    toggledRole = toggleRes.body.data.event.roles[0];
    expect(toggledRole.openToPublic).toBe(true);
  });
});
