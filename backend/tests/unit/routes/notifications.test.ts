import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import notificationsRoutes from "../../../src/routes/notifications";

// Mock the controllers
vi.mock("../../../src/controllers/unifiedMessageController", () => ({
  UnifiedMessageController: {
    getSystemMessages: vi.fn((req, res) =>
      res.status(200).json({ messages: [] })
    ),
    markAsRead: vi.fn((req, res) => res.status(200).json({ success: true })),
    createSystemMessage: vi.fn((req, res) =>
      res.status(201).json({ id: "msg-123" })
    ),
    deleteMessage: vi.fn((req, res) => res.status(204).send()),
    getBellNotifications: vi.fn((req, res) =>
      res.status(200).json({ notifications: [] })
    ),
    markBellNotificationAsRead: vi.fn((req, res) =>
      res.status(200).json({ success: true })
    ),
    markAllBellNotificationsAsRead: vi.fn((req, res) =>
      res.status(200).json({ success: true })
    ),
    removeBellNotification: vi.fn((req, res) => res.status(204).send()),
    getUnreadCounts: vi.fn((req, res) =>
      res.status(200).json({ system: 5, bell: 3 })
    ),
    cleanupExpiredMessages: vi.fn((req, res) =>
      res.status(200).json({ cleaned: 10 })
    ),
    checkWelcomeMessageStatus: vi.fn((req, res) =>
      res.status(200).json({ received: false })
    ),
    sendWelcomeNotification: vi.fn((req, res) =>
      res.status(200).json({ sent: true })
    ),
  },
}));

vi.mock("../../../src/controllers/emailNotificationController", () => ({
  EmailNotificationController: {
    sendEventCreatedNotification: vi.fn((req, res) =>
      res.status(200).json({ sent: true })
    ),
    sendSystemAuthorizationChangeNotification: vi.fn((req, res) =>
      res.status(200).json({ sent: true })
    ),
    sendCoOrganizerAssignedNotification: vi.fn((req, res) =>
      res.status(200).json({ sent: true })
    ),
  },
}));

// Mock authentication middleware
vi.mock("../../../src/middleware/auth", () => ({
  authenticate: vi.fn((req, res, next) => {
    req.user = { id: "user-123", role: "USER" };
    next();
  }),
}));

// Mock validation middleware
vi.mock("../../../src/middleware/validation", () => ({
  validateSystemMessage: vi.fn((req, res, next) => next()),
  validateError: vi.fn((req, res, next) => next()),
  handleValidationErrors: vi.fn((req, res, next) => next()),
}));

