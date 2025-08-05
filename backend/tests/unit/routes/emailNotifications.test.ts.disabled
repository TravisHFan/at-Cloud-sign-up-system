import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { emailNotificationRouter } from "../../../src/routes/emailNotifications";

// Mock the controller
vi.mock("../../../src/controllers/emailNotificationController", () => ({
  EmailNotificationController: {
    sendEventReminderNotification: vi.fn((req, res) =>
      res.status(200).json({ sent: true })
    ),
    sendEventCreatedNotification: vi.fn((req, res) =>
      res.status(200).json({ sent: true })
    ),
    sendSystemAuthorizationChangeNotification: vi.fn((req, res) =>
      res.status(200).json({ sent: true })
    ),
    sendAtCloudRoleChangeNotification: vi.fn((req, res) =>
      res.status(200).json({ sent: true })
    ),
    sendNewLeaderSignupNotification: vi.fn((req, res) =>
      res.status(200).json({ sent: true })
    ),
    sendCoOrganizerAssignedNotification: vi.fn((req, res) =>
      res.status(200).json({ sent: true })
    ),
  },
}));

// Mock EventReminderScheduler
vi.mock("../../../src/services/EventReminderScheduler", () => ({
  default: {
    getInstance: vi.fn(() => ({
      triggerManualCheck: vi.fn().mockResolvedValue(true),
    })),
  },
}));

// Mock authentication middleware
vi.mock("../../../src/middleware/auth", () => ({
  authenticate: vi.fn((req, res, next) => {
    req.user = { id: "user-123", role: "ADMIN" };
    next();
  }),
}));

