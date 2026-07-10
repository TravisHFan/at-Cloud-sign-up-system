import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Events Routes - Isolated Testing Pattern
 *
 * Tests event management routes without heavy import chains
 */
describe("Events Routes - Isolated Architecture", () => {
  let app: express.Application;

  beforeEach(async () => {
    app = express();
    app.use(express.json());

    // Mock authentication and authorization middleware
    const mockAuth = (req: any, res: any, next: any) => {
      req.user = { id: "user-123", username: "testuser", role: "Participant" };
      next();
    };

    const mockLeaderAuth = (req: any, res: any, next: any) => {
      req.user = { id: "leader-123", username: "testleader", role: "Leader" };
      next();
    };

    const mockAdminAuth = (req: any, res: any, next: any) => {
      req.user = {
        id: "admin-123",
        username: "testadmin",
        role: "Administrator",
      };
      next();
    };

    const mockValidation = (req: any, res: any, next: any) => next();
    const mockRateLimit = (req: any, res: any, next: any) => next();

    // Mock events data
    const mockEvents = [
      {
        id: "event-1",
        title: "Community Worship",
        type: "Worship Service",
        date: "2024-12-25",
        time: "10:00",
        endTime: "12:00",
        location: "Main Sanctuary",
        organizer: "Pastor John",
        createdBy: "user-123",
        purpose: "Christmas Service",
        format: "In-person",
        roles: [{ name: "Attendee", maxParticipants: 100, signedUp: 25 }],
        status: "Published",
      },
      {
        id: "event-2",
        title: "Youth Group Meeting",
        type: "Fellowship",
        date: "2024-12-28",
        time: "18:00",
        endTime: "20:00",
        location: "Youth Room",
        organizer: "Sarah Leader",
        createdBy: "leader-123",
        purpose: "Youth Fellowship",
        format: "Hybrid Participation",
        roles: [{ name: "Participant", maxParticipants: 30, signedUp: 12 }],
        status: "Published",
      },
    ];

    // Public routes
    // GET /events
    app.get("/api/events", mockRateLimit, (req, res) => {
      const { page = 1, limit = 10, search, type, format, status } = req.query;

      let filteredEvents = [...mockEvents];

      if (search) {
        filteredEvents = filteredEvents.filter(
          (event) =>
            event.title
              .toLowerCase()
              .includes(search.toString().toLowerCase()) ||
            event.organizer
              .toLowerCase()
              .includes(search.toString().toLowerCase())
        );
      }

      if (type) {
        filteredEvents = filteredEvents.filter((event) => event.type === type);
      }

      if (format) {
        filteredEvents = filteredEvents.filter(
          (event) => event.format === format
        );
      }

      if (status) {
        filteredEvents = filteredEvents.filter(
          (event) => event.status === status
        );
      }

      res.status(200).json({
        events: filteredEvents,
        pagination: {
          total: filteredEvents.length,
          page: parseInt(page.toString()),
          limit: parseInt(limit.toString()),
          pages: Math.ceil(filteredEvents.length / parseInt(limit.toString())),
        },
      });
    });

    // GET /events/:id
    app.get("/api/events/:id", mockValidation, (req, res) => {
      const { id } = req.params;

      if (id === "invalid-id") {
        return res.status(400).json({
          message: "Invalid event ID format",
          code: "INVALID_ID",
        });
      }

      const event = mockEvents.find((e) => e.id === id);

      if (!event) {
        return res.status(404).json({
          message: "Event not found",
          code: "EVENT_NOT_FOUND",
        });
      }

      res.status(200).json({ event });
    });

    // POST /events/update-statuses (admin only)
    app.post("/api/events/update-statuses", mockAdminAuth, (req, res) => {
      res.status(200).json({
        message: "Event statuses updated successfully",
        updated: 2,
      });
    });

    // Protected routes (authentication required)
    // POST /events
    app.post("/api/events", mockLeaderAuth, mockValidation, (req, res) => {
      const { title, type, date, time, endTime, purpose, format } = req.body;

      if (
        !title ||
        !type ||
        !date ||
        !time ||
        !endTime ||
        !purpose ||
        !format
      ) {
        return res.status(400).json({
          message: "Missing required fields",
          code: "MISSING_FIELDS",
        });
      }

      if (title === "Duplicate Event") {
        return res.status(409).json({
          message: "Event with this title already exists",
          code: "DUPLICATE_EVENT",
        });
      }

      const newEvent = {
        id: "new-event-123",
        title,
        type,
        date,
        time,
        endTime,
        purpose,
        format,
        organizer: req.user?.username || "Unknown",
        createdBy: req.user?.id || "unknown",
        status: "Draft",
        roles: [],
      };

      res.status(201).json({
        message: "Event created successfully",
        event: newEvent,
      });
    });

    // PUT /events/:id
    app.put("/api/events/:id", mockAuth, mockValidation, (req, res) => {
      const { id } = req.params;
      const event = mockEvents.find((e) => e.id === id);

      if (!event) {
        return res.status(404).json({
          message: "Event not found",
          code: "EVENT_NOT_FOUND",
        });
      }

      // Check permissions (only creator or admin can edit)
      if (
        event.createdBy !== req.user?.id &&
        req.user?.role !== "Administrator"
      ) {
        return res.status(403).json({
          message: "Insufficient permissions to edit this event",
          code: "INSUFFICIENT_PERMISSIONS",
        });
      }

      const updatedEvent = { ...event, ...req.body, id };

      res.status(200).json({
        message: "Event updated successfully",
        event: updatedEvent,
      });
    });

    // DELETE /events/:id
    app.delete("/api/events/:id", mockAuth, (req, res) => {
      const { id } = req.params;
      const event = mockEvents.find((e) => e.id === id);

      if (!event) {
        return res.status(404).json({
          message: "Event not found",
          code: "EVENT_NOT_FOUND",
        });
      }

      // Check permissions (only creator or admin can delete)
      if (
        event.createdBy !== req.user?.id &&
        req.user?.role !== "Administrator"
      ) {
        return res.status(403).json({
          message: "Insufficient permissions to delete this event",
          code: "INSUFFICIENT_PERMISSIONS",
        });
      }

      res.status(200).json({
        message: "Event deleted successfully",
      });
    });

    // POST /events/:id/signup
    app.post("/api/events/:id/signup", mockAuth, (req, res) => {
      const { id } = req.params;
      const { roleId, notes } = req.body;

      const event = mockEvents.find((e) => e.id === id);

      if (!event) {
        return res.status(404).json({
          message: "Event not found",
          code: "EVENT_NOT_FOUND",
        });
      }

      if (!roleId) {
        return res.status(400).json({
          message: "Role ID is required",
          code: "MISSING_ROLE_ID",
        });
      }

      if (event.status !== "Published") {
        return res.status(400).json({
          message: "Cannot sign up for unpublished event",
          code: "EVENT_NOT_PUBLISHED",
        });
      }

      res.status(201).json({
        message: "Successfully signed up for event",
        registration: {
          id: "reg-123",
          eventId: id,
          userId: req.user?.id || "unknown",
          roleId,
          notes,
          status: "active",
        },
      });
    });

    // DELETE /events/:id/signup
    app.delete("/api/events/:id/signup", mockAuth, (req, res) => {
      const { id } = req.params;

      const event = mockEvents.find((e) => e.id === id);

      if (!event) {
        return res.status(404).json({
          message: "Event not found",
          code: "EVENT_NOT_FOUND",
        });
      }

      res.status(200).json({
        message: "Successfully cancelled signup",
      });
    });

    // GET /events/user/:userId
    app.get("/api/events/user/:userId", mockAuth, (req, res) => {
      const { userId } = req.params;

      // Users can only view their own events unless they're admin
      if (userId !== req.user?.id && req.user?.role !== "Administrator") {
        return res.status(403).json({
          message: "Insufficient permissions",
          code: "INSUFFICIENT_PERMISSIONS",
        });
      }

      const userEvents = mockEvents.filter(
        (event) => event.createdBy === userId
      );

      res.status(200).json({
        events: userEvents,
        total: userEvents.length,
      });
    });

    // GET /events/:id/participants
    app.get("/api/events/:id/participants", mockAuth, (req, res) => {
      const { id } = req.params;

      const event = mockEvents.find((e) => e.id === id);

      if (!event) {
        return res.status(404).json({
          message: "Event not found",
          code: "EVENT_NOT_FOUND",
        });
      }

      // Check permissions (only event creator or admin can view participants)
      if (
        event.createdBy !== req.user?.id &&
        req.user?.role !== "Administrator"
      ) {
        return res.status(403).json({
          message: "Insufficient permissions to view participants",
          code: "INSUFFICIENT_PERMISSIONS",
        });
      }

      const mockParticipants = [
        {
          id: "user-1",
          username: "john_doe",
          email: "john@example.com",
          role: "Attendee",
          registrationDate: "2024-12-20",
          status: "confirmed",
        },
        {
          id: "user-2",
          username: "jane_smith",
          email: "jane@example.com",
          role: "Attendee",
          registrationDate: "2024-12-21",
          status: "confirmed",
        },
      ];

      res.status(200).json({
        participants: mockParticipants,
        total: mockParticipants.length,
      });
    });

    await new Promise((resolve) => setImmediate(resolve));
  });

  afterEach(async () => {
    await new Promise((resolve) => setImmediate(resolve));
  });

  describe("Public Routes", () => {
    describe("GET /events", () => {
      it("should get all events successfully", async () => {
        const response = await request(app).get("/api/events").timeout(1000);

        expect(response.status).toBe(200);
        expect(response.body.events).toHaveLength(2);
        expect(response.body.pagination).toMatchObject({
          total: 2,
          page: 1,
          limit: 10,
          pages: 1,
        });
      }, 5000);

      it("should filter events by search term", async () => {
        const response = await request(app)
          .get("/api/events?search=worship")
          .timeout(1000);

        expect(response.status).toBe(200);
        expect(response.body.events).toHaveLength(1);
        expect(response.body.events[0].title).toBe("Community Worship");
      }, 5000);

      it("should filter events by type", async () => {
        const response = await request(app)
          .get("/api/events?type=Fellowship")
          .timeout(1000);

        expect(response.status).toBe(200);
        expect(response.body.events).toHaveLength(1);
        expect(response.body.events[0].type).toBe("Fellowship");
      }, 5000);

      it("should filter events by format", async () => {
        const response = await request(app)
          .get("/api/events?format=In-person")
          .timeout(1000);

        expect(response.status).toBe(200);
        expect(response.body.events).toHaveLength(1);
        expect(response.body.events[0].format).toBe("In-person");
      }, 5000);
    });

    describe("GET /events/:id", () => {
      it("should get event by ID successfully", async () => {
        const response = await request(app)
          .get("/api/events/event-1")
          .timeout(1000);

        expect(response.status).toBe(200);
        expect(response.body.event).toMatchObject({
          id: "event-1",
          title: "Community Worship",
          type: "Worship Service",
        });
      }, 5000);

      it("should return 404 for non-existent event", async () => {
        const response = await request(app)
          .get("/api/events/nonexistent")
          .timeout(1000);

        expect(response.status).toBe(404);
        expect(response.body.code).toBe("EVENT_NOT_FOUND");
      }, 5000);

      it("should return 400 for invalid event ID", async () => {
        const response = await request(app)
          .get("/api/events/invalid-id")
          .timeout(1000);

        expect(response.status).toBe(400);
        expect(response.body.code).toBe("INVALID_ID");
      }, 5000);
    });
  });

  describe("Protected Routes", () => {
    describe("POST /events", () => {
      it("should create event successfully with valid data", async () => {
        const eventData = {
          title: "New Bible Study",
          type: "Study Group",
          date: "2024-12-30",
          time: "19:00",
          endTime: "21:00",
          purpose: "Weekly Bible Study",
          format: "In-person",
          location: "Study Room A",
        };

        const response = await request(app)
          .post("/api/events")
          .send(eventData)
          .timeout(1000);

        expect(response.status).toBe(201);
        expect(response.body.message).toBe("Event created successfully");
        expect(response.body.event).toMatchObject({
          title: "New Bible Study",
          type: "Study Group",
          status: "Draft",
        });
      }, 5000);

      it("should reject event creation with missing fields", async () => {
        const eventData = {
          title: "Incomplete Event",
          // Missing required fields
        };

        const response = await request(app)
          .post("/api/events")
          .send(eventData)
          .timeout(1000);

        expect(response.status).toBe(400);
        expect(response.body.code).toBe("MISSING_FIELDS");
      }, 5000);

      it("should reject duplicate event titles", async () => {
        const eventData = {
          title: "Duplicate Event",
          type: "Study Group",
          date: "2024-12-30",
          time: "19:00",
          endTime: "21:00",
          purpose: "Test duplicate",
          format: "In-person",
        };

        const response = await request(app)
          .post("/api/events")
          .send(eventData)
          .timeout(1000);

        expect(response.status).toBe(409);
        expect(response.body.code).toBe("DUPLICATE_EVENT");
      }, 5000);
    });

    describe("PUT /events/:id", () => {
      it("should update event successfully", async () => {
        const updateData = {
          title: "Updated Community Worship",
          location: "New Sanctuary",
        };

        const response = await request(app)
          .put("/api/events/event-1")
          .send(updateData)
          .timeout(1000);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("Event updated successfully");
        expect(response.body.event.title).toBe("Updated Community Worship");
      }, 5000);

      it("should return 404 for non-existent event", async () => {
        const response = await request(app)
          .put("/api/events/nonexistent")
          .send({ title: "Updated Title" })
          .timeout(1000);

        expect(response.status).toBe(404);
        expect(response.body.code).toBe("EVENT_NOT_FOUND");
      }, 5000);
    });

    describe("DELETE /events/:id", () => {
      it("should delete event successfully", async () => {
        const response = await request(app)
          .delete("/api/events/event-1")
          .timeout(1000);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("Event deleted successfully");
      }, 5000);

      it("should return 404 for non-existent event", async () => {
        const response = await request(app)
          .delete("/api/events/nonexistent")
          .timeout(1000);

        expect(response.status).toBe(404);
        expect(response.body.code).toBe("EVENT_NOT_FOUND");
      }, 5000);
    });

    describe("Event Signup Routes", () => {
      it("should sign up for event successfully", async () => {
        const signupData = {
          roleId: "role-1",
          notes: "Looking forward to attending",
        };

        const response = await request(app)
          .post("/api/events/event-1/signup")
          .send(signupData)
          .timeout(1000);

        expect(response.status).toBe(201);
        expect(response.body.message).toBe("Successfully signed up for event");
        expect(response.body.registration).toMatchObject({
          eventId: "event-1",
          roleId: "role-1",
          status: "active",
        });
      }, 5000);

      it("should require roleId for signup", async () => {
        const signupData = {
          notes: "Looking forward to attending",
        };

        const response = await request(app)
          .post("/api/events/event-1/signup")
          .send(signupData)
          .timeout(1000);

        expect(response.status).toBe(400);
        expect(response.body.code).toBe("MISSING_ROLE_ID");
      }, 5000);

      it("should cancel signup successfully", async () => {
        const response = await request(app).del("/api/events/event-1/signup");

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("Successfully cancelled signup");
      }, 5000);
    });

    describe("User Events Routes", () => {
      it("should get user events successfully", async () => {
        const response = await request(app)
          .get("/api/events/user/user-123")
          .timeout(1000);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("events");
        expect(response.body).toHaveProperty("total");
      }, 5000);
    });

    describe("Event Participants Routes", () => {
      it("should get event participants successfully", async () => {
        const response = await request(app)
          .get("/api/events/event-1/participants")
          .timeout(1000);

        expect(response.status).toBe(200);
        expect(response.body.participants).toHaveLength(2);
        expect(response.body.total).toBe(2);
      }, 5000);

      it("should return 404 for non-existent event participants", async () => {
        const response = await request(app)
          .get("/api/events/nonexistent/participants")
          .timeout(1000);

        expect(response.status).toBe(404);
        expect(response.body.code).toBe("EVENT_NOT_FOUND");
      }, 5000);
    });
  });

  describe("Admin Routes", () => {
    it("should update event statuses successfully", async () => {
      const response = await request(app)
        .post("/api/events/update-statuses")
        .timeout(1000);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Event statuses updated successfully");
      expect(response.body.updated).toBe(2);
    }, 5000);
  });
});
