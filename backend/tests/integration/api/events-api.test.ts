/**
 * Events API Integration Tests
 *
 * Tests the complete events management flow including:
 * - Event creation, reading, updating, deletion
 * - Event registration and management
 * - Role-based access control
 * - Event search and filtering
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Event from "../../../src/models/Event";

describe("Events API Integration Tests", () => {
  let authToken: string;
  let adminToken: string;
  let userId: string;
  let adminId: string;

  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});
    await Event.deleteMany({});

    // Create regular user
    const userData = {
      username: "eventuser",
      email: "event@example.com",
      password: "EventPass123!",
      firstName: "Event",
      lastName: "User",
      role: "user",
    };

    const userResponse = await request(app)
      .post("/api/auth/register")
      .send(userData);

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "event@example.com",
      password: "EventPass123!",
    });

    authToken = loginResponse.body.data.token;
    userId = userResponse.body.data.user.id;

    // Create admin user
    const adminData = {
      username: "admin",
      email: "admin@example.com",
      password: "AdminPass123!",
      firstName: "Admin",
      lastName: "User",
      role: "admin",
    };

    const adminResponse = await request(app)
      .post("/api/auth/register")
      .send(adminData);

    const adminLoginResponse = await request(app).post("/api/auth/login").send({
      email: "admin@example.com",
      password: "AdminPass123!",
    });

    adminToken = adminLoginResponse.body.data.token;
    adminId = adminResponse.body.data.user.id;
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Event.deleteMany({});
  });

  describe("POST /api/events", () => {
    const validEventData = {
      title: "Test Event",
      description: "A test event for integration testing",
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week from now
      location: "Test Location",
      maxParticipants: 50,
      category: "general",
      requiredRoles: [
        {
          roleName: "volunteer",
          count: 10,
          description: "General volunteers",
        },
      ],
    };

    it("should create event with admin token", async () => {
      const response = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(validEventData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining("created"),
        data: {
          event: {
            title: "Test Event",
            description: "A test event for integration testing",
            location: "Test Location",
            maxParticipants: 50,
            category: "general",
            createdBy: adminId,
          },
        },
      });

      // Verify event was created in database
      const createdEvent = await Event.findOne({ title: "Test Event" });
      expect(createdEvent).toBeTruthy();
      expect(createdEvent?.createdBy.toString()).toBe(adminId);
    });

    it("should reject event creation with user token", async () => {
      const response = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send(validEventData)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining("permission"),
      });
    });

    it("should reject event creation without authentication", async () => {
      const response = await request(app)
        .post("/api/events")
        .send(validEventData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining("token"),
      });
    });

    it("should validate required fields", async () => {
      const invalidEventData = {
        description: "Missing title and date",
      };

      const response = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(invalidEventData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });

    it("should validate date is in the future", async () => {
      const pastEventData = {
        ...validEventData,
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
      };

      const response = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(pastEventData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining("date"),
      });
    });

    it("should validate maxParticipants is positive", async () => {
      const invalidEventData = {
        ...validEventData,
        maxParticipants: -5,
      };

      const response = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(invalidEventData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });
  });

  describe("GET /api/events", () => {
    beforeEach(async () => {
      // Create test events
      const events = [
        {
          title: "Event 1",
          description: "First test event",
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          location: "Location 1",
          maxParticipants: 30,
          category: "general",
          createdBy: adminId,
        },
        {
          title: "Event 2",
          description: "Second test event",
          date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          location: "Location 2",
          maxParticipants: 50,
          category: "workshop",
          createdBy: adminId,
        },
      ];

      await Event.insertMany(events);
    });

    it("should get all events without authentication", async () => {
      const response = await request(app).get("/api/events").expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          events: expect.arrayContaining([
            expect.objectContaining({ title: "Event 1" }),
            expect.objectContaining({ title: "Event 2" }),
          ]),
        },
      });

      expect(response.body.data.events).toHaveLength(2);
    });

    it("should filter events by category", async () => {
      const response = await request(app)
        .get("/api/events?category=workshop")
        .expect(200);

      expect(response.body.data.events).toHaveLength(1);
      expect(response.body.data.events[0]).toMatchObject({
        title: "Event 2",
        category: "workshop",
      });
    });

    it("should paginate events", async () => {
      const response = await request(app)
        .get("/api/events?page=1&limit=1")
        .expect(200);

      expect(response.body.data.events).toHaveLength(1);
      expect(response.body.data).toMatchObject({
        pagination: {
          currentPage: 1,
          totalPages: expect.any(Number),
          totalItems: 2,
          itemsPerPage: 1,
        },
      });
    });

    it("should sort events by date", async () => {
      const response = await request(app)
        .get("/api/events?sortBy=date&sortOrder=asc")
        .expect(200);

      const events = response.body.data.events;
      expect(new Date(events[0].date).getTime()).toBeLessThan(
        new Date(events[1].date).getTime()
      );
    });
  });

  describe("GET /api/events/:id", () => {
    let eventId: string;

    beforeEach(async () => {
      const event = await Event.create({
        title: "Detailed Event",
        description: "Event for detail testing",
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        location: "Detail Location",
        maxParticipants: 40,
        category: "general",
        createdBy: adminId,
      });

      eventId = (event as any)._id.toString();
    });

    it("should get event details by ID", async () => {
      const response = await request(app)
        .get(`/api/events/${eventId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          event: {
            title: "Detailed Event",
            description: "Event for detail testing",
            location: "Detail Location",
            maxParticipants: 40,
            category: "general",
          },
        },
      });
    });

    it("should return 404 for non-existent event", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .get(`/api/events/${fakeId}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining("not found"),
      });
    });

    it("should return 400 for invalid event ID", async () => {
      const response = await request(app)
        .get("/api/events/invalid-id")
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining("Invalid"),
      });
    });
  });

  describe("PUT /api/events/:id", () => {
    let eventId: string;

    beforeEach(async () => {
      const event = await Event.create({
        title: "Update Event",
        description: "Event for update testing",
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        location: "Update Location",
        maxParticipants: 35,
        category: "general",
        createdBy: adminId,
      });

      eventId = (event as any)._id.toString();
    });

    it("should update event with admin token", async () => {
      const updateData = {
        title: "Updated Event Title",
        description: "Updated description",
        maxParticipants: 60,
      };

      const response = await request(app)
        .put(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining("updated"),
        data: {
          event: {
            title: "Updated Event Title",
            description: "Updated description",
            maxParticipants: 60,
          },
        },
      });
    });

    it("should reject update with user token", async () => {
      const updateData = {
        title: "Unauthorized Update",
      };

      const response = await request(app)
        .put(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining("permission"),
      });
    });

    it("should validate update data", async () => {
      const invalidUpdateData = {
        maxParticipants: "invalid",
      };

      const response = await request(app)
        .put(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(invalidUpdateData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });
  });

  describe("DELETE /api/events/:id", () => {
    let eventId: string;

    beforeEach(async () => {
      const event = await Event.create({
        title: "Delete Event",
        description: "Event for delete testing",
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        location: "Delete Location",
        maxParticipants: 25,
        category: "general",
        createdBy: adminId,
      });

      eventId = (event as any)._id.toString();
    });

    it("should delete event with admin token", async () => {
      const response = await request(app)
        .delete(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining("deleted"),
      });

      // Verify event was deleted from database
      const deletedEvent = await Event.findById(eventId);
      expect(deletedEvent).toBeNull();
    });

    it("should reject delete with user token", async () => {
      const response = await request(app)
        .delete(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining("permission"),
      });
    });

    it("should return 404 for non-existent event", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .delete(`/api/events/${fakeId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining("not found"),
      });
    });
  });

  describe("POST /api/events/:id/register", () => {
    let eventId: string;

    beforeEach(async () => {
      const event = await Event.create({
        title: "Registration Event",
        description: "Event for registration testing",
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        location: "Registration Location",
        maxParticipants: 20,
        category: "general",
        createdBy: adminId,
        requiredRoles: [
          {
            roleName: "volunteer",
            count: 5,
            description: "General volunteers",
          },
          {
            roleName: "coordinator",
            count: 2,
            description: "Event coordinators",
          },
        ],
      });

      eventId = (event as any)._id.toString();
    });

    it("should register user for event", async () => {
      const registrationData = {
        role: "volunteer",
        additionalInfo: "Excited to help!",
      };

      const response = await request(app)
        .post(`/api/events/${eventId}/register`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(registrationData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining("registered"),
        data: {
          registration: {
            eventId: eventId,
            userId: userId,
            role: "volunteer",
            additionalInfo: "Excited to help!",
          },
        },
      });
    });

    it("should prevent duplicate registration", async () => {
      // First registration
      const registrationData = {
        role: "volunteer",
      };

      await request(app)
        .post(`/api/events/${eventId}/register`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(registrationData)
        .expect(201);

      // Second registration should fail
      const response = await request(app)
        .post(`/api/events/${eventId}/register`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(registrationData)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining("already registered"),
      });
    });

    it("should validate role availability", async () => {
      const registrationData = {
        role: "invalid-role",
      };

      const response = await request(app)
        .post(`/api/events/${eventId}/register`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(registrationData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining("role"),
      });
    });

    it("should require authentication for registration", async () => {
      const registrationData = {
        role: "volunteer",
      };

      const response = await request(app)
        .post(`/api/events/${eventId}/register`)
        .send(registrationData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining("token"),
      });
    });
  });

  describe("Event Search and Filtering", () => {
    beforeEach(async () => {
      // Create diverse events for search testing
      const events = [
        {
          title: "JavaScript Workshop",
          description: "Learn modern JavaScript features",
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          location: "Tech Center",
          maxParticipants: 30,
          category: "workshop",
          createdBy: adminId,
        },
        {
          title: "Community Cleanup",
          description: "Help clean our neighborhood",
          date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          location: "Community Park",
          maxParticipants: 50,
          category: "volunteer",
          createdBy: adminId,
        },
        {
          title: "React Conference",
          description: "Annual React developer conference",
          date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
          location: "Convention Center",
          maxParticipants: 200,
          category: "conference",
          createdBy: adminId,
        },
      ];

      await Event.insertMany(events);
    });

    it("should search events by title", async () => {
      const response = await request(app)
        .get("/api/events?search=JavaScript")
        .expect(200);

      expect(response.body.data.events).toHaveLength(1);
      expect(response.body.data.events[0]).toMatchObject({
        title: "JavaScript Workshop",
      });
    });

    it("should search events by description", async () => {
      const response = await request(app)
        .get("/api/events?search=React")
        .expect(200);

      expect(response.body.data.events).toHaveLength(1);
      expect(response.body.data.events[0]).toMatchObject({
        title: "React Conference",
      });
    });

    it("should filter by multiple categories", async () => {
      const response = await request(app)
        .get("/api/events?category=workshop,conference")
        .expect(200);

      expect(response.body.data.events).toHaveLength(2);
      const titles = response.body.data.events.map((e: any) => e.title);
      expect(titles).toContain("JavaScript Workshop");
      expect(titles).toContain("React Conference");
    });

    it("should filter by date range", async () => {
      const startDate = new Date(
        Date.now() + 6 * 24 * 60 * 60 * 1000
      ).toISOString();
      const endDate = new Date(
        Date.now() + 15 * 24 * 60 * 60 * 1000
      ).toISOString();

      const response = await request(app)
        .get(`/api/events?startDate=${startDate}&endDate=${endDate}`)
        .expect(200);

      expect(response.body.data.events).toHaveLength(2);
      const titles = response.body.data.events.map((e: any) => e.title);
      expect(titles).toContain("JavaScript Workshop");
      expect(titles).toContain("Community Cleanup");
    });

    it("should filter by participant capacity", async () => {
      const response = await request(app)
        .get("/api/events?minParticipants=100")
        .expect(200);

      expect(response.body.data.events).toHaveLength(1);
      expect(response.body.data.events[0]).toMatchObject({
        title: "React Conference",
        maxParticipants: 200,
      });
    });
  });
});
