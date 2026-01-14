/**
 * Uploads Route Unit Tests
 *
 * Tests the uploads router endpoints for image and avatar uploads
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock middleware
vi.mock("../../../src/middleware/auth", () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { _id: "user123", role: "Administrator" };
    next();
  },
  requireAdmin: (req: any, res: any, next: any) => next(),
}));

vi.mock("../../../src/middleware/rateLimiting", () => ({
  uploadLimiter: (req: any, res: any, next: any) => next(),
}));

const mockUploadImage = vi.fn((req: any, res: any, next: any) => {
  req.file = { filename: "test-image.jpg" };
  next();
});

const mockUploadAvatar = vi.fn((req: any, res: any, next: any) => {
  req.file = { filename: "test-avatar.jpg" };
  next();
});

const mockGetFileUrl = vi.fn((req: any, path: string, options?: any) => {
  if (options?.absolute) {
    return `http://localhost:5001/api/uploads/${path}`;
  }
  return `/api/uploads/${path}`;
});

vi.mock("../../../src/middleware/upload", () => ({
  uploadImage: (...args: any[]) => mockUploadImage(...args),
  uploadAvatar: (...args: any[]) => mockUploadAvatar(...args),
  getFileUrl: (...args: any[]) => mockGetFileUrl(...args),
}));

// Import router after mocks
import uploadsRouter from "../../../src/routes/uploads";

const makeApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/uploads", uploadsRouter);
  return app;
};

describe("uploads routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/uploads/image", () => {
    it("should upload image successfully", async () => {
      const app = makeApp();

      const response = await request(app)
        .post("/api/uploads/image")
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          url: "http://localhost:5001/api/uploads/images/test-image.jpg",
        },
      });

      expect(mockUploadImage).toHaveBeenCalled();
      expect(mockGetFileUrl).toHaveBeenCalledWith(
        expect.any(Object),
        "images/test-image.jpg",
        { absolute: true }
      );
    });

    it("should return 400 when no file uploaded", async () => {
      mockUploadImage.mockImplementationOnce(
        (req: any, res: any, next: any) => {
          // Don't set req.file
          next();
        }
      );

      const app = makeApp();

      const response = await request(app)
        .post("/api/uploads/image")
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: "No image uploaded",
      });
    });
  });

  describe("POST /api/uploads/avatar", () => {
    it("should upload avatar successfully with cache busting", async () => {
      const app = makeApp();

      const response = await request(app)
        .post("/api/uploads/avatar")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.avatarUrl).toMatch(
        /^http:\/\/localhost:5001\/api\/uploads\/avatars\/test-avatar\.jpg\?t=\d+$/
      );

      expect(mockUploadAvatar).toHaveBeenCalled();
      expect(mockGetFileUrl).toHaveBeenCalledWith(
        expect.any(Object),
        "avatars/test-avatar.jpg",
        { absolute: true }
      );
    });

    it("should return 400 when no avatar file uploaded", async () => {
      mockUploadAvatar.mockImplementationOnce(
        (req: any, res: any, next: any) => {
          // Don't set req.file
          next();
        }
      );

      const app = makeApp();

      const response = await request(app)
        .post("/api/uploads/avatar")
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: "No avatar uploaded",
      });
    });
  });
});
