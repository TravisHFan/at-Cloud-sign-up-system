/**
 * responseHelper.test.ts
 *
 * Unit tests for ResponseHelper utility class.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Response } from "express";
import { ResponseHelper } from "../../../src/utils/responseHelper";

// Mock the LoggerService
vi.mock("../../../src/services/LoggerService", () => ({
  createLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("ResponseHelper", () => {
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    mockRes = {
      status: statusMock as unknown as Response["status"],
      json: jsonMock as unknown as Response["json"],
    };
  });

  describe("success", () => {
    it("should send success response with default status 200", () => {
      ResponseHelper.success(mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ success: true });
    });

    it("should send success response with data", () => {
      const data = { id: 123, name: "Test" };
      ResponseHelper.success(mockRes as Response, data);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ success: true, data });
    });

    it("should send success response with message", () => {
      ResponseHelper.success(
        mockRes as Response,
        undefined,
        "Operation successful"
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "Operation successful",
      });
    });

    it("should send success response with data and message", () => {
      const data = { result: "value" };
      ResponseHelper.success(mockRes as Response, data, "Success");

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "Success",
        data,
      });
    });

    it("should send success response with custom status code", () => {
      ResponseHelper.success(mockRes as Response, { id: 1 }, "Created", 201);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "Created",
        data: { id: 1 },
      });
    });

    it("should handle null data", () => {
      ResponseHelper.success(mockRes as Response, null);

      expect(jsonMock).toHaveBeenCalledWith({ success: true, data: null });
    });

    it("should handle empty array data", () => {
      ResponseHelper.success(mockRes as Response, []);

      expect(jsonMock).toHaveBeenCalledWith({ success: true, data: [] });
    });
  });

  describe("error", () => {
    it("should send error response with default status 400", () => {
      ResponseHelper.error(mockRes as Response, "Bad request");

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Bad request",
      });
    });

    it("should send error response with custom status code", () => {
      ResponseHelper.error(mockRes as Response, "Conflict", 409);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Conflict",
      });
    });

    it("should log error with Error object", () => {
      const error = new Error("Internal failure");
      ResponseHelper.error(mockRes as Response, "Server error", 500, error);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Server error",
      });
    });

    it("should handle non-Error error object", () => {
      const error = { code: "INVALID", reason: "test" };
      ResponseHelper.error(mockRes as Response, "Error occurred", 400, error);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Error occurred",
      });
    });
  });

  describe("badRequest", () => {
    it("should send 400 Bad Request response", () => {
      ResponseHelper.badRequest(mockRes as Response, "Invalid input");

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid input",
      });
    });
  });

  describe("authRequired", () => {
    it("should send 401 Unauthorized response", () => {
      ResponseHelper.authRequired(mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });
  });

  describe("forbidden", () => {
    it("should send 403 Forbidden response with default message", () => {
      ResponseHelper.forbidden(mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Access denied.",
      });
    });

    it("should send 403 Forbidden response with custom message", () => {
      ResponseHelper.forbidden(
        mockRes as Response,
        "You cannot access this resource"
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "You cannot access this resource",
      });
    });
  });

  describe("notFound", () => {
    it("should send 404 Not Found response with default message", () => {
      ResponseHelper.notFound(mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Resource not found.",
      });
    });

    it("should send 404 Not Found response with custom message", () => {
      ResponseHelper.notFound(mockRes as Response, "Event not found");

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Event not found",
      });
    });
  });

  describe("serverError", () => {
    it("should send 500 Internal Server Error response", () => {
      ResponseHelper.serverError(mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error.",
      });
    });

    it("should send 500 response with error logging", () => {
      const error = new Error("Database connection failed");
      ResponseHelper.serverError(mockRes as Response, error);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error.",
      });
    });
  });

  describe("internalServerError", () => {
    it("should send 500 response with default message", () => {
      ResponseHelper.internalServerError(mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error.",
      });
    });

    it("should send 500 response with custom message", () => {
      ResponseHelper.internalServerError(
        mockRes as Response,
        "Service unavailable"
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Service unavailable",
      });
    });
  });
});
