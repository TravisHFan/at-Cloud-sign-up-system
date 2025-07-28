/**
 * Simple Email Notification API Test
 * Tests route registration and basic functionality
 */

import request from "supertest";
import { describe, it, expect } from "vitest";
import { app } from "../../src/index";

describe("Email Notification API - Route Registration", () => {
  it("should return 401 for unauthenticated request to event-created endpoint", async () => {
    const response = await request(app)
      .post("/api/v1/email-notifications/event-created")
      .send({
        eventId: "507f1f77bcf86cd799439011", // Valid ObjectId format
      });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("success", false);
  });

  it("should return 401 for unauthenticated request to system-authorization-change endpoint", async () => {
    const response = await request(app)
      .post("/api/v1/email-notifications/system-authorization-change")
      .send({
        userId: "507f1f77bcf86cd799439011",
        changeType: "account_activated",
        details: "Test details",
      });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("success", false);
  });

  it("should return 401 for unauthenticated request to atcloud-role-change endpoint", async () => {
    const response = await request(app)
      .post("/api/v1/email-notifications/atcloud-role-change")
      .send({
        userId: "507f1f77bcf86cd799439011",
        oldRole: "member",
        newRole: "organizer",
        details: "Test role change",
      });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("success", false);
  });

  it("should return 401 for unauthenticated request to new-leader-signup endpoint", async () => {
    const response = await request(app)
      .post("/api/v1/email-notifications/new-leader-signup")
      .send({
        userId: "507f1f77bcf86cd799439011",
        leadershipDetails: "Test leadership details",
      });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("success", false);
  });

  it("should return 401 for unauthenticated request to co-organizer-assigned endpoint", async () => {
    const response = await request(app)
      .post("/api/v1/email-notifications/co-organizer-assigned")
      .send({
        eventId: "507f1f77bcf86cd799439011",
        coOrganizerId: "507f1f77bcf86cd799439011",
      });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("success", false);
  });

  it("should return 401 for unauthenticated request to event-reminder endpoint", async () => {
    const response = await request(app)
      .post("/api/v1/email-notifications/event-reminder")
      .send({
        eventId: "507f1f77bcf86cd799439011",
        reminderType: "24h",
      });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("success", false);
  });
});
