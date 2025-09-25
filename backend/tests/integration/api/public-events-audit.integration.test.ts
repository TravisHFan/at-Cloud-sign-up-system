import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Event from "../../../src/models/Event";
import AuditLog from "../../../src/models/AuditLog";

/**
 * Verifies audit logs are created for publish/unpublish lifecycle.
 */

describe("Public Events API - audit logs", () => {
  let adminToken: string;
  let eventId: string;
  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Event.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
    const adminData = {
      username: "auditadmin",
      email: "auditadmin@example.com",
      password: "AdminPass123!",
      confirmPassword: "AdminPass123!",
      firstName: "Audit",
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
    const createRes = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Audit Event",
        type: "Webinar",
        date: "2025-12-01",
        endDate: "2025-12-01",
        time: "10:00",
        endTime: "11:00",
        location: "Online",
        format: "Online",
        organizer: "Org",
        roles: [
          {
            name: "Open",
            description: "Desc",
            maxParticipants: 10,
            openToPublic: true,
          },
        ],
        purpose: "Audit Purpose",
      });
    expect(createRes.status).toBe(201);
    eventId = createRes.body.data.id;
  });

  it("creates EventPublished and EventUnpublished audit logs", async () => {
    const pub = await request(app)
      .post(`/api/events/${eventId}/publish`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send();
    expect(pub.status).toBe(200);
    const publishedLogs = await AuditLog.find({
      eventId,
      action: "EventPublished",
    });
    expect(publishedLogs.length).toBe(1);
    const unpub = await request(app)
      .post(`/api/events/${eventId}/unpublish`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send();
    expect(unpub.status).toBe(200);
    const unpublishedLogs = await AuditLog.find({
      eventId,
      action: "EventUnpublished",
    });
    expect(unpublishedLogs.length).toBe(1);
  });
});
