import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Event from "../../../src/models/Event";
import { ROLES } from "../../../src/utils/roleUtils";
import { ensureIntegrationDB } from "../setup/connect";

describe("EventConflictController - GET /api/events/check-conflict", () => {
  beforeEach(async () => {
    await ensureIntegrationDB();
    await User.deleteMany({});
    await Event.deleteMany({});
  });

  const createTestEvent = async (options: any = {}) => {
    const creator = await User.create({
      name: "Creator",
      username: `creator${Date.now()}`,
      email: `creator${Date.now()}@test.com`,
      password: "Password123",
      role: ROLES.PARTICIPANT,
      isActive: true,
      isVerified: true,
    });

    return await Event.create({
      title: options.title || "Test Event",
      type: "Conference",
      date: options.date || "2025-06-01",
      endDate: options.endDate || options.date || "2025-06-01",
      time: options.time || "10:00",
      endTime: options.endTime || "12:00",
      location: "Test Location",
      organizer: "Test Organizer",
      format: "In-person",
      timeZone: options.timeZone || "America/Los_Angeles",
      createdBy: creator._id,
      roles: [
        {
          id: "participant-role-1",
          name: "Participant",
          description: "Event participant",
          maxParticipants: 100,
          signups: [],
        },
      ],
      isPaid: false,
      published: true,
      status: options.status || "upcoming",
    });
  };

  // ========== Public Access ==========
  describe("Public Access", () => {
    it("should allow access without authentication", async () => {
      const response = await request(app).get(
        "/api/events/check-conflict?startDate=2025-06-01&startTime=10:00"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ========== Success Cases ==========
  describe("Success Cases", () => {
    it("should detect no conflict when no events exist", async () => {
      const response = await request(app).get(
        "/api/events/check-conflict?startDate=2025-06-01&startTime=10:00&endDate=2025-06-01&endTime=12:00"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.conflict).toBe(false);
      expect(response.body.data.conflicts).toEqual([]);
    });

    it("should detect conflict with overlapping event", async () => {
      await createTestEvent({
        title: "Existing Event",
        date: "2025-06-01",
        time: "10:00",
        endTime: "12:00",
      });

      const response = await request(app).get(
        "/api/events/check-conflict?startDate=2025-06-01&startTime=11:00&endDate=2025-06-01&endTime=13:00"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.conflict).toBe(true);
      expect(response.body.data.conflicts).toHaveLength(1);
      expect(response.body.data.conflicts[0].title).toBe("Existing Event");
    });

    it("should detect no conflict with non-overlapping events", async () => {
      await createTestEvent({
        date: "2025-06-01",
        time: "10:00",
        endTime: "12:00",
      });

      const response = await request(app).get(
        "/api/events/check-conflict?startDate=2025-06-01&startTime=13:00&endDate=2025-06-01&endTime=15:00"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.conflict).toBe(false);
      expect(response.body.data.conflicts).toEqual([]);
    });

    it("should exclude specific event by ID", async () => {
      const existingEvent = await createTestEvent({
        date: "2025-06-01",
        time: "10:00",
        endTime: "12:00",
      });

      const response = await request(app).get(
        `/api/events/check-conflict?startDate=2025-06-01&startTime=10:00&endDate=2025-06-01&endTime=12:00&excludeId=${existingEvent._id}`
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.conflict).toBe(false);
      expect(response.body.data.conflicts).toEqual([]);
    });

    it("should use end defaults when not provided", async () => {
      await createTestEvent({
        date: "2025-06-01",
        time: "10:00",
        endTime: "12:00",
      });

      // Only startDate and startTime provided
      const response = await request(app).get(
        "/api/events/check-conflict?startDate=2025-06-01&startTime=10:30"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Should still detect conflict (point-in-time check with +1 minute)
      expect(response.body.data.conflict).toBe(true);
    });

    it("should handle point mode correctly", async () => {
      await createTestEvent({
        date: "2025-06-01",
        time: "10:00",
        endTime: "12:00",
      });

      const response = await request(app).get(
        "/api/events/check-conflict?startDate=2025-06-01&startTime=10:30&mode=point"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.conflict).toBe(true);
    });

    it("should respect timezone differences", async () => {
      await createTestEvent({
        date: "2025-06-01",
        time: "10:00",
        endTime: "12:00",
        timeZone: "America/New_York",
      });

      // 10 AM Pacific = 1 PM Eastern (no conflict)
      const response = await request(app).get(
        "/api/events/check-conflict?startDate=2025-06-01&startTime=10:00&endDate=2025-06-01&endTime=12:00&timeZone=America/Los_Angeles"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.conflict).toBe(false);
    });

    it("should detect multiple conflicts", async () => {
      await createTestEvent({
        title: "Event 1",
        date: "2025-06-01",
        time: "10:00",
        endTime: "12:00",
      });

      await createTestEvent({
        title: "Event 2",
        date: "2025-06-01",
        time: "11:00",
        endTime: "13:00",
      });

      const response = await request(app).get(
        "/api/events/check-conflict?startDate=2025-06-01&startTime=11:30&endDate=2025-06-01&endTime=12:30"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.conflict).toBe(true);
      expect(response.body.data.conflicts).toHaveLength(2);
    });

    it("should ignore cancelled events", async () => {
      await createTestEvent({
        date: "2025-06-01",
        time: "10:00",
        endTime: "12:00",
        status: "cancelled",
      });

      const response = await request(app).get(
        "/api/events/check-conflict?startDate=2025-06-01&startTime=11:00&endDate=2025-06-01&endTime=13:00"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.conflict).toBe(false);
      expect(response.body.data.conflicts).toEqual([]);
    });

    it("should handle multi-day events", async () => {
      await createTestEvent({
        date: "2025-06-01",
        endDate: "2025-06-03",
        time: "10:00",
        endTime: "17:00",
      });

      const response = await request(app).get(
        "/api/events/check-conflict?startDate=2025-06-02&startTime=14:00&endDate=2025-06-02&endTime=16:00"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.conflict).toBe(true);
    });
  });

  // ========== Edge Cases ==========
  describe("Edge Cases", () => {
    it("should return 400 when startDate is missing", async () => {
      const response = await request(app).get(
        "/api/events/check-conflict?startTime=10:00"
      );

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "startDate and startTime are required"
      );
    });

    it("should return 400 when startTime is missing", async () => {
      const response = await request(app).get(
        "/api/events/check-conflict?startDate=2025-06-01"
      );

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "startDate and startTime are required"
      );
    });

    it("should handle invalid excludeId gracefully", async () => {
      await createTestEvent({
        date: "2025-06-01",
        time: "10:00",
        endTime: "12:00",
      });

      const response = await request(app).get(
        "/api/events/check-conflict?startDate=2025-06-01&startTime=11:00&endDate=2025-06-01&endTime=13:00&excludeId=invalid-id"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Invalid excludeId should be ignored, conflict still detected
      expect(response.body.data.conflict).toBe(true);
    });

    it("should handle same-day events (endDate defaults to date)", async () => {
      // Create event where endDate is same as date (single-day event)
      await createTestEvent({
        date: "2025-06-01",
        endDate: "2025-06-01",
        time: "10:00",
        endTime: "12:00",
      });

      const response = await request(app).get(
        "/api/events/check-conflict?startDate=2025-06-01&startTime=11:00&endDate=2025-06-01&endTime=13:00"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.conflict).toBe(true);
    });

    it("should handle events spanning midnight", async () => {
      await createTestEvent({
        date: "2025-06-01",
        time: "22:00",
        endDate: "2025-06-02",
        endTime: "02:00",
      });

      const response = await request(app).get(
        "/api/events/check-conflict?startDate=2025-06-01&startTime=23:00&endDate=2025-06-02&endTime=01:00"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.conflict).toBe(true);
    });
  });

  // ========== Response Format ==========
  describe("Response Format", () => {
    it("should have correct success response structure", async () => {
      const response = await request(app).get(
        "/api/events/check-conflict?startDate=2025-06-01&startTime=10:00"
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success");
      expect(response.body).toHaveProperty("data");
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("conflict");
      expect(response.body.data).toHaveProperty("conflicts");
      expect(typeof response.body.data.conflict).toBe("boolean");
      expect(Array.isArray(response.body.data.conflicts)).toBe(true);
    });

    it("should have correct error response structure", async () => {
      const response = await request(app).get(
        "/api/events/check-conflict?startTime=10:00"
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("success");
      expect(response.body).toHaveProperty("message");
      expect(response.body.success).toBe(false);
      expect(typeof response.body.message).toBe("string");
    });

    it("should include event id and title in conflicts", async () => {
      const event = await createTestEvent({
        title: "Conflicting Event",
        date: "2025-06-01",
        time: "10:00",
        endTime: "12:00",
      });

      const response = await request(app).get(
        "/api/events/check-conflict?startDate=2025-06-01&startTime=11:00&endDate=2025-06-01&endTime=13:00"
      );

      expect(response.status).toBe(200);
      expect(response.body.data.conflicts).toHaveLength(1);
      expect(response.body.data.conflicts[0]).toHaveProperty("id");
      expect(response.body.data.conflicts[0]).toHaveProperty("title");
      expect(response.body.data.conflicts[0].id).toBe(event._id.toString());
      expect(response.body.data.conflicts[0].title).toBe("Conflicting Event");
    });
  });
});