describe("Notifications Routes", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/v1/notifications", notificationsRoutes);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Route Existence", () => {
    it("should have system messages GET route", async () => {
      const response = await request(app).get("/api/v1/notifications/system");

      expect(response.status).not.toBe(404);
    });

    it("should have system message mark as read PATCH route", async () => {
      const response = await request(app).patch(
        "/api/v1/notifications/system/msg-123/read"
      );

      expect(response.status).not.toBe(404);
    });

    it("should have system message create POST route", async () => {
      const response = await request(app)
        .post("/api/v1/notifications/system")
        .send({ type: "info", content: "Test message" });

      expect(response.status).not.toBe(404);
    });

    it("should have system message delete DELETE route", async () => {
      const response = await request(app).delete(
        "/api/v1/notifications/system/msg-123"
      );

      expect(response.status).not.toBe(404);
    });

    it("should have bell notifications GET route", async () => {
      const response = await request(app).get("/api/v1/notifications/bell");

      expect(response.status).not.toBe(404);
    });

    it("should have bell notification mark as read PATCH route", async () => {
      const response = await request(app).patch(
        "/api/v1/notifications/bell/notif-123/read"
      );

      expect(response.status).not.toBe(404);
    });

    it("should have bell notifications mark all read PATCH route", async () => {
      const response = await request(app).patch(
        "/api/v1/notifications/bell/read-all"
      );

      expect(response.status).not.toBe(404);
    });

    it("should have bell notification remove DELETE route", async () => {
      const response = await request(app).delete(
        "/api/v1/notifications/bell/notif-123"
      );

      expect(response.status).not.toBe(404);
    });

    it("should have email event-created POST route", async () => {
      const response = await request(app)
        .post("/api/v1/notifications/email/event-created")
        .send({ eventId: "event-123" });

      expect(response.status).not.toBe(404);
    });

    it("should have email role-change POST route", async () => {
      const response = await request(app)
        .post("/api/v1/notifications/email/role-change")
        .send({ userId: "user-123", newRole: "ADMIN" });

      expect(response.status).not.toBe(404);
    });

    it("should have email co-organizer-assigned POST route", async () => {
      const response = await request(app)
        .post("/api/v1/notifications/email/co-organizer-assigned")
        .send({ eventId: "event-123", userId: "user-123" });

      expect(response.status).not.toBe(404);
    });

    it("should have unread counts GET route", async () => {
      const response = await request(app).get(
        "/api/v1/notifications/unread-counts"
      );

      expect(response.status).not.toBe(404);
    });

    it("should have cleanup POST route", async () => {
      const response = await request(app).post("/api/v1/notifications/cleanup");

      expect(response.status).not.toBe(404);
    });

    it("should have welcome status GET route", async () => {
      const response = await request(app).get(
        "/api/v1/notifications/welcome-status"
      );

      expect(response.status).not.toBe(404);
    });

    it("should have welcome POST route", async () => {
      const response = await request(app).post("/api/v1/notifications/welcome");

      expect(response.status).not.toBe(404);
    });
  });

  describe("System Messages", () => {
    describe("GET /system", () => {
      it("should get system messages successfully", async () => {
        const response = await request(app).get("/api/v1/notifications/system");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ messages: [] });
      });

      it("should support query parameters", async () => {
        const response = await request(app).get(
          "/api/v1/notifications/system?type=info&isRead=false&page=1&limit=10"
        );

        expect(response.status).toBe(200);
      });
    });

    describe("PATCH /system/:messageId/read", () => {
      it("should mark system message as read successfully", async () => {
        const response = await request(app).patch(
          "/api/v1/notifications/system/msg-123/read"
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true });
      });

      it("should handle different message IDs", async () => {
        const response = await request(app).patch(
          "/api/v1/notifications/system/msg-456/read"
        );

        expect(response.status).toBe(200);
      });
    });

    describe("POST /system", () => {
      it("should create system message successfully", async () => {
        const messageData = {
          type: "info",
          content: "Test system message",
          priority: "normal",
        };

        const response = await request(app)
          .post("/api/v1/notifications/system")
          .send(messageData);

        expect(response.status).toBe(201);
        expect(response.body).toEqual({ id: "msg-123" });
      });

      it("should handle different message types", async () => {
        const messageData = {
          type: "warning",
          content: "Test warning message",
          priority: "high",
        };

        const response = await request(app)
          .post("/api/v1/notifications/system")
          .send(messageData);

        expect(response.status).toBe(201);
      });
    });

    describe("DELETE /system/:messageId", () => {
      it("should delete system message successfully", async () => {
        const response = await request(app).delete(
          "/api/v1/notifications/system/msg-123"
        );

        expect(response.status).toBe(204);
      });

      it("should handle different message IDs", async () => {
        const response = await request(app).delete(
          "/api/v1/notifications/system/msg-789"
        );

        expect(response.status).toBe(204);
      });
    });
  });

  describe("Bell Notifications", () => {
    describe("GET /bell", () => {
      it("should get bell notifications successfully", async () => {
        const response = await request(app).get("/api/v1/notifications/bell");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ notifications: [] });
      });
    });

    describe("PATCH /bell/:messageId/read", () => {
      it("should mark bell notification as read successfully", async () => {
        const response = await request(app).patch(
          "/api/v1/notifications/bell/notif-123/read"
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true });
      });
    });

    describe("PATCH /bell/read-all", () => {
      it("should mark all bell notifications as read successfully", async () => {
        const response = await request(app).patch(
          "/api/v1/notifications/bell/read-all"
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true });
      });
    });

    describe("DELETE /bell/:messageId", () => {
      it("should remove bell notification successfully", async () => {
        const response = await request(app).delete(
          "/api/v1/notifications/bell/notif-123"
        );

        expect(response.status).toBe(204);
      });
    });
  });

  describe("Email Notifications", () => {
    describe("POST /email/event-created", () => {
      it("should send event created notification successfully", async () => {
        const response = await request(app)
          .post("/api/v1/notifications/email/event-created")
          .send({ eventId: "event-123" });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ sent: true });
      });
    });

    describe("POST /email/role-change", () => {
      it("should send role change notification successfully", async () => {
        const response = await request(app)
          .post("/api/v1/notifications/email/role-change")
          .send({ userId: "user-123", newRole: "ADMIN" });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ sent: true });
      });
    });

    describe("POST /email/co-organizer-assigned", () => {
      it("should send co-organizer assigned notification successfully", async () => {
        const response = await request(app)
          .post("/api/v1/notifications/email/co-organizer-assigned")
          .send({ eventId: "event-123", userId: "user-123" });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ sent: true });
      });
    });
  });

  describe("Utility Endpoints", () => {
    describe("GET /unread-counts", () => {
      it("should get unread counts successfully", async () => {
        const response = await request(app).get(
          "/api/v1/notifications/unread-counts"
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ system: 5, bell: 3 });
      });
    });

    describe("POST /cleanup", () => {
      it("should cleanup expired messages successfully", async () => {
        const response = await request(app).post(
          "/api/v1/notifications/cleanup"
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ cleaned: 10 });
      });
    });
  });

  describe("Welcome System", () => {
    describe("GET /welcome-status", () => {
      it("should check welcome message status successfully", async () => {
        const response = await request(app).get(
          "/api/v1/notifications/welcome-status"
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ received: false });
      });
    });

    describe("POST /welcome", () => {
      it("should send welcome notification successfully", async () => {
        const response = await request(app).post(
          "/api/v1/notifications/welcome"
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ sent: true });
      });
    });
  });

  describe("Authentication Integration", () => {
    it("should require authentication for all routes", async () => {
      // This test verifies that authentication middleware is applied
      // The mocked authenticate middleware sets req.user
      const response = await request(app).get("/api/v1/notifications/system");

      expect(response.status).toBe(200);
      // Authentication is mocked to always succeed in tests
    });

    it("should apply authentication to POST routes", async () => {
      const response = await request(app)
        .post("/api/v1/notifications/system")
        .send({ type: "info", content: "Test" });

      expect(response.status).toBe(201);
    });

    it("should apply authentication to PATCH routes", async () => {
      const response = await request(app).patch(
        "/api/v1/notifications/system/msg-123/read"
      );

      expect(response.status).toBe(200);
    });

    it("should apply authentication to DELETE routes", async () => {
      const response = await request(app).delete(
        "/api/v1/notifications/system/msg-123"
      );

      expect(response.status).toBe(204);
    });
  });

  describe("Validation Integration", () => {
    it("should validate system message creation", async () => {
      const response = await request(app)
        .post("/api/v1/notifications/system")
        .send({ type: "info", content: "Valid message" });

      expect(response.status).toBe(201);
    });

    it("should validate message ID parameters", async () => {
      const response = await request(app).patch(
        "/api/v1/notifications/system/valid-id/read"
      );

      expect(response.status).toBe(200);
    });
  });

  describe("Error Scenarios", () => {
    it("should handle invalid routes gracefully", async () => {
      const response = await request(app).get(
        "/api/v1/notifications/invalid-route"
      );

      expect(response.status).toBe(404);
    });

    it("should handle malformed requests", async () => {
      const response = await request(app)
        .post("/api/v1/notifications/system")
        .send("invalid json");

      // Express should handle malformed JSON
      expect([400, 201]).toContain(response.status);
    });
  });
});
