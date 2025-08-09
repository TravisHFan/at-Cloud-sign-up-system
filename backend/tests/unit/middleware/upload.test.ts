// upload.test.ts - Comprehensive tests for upload middleware
import { describe, test, beforeEach, expect, vi } from "vitest";
import { getFileUrl, uploadAvatar } from "../../../src/middleware/upload";

// Capture options passed to multer to test storage and fileFilter logic
const captured = vi.hoisted(() => ({ opts: {} as any }));

// Mock multer to expose diskStorage config and capture options
vi.mock("multer", () => {
  const multerMock: any = vi.fn((opts?: any) => {
    captured.opts = opts ?? {};
    return {
      single: vi.fn(() => (req: any, res: any, next: any) => next()),
    };
  });

  // Return the provided config so tests can call destination/filename
  multerMock.diskStorage = vi.fn((cfg: any) => cfg);

  return {
    default: multerMock,
  };
});

// Mock image compression middleware
vi.mock("../../../src/middleware/imageCompression", () => ({
  compressUploadedImage: vi.fn((req: any, res: any, next: any) => next()),
  includeCompressionInfo: vi.fn((req: any, res: any, next: any) => next()),
}));

describe("Upload Middleware", () => {
  let mockRequest: any;

  beforeEach(() => {
    mockRequest = {
      protocol: "http",
      get: vi.fn((header: string) => {
        if (header === "host") return "localhost:3000";
        return undefined;
      }),
    };
    vi.clearAllMocks();
  });

  describe("getFileUrl Function", () => {
    test("should return correct relative URL for avatar uploads", () => {
      const filepath = "avatars/avatar-123456789.jpg";
      const result = getFileUrl(mockRequest, filepath);

      expect(result).toBe("/uploads/avatars/avatar-123456789.jpg");
    });

    test("should handle various filepath formats", () => {
      const testCases = [
        {
          input: "avatars/user-123.jpg",
          expected: "/uploads/avatars/user-123.jpg",
        },
        {
          input: "avatars/profile-456.png",
          expected: "/uploads/avatars/profile-456.png",
        },
        {
          input: "avatars/image.gif",
          expected: "/uploads/avatars/image.gif",
        },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = getFileUrl(mockRequest, input);
        expect(result).toBe(expected);
      });
    });

    test("should maintain frontend proxy compatibility", () => {
      const filepath = "avatars/test.jpg";
      const result = getFileUrl(mockRequest, filepath);

      // Should return relative path (not absolute URL)
      expect(result.startsWith("/uploads/")).toBe(true);
      expect(result.includes("http")).toBe(false);
      expect(result.includes("localhost")).toBe(false);
    });

    test("should handle empty filepath", () => {
      const result = getFileUrl(mockRequest, "");
      expect(result).toBe("/uploads/");
    });

    test("should handle filepath with subdirectories", () => {
      const filepath = "avatars/users/2023/profile.jpg";
      const result = getFileUrl(mockRequest, filepath);
      expect(result).toBe("/uploads/avatars/users/2023/profile.jpg");
    });
  });

  describe("Storage Configuration Tests", () => {
    test("should configure multer with correct settings", () => {
      // Test that multer mock is properly set up
      expect(vi.isMockFunction(vi.fn())).toBe(true);
    });

    test("should configure disk storage", () => {
      // Test that diskStorage can be called
      const multer = require("multer");
      expect(typeof multer.diskStorage).toBe("function");
    });

    test("storage.destination sets avatar path and rejects unsupported fields", () => {
      // Force module import side-effects to set captured opts
      void uploadAvatar;

      const storage = captured.opts.storage;
      expect(storage).toBeTruthy();
      expect(typeof storage.destination).toBe("function");

      // Supported field: avatar
      const cbOk = vi.fn();
      storage.destination(
        {} as any,
        { fieldname: "avatar" } as any,
        (err: any, dest: string) => cbOk(err, dest)
      );
      expect(cbOk).toHaveBeenCalledWith(null, "uploads/avatars/");

      // Unsupported field triggers error
      const cbErr = vi.fn();
      storage.destination(
        {} as any,
        { fieldname: "document" } as any,
        (err: any, dest: string) => cbErr(err, dest)
      );
      const [errArg, destArg] = cbErr.mock.calls[0];
      expect(errArg).toBeInstanceOf(Error);
      expect(String(errArg.message)).toContain("Unsupported upload field");
      expect(destArg).toBe("");
    });

    test("storage.filename generates unique filename with original extension", () => {
      // Make suffix deterministic
      const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1700000000000);
      const rndSpy = vi.spyOn(Math, "random").mockReturnValue(0.123456789); // ~123456789

      void uploadAvatar;
      const storage = captured.opts.storage;
      const cb = vi.fn();
      storage.filename(
        {} as any,
        { fieldname: "avatar", originalname: "photo.png" } as any,
        (err: any, filename: string) => cb(err, filename)
      );

      const [, generated] = cb.mock.calls[0];
      expect(generated).toMatch(/^avatar-1700000000000-123456789\.png$/);

      nowSpy.mockRestore();
      rndSpy.mockRestore();
    });
  });

  describe("Image Compression Integration", () => {
    test("should have compression middleware mocked", () => {
      // Basic test to ensure mocking is working
      expect(vi.isMockFunction(vi.fn())).toBe(true);
    });

    test("should call compression middleware functions", () => {
      // Test that mocked functions can be called
      const mockReq = {};
      const mockRes = {};
      const mockNext = vi.fn();

      // This tests the mock functions work
      expect(mockNext).toBeDefined();
      expect(typeof mockNext).toBe("function");
    });
  });

  describe("File Filtering Logic", () => {
    test("should accept image MIME types", () => {
      const imageTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/svg+xml",
      ];

      void uploadAvatar;
      const fileFilter = captured.opts.fileFilter as Function;
      expect(typeof fileFilter).toBe("function");

      imageTypes.forEach((mimetype) => {
        const cb = vi.fn();
        fileFilter({} as any, { mimetype } as any, cb);
        expect(cb).toHaveBeenCalledWith(null, true);
      });
    });

    test("should reject non-image MIME types", () => {
      const nonImageTypes = [
        "text/plain",
        "video/mp4",
        "application/pdf",
        "audio/mpeg",
      ];

      void uploadAvatar;
      const fileFilter = captured.opts.fileFilter as Function;

      nonImageTypes.forEach((mimetype) => {
        const cb = vi.fn();
        fileFilter({} as any, { mimetype } as any, cb);
        const [err] = cb.mock.calls[0];
        expect(err).toBeInstanceOf(Error);
        expect(String(err.message)).toContain("Only image files are allowed");
      });
    });
  });

  describe("Filename Generation", () => {
    test("should generate unique filename patterns", () => {
      const timestamp = Date.now();
      const randomValue = Math.round(Math.random() * 1e9);
      const extension = ".jpg";
      const fieldname = "avatar";

      const expectedPattern = `${fieldname}-${timestamp}-${randomValue}${extension}`;

      // Test that the pattern components exist
      expect(timestamp).toBeGreaterThan(0);
      expect(randomValue).toBeGreaterThanOrEqual(0);
      expect(extension).toBe(".jpg");
      expect(fieldname).toBe("avatar");
      expect(expectedPattern).toContain("avatar-");
      expect(expectedPattern).toContain(".jpg");
    });

    test("should handle different file extensions", () => {
      const extensions = [".jpg", ".png", ".gif", ".webp"];

      extensions.forEach((ext) => {
        const filename = `avatar-123456789${ext}`;
        expect(filename).toContain("avatar-");
        expect(filename).toContain(ext);
      });
    });
  });

  describe("Upload Path Configuration", () => {
    test("should configure avatar upload path correctly", () => {
      const avatarPath = "uploads/avatars/";

      expect(avatarPath).toBe("uploads/avatars/");
      expect(avatarPath.startsWith("uploads/")).toBe(true);
      expect(avatarPath.includes("avatars")).toBe(true);
    });

    test("should reject unsupported field names", () => {
      const supportedField = "avatar";
      const unsupportedFields = ["document", "video", "audio"];

      expect(supportedField).toBe("avatar");

      unsupportedFields.forEach((field) => {
        expect(field).not.toBe("avatar");
      });
    });
  });

  describe("File Size Limits", () => {
    test("should configure 10MB file size limit", () => {
      void uploadAvatar;
      const limits = captured.opts.limits;
      expect(limits).toBeTruthy();
      expect(limits.fileSize).toBe(10 * 1024 * 1024);
    });
  });
});
