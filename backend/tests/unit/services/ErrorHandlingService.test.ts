import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import {
  ErrorHandlingService,
  AppError,
  ErrorType,
  createValidationError,
  createAuthenticationError,
  createAuthorizationError,
  createNotFoundError,
  createConflictError,
  createDatabaseError,
  createRateLimitError,
  asyncHandler,
  handleValidationResult,
} from "../../../src/services/ErrorHandlingService";

// Mock the logger service
vi.mock("../../../src/services/LoggerService", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("ErrorHandlingService", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      method: "GET",
      path: "/test",
      url: "/test",
      ip: "127.0.0.1",
      get: vi.fn().mockReturnValue("test-user-agent"),
      body: {},
      params: {},
      query: {},
      headers: { "x-request-id": "test-request-id" },
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    mockNext = vi.fn() as unknown as NextFunction;

    // Clear environment variables
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AppError class", () => {
    it("should create an AppError with all properties", () => {
      const error = new AppError(
        ErrorType.VALIDATION_ERROR,
        "Test error",
        400,
        { field: "email" },
        "email",
        "INVALID_EMAIL"
      );

      expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: "email" });
      expect(error.field).toBe("email");
      expect(error.code).toBe("INVALID_EMAIL");
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe("AppError");
    });

    it("should use default status code of 500", () => {
      const error = new AppError(ErrorType.INTERNAL_SERVER_ERROR, "Test error");

      expect(error.statusCode).toBe(500);
    });

    it("should maintain proper stack trace", () => {
      const error = new AppError(ErrorType.VALIDATION_ERROR, "Test error");

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("AppError");
    });

    describe("toJSON method", () => {
      it("should return error details without stack in production", () => {
        process.env.NODE_ENV = "production";
        const error = new AppError(
          ErrorType.VALIDATION_ERROR,
          "Test error",
          400,
          { field: "email" },
          "email",
          "INVALID_EMAIL"
        );

        const json = error.toJSON();

        expect(json).toEqual({
          type: ErrorType.VALIDATION_ERROR,
          message: "Test error",
          statusCode: 400,
          details: { field: "email" },
          field: "email",
          code: "INVALID_EMAIL",
          stack: undefined,
        });
      });

      it("should include stack in development environment", () => {
        process.env.NODE_ENV = "development";
        const error = new AppError(ErrorType.VALIDATION_ERROR, "Test error");

        const json = error.toJSON();

        expect(json.stack).toBeDefined();
        expect(typeof json.stack).toBe("string");
      });
    });
  });

  describe("Error creation methods", () => {
    it("should create validation error", () => {
      const error = ErrorHandlingService.createValidationError(
        "Invalid input",
        "email",
        { reason: "format" }
      );

      expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(error.message).toBe("Invalid input");
      expect(error.statusCode).toBe(400);
      expect(error.field).toBe("email");
      expect(error.details).toEqual({ reason: "format" });
      expect(error.code).toBe("VALIDATION_FAILED");
    });

    it("should create authentication error with default message", () => {
      const error = ErrorHandlingService.createAuthenticationError();

      expect(error.type).toBe(ErrorType.AUTHENTICATION_ERROR);
      expect(error.message).toBe("Authentication required");
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe("AUTH_REQUIRED");
    });

    it("should create authentication error with custom message", () => {
      const error = ErrorHandlingService.createAuthenticationError(
        "Invalid credentials",
        { attempts: 3 }
      );

      expect(error.message).toBe("Invalid credentials");
      expect(error.details).toEqual({ attempts: 3 });
    });

    it("should create authorization error with default message", () => {
      const error = ErrorHandlingService.createAuthorizationError();

      expect(error.type).toBe(ErrorType.AUTHORIZATION_ERROR);
      expect(error.message).toBe("Insufficient permissions");
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe("ACCESS_DENIED");
    });

    it("should create authorization error with custom message", () => {
      const error = ErrorHandlingService.createAuthorizationError(
        "Admin access required",
        { role: "user", required: "admin" }
      );

      expect(error.message).toBe("Admin access required");
      expect(error.details).toEqual({ role: "user", required: "admin" });
    });

    it("should create not found error with resource name", () => {
      const error = ErrorHandlingService.createNotFoundError("User");

      expect(error.type).toBe(ErrorType.NOT_FOUND_ERROR);
      expect(error.message).toBe("User not found");
      expect(error.statusCode).toBe(404);
      expect(error.details).toEqual({ resource: "User", id: undefined });
      expect(error.code).toBe("NOT_FOUND");
    });

    it("should create not found error with resource and ID", () => {
      const error = ErrorHandlingService.createNotFoundError("User", "123");

      expect(error.message).toBe("User with ID 123 not found");
      expect(error.details).toEqual({ resource: "User", id: "123" });
    });

    it("should create conflict error", () => {
      const error = ErrorHandlingService.createConflictError(
        "Email already exists",
        { field: "email", value: "test@example.com" }
      );

      expect(error.type).toBe(ErrorType.CONFLICT_ERROR);
      expect(error.message).toBe("Email already exists");
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe("CONFLICT");
      expect(error.details).toEqual({
        field: "email",
        value: "test@example.com",
      });
    });

    it("should create database error", () => {
      const originalError = new Error("Connection timeout");
      const error = ErrorHandlingService.createDatabaseError(
        "Database operation failed",
        originalError,
        "find"
      );

      expect(error.type).toBe(ErrorType.DATABASE_ERROR);
      expect(error.message).toBe("Database operation failed");
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe("DATABASE_ERROR");
      expect(error.details).toEqual({
        originalError: "Connection timeout",
        operation: "find",
      });
    });

    it("should create rate limit error with default message", () => {
      const error = ErrorHandlingService.createRateLimitError();

      expect(error.type).toBe(ErrorType.RATE_LIMIT_ERROR);
      expect(error.message).toBe("Too many requests");
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe("RATE_LIMIT_EXCEEDED");
    });

    it("should create rate limit error with retry after", () => {
      const error = ErrorHandlingService.createRateLimitError(
        "Rate limit exceeded",
        60
      );

      expect(error.message).toBe("Rate limit exceeded");
      expect(error.details).toEqual({ retryAfter: 60 });
    });
  });

  describe("parseMongoError", () => {
    it("should parse duplicate key error", () => {
      const mongoError = {
        code: 11000,
        keyValue: { email: "test@example.com" },
      };

      const error = ErrorHandlingService.parseMongoError(mongoError);

      expect(error.type).toBe(ErrorType.CONFLICT_ERROR);
      expect(error.message).toBe("email 'test@example.com' already exists");
      expect(error.details).toEqual({
        field: "email",
        value: "test@example.com",
      });
    });

    it("should parse validation error", () => {
      const mongoError = {
        name: "ValidationError",
        errors: {
          email: {
            path: "email",
            message: "Email is required",
            value: null,
          },
          name: {
            path: "name",
            message: "Name is too short",
            value: "a",
          },
        },
      };

      const error = ErrorHandlingService.parseMongoError(mongoError);

      expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(error.message).toBe("Validation failed");
      expect(error.details.errors).toHaveLength(2);
      expect(error.details.errors[0]).toEqual({
        field: "email",
        message: "Email is required",
        value: null,
      });
    });

    it("should parse cast error", () => {
      const mongoError = {
        name: "CastError",
        path: "userId",
        value: "invalid-id",
      };

      const error = ErrorHandlingService.parseMongoError(mongoError);

      expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(error.message).toBe("Invalid userId: invalid-id");
      expect(error.field).toBe("userId");
    });

    it("should parse generic mongo error", () => {
      const mongoError = {
        name: "MongoError",
        message: "Connection failed",
      };

      const error = ErrorHandlingService.parseMongoError(mongoError);

      expect(error.type).toBe(ErrorType.DATABASE_ERROR);
      expect(error.message).toBe("Database operation failed");
    });
  });

  describe("parseJWTError", () => {
    it("should parse token expired error", () => {
      const jwtError = { name: "TokenExpiredError" };

      const error = ErrorHandlingService.parseJWTError(jwtError);

      expect(error.type).toBe(ErrorType.AUTHENTICATION_ERROR);
      expect(error.message).toBe("Token has expired");
    });

    it("should parse invalid token error", () => {
      const jwtError = { name: "JsonWebTokenError" };

      const error = ErrorHandlingService.parseJWTError(jwtError);

      expect(error.message).toBe("Invalid token");
    });

    it("should parse token not before error", () => {
      const jwtError = { name: "NotBeforeError" };

      const error = ErrorHandlingService.parseJWTError(jwtError);

      expect(error.message).toBe("Token not active");
    });

    it("should parse generic JWT error", () => {
      const jwtError = { name: "SomeOtherTokenError" };

      const error = ErrorHandlingService.parseJWTError(jwtError);

      expect(error.message).toBe("Token validation failed");
    });
  });

  describe("handleError", () => {
    it("should return AppError as is", () => {
      const appError = new AppError(ErrorType.VALIDATION_ERROR, "Test error");

      const result = ErrorHandlingService.handleError(appError);

      expect(result).toBe(appError);
    });

    it("should handle MongoDB errors", () => {
      const mongoError = { code: 11000, keyValue: { email: "test@test.com" } };

      const result = ErrorHandlingService.handleError(mongoError);

      expect(result.type).toBe(ErrorType.CONFLICT_ERROR);
    });

    it("should handle JWT errors", () => {
      const jwtError = { name: "TokenExpiredError" };

      const result = ErrorHandlingService.handleError(jwtError);

      expect(result.type).toBe(ErrorType.AUTHENTICATION_ERROR);
    });

    it("should handle HTTP status errors", () => {
      const httpError = { status: 404, message: "Route not found" };

      const result = ErrorHandlingService.handleError(httpError);

      expect(result.type).toBe(ErrorType.NOT_FOUND_ERROR);
      expect(result.statusCode).toBe(404);
      expect(result.message).toBe("Route not found");
    });

    it("should handle statusCode property", () => {
      const httpError = { statusCode: 400, message: "Bad request" };

      const result = ErrorHandlingService.handleError(httpError);

      expect(result.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(result.statusCode).toBe(400);
    });

    it("should handle unknown errors as internal server error", () => {
      const unknownError = new Error("Something went wrong");

      const result = ErrorHandlingService.handleError(unknownError);

      expect(result.type).toBe(ErrorType.INTERNAL_SERVER_ERROR);
      expect(result.statusCode).toBe(500);
      expect(result.message).toBe("Something went wrong");
    });

    it("should handle errors without message", () => {
      const unknownError = {};

      const result = ErrorHandlingService.handleError(unknownError);

      expect(result.message).toBe("An unexpected error occurred");
    });
  });

  describe("errorHandler middleware", () => {
    it("should handle error and send response", () => {
      const error = new Error("Test error");
      const middleware = ErrorHandlingService.errorHandler();

      middleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          type: ErrorType.INTERNAL_SERVER_ERROR,
          message: "Test error",
          code: undefined,
          details: { originalError: "Test error" },
        },
        timestamp: expect.any(String),
        requestId: "test-request-id",
      });
    });

    it("should handle AppError with all details", () => {
      const error = new AppError(
        ErrorType.VALIDATION_ERROR,
        "Validation failed",
        400,
        { errors: ["email required"] },
        "email",
        "VALIDATION_FAILED"
      );
      const middleware = ErrorHandlingService.errorHandler();

      middleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          type: ErrorType.VALIDATION_ERROR,
          message: "Validation failed",
          code: "VALIDATION_FAILED",
          field: "email",
          details: { errors: ["email required"] },
        },
        timestamp: expect.any(String),
        requestId: "test-request-id",
      });
    });

    it("should include stack trace in development", () => {
      process.env.NODE_ENV = "development";
      const error = new AppError(ErrorType.VALIDATION_ERROR, "Test error");
      const middleware = ErrorHandlingService.errorHandler();

      middleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const responseCall = (mockResponse.json as any).mock.calls[0][0];
      expect(responseCall.error.stack).toBeDefined();
    });

    it("should use default request ID when header missing", () => {
      mockRequest.headers = {};
      const error = new Error("Test error");
      const middleware = ErrorHandlingService.errorHandler();

      middleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const responseCall = (mockResponse.json as any).mock.calls[0][0];
      expect(responseCall.requestId).toBe("unknown");
    });
  });

  describe("notFoundHandler middleware", () => {
    it("should create and pass not found error", () => {
      const middleware = ErrorHandlingService.notFoundHandler();

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.NOT_FOUND_ERROR,
          message: "Route with ID GET /test not found",
          statusCode: 404,
        })
      );
    });
  });

  describe("asyncHandler", () => {
    it("should handle successful async operation", async () => {
      const asyncFn = async (
        req: Request,
        res: Response,
        next: NextFunction
      ) => {
        res.json({ success: true });
      };
      const wrappedFn = ErrorHandlingService.asyncHandler(asyncFn);

      await wrappedFn(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should catch and pass errors to next", async () => {
      const error = new Error("Async error");
      const asyncFn = async (
        req: Request,
        res: Response,
        next: NextFunction
      ) => {
        throw error;
      };
      const wrappedFn = ErrorHandlingService.asyncHandler(asyncFn);

      await wrappedFn(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe("handleValidationResult", () => {
    it("should do nothing when validation is valid", () => {
      const validationResult = { isValid: true, errors: [] };

      expect(() => {
        ErrorHandlingService.handleValidationResult(validationResult);
      }).not.toThrow();
    });

    it("should throw validation error when invalid", () => {
      const validationResult = {
        isValid: false,
        errors: ["Email is required", "Password too short"],
      };

      expect(() => {
        ErrorHandlingService.handleValidationResult(validationResult);
      }).toThrow(AppError);

      try {
        ErrorHandlingService.handleValidationResult(validationResult);
      } catch (error) {
        expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
        expect(error.message).toBe("Email is required, Password too short");
        expect(error.details.errors).toEqual([
          "Email is required",
          "Password too short",
        ]);
      }
    });
  });

  describe("safeAsync", () => {
    it("should return success result for successful operation", async () => {
      const operation = async () => ({ data: "success" });

      const result = await ErrorHandlingService.safeAsync(
        operation,
        "test context"
      );

      expect(result).toEqual({
        success: true,
        data: { data: "success" },
      });
    });

    it("should return error result for failed operation", async () => {
      const operation = async () => {
        throw new Error("Operation failed");
      };

      const result = await ErrorHandlingService.safeAsync(
        operation,
        "test context"
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AppError);
        expect(result.error.message).toBe("Operation failed");
      }
    });
  });

  describe("createErrorResponse", () => {
    it("should create error response format", () => {
      const error = new AppError(ErrorType.VALIDATION_ERROR, "Test error", 400);

      const response = ErrorHandlingService.createErrorResponse(
        error,
        "req-123"
      );

      expect(response).toEqual({
        success: false,
        error: {
          type: ErrorType.VALIDATION_ERROR,
          message: "Test error",
          statusCode: 400,
          details: undefined,
          field: undefined,
          code: undefined,
          stack: undefined,
          requestId: "req-123",
          timestamp: expect.any(String),
        },
      });
    });

    it("should create error response without request ID", () => {
      const error = new AppError(ErrorType.VALIDATION_ERROR, "Test error");

      const response = ErrorHandlingService.createErrorResponse(error);

      expect(response.error.requestId).toBeUndefined();
    });
  });

  describe("isOperationalError", () => {
    it("should return true for AppError", () => {
      const error = new AppError(ErrorType.VALIDATION_ERROR, "Test error");

      expect(ErrorHandlingService.isOperationalError(error)).toBe(true);
    });

    it("should return false for regular Error", () => {
      const error = new Error("Regular error");

      expect(ErrorHandlingService.isOperationalError(error)).toBe(false);
    });

    it("should return false for non-error objects", () => {
      expect(ErrorHandlingService.isOperationalError({})).toBe(false);
      expect(ErrorHandlingService.isOperationalError(null)).toBe(false);
    });
  });

  describe("exported convenience functions", () => {
    it("should export createValidationError", () => {
      const error = createValidationError("Test validation error");
      expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
    });

    it("should export createAuthenticationError", () => {
      const error = createAuthenticationError("Test auth error");
      expect(error.type).toBe(ErrorType.AUTHENTICATION_ERROR);
    });

    it("should export createAuthorizationError", () => {
      const error = createAuthorizationError("Test authz error");
      expect(error.type).toBe(ErrorType.AUTHORIZATION_ERROR);
    });

    it("should export createNotFoundError", () => {
      const error = createNotFoundError("User");
      expect(error.type).toBe(ErrorType.NOT_FOUND_ERROR);
    });

    it("should export createConflictError", () => {
      const error = createConflictError("Test conflict");
      expect(error.type).toBe(ErrorType.CONFLICT_ERROR);
    });

    it("should export createDatabaseError", () => {
      const error = createDatabaseError("Test DB error");
      expect(error.type).toBe(ErrorType.DATABASE_ERROR);
    });

    it("should export createRateLimitError", () => {
      const error = createRateLimitError("Test rate limit");
      expect(error.type).toBe(ErrorType.RATE_LIMIT_ERROR);
    });

    it("should export asyncHandler", () => {
      expect(typeof asyncHandler).toBe("function");
    });

    it("should export handleValidationResult", () => {
      expect(typeof handleValidationResult).toBe("function");
    });
  });
});
