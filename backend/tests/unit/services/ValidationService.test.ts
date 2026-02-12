/**
 * ValidationService Test Suite
 * Tests centralized validation logic using isolated patterns
 *
 * Coverage Target: ValidationService.ts (0% → 95%+)
 * Priority: High-impact service layer testing
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ValidationService } from "../../../src/services/ValidationService";

describe("ValidationService", () => {
  describe("validateEmail", () => {
    it("should validate correct email format", () => {
      const result = ValidationService.validateEmail("test@example.com");
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject invalid email formats", () => {
      const testCases = [
        { email: "invalid-email", shouldFail: true },
        { email: "test@", shouldFail: true },
        { email: "@example.com", shouldFail: true },
        { email: "test..test@example.com", shouldFail: false }, // Actually valid
        { email: "test@example", shouldFail: true },
        { email: "test space@example.com", shouldFail: true },
      ];

      testCases.forEach(({ email, shouldFail }) => {
        const result = ValidationService.validateEmail(email);
        if (shouldFail) {
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain("Invalid email format");
        } else {
          expect(result.isValid).toBe(true);
        }
      });
    });

    it("should reject empty email", () => {
      const result = ValidationService.validateEmail("");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Email is required");
    });

    it("should handle various valid email formats", () => {
      const validEmails = [
        "simple@example.com",
        "user.name@example.com",
        "user+tag@example.com",
        "user123@example-domain.co.uk",
        "firstname.lastname@subdomain.example.com",
      ];

      validEmails.forEach((email) => {
        const result = ValidationService.validateEmail(email);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe("validatePassword", () => {
    it("should validate password with minimum length", () => {
      const result = ValidationService.validatePassword("password123");
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject passwords that are too short", () => {
      const result = ValidationService.validatePassword("12345");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Password must be at least 6 characters long"
      );
    });

    it("should reject passwords that are too long", () => {
      const longPassword = "a".repeat(101);
      const result = ValidationService.validatePassword(longPassword);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Password must be less than 100 characters"
      );
    });

    it("should reject empty password", () => {
      const result = ValidationService.validatePassword("");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Password is required");
    });

    it("should validate passwords at boundary lengths", () => {
      // Test minimum valid length
      const minPassword = ValidationService.validatePassword("123456");
      expect(minPassword.isValid).toBe(true);

      // Test maximum valid length
      const maxPassword = ValidationService.validatePassword("a".repeat(100));
      expect(maxPassword.isValid).toBe(true);
    });
  });

  describe("validateUsername", () => {
    it("should validate correct username format", () => {
      const result = ValidationService.validateUsername("validUser123");
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject usernames that are too short", () => {
      const result = ValidationService.validateUsername("ab");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Username must be at least 3 characters long"
      );
    });

    it("should reject usernames that are too long", () => {
      const longUsername = "a".repeat(31);
      const result = ValidationService.validateUsername(longUsername);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Username must be less than 30 characters"
      );
    });

    it("should reject usernames with invalid characters", () => {
      const invalidUsernames = [
        "user name",
        "user@name",
        "user#name",
        "user%name",
        "user!name",
      ];

      invalidUsernames.forEach((username) => {
        const result = ValidationService.validateUsername(username);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Username can only contain letters, numbers, dots, hyphens, and underscores"
        );
      });
    });

    it("should accept valid username characters", () => {
      const validUsernames = [
        "username",
        "user_name",
        "user.name",
        "user-name",
        "Username123",
        "user123",
      ];

      validUsernames.forEach((username) => {
        const result = ValidationService.validateUsername(username);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it("should reject empty username", () => {
      const result = ValidationService.validateUsername("");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Username is required");
    });
  });

  describe("validateName", () => {
    it("should validate correct name format", () => {
      const result = ValidationService.validateName("John", "First name");
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject empty names", () => {
      const result = ValidationService.validateName("", "First name");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("First name is required");
    });

    it("should reject names with invalid characters", () => {
      const invalidNames = ["John123", "John@", "John#", "John!", "John$"];

      invalidNames.forEach((name) => {
        const result = ValidationService.validateName(name, "First name");
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "First name can only contain letters, spaces, hyphens, and apostrophes"
        );
      });
    });

    it("should accept valid name characters", () => {
      const validNames = [
        "John",
        "Mary Jane",
        "O'Connor",
        "Jean-Pierre",
        "Anna-Maria",
        "D'Angelo",
      ];

      validNames.forEach((name) => {
        const result = ValidationService.validateName(name, "First name");
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it("should reject names that are too long", () => {
      const longName = "a".repeat(51);
      const result = ValidationService.validateName(longName, "First name");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "First name must be less than 50 characters"
      );
    });
  });

  describe("validatePhoneNumber", () => {
    it("should validate optional phone number", () => {
      const result = ValidationService.validatePhoneNumber("");
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate correct phone number formats", () => {
      const validPhones = [
        "+1234567890",
        "1234567890",
        "+123456789012345",
        "123456789",
      ];

      validPhones.forEach((phone) => {
        const result = ValidationService.validatePhoneNumber(phone);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it("should reject invalid phone number formats", () => {
      const invalidPhones = [
        "abc123",
        "+12345678901234567", // too long
      ];

      invalidPhones.forEach((phone) => {
        const result = ValidationService.validatePhoneNumber(phone);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Invalid phone number format");
      });

      // Test edge cases - the regex is /^[\+]?[1-9][\d]{0,15}$/
      // So '+' alone, '123' (starts with valid digit), 'phone-number' should all fail
      const edgeCases = [
        { phone: "+", shouldPass: false }, // Just plus sign
        { phone: "0123", shouldPass: false }, // Starts with 0
        { phone: "phone-number", shouldPass: false }, // Contains letters
        { phone: "123", shouldPass: true }, // Actually valid: starts with 1-9
        { phone: "+123", shouldPass: true }, // Valid with plus
      ];

      edgeCases.forEach(({ phone, shouldPass }) => {
        const result = ValidationService.validatePhoneNumber(phone);
        expect(result.isValid).toBe(shouldPass);
      });
    });

    it("should handle phone numbers with formatting characters", () => {
      const phoneWithFormatting = "(123) 456-7890";
      const result = ValidationService.validatePhoneNumber(phoneWithFormatting);
      // The regex removes formatting chars, so this should be valid
      expect(result.isValid).toBe(true);
    });
  });

  describe("validateDate", () => {
    it("should validate correct date format", () => {
      const result = ValidationService.validateDate("2024-12-31", "Event date");
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject invalid date format", () => {
      const result = ValidationService.validateDate(
        "invalid-date",
        "Event date"
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid Event date format");
    });

    it("should reject empty date when required", () => {
      const result = ValidationService.validateDate("", "Event date");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Event date is required");
    });

    it("should validate various date formats", () => {
      const validDates = [
        "2024-01-01",
        "2024-12-31T23:59:59.999Z",
        "2024-06-15T10:30:00",
        new Date().toISOString(),
      ];

      validDates.forEach((date) => {
        const result = ValidationService.validateDate(date, "Test date");
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe("validateObjectId", () => {
    it("should validate correct MongoDB ObjectId", () => {
      const validObjectId = "507f1f77bcf86cd799439011";
      const result = ValidationService.validateObjectId(
        validObjectId,
        "User ID"
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject invalid ObjectId format", () => {
      const invalidObjectIds = [
        "invalid-id",
        "123",
        "507f1f77bcf86cd79943901g", // invalid character
        "507f1f77bcf86cd79943901", // too short
        "507f1f77bcf86cd799439011123", // too long
      ];

      invalidObjectIds.forEach((id) => {
        const result = ValidationService.validateObjectId(id, "User ID");
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Invalid User ID format");
      });
    });

    it("should reject empty ObjectId", () => {
      const result = ValidationService.validateObjectId("", "User ID");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("User ID is required");
    });
  });

  describe("validatePagination", () => {
    it("should validate correct pagination parameters", () => {
      const result = ValidationService.validatePagination(1, 10);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject invalid page numbers", () => {
      const invalidPages = [0, -1, "invalid", null, undefined];

      invalidPages.forEach((page) => {
        const result = ValidationService.validatePagination(page, 10);
        expect(result.isValid).toBe(false);
        expect(
          result.errors.some((error) => error.includes("Page must be"))
        ).toBe(true);
      });
    });

    it("should reject invalid limit numbers", () => {
      const invalidLimits = [0, -1, 101, "invalid", null, undefined];

      invalidLimits.forEach((limit) => {
        const result = ValidationService.validatePagination(1, limit);
        expect(result.isValid).toBe(false);
        // Check for various possible error message patterns
        const hasLimitError = result.errors.some(
          (error) => error.includes("Limit") || error.includes("limit")
        );
        expect(hasLimitError).toBe(true);
      });
    });

    it("should validate boundary values", () => {
      // Test minimum valid values
      const minResult = ValidationService.validatePagination(1, 1);
      expect(minResult.isValid).toBe(true);

      // Test maximum valid values
      const maxResult = ValidationService.validatePagination(1000, 100);
      expect(maxResult.isValid).toBe(true);
    });
  });

  describe("validateUrl", () => {
    it("should validate correct URL format", () => {
      const result = ValidationService.validateUrl(
        "https://example.com",
        "Website URL"
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject invalid URL format", () => {
      const invalidUrls = [
        "not-a-url",
        "http:/", // Invalid URL format
      ];

      invalidUrls.forEach((url) => {
        const result = ValidationService.validateUrl(url, "Website URL");
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Invalid Website URL format");
      });

      // Test URLs - the URL constructor is quite permissive
      const edgeCases = [
        { url: "ftp://example.com", shouldPass: true }, // FTP is valid URL
        { url: "invalid-protocol://example.com", shouldPass: true }, // URL constructor accepts this
        { url: "http://localhost", shouldPass: true },
        { url: "file:///path/to/file", shouldPass: true },
      ];

      edgeCases.forEach(({ url, shouldPass }) => {
        const result = ValidationService.validateUrl(url, "Test URL");
        expect(result.isValid).toBe(shouldPass);
      });
    });

    it("should validate various valid URL formats", () => {
      const validUrls = [
        "https://example.com",
        "http://example.com",
        "https://subdomain.example.com/path?param=value",
        "https://example.com:8080/path",
        "http://localhost:3000",
      ];

      validUrls.forEach((url) => {
        const result = ValidationService.validateUrl(url, "Test URL");
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it("should handle empty URL as valid (optional field)", () => {
      const result = ValidationService.validateUrl("", "Website URL");
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("validateStringArray", () => {
    it("should validate correct string array", () => {
      const result = ValidationService.validateStringArray(
        ["item1", "item2"],
        "Tags",
        false
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject non-array input", () => {
      const result = ValidationService.validateStringArray(
        "not-array",
        "Tags",
        false
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Tags must be an array");
    });

    it("should reject array with non-string items", () => {
      const result = ValidationService.validateStringArray(
        ["item1", 123, "item3"],
        "Tags",
        false
      );
      expect(result.isValid).toBe(false);
      // The actual error format is "Tags[1] must be a string"
      expect(result.errors).toContain("Tags[1] must be a string");
    });

    it("should handle required vs optional arrays", () => {
      // Required array - should fail when empty
      const requiredResult = ValidationService.validateStringArray(
        [],
        "Tags",
        true
      );
      expect(requiredResult.isValid).toBe(false);
      // The actual error format includes "non-empty array"
      expect(requiredResult.errors).toContain(
        "Tags is required and must be a non-empty array"
      );

      // Optional array - should pass when empty
      const optionalResult = ValidationService.validateStringArray(
        [],
        "Tags",
        false
      );
      expect(optionalResult.isValid).toBe(true);
    });
  });

  describe("Complex Validation Methods", () => {
    describe("validateUserCreation", () => {
      const validUserData = {
        email: "test@example.com",
        username: "testuser",
        password: "password123",
        firstName: "John",
        lastName: "Doe",
        phone: "+1234567890",
      };

      it("should validate complete user data", () => {
        const result = ValidationService.validateUserCreation(validUserData);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should validate required fields only", () => {
        const minimalData = {
          email: "test@example.com",
          username: "testuser",
          password: "password123",
        };

        const result = ValidationService.validateUserCreation(minimalData);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should reject missing required fields", () => {
        const incompleteData = {
          email: "test@example.com",
          // missing username and password
        };

        const result = ValidationService.validateUserCreation(incompleteData);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it("should accumulate multiple validation errors", () => {
        const invalidData = {
          email: "invalid-email",
          username: "ab", // too short
          password: "123", // too short
          firstName: "John123", // invalid characters
          phone: "invalid-phone",
        };

        const result = ValidationService.validateUserCreation(invalidData);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(3);
      });
    });

    describe("validateUserUpdate", () => {
      it("should validate partial user updates", () => {
        const updateData = {
          firstName: "Jane",
          email: "newemail@example.com",
        };

        const result = ValidationService.validateUserUpdate(updateData);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should allow empty updates", () => {
        const result = ValidationService.validateUserUpdate({});
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should validate only provided fields", () => {
        const partialUpdate = {
          email: "invalid-email",
          firstName: "Valid Name",
        };

        const result = ValidationService.validateUserUpdate(partialUpdate);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Invalid email format");
        // Should not contain errors about missing username/password
        expect(result.errors.some((error) => error.includes("Username"))).toBe(
          false
        );
      });

      it("should reject non-string email", () => {
        const result = ValidationService.validateUserUpdate({ email: 123 });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Email must be a string");
      });

      it("should reject non-string username", () => {
        const result = ValidationService.validateUserUpdate({ username: 456 });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Username must be a string");
      });

      it("should reject non-string firstName", () => {
        const result = ValidationService.validateUserUpdate({ firstName: true });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("First name must be a string");
      });

      it("should reject non-string lastName", () => {
        const result = ValidationService.validateUserUpdate({ lastName: [] });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Last name must be a string");
      });

      it("should reject non-string phone", () => {
        const result = ValidationService.validateUserUpdate({ phone: {} });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Phone must be a string");
      });

      it("should validate phone string content", () => {
        const result = ValidationService.validateUserUpdate({ phone: "555-1234" });
        expect(result.isValid).toBe(true);
      });
    });

    describe("validateEventCreation", () => {
      const validEventData = {
        title: "Test Event",
        description: "Event description",
        startDate: "2024-12-31T10:00:00Z",
        endDate: "2024-12-31T12:00:00Z",
        capacity: 50,
        location: "Test Location",
      };

      it("should validate complete event data", () => {
        const result = ValidationService.validateEventCreation(validEventData);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should reject missing required fields", () => {
        const incompleteData = {
          title: "Test Event",
          // missing description, dates
        };

        const result = ValidationService.validateEventCreation(incompleteData);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it("should reject invalid date logic", () => {
        const invalidData = {
          ...validEventData,
          startDate: "2024-12-31T12:00:00Z",
          endDate: "2024-12-31T10:00:00Z", // end before start
        };

        const result = ValidationService.validateEventCreation(invalidData);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("End date cannot be before start date");
      });

      it("should validate capacity constraints", () => {
        const invalidCapacityData = {
          ...validEventData,
          capacity: 0,
        };

        const result =
          ValidationService.validateEventCreation(invalidCapacityData);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Capacity must be a positive integer");
      });

      it("should validate field length constraints", () => {
        const longTitleData = {
          ...validEventData,
          title: "a".repeat(201),
          location: "a".repeat(501),
        };

        const result = ValidationService.validateEventCreation(longTitleData);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Event title must be less than 200 characters"
        );
        expect(result.errors).toContain(
          "Location must be less than 500 characters"
        );
      });
    });
  });

  describe("Utility Methods", () => {
    describe("combineValidationResults", () => {
      it("should combine multiple valid results", () => {
        const result1 = { isValid: true, errors: [] };
        const result2 = { isValid: true, errors: [] };

        const combined = ValidationService.combineValidationResults(
          result1,
          result2
        );
        expect(combined.isValid).toBe(true);
        expect(combined.errors).toHaveLength(0);
      });

      it("should combine results with errors", () => {
        const result1 = { isValid: false, errors: ["Error 1"] };
        const result2 = { isValid: false, errors: ["Error 2"] };

        const combined = ValidationService.combineValidationResults(
          result1,
          result2
        );
        expect(combined.isValid).toBe(false);
        expect(combined.errors).toEqual(["Error 1", "Error 2"]);
      });

      it("should handle mixed valid and invalid results", () => {
        const validResult = { isValid: true, errors: [] };
        const invalidResult = { isValid: false, errors: ["Error"] };

        const combined = ValidationService.combineValidationResults(
          validResult,
          invalidResult
        );
        expect(combined.isValid).toBe(false);
        expect(combined.errors).toEqual(["Error"]);
      });

      it("should handle empty results array", () => {
        const combined = ValidationService.combineValidationResults();
        expect(combined.isValid).toBe(true);
        expect(combined.errors).toHaveLength(0);
      });
    });
  });
});
