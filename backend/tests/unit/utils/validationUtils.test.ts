import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import { ValidationUtils } from "../../../src/utils/validationUtils";
import { createErrorResponse } from "../../../src/types/api";

// Mock the createErrorResponse function
vi.mock("../../../src/types/api", () => ({
  createErrorResponse: vi.fn((message, statusCode) => ({
    success: false,
    message,
    statusCode,
  })),
}));

// Mock mongoose
vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("mongoose")>();
  return {
    ...actual,
    default: {
      ...actual.default,
      Types: {
        ...actual.default.Types,
        ObjectId: {
          ...actual.default.Types.ObjectId,
          isValid: vi.fn(),
        },
      },
    },
    Types: {
      ...actual.Types,
      ObjectId: {
        ...actual.Types.ObjectId,
        isValid: vi.fn(),
      },
    },
  };
});

// Import mocked functions
import mongoose from "mongoose";
const mockObjectIdIsValid = vi.mocked(mongoose.Types.ObjectId.isValid);
const mockCreateErrorResponse = vi.mocked(createErrorResponse);

describe("ValidationUtils", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockStatus: any;
  let mockJson: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock Express objects
    mockStatus = vi.fn().mockReturnThis();
    mockJson = vi.fn().mockReturnThis();

    mockResponse = {
      status: mockStatus,
      json: mockJson,
    };

    mockRequest = {
      body: {},
      query: {},
    };
  });

  describe("validateRequiredFields", () => {
    it("should return valid when all required fields are present", () => {
      // Arrange
      mockRequest.body = {
        username: "testuser",
        email: "test@example.com",
        password: "password123",
      };

      // Act
      const result = ValidationUtils.validateRequiredFields(
        mockRequest as Request,
        mockResponse as Response,
        ["username", "email", "password"]
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.missingFields).toBeUndefined();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it("should return invalid and send 400 response when fields are missing", () => {
      // Arrange
      mockRequest.body = {
        username: "testuser",
        // email missing
        // password missing
      };

      // Act
      const result = ValidationUtils.validateRequiredFields(
        mockRequest as Request,
        mockResponse as Response,
        ["username", "email", "password"]
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.missingFields).toEqual(["email", "password"]);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Missing required fields: email, password",
          statusCode: 400,
        })
      );
    });

    it("should detect null values as missing", () => {
      // Arrange
      mockRequest.body = {
        username: "testuser",
        email: null,
        password: "password123",
      };

      // Act
      const result = ValidationUtils.validateRequiredFields(
        mockRequest as Request,
        mockResponse as Response,
        ["username", "email", "password"]
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.missingFields).toEqual(["email"]);
    });

    it("should detect undefined values as missing", () => {
      // Arrange
      mockRequest.body = {
        username: "testuser",
        email: undefined,
        password: "password123",
      };

      // Act
      const result = ValidationUtils.validateRequiredFields(
        mockRequest as Request,
        mockResponse as Response,
        ["username", "email", "password"]
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.missingFields).toEqual(["email"]);
    });

    it("should detect empty strings as missing", () => {
      // Arrange
      mockRequest.body = {
        username: "testuser",
        email: "   ", // whitespace only
        password: "", // empty string
      };

      // Act
      const result = ValidationUtils.validateRequiredFields(
        mockRequest as Request,
        mockResponse as Response,
        ["username", "email", "password"]
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.missingFields).toEqual(["email", "password"]);
    });

    it("should handle empty fields array", () => {
      // Arrange
      mockRequest.body = {};

      // Act
      const result = ValidationUtils.validateRequiredFields(
        mockRequest as Request,
        mockResponse as Response,
        []
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.missingFields).toBeUndefined();
    });
  });

  describe("validateEmail", () => {
    it("should return true for valid email addresses", () => {
      const validEmails = [
        "test@example.com",
        "user.name@domain.co.uk",
        "user+tag@example.org",
        "123@example.com",
        "test@subdomain.example.com",
      ];

      validEmails.forEach((email) => {
        expect(ValidationUtils.validateEmail(email)).toBe(true);
      });
    });

    it("should return false for invalid email addresses", () => {
      const invalidEmails = [
        "",
        "invalid",
        "@example.com",
        "test@",
        "test.example.com",
        "test @example.com", // space
        "test@.com",
        "test@com",
        "test@@example.com",
      ];

      invalidEmails.forEach((email) => {
        expect(ValidationUtils.validateEmail(email)).toBe(false);
      });
    });
  });

  describe("validatePassword", () => {
    it("should return valid for strong passwords", () => {
      const strongPasswords = [
        "Password123",
        "MyStrongP@ss1",
        "Complex1Password",
        "Aa1bcdefgh",
      ];

      strongPasswords.forEach((password) => {
        const result = ValidationUtils.validatePassword(password);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });
    });

    it("should reject passwords that are too short", () => {
      const result = ValidationUtils.validatePassword("Aa1");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Password must be at least 8 characters long"
      );
    });

    it("should reject passwords without lowercase letters", () => {
      const result = ValidationUtils.validatePassword("PASSWORD123");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Password must contain at least one lowercase letter"
      );
    });

    it("should reject passwords without uppercase letters", () => {
      const result = ValidationUtils.validatePassword("password123");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Password must contain at least one uppercase letter"
      );
    });

    it("should reject passwords without numbers", () => {
      const result = ValidationUtils.validatePassword("PasswordOnly");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Password must contain at least one number"
      );
    });

    it("should accumulate multiple validation errors", () => {
      const result = ValidationUtils.validatePassword("weak");
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3); // Only 3 errors: length, uppercase, number (not lowercase - "weak" has lowercase)
      expect(result.errors).toContain(
        "Password must be at least 8 characters long"
      );
      expect(result.errors).toContain(
        "Password must contain at least one uppercase letter"
      );
      expect(result.errors).toContain(
        "Password must contain at least one number"
      );
    });
  });

  describe("validatePhone", () => {
    it("should return true for valid phone numbers", () => {
      const validPhones = [
        "1234567890", // 10 digits starting with 1
        "+1234567890", // with +
        "+447123456789", // UK format (11 digits)
        "9876543210", // 10 digits starting with 9
        "123", // short but valid (3 digits starting with 1)
      ];

      validPhones.forEach((phone) => {
        expect(ValidationUtils.validatePhone(phone)).toBe(true);
      });
    });

    it("should return true for phone numbers with formatting characters", () => {
      const formattedPhones = [
        "123-456-7890",
        "(123) 456-7890",
        "123 456 7890",
        "+1 (123) 456-7890",
        "+1-123-456-7890",
      ];

      formattedPhones.forEach((phone) => {
        expect(ValidationUtils.validatePhone(phone)).toBe(true);
      });
    });

    it("should return false for invalid phone numbers", () => {
      const invalidPhones = [
        "",
        "abc123",
        "0123456789", // starts with 0
        "+0123456789", // starts with 0 after +
        "+12345678901234567890", // too long (17 digits after +)
        "+",
        "++1234567890",
      ];

      invalidPhones.forEach((phone) => {
        expect(ValidationUtils.validatePhone(phone)).toBe(false);
      });
    });
  });

  describe("validateObjectId", () => {
    it("should return true for valid ObjectId", () => {
      // Arrange
      mockObjectIdIsValid.mockReturnValue(true);

      // Act
      const result = ValidationUtils.validateObjectId(
        "507f1f77bcf86cd799439011"
      );

      // Assert
      expect(result).toBe(true);
      expect(mockObjectIdIsValid).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011"
      );
    });

    it("should return false for invalid ObjectId", () => {
      // Arrange
      mockObjectIdIsValid.mockReturnValue(false);

      // Act
      const result = ValidationUtils.validateObjectId("invalid-id");

      // Assert
      expect(result).toBe(false);
      expect(mockObjectIdIsValid).toHaveBeenCalledWith("invalid-id");
    });
  });

  describe("validatePaginationParams", () => {
    it("should return default values for empty query", () => {
      // Arrange
      mockRequest.query = {};

      // Act
      const result = ValidationUtils.validatePaginationParams(
        mockRequest as Request
      );

      // Assert
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.skip).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it("should parse valid pagination parameters", () => {
      // Arrange
      mockRequest.query = { page: "3", limit: "15" };

      // Act
      const result = ValidationUtils.validatePaginationParams(
        mockRequest as Request
      );

      // Assert
      expect(result.page).toBe(3);
      expect(result.limit).toBe(15);
      expect(result.skip).toBe(30); // (3-1) * 15
      expect(result.errors).toEqual([]);
    });

    it("should handle invalid page numbers", () => {
      // Arrange - using negative numbers that will actually trigger the < 1 condition
      mockRequest.query = { page: "-1", limit: "10" };

      // Act
      const result = ValidationUtils.validatePaginationParams(
        mockRequest as Request
      );

      // Assert
      expect(result.page).toBe(1); // corrected to 1
      expect(result.limit).toBe(10);
      expect(result.skip).toBe(0);
      expect(result.errors).toContain("Page number must be greater than 0");
    });

    it("should handle invalid limit values", () => {
      // Arrange - using negative numbers that will actually trigger the < 1 condition
      mockRequest.query = { page: "1", limit: "-5" };

      // Act
      const result = ValidationUtils.validatePaginationParams(
        mockRequest as Request
      );

      // Assert
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20); // corrected to default
      expect(result.skip).toBe(0);
      expect(result.errors).toContain("Limit must be greater than 0");
    });

    it("should cap limit at maximum value", () => {
      // Arrange
      mockRequest.query = { page: "1", limit: "150" };

      // Act
      const result = ValidationUtils.validatePaginationParams(
        mockRequest as Request
      );

      // Assert
      expect(result.page).toBe(1);
      expect(result.limit).toBe(100); // capped at 100
      expect(result.skip).toBe(0);
      expect(result.errors).toContain("Limit cannot exceed 100");
    });

    it("should handle non-numeric values", () => {
      // Arrange
      mockRequest.query = { page: "abc", limit: "xyz" };

      // Act
      const result = ValidationUtils.validatePaginationParams(
        mockRequest as Request
      );

      // Assert
      expect(result.page).toBe(1); // defaults
      expect(result.limit).toBe(20); // defaults
      expect(result.skip).toBe(0);
      expect(result.errors).toEqual([]); // No errors for non-numeric (parseInt returns NaN, || provides defaults)
    });

    it("should accumulate multiple validation errors", () => {
      // Arrange
      mockRequest.query = { page: "-1", limit: "200" };

      // Act
      const result = ValidationUtils.validatePaginationParams(
        mockRequest as Request
      );

      // Assert
      expect(result.page).toBe(1);
      expect(result.limit).toBe(100);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain("Page number must be greater than 0");
      expect(result.errors).toContain("Limit cannot exceed 100");
    });
  });

  describe("sanitizeString", () => {
    it("should trim whitespace", () => {
      expect(ValidationUtils.sanitizeString("  hello world  ")).toBe(
        "hello world"
      );
    });

    it("should normalize multiple spaces to single space", () => {
      expect(ValidationUtils.sanitizeString("hello    world")).toBe(
        "hello world"
      );
      expect(ValidationUtils.sanitizeString("multiple   spaces    here")).toBe(
        "multiple spaces here"
      );
    });

    it("should handle mixed whitespace characters", () => {
      expect(ValidationUtils.sanitizeString("  hello\t\n  world  ")).toBe(
        "hello world"
      );
    });

    it("should return empty string for non-string input", () => {
      expect(ValidationUtils.sanitizeString(null as any)).toBe("");
      expect(ValidationUtils.sanitizeString(undefined as any)).toBe("");
      expect(ValidationUtils.sanitizeString(123 as any)).toBe("");
      expect(ValidationUtils.sanitizeString({} as any)).toBe("");
    });

    it("should handle empty string", () => {
      expect(ValidationUtils.sanitizeString("")).toBe("");
    });

    it("should handle string with only whitespace", () => {
      expect(ValidationUtils.sanitizeString("   \t\n   ")).toBe("");
    });
  });

  describe("validateSystemMessageInput", () => {
    beforeEach(() => {
      // Setup default valid request body
      mockRequest.body = {
        title: "Test Message",
        content: "This is a test message content",
        type: "info",
        priority: "medium",
      };
    });

    it("should return valid result for correct input", () => {
      // Act
      const result = ValidationUtils.validateSystemMessageInput(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData).toEqual({
        title: "Test Message",
        content: "This is a test message content",
        type: "info",
        priority: "medium",
        targetUserId: undefined,
        expiresAt: undefined,
      });
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should handle missing required fields", () => {
      // Arrange
      mockRequest.body = {
        type: "info",
        priority: "medium",
        // title and content missing
      };

      // Act
      const result = ValidationUtils.validateSystemMessageInput(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.sanitizedData).toBeUndefined();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it("should validate targetUserId when provided", () => {
      // Arrange
      mockRequest.body.targetUserId = "invalid-id";
      mockObjectIdIsValid.mockReturnValue(false);

      // Act
      const result = ValidationUtils.validateSystemMessageInput(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Invalid target user ID format",
        })
      );
    });

    it("should accept valid targetUserId", () => {
      // Arrange
      mockRequest.body.targetUserId = "507f1f77bcf86cd799439011";
      mockObjectIdIsValid.mockReturnValue(true);

      // Act
      const result = ValidationUtils.validateSystemMessageInput(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.targetUserId).toBe(
        "507f1f77bcf86cd799439011"
      );
    });

    it("should validate expiresAt date", () => {
      // Arrange
      const futureDate = new Date(Date.now() + 86400000); // 1 day from now
      mockRequest.body.expiresAt = futureDate.toISOString();

      // Act
      const result = ValidationUtils.validateSystemMessageInput(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.expiresAt).toEqual(futureDate);
    });

    it("should reject past dates for expiresAt", () => {
      // Arrange
      const pastDate = new Date(Date.now() - 86400000); // 1 day ago
      mockRequest.body.expiresAt = pastDate.toISOString();

      // Act
      const result = ValidationUtils.validateSystemMessageInput(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Invalid expiration date",
        })
      );
    });

    it("should reject invalid date strings for expiresAt", () => {
      // Arrange
      mockRequest.body.expiresAt = "invalid-date";

      // Act
      const result = ValidationUtils.validateSystemMessageInput(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Invalid expiration date",
        })
      );
    });

    it("should sanitize title and content", () => {
      // Arrange
      mockRequest.body = {
        title: "  Test    Message  ",
        content: "  This   is   a   test   message   content  ",
        type: "info",
        priority: "medium",
      };

      // Act
      const result = ValidationUtils.validateSystemMessageInput(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.title).toBe("Test Message");
      expect(result.sanitizedData?.content).toBe(
        "This is a test message content"
      );
    });

    it("should reject title that is too long", () => {
      // Arrange
      const longTitle = "a".repeat(256); // 256 characters
      mockRequest.body.title = longTitle;

      // Act
      const result = ValidationUtils.validateSystemMessageInput(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Title too long (max 255 characters)",
        })
      );
    });

    it("should reject content that is too long", () => {
      // Arrange
      const longContent = "a".repeat(5001); // 5001 characters
      mockRequest.body.content = longContent;

      // Act
      const result = ValidationUtils.validateSystemMessageInput(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Content too long (max 5000 characters)",
        })
      );
    });

    it("should use default values for invalid enum types", () => {
      // Arrange
      mockRequest.body.type = "invalid-type";
      mockRequest.body.priority = "invalid-priority";

      // Act
      const result = ValidationUtils.validateSystemMessageInput(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.type).toBe("info"); // default
      expect(result.sanitizedData?.priority).toBe("medium"); // default
    });

    it("should accept all valid enum values", () => {
      const validTypes = [
        "info",
        "warning",
        "error",
        "success",
        "announcement",
      ];
      const validPriorities = ["low", "medium", "high", "critical"];

      validTypes.forEach((type) => {
        validPriorities.forEach((priority) => {
          // Arrange
          mockRequest.body = {
            title: "Test",
            content: "Test content",
            type,
            priority,
          };

          // Act
          const result = ValidationUtils.validateSystemMessageInput(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(result.isValid).toBe(true);
          expect(result.sanitizedData?.type).toBe(type);
          expect(result.sanitizedData?.priority).toBe(priority);
        });
      });
    });

    it("should handle missing type and priority with defaults", () => {
      // Arrange
      mockRequest.body = {
        title: "Test",
        content: "Test content",
        // type and priority missing
      };

      // Act
      const result = ValidationUtils.validateSystemMessageInput(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.type).toBe("info"); // default
      expect(result.sanitizedData?.priority).toBe("medium"); // default
    });
  });
});