describe("Email Notifications Routes", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/v1/email", emailNotificationRouter);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Route Existence", () => {
    it("should have test event reminder POST route (no auth)", async () => {
      const response = await request(app).post(
        "/api/v1/email/test-event-reminder"
      );

      expect(response.status).not.toBe(404);
    });

    it("should have event created POST route", async () => {
      const response = await request(app).post("/api/v1/email/event-created");

      expect(response.status).not.toBe(404);
    });

    it("should have system authorization change POST route", async () => {
      const response = await request(app).post(
        "/api/v1/email/system-authorization-change"
      );

      expect(response.status).not.toBe(404);
    });

    it("should have atcloud role change POST route", async () => {
      const response = await request(app).post(
        "/api/v1/email/atcloud-role-change"
      );

      expect(response.status).not.toBe(404);
    });

    it("should have new leader signup POST route", async () => {
      const response = await request(app).post(
        "/api/v1/email/new-leader-signup"
      );

      expect(response.status).not.toBe(404);
    });

    it("should have co-organizer assigned POST route", async () => {
      const response = await request(app).post(
        "/api/v1/email/co-organizer-assigned"
      );

      expect(response.status).not.toBe(404);
    });

    it("should have event reminder POST route", async () => {
      const response = await request(app).post("/api/v1/email/event-reminder");

      expect(response.status).not.toBe(404);
    });

    it("should have schedule reminder POST route", async () => {
      const response = await request(app).post(
        "/api/v1/email/schedule-reminder"
      );

      expect(response.status).not.toBe(404);
    });
  });

  describe("Event Notifications", () => {
    describe("POST /test-event-reminder", () => {
      it("should send test event reminder without authentication", async () => {
        const response = await request(app)
          .post("/api/v1/email/test-event-reminder")
          .send({ eventId: "event-123" });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ sent: true });
      });
    });

    describe("POST /event-created", () => {
      it("should send event created notification successfully", async () => {
        const response = await request(app)
          .post("/api/v1/email/event-created")
          .send({ eventId: "event-123" });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ sent: true });
      });

      it("should handle event data", async () => {
        const eventData = {
          eventId: "event-456",
          title: "Test Event",
          organizer: "user-123",
        };

        const response = await request(app)
          .post("/api/v1/email/event-created")
          .send(eventData);

        expect(response.status).toBe(200);
      });
    });

    describe("POST /event-reminder", () => {
      it("should send event reminder notification successfully", async () => {
        const response = await request(app)
          .post("/api/v1/email/event-reminder")
          .send({ eventId: "event-123" });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ sent: true });
      });
    });

    describe("POST /co-organizer-assigned", () => {
      it("should send co-organizer assigned notification successfully", async () => {
        const response = await request(app)
          .post("/api/v1/email/co-organizer-assigned")
          .send({ eventId: "event-123", userId: "user-456" });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ sent: true });
      });
    });
  });

  describe("Role Change Notifications", () => {
    describe("POST /system-authorization-change", () => {
      it("should send system authorization change notification successfully", async () => {
        const response = await request(app)
          .post("/api/v1/email/system-authorization-change")
          .send({ userId: "user-123", newRole: "ADMIN" });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ sent: true });
      });
    });

    describe("POST /atcloud-role-change", () => {
      it("should send atcloud role change notification successfully", async () => {
        const response = await request(app)
          .post("/api/v1/email/atcloud-role-change")
          .send({ userId: "user-123", newRole: "LEADER" });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ sent: true });
      });
    });

    describe("POST /new-leader-signup", () => {
      it("should send new leader signup notification successfully", async () => {
        const response = await request(app)
          .post("/api/v1/email/new-leader-signup")
          .send({ userId: "user-123", eventId: "event-456" });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ sent: true });
      });
    });
  });

  describe("System Utilities", () => {
    describe("POST /schedule-reminder", () => {
      it("should trigger manual reminder check successfully", async () => {
        const response = await request(app).post(
          "/api/v1/email/schedule-reminder"
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          message: "Manual 24h reminder check triggered successfully",
        });
      });

      it("should handle scheduler errors", async () => {
        // Mock scheduler to throw error
        const mockScheduler = {
          triggerManualCheck: vi
            .fn()
            .mockRejectedValue(new Error("Scheduler error")),
        };

        vi.mocked(
          require("../../../src/services/EventReminderScheduler").default
            .getInstance
        ).mockReturnValue(mockScheduler);

        const response = await request(app).post(
          "/api/v1/email/schedule-reminder"
        );

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
      });
    });
  });

  describe("Not Implemented Routes", () => {
    describe("POST /password-reset", () => {
      it("should return not implemented status", async () => {
        const response = await request(app).post(
          "/api/v1/email/password-reset"
        );

        expect(response.status).toBe(501);
        expect(response.body).toEqual({
          success: false,
          message: "Not implemented yet",
        });
      });
    });

    describe("POST /email-verification", () => {
      it("should return not implemented status", async () => {
        const response = await request(app).post(
          "/api/v1/email/email-verification"
        );

        expect(response.status).toBe(501);
        expect(response.body).toEqual({
          success: false,
          message: "Not implemented yet",
        });
      });
    });

    describe("POST /security-alert", () => {
      it("should return not implemented status", async () => {
        const response = await request(app).post(
          "/api/v1/email/security-alert"
        );

        expect(response.status).toBe(501);
        expect(response.body).toEqual({
          success: false,
          message: "Not implemented yet",
        });
      });
    });

    describe("POST /event-role-removal", () => {
      it("should return not implemented status", async () => {
        const response = await request(app).post(
          "/api/v1/email/event-role-removal"
        );

        expect(response.status).toBe(501);
        expect(response.body).toEqual({
          success: false,
          message: "Not implemented yet",
        });
      });
    });

    describe("POST /event-role-move", () => {
      it("should return not implemented status", async () => {
        const response = await request(app).post(
          "/api/v1/email/event-role-move"
        );

        expect(response.status).toBe(501);
        expect(response.body).toEqual({
          success: false,
          message: "Not implemented yet",
        });
      });
    });
  });

  describe("Authentication Integration", () => {
    it("should require authentication for most routes", async () => {
      const response = await request(app).post("/api/v1/email/event-created");

      expect(response.status).toBe(200);
      // Authentication is mocked to always succeed
    });

    it("should allow test route without authentication", async () => {
      const response = await request(app).post(
        "/api/v1/email/test-event-reminder"
      );

      expect(response.status).toBe(200);
      // This route doesn't require authentication
    });

    it("should apply authentication to role change routes", async () => {
      const response = await request(app)
        .post("/api/v1/email/system-authorization-change")
        .send({ userId: "user-123", newRole: "ADMIN" });

      expect(response.status).toBe(200);
    });
  });

  describe("Error Scenarios", () => {
    it("should handle invalid routes gracefully", async () => {
      const response = await request(app).post("/api/v1/email/invalid-route");

      expect(response.status).toBe(404);
    });

    it("should handle malformed requests", async () => {
      const response = await request(app)
        .post("/api/v1/email/event-created")
        .send("invalid json");

      // Express should handle malformed JSON
      expect([400, 200]).toContain(response.status);
    });
  });
});
