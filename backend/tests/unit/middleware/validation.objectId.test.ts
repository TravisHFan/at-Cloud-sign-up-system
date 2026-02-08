/**
 * Tests for ObjectId validation and handleValidationErrors in validation.ts
 * Covers: validateObjectId with valid/invalid MongoDB ObjectIds
 * Covers: handleValidationErrors with various error scenarios and logging
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";

// Import the actual validation rules
import {
  validateObjectId,
  handleValidationErrors,
} from "../../../src/middleware/validation";

// Helper to run validation chain against mock request (for param validation)
async function runParamValidation(
  validationChain: unknown[],
  params: Record<string, unknown>,
): Promise<{ errors: Array<{ msg: string; path: string }> }> {
  const req = {
    body: {},
    query: {},
    params,
    cookies: {},
    get: () => undefined,
    headers: {},
  } as unknown as Request;
  const res = {} as Response;
  const next = vi.fn() as unknown as NextFunction;

  // Run each validator/middleware except the last (error handler)
  for (let i = 0; i < validationChain.length - 1; i++) {
    const middleware = validationChain[i] as (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => Promise<void>;
    await middleware(req, res, next);
  }

  const result = validationResult(req);
  return {
    errors: result.array() as Array<{ msg: string; path: string }>,
  };
}

describe("ObjectId Validation Rules", () => {
  describe("validateObjectId", () => {
    it("should accept valid 24-character hex ObjectId", async () => {
      const result = await runParamValidation(validateObjectId, {
        id: "507f1f77bcf86cd799439011",
      });
      const idErrors = result.errors.filter((e) => e.path === "id");
      expect(idErrors).toHaveLength(0);
    });

    it("should accept another valid ObjectId", async () => {
      const result = await runParamValidation(validateObjectId, {
        id: "000000000000000000000000",
      });
      const idErrors = result.errors.filter((e) => e.path === "id");
      expect(idErrors).toHaveLength(0);
    });

    it("should accept ObjectId with all valid hex characters", async () => {
      const result = await runParamValidation(validateObjectId, {
        id: "abcdef0123456789abcdef01",
      });
      const idErrors = result.errors.filter((e) => e.path === "id");
      expect(idErrors).toHaveLength(0);
    });

    it("should accept ObjectId with uppercase hex characters", async () => {
      const result = await runParamValidation(validateObjectId, {
        id: "ABCDEF0123456789ABCDEF01",
      });
      const idErrors = result.errors.filter((e) => e.path === "id");
      expect(idErrors).toHaveLength(0);
    });

    it("should accept ObjectId with mixed case hex characters", async () => {
      const result = await runParamValidation(validateObjectId, {
        id: "AbCdEf0123456789aBcDeF01",
      });
      const idErrors = result.errors.filter((e) => e.path === "id");
      expect(idErrors).toHaveLength(0);
    });

    it("should reject ObjectId with less than 24 characters", async () => {
      const result = await runParamValidation(validateObjectId, {
        id: "507f1f77bcf86cd79943901", // 23 chars
      });
      const idErrors = result.errors.filter((e) => e.path === "id");
      expect(idErrors.length).toBeGreaterThan(0);
      expect(idErrors[0].msg).toContain("Invalid ID");
    });

    it("should reject ObjectId with more than 24 characters", async () => {
      const result = await runParamValidation(validateObjectId, {
        id: "507f1f77bcf86cd7994390111", // 25 chars
      });
      const idErrors = result.errors.filter((e) => e.path === "id");
      expect(idErrors.length).toBeGreaterThan(0);
    });

    it("should reject ObjectId with non-hex characters", async () => {
      const result = await runParamValidation(validateObjectId, {
        id: "507f1f77bcf86cd79943901g", // 'g' is not hex
      });
      const idErrors = result.errors.filter((e) => e.path === "id");
      expect(idErrors.length).toBeGreaterThan(0);
    });

    it("should reject ObjectId with special characters", async () => {
      const result = await runParamValidation(validateObjectId, {
        id: "507f1f77-cf86-d799-4390",
      });
      const idErrors = result.errors.filter((e) => e.path === "id");
      expect(idErrors.length).toBeGreaterThan(0);
    });

    it("should reject ObjectId with spaces", async () => {
      const result = await runParamValidation(validateObjectId, {
        id: "507f1f77bcf86cd7 9439011",
      });
      const idErrors = result.errors.filter((e) => e.path === "id");
      expect(idErrors.length).toBeGreaterThan(0);
    });

    it("should reject empty ObjectId", async () => {
      const result = await runParamValidation(validateObjectId, {
        id: "",
      });
      const idErrors = result.errors.filter((e) => e.path === "id");
      expect(idErrors.length).toBeGreaterThan(0);
    });

    it("should reject UUID format (not ObjectId)", async () => {
      const result = await runParamValidation(validateObjectId, {
        id: "550e8400-e29b-41d4-a716-446655440000",
      });
      const idErrors = result.errors.filter((e) => e.path === "id");
      expect(idErrors.length).toBeGreaterThan(0);
    });

    it("should reject plain text as ObjectId", async () => {
      const result = await runParamValidation(validateObjectId, {
        id: "not-a-valid-object-id",
      });
      const idErrors = result.errors.filter((e) => e.path === "id");
      expect(idErrors.length).toBeGreaterThan(0);
    });

    it("should reject numeric-only string (not 24 chars)", async () => {
      const result = await runParamValidation(validateObjectId, {
        id: "123456789",
      });
      const idErrors = result.errors.filter((e) => e.path === "id");
      expect(idErrors.length).toBeGreaterThan(0);
    });

    it("should reject ObjectId with leading/trailing whitespace", async () => {
      const result = await runParamValidation(validateObjectId, {
        id: " 507f1f77bcf86cd799439011 ",
      });
      const idErrors = result.errors.filter((e) => e.path === "id");
      expect(idErrors.length).toBeGreaterThan(0);
    });

    it("should reject undefined id", async () => {
      const result = await runParamValidation(validateObjectId, {});
      const idErrors = result.errors.filter((e) => e.path === "id");
      expect(idErrors.length).toBeGreaterThan(0);
    });

    it("should reject null id", async () => {
      const result = await runParamValidation(validateObjectId, {
        id: null,
      });
      const idErrors = result.errors.filter((e) => e.path === "id");
      expect(idErrors.length).toBeGreaterThan(0);
    });
  });
});

describe("handleValidationErrors", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    statusMock = vi.fn().mockReturnThis();
    jsonMock = vi.fn().mockReturnThis();

    mockReq = {
      body: {},
      query: {},
      params: {},
      method: "POST",
      originalUrl: "/api/test",
    };

    mockRes = {
      status: statusMock,
      json: jsonMock,
    } as any;

    mockNext = vi.fn() as unknown as NextFunction;
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.TEST_VALIDATION_LOG;
  });

  describe("error response formatting", () => {
    it("should return 400 status code on validation error", async () => {
      // Create a request with validation errors
      const req = {
        body: {},
        query: {},
        params: { id: "invalid" },
        cookies: {},
        get: () => undefined,
        headers: {},
        method: "GET",
        originalUrl: "/api/users/invalid",
      } as unknown as Request;

      // Run validation to add errors
      for (let i = 0; i < validateObjectId.length - 1; i++) {
        const middleware = validateObjectId[i] as (
          req: Request,
          res: Response,
          next: NextFunction,
        ) => Promise<void>;
        await middleware(
          req,
          {} as Response,
          vi.fn() as unknown as NextFunction,
        );
      }

      // Now call handleValidationErrors
      handleValidationErrors(req, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should return success: false in response body", async () => {
      const req = {
        body: {},
        query: {},
        params: { id: "invalid" },
        cookies: {},
        get: () => undefined,
        headers: {},
        method: "GET",
        originalUrl: "/api/users/invalid",
      } as unknown as Request;

      for (let i = 0; i < validateObjectId.length - 1; i++) {
        const middleware = validateObjectId[i] as (
          req: Request,
          res: Response,
          next: NextFunction,
        ) => Promise<void>;
        await middleware(
          req,
          {} as Response,
          vi.fn() as unknown as NextFunction,
        );
      }

      handleValidationErrors(req, mockRes as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        }),
      );
    });

    it("should return message: Validation failed", async () => {
      const req = {
        body: {},
        query: {},
        params: { id: "invalid" },
        cookies: {},
        get: () => undefined,
        headers: {},
        method: "GET",
        originalUrl: "/api/users/invalid",
      } as unknown as Request;

      for (let i = 0; i < validateObjectId.length - 1; i++) {
        const middleware = validateObjectId[i] as (
          req: Request,
          res: Response,
          next: NextFunction,
        ) => Promise<void>;
        await middleware(
          req,
          {} as Response,
          vi.fn() as unknown as NextFunction,
        );
      }

      handleValidationErrors(req, mockRes as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Validation failed",
        }),
      );
    });

    it("should include errors array in response", async () => {
      const req = {
        body: {},
        query: {},
        params: { id: "invalid" },
        cookies: {},
        get: () => undefined,
        headers: {},
        method: "GET",
        originalUrl: "/api/users/invalid",
      } as unknown as Request;

      for (let i = 0; i < validateObjectId.length - 1; i++) {
        const middleware = validateObjectId[i] as (
          req: Request,
          res: Response,
          next: NextFunction,
        ) => Promise<void>;
        await middleware(
          req,
          {} as Response,
          vi.fn() as unknown as NextFunction,
        );
      }

      handleValidationErrors(req, mockRes as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.any(Array),
        }),
      );
    });

    it("should not call next when there are validation errors", async () => {
      const req = {
        body: {},
        query: {},
        params: { id: "invalid" },
        cookies: {},
        get: () => undefined,
        headers: {},
        method: "GET",
        originalUrl: "/api/users/invalid",
      } as unknown as Request;

      for (let i = 0; i < validateObjectId.length - 1; i++) {
        const middleware = validateObjectId[i] as (
          req: Request,
          res: Response,
          next: NextFunction,
        ) => Promise<void>;
        await middleware(
          req,
          {} as Response,
          vi.fn() as unknown as NextFunction,
        );
      }

      handleValidationErrors(req, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should call next when there are no validation errors", async () => {
      const req = {
        body: {},
        query: {},
        params: { id: "507f1f77bcf86cd799439011" }, // Valid ObjectId
        cookies: {},
        get: () => undefined,
        headers: {},
        method: "GET",
        originalUrl: "/api/users/507f1f77bcf86cd799439011",
      } as unknown as Request;

      for (let i = 0; i < validateObjectId.length - 1; i++) {
        const middleware = validateObjectId[i] as (
          req: Request,
          res: Response,
          next: NextFunction,
        ) => Promise<void>;
        await middleware(
          req,
          {} as Response,
          vi.fn() as unknown as NextFunction,
        );
      }

      handleValidationErrors(req, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
      expect(jsonMock).not.toHaveBeenCalled();
    });
  });

  describe("diagnostic logging (TEST_VALIDATION_LOG=1)", () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = "test";
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      delete process.env.TEST_VALIDATION_LOG;
    });

    it("should log diagnostics when TEST_VALIDATION_LOG=1", async () => {
      process.env.TEST_VALIDATION_LOG = "1";
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const req = {
        body: { title: "Test" },
        query: {},
        params: { id: "invalid" },
        cookies: {},
        get: () => undefined,
        headers: {},
        method: "POST",
        originalUrl: "/api/events",
      } as unknown as Request;

      for (let i = 0; i < validateObjectId.length - 1; i++) {
        const middleware = validateObjectId[i] as (
          req: Request,
          res: Response,
          next: NextFunction,
        ) => Promise<void>;
        await middleware(
          req,
          {} as Response,
          vi.fn() as unknown as NextFunction,
        );
      }

      handleValidationErrors(req, mockRes as Response, mockNext);

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        "[VALIDATION]",
        "POST",
        "/api/events",
        expect.any(String),
      );

      consoleSpy.mockRestore();
    });

    it("should not log diagnostics when TEST_VALIDATION_LOG is not set", async () => {
      delete process.env.TEST_VALIDATION_LOG;
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const req = {
        body: {},
        query: {},
        params: { id: "invalid" },
        cookies: {},
        get: () => undefined,
        headers: {},
        method: "POST",
        originalUrl: "/api/events",
      } as unknown as Request;

      for (let i = 0; i < validateObjectId.length - 1; i++) {
        const middleware = validateObjectId[i] as (
          req: Request,
          res: Response,
          next: NextFunction,
        ) => Promise<void>;
        await middleware(
          req,
          {} as Response,
          vi.fn() as unknown as NextFunction,
        );
      }

      handleValidationErrors(req, mockRes as Response, mockNext);

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should log roles information in diagnostics", async () => {
      process.env.TEST_VALIDATION_LOG = "1";
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const req = {
        body: {
          title: "Event",
          roles: [
            {
              name: "Speaker",
              maxParticipants: 5,
              description: "Presents topics",
            },
            { name: "Attendee", maxParticipants: 50, description: "Listens" },
          ],
        },
        query: {},
        params: { id: "invalid" },
        cookies: {},
        get: () => undefined,
        headers: {},
        method: "POST",
        originalUrl: "/api/events",
      } as unknown as Request;

      for (let i = 0; i < validateObjectId.length - 1; i++) {
        const middleware = validateObjectId[i] as (
          req: Request,
          res: Response,
          next: NextFunction,
        ) => Promise<void>;
        await middleware(
          req,
          {} as Response,
          vi.fn() as unknown as NextFunction,
        );
      }

      handleValidationErrors(req, mockRes as Response, mockNext);

      expect(consoleSpy).toHaveBeenCalled();
      const loggedData = consoleSpy.mock.calls[0][3];
      expect(loggedData).toContain("roles");

      consoleSpy.mockRestore();
    });

    it("should include event-related fields in diagnostics preview", async () => {
      process.env.TEST_VALIDATION_LOG = "1";
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const req = {
        body: {
          title: "Test Event",
          type: "Conference",
          date: "2030-01-01",
          endDate: "2030-01-01",
          time: "10:00",
          endTime: "12:00",
          location: "Room A",
          format: "In-person",
          purpose: "Test purpose",
          agenda: "Test agenda",
          organizer: "Test Org",
        },
        query: {},
        params: { id: "invalid" },
        cookies: {},
        get: () => undefined,
        headers: {},
        method: "POST",
        originalUrl: "/api/events",
      } as unknown as Request;

      for (let i = 0; i < validateObjectId.length - 1; i++) {
        const middleware = validateObjectId[i] as (
          req: Request,
          res: Response,
          next: NextFunction,
        ) => Promise<void>;
        await middleware(
          req,
          {} as Response,
          vi.fn() as unknown as NextFunction,
        );
      }

      handleValidationErrors(req, mockRes as Response, mockNext);

      expect(consoleSpy).toHaveBeenCalled();
      const loggedData = consoleSpy.mock.calls[0][3];
      expect(loggedData).toContain("title");
      expect(loggedData).toContain("Test Event");
      expect(loggedData).toContain("type");
      expect(loggedData).toContain("Conference");

      consoleSpy.mockRestore();
    });

    it("should handle logging errors gracefully", async () => {
      process.env.TEST_VALIDATION_LOG = "1";

      // Create a mock that throws on first call (simulating logging error)
      let callCount = 0;
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Logging failed");
        }
      });

      const req = {
        body: { title: "Test" },
        query: {},
        params: { id: "invalid" },
        cookies: {},
        get: () => undefined,
        headers: {},
        method: "POST",
        originalUrl: "/api/events",
      } as unknown as Request;

      for (let i = 0; i < validateObjectId.length - 1; i++) {
        const middleware = validateObjectId[i] as (
          req: Request,
          res: Response,
          next: NextFunction,
        ) => Promise<void>;
        await middleware(
          req,
          {} as Response,
          vi.fn() as unknown as NextFunction,
        );
      }

      // Should not throw even if logging fails
      expect(() => {
        handleValidationErrors(req, mockRes as Response, mockNext);
      }).not.toThrow();

      // Should still send the response
      expect(statusMock).toHaveBeenCalledWith(400);

      consoleSpy.mockRestore();
    });
  });

  describe("multiple validation errors", () => {
    it("should include all validation errors in response", async () => {
      // Import validateEventCreation for testing multiple errors
      const { validateEventCreation } =
        await import("../../../src/middleware/validation");

      const req = {
        body: {
          title: "AB", // too short
          date: "invalid",
          time: "25:00",
          type: "Invalid",
          format: "Unknown",
          organizer: "X",
          roles: [],
        },
        query: {},
        params: {},
        cookies: {},
        get: () => undefined,
        headers: {},
        method: "POST",
        originalUrl: "/api/events",
      } as unknown as Request;

      // Run all validators except the last (error handler)
      for (let i = 0; i < validateEventCreation.length - 1; i++) {
        const middleware = validateEventCreation[i] as (
          req: Request,
          res: Response,
          next: NextFunction,
        ) => Promise<void>;
        await middleware(
          req,
          {} as Response,
          vi.fn() as unknown as NextFunction,
        );
      }

      handleValidationErrors(req, mockRes as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({ path: "title" }),
            expect.objectContaining({ path: "date" }),
            expect.objectContaining({ path: "time" }),
          ]),
        }),
      );
    });

    it("should handle validation for nested fields like roles.*", async () => {
      const { validateEventCreation } =
        await import("../../../src/middleware/validation");

      const req = {
        body: {
          title: "Valid Title",
          date: "2030-06-15",
          time: "14:00",
          endTime: "16:00",
          type: "Conference",
          format: "In-person",
          organizer: "Valid Org",
          roles: [
            { name: "X", maxParticipants: 0 }, // name too short, max too low
          ],
        },
        query: {},
        params: {},
        cookies: {},
        get: () => undefined,
        headers: {},
        method: "POST",
        originalUrl: "/api/events",
      } as unknown as Request;

      for (let i = 0; i < validateEventCreation.length - 1; i++) {
        const middleware = validateEventCreation[i] as (
          req: Request,
          res: Response,
          next: NextFunction,
        ) => Promise<void>;
        await middleware(
          req,
          {} as Response,
          vi.fn() as unknown as NextFunction,
        );
      }

      handleValidationErrors(req, mockRes as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({ path: "roles[0].name" }),
            expect.objectContaining({ path: "roles[0].maxParticipants" }),
          ]),
        }),
      );
    });
  });
});
