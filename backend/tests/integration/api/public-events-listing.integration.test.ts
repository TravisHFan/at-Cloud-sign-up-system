/**
 * @vitest-environment node
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import request from "supertest";
import app from "../../../src/app";
import Event from "../../../src/models/Event";
import Registration from "../../../src/models/Registration";
import User from "../../../src/models/User";
import { bumpPublicEventsListVersion } from "../../../src/services/PublicEventsListCache";
import { ensureIntegrationDB } from "../setup/connect";

beforeAll(async () => {
  await ensureIntegrationDB();
});

describe("Public Events Listing Integration Tests", () => {
  let testUser: any;

  // Helper to create a valid event with required fields
  const createTestEvent = (overrides: any = {}) => ({
    title: "Test Event",
    type: "Conference",
    format: "Hybrid Participation",
    date: "2025-12-15",
    time: "10:00",
    endTime: "12:00",
    timeZone: "America/Los_Angeles",
    location: "Test Location",
    description: "Test Description",
    publish: true,
    publicSlug: `test-event-${Date.now()}-${Math.random()}`,
    organizer: testUser?._id,
    createdBy: testUser?._id,
    roles: [
      {
        id: "role1",
        name: "Participant",
        description: "Event participant",
        maxParticipants: 10,
        openToPublic: true,
      },
    ],
    ...overrides,
  });

  beforeEach(async () => {
    // Bump cache version to invalidate cache between tests
    bumpPublicEventsListVersion();

    // Create test user for registrations
    testUser = await User.create({
      username: "testuser",
      firstName: "Test",
      lastName: "User",
      email: "testuser@example.com",
      password: "HashedPassword123",
      emailVerified: true,
    });
  });

  afterEach(async () => {
    await Registration.deleteMany({});
    await Event.deleteMany({});
    await User.deleteMany({});
  });

  describe("GET /api/public/events", () => {
    it("should return published events with pagination", async () => {
      // Create multiple published events
      await Event.create([
        createTestEvent({
          title: "Public Event 1",
          publicSlug: "public-event-1",
          date: "2025-12-15",
        }),
        createTestEvent({
          title: "Public Event 2",
          type: "Webinar",
          publicSlug: "public-event-2",
          date: "2025-12-20",
          time: "14:00",
          endTime: "16:00",
          location: "Conference Hall B",
        }),
      ]);

      // Create unpublished event (should not appear)
      await Event.create(
        createTestEvent({
          title: "Private Event",
          publicSlug: "private-event",
          publish: false,
          date: "2025-12-25",
          time: "09:00",
          endTime: "10:00",
        })
      );

      const response = await request(app).get("/api/public/events").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.pageSize).toBe(10);

      // Verify structure of returned items
      const firstItem = response.body.data.items[0];
      expect(firstItem).toHaveProperty("title");
      expect(firstItem).toHaveProperty("type");
      expect(firstItem).toHaveProperty("slug");
      expect(firstItem).toHaveProperty("start");
      expect(firstItem).toHaveProperty("end");
      expect(firstItem).toHaveProperty("location");
      expect(firstItem).toHaveProperty("rolesOpen");
      expect(firstItem).toHaveProperty("capacityRemaining");
    });

    it("should filter events by type", async () => {
      await Event.create([
        createTestEvent({
          title: "Workshop Event",
          type: "Conference",
          publicSlug: "workshop-event",
          date: "2025-12-15",
        }),
        createTestEvent({
          title: "Seminar Event",
          type: "Webinar",
          publicSlug: "seminar-event",
          date: "2025-12-20",
          time: "14:00",
          endTime: "16:00",
        }),
      ]);

      const response = await request(app)
        .get("/api/public/events?type=Conference")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(1);
      expect(response.body.data.items[0].type).toBe("Conference");
    });

    it("should filter events by date range", async () => {
      await Event.create([
        createTestEvent({
          title: "Early Event",
          publicSlug: "early-event",
          date: "2025-12-10",
        }),
        createTestEvent({
          title: "Mid Event",
          type: "Webinar",
          publicSlug: "mid-event",
          date: "2025-12-20",
          time: "14:00",
          endTime: "16:00",
        }),
        createTestEvent({
          title: "Late Event",
          publicSlug: "late-event",
          date: "2025-12-30",
          time: "09:00",
          endTime: "17:00",
        }),
      ]);

      const response = await request(app)
        .get("/api/public/events?dateFrom=2025-12-15&dateTo=2025-12-25")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(1);
      expect(response.body.data.items[0].title).toBe("Mid Event");
    });

    it("should search events by title", async () => {
      await Event.create([
        createTestEvent({
          title: "JavaScript Workshop",
          publicSlug: "js-workshop",
          date: "2025-12-15",
        }),
        createTestEvent({
          title: "Python Seminar",
          type: "Webinar",
          publicSlug: "python-seminar",
          date: "2025-12-20",
          time: "14:00",
          endTime: "16:00",
        }),
      ]);

      const response = await request(app)
        .get("/api/public/events?q=JavaScript")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(1);
      expect(response.body.data.items[0].title).toBe("JavaScript Workshop");
    });

    it("should sort events by date ascending (default)", async () => {
      await Event.create([
        createTestEvent({
          title: "Event B",
          publicSlug: "event-b",
          date: "2025-12-20",
        }),
        createTestEvent({
          title: "Event A",
          type: "Webinar",
          publicSlug: "event-a",
          date: "2025-12-10",
          time: "14:00",
          endTime: "16:00",
        }),
      ]);

      const response = await request(app)
        .get("/api/public/events?sort=startAsc")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items[0].title).toBe("Event A");
      expect(response.body.data.items[1].title).toBe("Event B");
    });

    it("should sort events by date descending", async () => {
      await Event.create([
        createTestEvent({
          title: "Event A",
          publicSlug: "event-a",
          date: "2025-12-10",
        }),
        createTestEvent({
          title: "Event B",
          type: "Webinar",
          publicSlug: "event-b",
          date: "2025-12-20",
          time: "14:00",
          endTime: "16:00",
        }),
      ]);

      const response = await request(app)
        .get("/api/public/events?sort=startDesc")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items[0].title).toBe("Event B");
      expect(response.body.data.items[1].title).toBe("Event A");
    });

    it("should calculate capacity remaining correctly", async () => {
      const event = await Event.create(
        createTestEvent({
          title: "Capacity Test Event",
          publicSlug: "capacity-test",
          date: "2025-12-15",
        })
      );

      // Create 3 different users for registrations
      const user1 = await User.create({
        username: "testuser1",
        firstName: "Test",
        lastName: "User1",
        email: "testuser1@example.com",
        password: "HashedPassword123",
        emailVerified: true,
      });
      const user2 = await User.create({
        username: "testuser2",
        firstName: "Test",
        lastName: "User2",
        email: "testuser2@example.com",
        password: "HashedPassword123",
        emailVerified: true,
      });
      const user3 = await User.create({
        username: "testuser3",
        firstName: "Test",
        lastName: "User3",
        email: "testuser3@example.com",
        password: "HashedPassword123",
        emailVerified: true,
      });

      // Add 3 active registrations from different users
      await Registration.create([
        {
          eventId: event._id,
          userId: user1._id,
          roleId: "role1",
          status: "active" as const,
          registeredBy: user1._id,
          userSnapshot: {
            username: user1.username,
            firstName: user1.firstName,
            lastName: user1.lastName,
            email: user1.email,
          },
          eventSnapshot: {
            title: event.title,
            date: event.date,
            time: event.time,
            location: event.location,
            type: event.type,
            roleName: "Participant",
            roleDescription: "Event participant",
          },
        },
        {
          eventId: event._id,
          userId: user2._id,
          roleId: "role1",
          status: "active" as const,
          registeredBy: user2._id,
          userSnapshot: {
            username: user2.username,
            firstName: user2.firstName,
            lastName: user2.lastName,
            email: user2.email,
          },
          eventSnapshot: {
            title: event.title,
            date: event.date,
            time: event.time,
            location: event.location,
            type: event.type,
            roleName: "Participant",
            roleDescription: "Event participant",
          },
        },
        {
          eventId: event._id,
          userId: user3._id,
          roleId: "role1",
          status: "active" as const,
          registeredBy: user3._id,
          userSnapshot: {
            username: user3.username,
            firstName: user3.firstName,
            lastName: user3.lastName,
            email: user3.email,
          },
          eventSnapshot: {
            title: event.title,
            date: event.date,
            time: event.time,
            location: event.location,
            type: event.type,
            roleName: "Participant",
            roleDescription: "Event participant",
          },
        },
      ]);

      const response = await request(app).get("/api/public/events").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items[0].capacityRemaining).toBe(7);
    });

    it("should handle pagination correctly", async () => {
      // Create 15 events
      const events = [];
      for (let i = 1; i <= 15; i++) {
        events.push(
          createTestEvent({
            title: `Event ${i}`,
            publicSlug: `event-${i}`,
            date: "2025-12-15",
          })
        );
      }
      await Event.create(events);

      // Get page 1
      const page1 = await request(app)
        .get("/api/public/events?page=1&pageSize=10")
        .expect(200);

      expect(page1.body.data.page).toBe(1);
      expect(page1.body.data.pageSize).toBe(10);
      expect(page1.body.data.items).toHaveLength(10);
      expect(page1.body.data.total).toBe(15);
      expect(page1.body.data.totalPages).toBe(2);

      // Get page 2
      const page2 = await request(app)
        .get("/api/public/events?page=2&pageSize=10")
        .expect(200);

      expect(page2.body.data.page).toBe(2);
      expect(page2.body.data.items).toHaveLength(5);
    });

    it("should enforce page size limits (max 50)", async () => {
      const response = await request(app)
        .get("/api/public/events?pageSize=100")
        .expect(200);

      expect(response.body.data.pageSize).toBe(50);
    });

    it("should exclude completed events", async () => {
      await Event.create([
        createTestEvent({
          title: "Upcoming Event",
          publicSlug: "upcoming-event",
          date: "2025-12-15",
          status: "upcoming",
        }),
        createTestEvent({
          title: "Completed Event",
          type: "Webinar",
          publicSlug: "completed-event",
          date: "2025-11-01",
          time: "14:00",
          endTime: "16:00",
          status: "completed",
        }),
      ]);

      const response = await request(app).get("/api/public/events").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(1);
      expect(response.body.data.items[0].title).toBe("Upcoming Event");
    });

    it("should return 304 when ETag matches", async () => {
      await Event.create(
        createTestEvent({
          title: "Test Event",
          publicSlug: "test-event-etag",
          date: "2025-12-15",
        })
      );

      // First request to get ETag
      const firstResponse = await request(app)
        .get("/api/public/events")
        .expect(200);

      const etag = firstResponse.headers.etag;
      expect(etag).toBeDefined();

      // Second request with ETag
      await request(app)
        .get("/api/public/events")
        .set("If-None-Match", etag)
        .expect(304);
    });

    it("should include flyer URLs when available", async () => {
      await Event.create(
        createTestEvent({
          title: "Event with Flyer",
          publicSlug: "event-with-flyer",
          date: "2025-12-15",
          flyerUrl: "https://example.com/flyer.jpg",
          secondaryFlyerUrl: "https://example.com/flyer2.jpg",
        })
      );

      const response = await request(app).get("/api/public/events").expect(200);

      expect(response.body.data.items[0].flyerUrl).toBe(
        "https://example.com/flyer.jpg"
      );
      expect(response.body.data.items[0].secondaryFlyerUrl).toBe(
        "https://example.com/flyer2.jpg"
      );
    });

    it("should handle errors gracefully", async () => {
      // Force an error by providing invalid query parameters
      const response = await request(app)
        .get("/api/public/events?page=-1")
        .expect(200);

      // Should still work with corrected values
      expect(response.body.success).toBe(true);
      expect(response.body.data.page).toBe(1); // Corrected to minimum value
    });
  });
});
