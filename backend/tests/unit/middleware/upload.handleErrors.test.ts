// upload.handleErrors.test.ts - Tests for makeHandleUploadErrors coverage
import { describe, test, beforeEach, afterEach, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Capture state with vi.hoisted
const hoisted = vi.hoisted(() => {
  let capturedCallback: ((err: unknown) => void) | null = null;

  // Create a mock MulterError class
  class MockMulterError extends Error {
    code: string;
    constructor(code: string, message?: string) {
      super(message || code);
      this.code = code;
      this.name = "MulterError";
    }
  }

  return {
    get capturedCallback() {
      return capturedCallback;
    },
    MockMulterError,
    setCapturedCallback: (cb: ((err: unknown) => void) | null) => {
      capturedCallback = cb;
    },
  };
});

// Mock multer to capture the callback
vi.mock("multer", () => {
  const multerMock: any = vi.fn(() => ({
    single: vi.fn(() => (req: any, res: any, cb: (err: unknown) => void) => {
      hoisted.setCapturedCallback(cb);
    }),
  }));

  multerMock.diskStorage = vi.fn((cfg: any) => cfg);
  multerMock.MulterError = hoisted.MockMulterError;

  return { default: multerMock };
});

// Mock image compression middleware
vi.mock("../../../src/middleware/imageCompression", () => ({
  compressUploadedImage: vi.fn((req: any, res: any, next: any) => next()),
  includeCompressionInfo: vi.fn((req: any, res: any, next: any) => next()),
}));

// Import after mocks
import { uploadAvatar, uploadImage } from "../../../src/middleware/upload";

describe("Upload Middleware - Error Handling", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.setCapturedCallback(null);

    statusMock = vi.fn().mockReturnThis();
    jsonMock = vi.fn();
    mockNext = vi.fn() as unknown as NextFunction;
    vi.spyOn(console, "error").mockImplementation(() => {});

    mockRequest = {
      headers: {
        "content-type": "multipart/form-data; boundary=----WebKitFormBoundary",
      },
    };
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Partial<Response>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("handleAvatarUploadErrors (uploadAvatar[0])", () => {
    test("returns 400 when content-type is not multipart/form-data", () => {
      mockRequest.headers = { "content-type": "application/json" };

      const handleUploadErrors = uploadAvatar[0] as (
        req: Request,
        res: Response,
        next: NextFunction,
      ) => void;
      handleUploadErrors(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message:
          "No file uploaded. Please submit as multipart/form-data with a supported image field.",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test("returns 400 when content-type is empty", () => {
      mockRequest.headers = { "content-type": "" };

      const handleUploadErrors = uploadAvatar[0] as (
        req: Request,
        res: Response,
        next: NextFunction,
      ) => void;
      handleUploadErrors(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("multipart/form-data"),
        }),
      );
    });

    test("returns 400 when content-type header is missing", () => {
      mockRequest.headers = {};

      const handleUploadErrors = uploadAvatar[0] as (
        req: Request,
        res: Response,
        next: NextFunction,
      ) => void;
      handleUploadErrors(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    test("returns 400 with LIMIT_FILE_SIZE error", () => {
      const handleUploadErrors = uploadAvatar[0] as (
        req: Request,
        res: Response,
        next: NextFunction,
      ) => void;
      handleUploadErrors(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Trigger the captured callback with a LIMIT_FILE_SIZE error
      expect(hoisted.capturedCallback).not.toBeNull();
      const multerError = new hoisted.MockMulterError(
        "LIMIT_FILE_SIZE",
        "File is too large",
      );
      hoisted.capturedCallback!(multerError);

      expect(console.error).toHaveBeenCalledWith("Upload error:", multerError);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "File too large. Maximum size is 10MB.",
      });
    });

    test("returns 400 with other MulterError codes", () => {
      const handleUploadErrors = uploadAvatar[0] as (
        req: Request,
        res: Response,
        next: NextFunction,
      ) => void;
      handleUploadErrors(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(hoisted.capturedCallback).not.toBeNull();
      const multerError = new hoisted.MockMulterError(
        "LIMIT_UNEXPECTED_FILE",
        "Unexpected file field",
      );
      hoisted.capturedCallback!(multerError);

      expect(console.error).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Upload error: Unexpected file field",
      });
    });

    test("returns 500 with generic Error", () => {
      const handleUploadErrors = uploadAvatar[0] as (
        req: Request,
        res: Response,
        next: NextFunction,
      ) => void;
      handleUploadErrors(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(hoisted.capturedCallback).not.toBeNull();
      const genericError = new Error("Directory creation failed");
      hoisted.capturedCallback!(genericError);

      expect(console.error).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Server error: Directory creation failed",
      });
    });

    test("returns 500 with non-Error object (stringified)", () => {
      const handleUploadErrors = uploadAvatar[0] as (
        req: Request,
        res: Response,
        next: NextFunction,
      ) => void;
      handleUploadErrors(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(hoisted.capturedCallback).not.toBeNull();
      hoisted.capturedCallback!("String error message");

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Server error: String error message",
      });
    });

    test("calls next() when no error occurs", () => {
      const handleUploadErrors = uploadAvatar[0] as (
        req: Request,
        res: Response,
        next: NextFunction,
      ) => void;
      handleUploadErrors(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(hoisted.capturedCallback).not.toBeNull();
      hoisted.capturedCallback!(null);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe("handleImageUploadErrors (uploadImage[0])", () => {
    test("returns 400 when content-type is not multipart/form-data", () => {
      mockRequest.headers = { "content-type": "text/plain" };

      const handleImageErrors = uploadImage[0] as (
        req: Request,
        res: Response,
        next: NextFunction,
      ) => void;
      handleImageErrors(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test("handles MulterError in image upload", () => {
      const handleImageErrors = uploadImage[0] as (
        req: Request,
        res: Response,
        next: NextFunction,
      ) => void;
      handleImageErrors(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(hoisted.capturedCallback).not.toBeNull();
      const multerError = new hoisted.MockMulterError(
        "LIMIT_FILE_SIZE",
        "Too large",
      );
      hoisted.capturedCallback!(multerError);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "File too large. Maximum size is 10MB.",
      });
    });
  });
});
