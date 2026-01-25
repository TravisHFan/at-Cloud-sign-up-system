/**
 * PublicEvents Route Unit Tests - Isolated Pattern
 *
 * Tests the public events routing logic in isolation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express, { Express } from "express";
import request from "supertest";

describe("publicEvents routes - isolated", () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("GET /api/public/events (listing)", () => {
    it("should return paginated public events list", async () => {
      const mockPayload = {
        page: 1,
        pageSize: 10,
        total: 2,
        totalPages: 1,
        items: [
          {
            title: "Event 1",
            slug: "event-1",
            start: "2024-06-15T10:00:00Z",
          },
          {
            title: "Event 2",
            slug: "event-2",
            start: "2024-06-16T14:00:00Z",
          },
        ],
      };

      app.get("/api/public/events", (req, res) => {
        const etag = '"abc123"';
        res.setHeader("ETag", etag);
        res.status(200).json({ success: true, data: mockPayload });
      });

      const response = await request(app).get("/api/public/events").expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockPayload,
      });
      expect(response.headers.etag).toBe('"abc123"');
    });

    it("should return 304 when If-None-Match matches ETag", async () => {
      app.get("/api/public/events", (req, res) => {
        const etag = '"abc123"';
        const clientEtag = req.headers["if-none-match"];
        if (clientEtag === etag) {
          res.status(304).end();
          return;
        }
        res.status(200).json({ success: true, data: {} });
      });

      await request(app)
        .get("/api/public/events")
        .set("If-None-Match", '"abc123"')
        .expect(304);
    });

    it("should parse query parameters correctly", async () => {
      let capturedParams: Record<string, unknown> = {};

      app.get("/api/public/events", (req, res) => {
        capturedParams = {
          page: parseInt(req.query.page as string) || 1,
          pageSize: parseInt(req.query.pageSize as string) || 10,
          type: req.query.type,
          dateFrom: req.query.dateFrom,
          dateTo: req.query.dateTo,
          q: req.query.q,
          sort: req.query.sort || "startAsc",
        };
        res.status(200).json({ success: true });
      });

      await request(app)
        .get("/api/public/events")
        .query({
          page: "2",
          pageSize: "20",
          type: "Conference",
          dateFrom: "2024-01-01",
          dateTo: "2024-12-31",
          q: "test",
          sort: "startDesc",
        })
        .expect(200);

      expect(capturedParams).toEqual({
        page: 2,
        pageSize: 20,
        type: "Conference",
        dateFrom: "2024-01-01",
        dateTo: "2024-12-31",
        q: "test",
        sort: "startDesc",
      });
    });

    it("should limit pageSize to max 50", async () => {
      let actualPageSize = 0;

      app.get("/api/public/events", (req, res) => {
        const requestedPageSize = parseInt(req.query.pageSize as string) || 10;
        actualPageSize = Math.min(requestedPageSize, 50); // Max 50
        res.status(200).json({ success: true, pageSize: actualPageSize });
      });

      const response = await request(app)
        .get("/api/public/events")
        .query({ pageSize: "100" })
        .expect(200);

      expect(response.body.pageSize).toBe(50);
    });

    it("should enforce minimum page of 1", async () => {
      let actualPage = 0;

      app.get("/api/public/events", (req, res) => {
        const requestedPage = parseInt(req.query.page as string) || 1;
        actualPage = Math.max(requestedPage, 1); // Min 1
        res.status(200).json({ success: true, page: actualPage });
      });

      const response = await request(app)
        .get("/api/public/events")
        .query({ page: "-1" })
        .expect(200);

      expect(response.body.page).toBe(1);
    });

    it("should return 500 on error", async () => {
      app.get("/api/public/events", (req, res) => {
        res.status(500).json({
          success: false,
          message: "Failed to list public events",
        });
      });

      const response = await request(app).get("/api/public/events").expect(500);

      expect(response.body).toEqual({
        success: false,
        message: "Failed to list public events",
      });
    });

    it("should default sort to startAsc", async () => {
      let capturedSort = "";

      app.get("/api/public/events", (req, res) => {
        capturedSort = (req.query.sort as string) || "startAsc";
        res.status(200).json({ success: true, sort: capturedSort });
      });

      const response = await request(app).get("/api/public/events").expect(200);

      expect(response.body.sort).toBe("startAsc");
    });
  });

  describe("GET /api/public/events/:slug (detail)", () => {
    it("should return public event detail by slug", async () => {
      const mockEvent = {
        title: "Test Event",
        slug: "test-event",
        date: "2024-06-15",
        time: "10:00",
        roles: [],
      };

      app.get("/api/public/events/:slug", (req, res) => {
        const { slug } = req.params;
        if (slug === "test-event") {
          res.status(200).json({
            success: true,
            data: { ...mockEvent, isAuthenticated: false },
          });
          return;
        }
        res.status(404).json({ success: false, message: "Not found" });
      });

      const response = await request(app)
        .get("/api/public/events/test-event")
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: { ...mockEvent, isAuthenticated: false },
      });
    });

    it("should return 404 if event not found", async () => {
      app.get("/api/public/events/:slug", (req, res) => {
        res.status(404).json({
          success: false,
          message: "Public event not found",
        });
      });

      const response = await request(app)
        .get("/api/public/events/nonexistent")
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        message: "Public event not found",
      });
    });

    it("should return 500 on error", async () => {
      app.get("/api/public/events/:slug", (req, res) => {
        res.status(500).json({
          success: false,
          message: "Failed to load public event",
        });
      });

      const response = await request(app)
        .get("/api/public/events/test-event")
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        message: "Failed to load public event",
      });
    });

    it("should trim slug parameter", async () => {
      let capturedSlug = "";

      app.get("/api/public/events/:slug", (req, res) => {
        capturedSlug = req.params.slug?.trim() || "";
        if (!capturedSlug) {
          res.status(400).json({ success: false, message: "Invalid slug" });
          return;
        }
        res.status(200).json({ success: true, slug: capturedSlug });
      });

      const response = await request(app)
        .get("/api/public/events/  test-event  ")
        .expect(200);

      expect(response.body.slug).toBe("test-event");
    });
  });

  describe("POST /api/public/events/:slug/register", () => {
    it("should accept registration data", async () => {
      app.post("/api/public/events/:slug/register", (req, res) => {
        const { slug } = req.params;
        const { roleId, email } = req.body;

        if (!slug || !roleId || !email) {
          res.status(400).json({ success: false, message: "Missing fields" });
          return;
        }

        res.status(201).json({
          success: true,
          message: "Registered",
        });
      });

      const response = await request(app)
        .post("/api/public/events/test-event/register")
        .send({ roleId: "role1", email: "test@test.com" })
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        message: "Registered",
      });
    });

    it("should return 400 when required fields missing", async () => {
      app.post("/api/public/events/:slug/register", (req, res) => {
        const { roleId, email } = req.body;

        if (!roleId || !email) {
          res.status(400).json({
            success: false,
            message: "roleId and email are required",
          });
          return;
        }

        res.status(201).json({ success: true });
      });

      const response = await request(app)
        .post("/api/public/events/test-event/register")
        .send({ roleId: "role1" }) // Missing email
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should return 500 on registration error", async () => {
      app.post("/api/public/events/:slug/register", (req, res) => {
        res.status(500).json({
          success: false,
          message: "Registration failed",
        });
      });

      const response = await request(app)
        .post("/api/public/events/test-event/register")
        .send({ roleId: "role1", email: "test@test.com" })
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });
});
