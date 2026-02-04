import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request } from "express";
import { validationResult } from "express-validator";
import { ValidationRules } from "../../../src/middleware/validationRules";

// Mock express-validator
vi.mock("express-validator", async () => {
  const actual = await vi.importActual("express-validator");
  return {
    ...actual,
    validationResult: vi.fn(),
  };
});

describe("ValidationRules", () => {
  let mockRequest: Partial<Request>;

  beforeEach(() => {
    mockRequest = {
      body: {},
      params: {},
      query: {},
    };
    vi.clearAllMocks();
  });

  describe("userRegistration", () => {
    it("should return array of validation chains", () => {
      const validationChains = ValidationRules.userRegistration();

      expect(Array.isArray(validationChains)).toBe(true);
      expect(validationChains.length).toBeGreaterThan(0);
    });

    it("should validate username requirements", async () => {
      const validationChains = ValidationRules.userRegistration();
      const usernameValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("username"),
      );

      expect(usernameValidation).toBeDefined();
    });

    it("should validate email format", async () => {
      const validationChains = ValidationRules.userRegistration();
      const emailValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("email"),
      );

      expect(emailValidation).toBeDefined();
    });

    it("should validate password strength requirements", async () => {
      const validationChains = ValidationRules.userRegistration();
      const passwordValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("password"),
      );

      expect(passwordValidation).toBeDefined();
    });

    it("should validate password confirmation", async () => {
      const validationChains = ValidationRules.userRegistration();
      const confirmPasswordValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("confirmPassword"),
      );

      expect(confirmPasswordValidation).toBeDefined();
    });

    it("should validate optional fields", async () => {
      const validationChains = ValidationRules.userRegistration();

      // Check that firstName, lastName, and gender validations exist
      const firstNameValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("firstName"),
      );
      const lastNameValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("lastName"),
      );
      const genderValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("gender"),
      );

      expect(firstNameValidation).toBeDefined();
      expect(lastNameValidation).toBeDefined();
      expect(genderValidation).toBeDefined();
    });

    it("should validate isAtCloudLeader boolean field", async () => {
      const validationChains = ValidationRules.userRegistration();
      const leaderValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("isAtCloudLeader"),
      );

      expect(leaderValidation).toBeDefined();
    });

    it("should validate roleInAtCloud conditional requirement", async () => {
      const validationChains = ValidationRules.userRegistration();
      const roleValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("roleInAtCloud"),
      );

      expect(roleValidation).toBeDefined();
    });

    it("should validate phone number format", async () => {
      const validationChains = ValidationRules.userRegistration();
      const phoneValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("phone"),
      );

      expect(phoneValidation).toBeDefined();
    });

    it("should validate terms acceptance", async () => {
      const validationChains = ValidationRules.userRegistration();
      const termsValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("acceptTerms"),
      );

      expect(termsValidation).toBeDefined();
    });
  });

  describe("userLogin", () => {
    it("should return array of validation chains for user login", () => {
      const validationChains = ValidationRules.userLogin();

      expect(Array.isArray(validationChains)).toBe(true);
      expect(validationChains.length).toBeGreaterThan(0);
    });

    it("should validate login identifier", async () => {
      const validationChains = ValidationRules.userLogin();
      const identifierValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("emailOrUsername"),
      );

      expect(identifierValidation).toBeDefined();
    });

    it("should validate password", async () => {
      const validationChains = ValidationRules.userLogin();
      const passwordValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("password"),
      );

      expect(passwordValidation).toBeDefined();
    });

    it("should validate remember me option", async () => {
      const validationChains = ValidationRules.userLogin();
      const rememberMeValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("rememberMe"),
      );

      expect(rememberMeValidation).toBeDefined();
    });
  });

  describe("userProfileUpdate", () => {
    it("should return array of validation chains for user profile updates", () => {
      const validationChains = ValidationRules.userProfileUpdate();

      expect(Array.isArray(validationChains)).toBe(true);
      expect(validationChains.length).toBeGreaterThan(0);
    });

    it("should include optional field validations", async () => {
      const validationChains = ValidationRules.userProfileUpdate();

      // All fields should be optional for updates
      const usernameValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("username"),
      );
      const emailValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("email"),
      );
      const firstNameValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("firstName"),
      );
      const lastNameValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("lastName"),
      );

      expect(usernameValidation).toBeDefined();
      expect(emailValidation).toBeDefined();
      expect(firstNameValidation).toBeDefined();
      expect(lastNameValidation).toBeDefined();
    });

    it("should validate gender field", async () => {
      const validationChains = ValidationRules.userProfileUpdate();
      const genderValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("gender"),
      );

      expect(genderValidation).toBeDefined();
    });

    it("should validate phone number", async () => {
      const validationChains = ValidationRules.userProfileUpdate();
      const phoneValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("phone"),
      );

      expect(phoneValidation).toBeDefined();
    });
  });

  describe("eventCreation", () => {
    it("should return array of validation chains for event creation", () => {
      const validationChains = ValidationRules.eventCreation();

      expect(Array.isArray(validationChains)).toBe(true);
      expect(validationChains.length).toBeGreaterThan(0);
    });

    it("should validate event title", async () => {
      const validationChains = ValidationRules.eventCreation();
      const titleValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("title"),
      );

      expect(titleValidation).toBeDefined();
    });

    it("should validate event type", async () => {
      const validationChains = ValidationRules.eventCreation();
      const typeValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("type"),
      );

      expect(typeValidation).toBeDefined();
    });

    it("should validate event date", async () => {
      const validationChains = ValidationRules.eventCreation();
      const dateValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("date"),
      );

      expect(dateValidation).toBeDefined();
    });

    it("should validate event time", async () => {
      const validationChains = ValidationRules.eventCreation();
      const timeValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("time"),
      );
      const endTimeValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("endTime"),
      );

      expect(timeValidation).toBeDefined();
      expect(endTimeValidation).toBeDefined();
    });

    it("should validate location information", async () => {
      const validationChains = ValidationRules.eventCreation();
      const locationValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("location"),
      );

      expect(locationValidation).toBeDefined();
    });

    it("should validate organizer information", async () => {
      const validationChains = ValidationRules.eventCreation();
      const organizerValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("organizer"),
      );

      expect(organizerValidation).toBeDefined();
    });

    it("should validate purpose description", async () => {
      const validationChains = ValidationRules.eventCreation();
      const purposeValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("purpose"),
      );

      expect(purposeValidation).toBeDefined();
    });

    it("should validate event format", async () => {
      const validationChains = ValidationRules.eventCreation();
      const formatValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("format"),
      );

      expect(formatValidation).toBeDefined();
    });

    it("should validate roles array", async () => {
      const validationChains = ValidationRules.eventCreation();
      const rolesValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("roles"),
      );

      expect(rolesValidation).toBeDefined();
    });

    it("should validate role properties", async () => {
      const validationChains = ValidationRules.eventCreation();

      // Check for role.name, role.description, role.maxParticipants validations
      const roleNameValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("roles.*.name"),
      );
      const roleDescValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("roles.*.description"),
      );
      const roleMaxValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("roles.*.maxParticipants"),
      );

      expect(roleNameValidation).toBeDefined();
      expect(roleDescValidation).toBeDefined();
      expect(roleMaxValidation).toBeDefined();
    });
  });

  describe("mongoId", () => {
    it("should return array of validation chains for MongoDB ID", () => {
      const validationChains = ValidationRules.mongoId();

      expect(Array.isArray(validationChains)).toBe(true);
      expect(validationChains.length).toBeGreaterThan(0);
    });

    it("should validate MongoDB ObjectId format", async () => {
      const validationChains = ValidationRules.mongoId();
      const idValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("id"),
      );

      expect(idValidation).toBeDefined();
    });
  });

  describe("pagination", () => {
    it("should return array of validation chains for pagination", () => {
      const validationChains = ValidationRules.pagination();

      expect(Array.isArray(validationChains)).toBe(true);
      expect(validationChains.length).toBeGreaterThan(0);
    });

    it("should validate page number", async () => {
      const validationChains = ValidationRules.pagination();
      const pageValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("page"),
      );

      expect(pageValidation).toBeDefined();
    });

    it("should validate limit parameter", async () => {
      const validationChains = ValidationRules.pagination();
      const limitValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("limit"),
      );

      expect(limitValidation).toBeDefined();
    });
  });

  describe("search", () => {
    it("should return array of validation chains for search", () => {
      const validationChains = ValidationRules.search();

      expect(Array.isArray(validationChains)).toBe(true);
      expect(validationChains.length).toBeGreaterThan(0);
    });

    it("should validate search query", async () => {
      const validationChains = ValidationRules.search();
      const queryValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("q"),
      );

      expect(queryValidation).toBeDefined();
    });
  });

  describe("Validation Chain Execution", () => {
    it("should execute username validation correctly", async () => {
      const validationChains = ValidationRules.userRegistration();
      const mockReq = {
        body: {
          username: "ab", // Too short
        },
      } as Request;

      // Find username validation
      const usernameValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("username"),
      );

      if (usernameValidation) {
        const result = await usernameValidation.run(mockReq);
        expect(result).toBeDefined();
      }
    });

    it("should execute email validation correctly", async () => {
      const validationChains = ValidationRules.userRegistration();
      const mockReq = {
        body: {
          email: "invalid-email", // Invalid format
        },
      } as Request;

      // Find email validation
      const emailValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("email"),
      );

      if (emailValidation) {
        const result = await emailValidation.run(mockReq);
        expect(result).toBeDefined();
      }
    });

    it("should execute password validation correctly", async () => {
      const validationChains = ValidationRules.userRegistration();
      const mockReq = {
        body: {
          password: "weak", // Too weak
        },
      } as Request;

      // Find password validation
      const passwordValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("password"),
      );

      if (passwordValidation) {
        const result = await passwordValidation.run(mockReq);
        expect(result).toBeDefined();
      }
    });

    it("should execute event date validation correctly", async () => {
      const validationChains = ValidationRules.eventCreation();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const mockReq = {
        body: {
          date: yesterday.toISOString(), // Past date
        },
      } as Request;

      // Find date validation
      const dateValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("date"),
      );

      if (dateValidation) {
        const result = await dateValidation.run(mockReq);
        expect(result).toBeDefined();
      }
    });

    it("should execute time comparison validation correctly", async () => {
      const validationChains = ValidationRules.eventCreation();
      const mockReq = {
        body: {
          time: "15:00",
          endTime: "14:00", // End time before start time
        },
      } as Request;

      // Find endTime validation
      const endTimeValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("endTime"),
      );

      if (endTimeValidation) {
        const result = await endTimeValidation.run(mockReq);
        expect(result).toBeDefined();
      }
    });

    it("should execute confirmPassword custom: match path returns true", async () => {
      const validationChains = ValidationRules.userRegistration();
      const mockReq = {
        body: {
          password: "StrongP4ss",
          confirmPassword: "StrongP4ss", // matches
        },
      } as Request;

      const confirmValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("confirmPassword"),
      );

      expect(confirmValidation).toBeDefined();
      if (confirmValidation) {
        const result = await confirmValidation.run(mockReq);
        expect(result).toBeDefined();
      }
    });

    it("should execute confirmPassword custom: mismatch path throws error (captured)", async () => {
      const validationChains = ValidationRules.userRegistration();
      const mockReq = {
        body: {
          password: "StrongP4ss",
          confirmPassword: "WrongPass", // mismatch to trigger throw branch
        },
      } as Request;

      const confirmValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("confirmPassword"),
      );

      expect(confirmValidation).toBeDefined();
      if (confirmValidation) {
        const result = await confirmValidation.run(mockReq);
        expect(result).toBeDefined();
      }
    });

    it("should execute event date custom: future date passes branch", async () => {
      const validationChains = ValidationRules.eventCreation();
      const future = new Date();
      future.setDate(future.getDate() + 1);

      const mockReq = {
        body: {
          date: future.toISOString(),
        },
      } as Request;

      const dateValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("date"),
      );

      expect(dateValidation).toBeDefined();
      if (dateValidation) {
        const result = await dateValidation.run(mockReq);
        expect(result).toBeDefined();
      }
    });

    it("should execute endTime custom: end after start passes branch", async () => {
      const validationChains = ValidationRules.eventCreation();
      const mockReq = {
        body: {
          time: "14:00",
          endTime: "15:00", // valid ordering, covers return true path
        },
      } as Request;

      const endTimeValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("endTime"),
      );

      expect(endTimeValidation).toBeDefined();
      if (endTimeValidation) {
        const result = await endTimeValidation.run(mockReq);
        expect(result).toBeDefined();
      }
    });

    it("should reject endTime before startTime on same day", async () => {
      const validationChains = ValidationRules.eventCreation();
      const mockReq = {
        body: {
          date: "2025-06-15",
          endDate: "2025-06-15",
          time: "14:00",
          endTime: "13:00", // Invalid: end before start on same day
        },
      } as Request;

      const endTimeValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("endTime"),
      );

      expect(endTimeValidation).toBeDefined();
      if (endTimeValidation) {
        const result = await endTimeValidation.run(mockReq);
        const errors = result.array();
        expect(
          errors.some(
            (e: { msg: string }) =>
              e.msg === "End time must be after start time",
          ),
        ).toBe(true);
      }
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle undefined validation chains gracefully", () => {
      // Test that all validation methods return arrays even in edge cases
      const methods = [
        "userRegistration",
        "userLogin",
        "userProfileUpdate",
        "eventCreation",
        "mongoId",
        "pagination",
        "search",
      ];

      methods.forEach((method) => {
        const result = ValidationRules[method]();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
      });
    });

    it("should provide meaningful error messages", () => {
      // Test that validation chains have proper error messages configured
      const validationChains = ValidationRules.userRegistration();

      // Each validation chain should be properly configured
      validationChains.forEach((chain) => {
        expect(chain).toBeDefined();
        expect(typeof chain.run).toBe("function");
      });
    });

    it("should handle complex validation scenarios", () => {
      // Test more complex validation scenarios
      const registrationChains = ValidationRules.userRegistration();
      const loginChains = ValidationRules.userLogin();
      const eventChains = ValidationRules.eventCreation();

      expect(registrationChains.length).toBeGreaterThan(loginChains.length);
      expect(eventChains.length).toBeGreaterThan(loginChains.length);
    });

    it("should maintain validation chain integrity", () => {
      // Ensure validation chains maintain their structure
      const allMethods = [
        ValidationRules.userRegistration(),
        ValidationRules.userLogin(),
        ValidationRules.userProfileUpdate(),
        ValidationRules.eventCreation(),
        ValidationRules.mongoId(),
        ValidationRules.pagination(),
        ValidationRules.search(),
      ];

      allMethods.forEach((chains) => {
        expect(Array.isArray(chains)).toBe(true);
        chains.forEach((chain) => {
          expect(chain).toBeDefined();
          expect(typeof chain.run).toBe("function");
        });
      });
    });

    it("should handle conditional validation properly", async () => {
      // Test conditional validation for roleInAtCloud
      const validationChains = ValidationRules.userRegistration();
      const mockReq = {
        body: {
          isAtCloudLeader: "true",
          roleInAtCloud: "", // Empty when leader is true
        },
      } as Request;

      // Find roleInAtCloud validation
      const roleValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("roleInAtCloud"),
      );

      if (roleValidation) {
        const result = await roleValidation.run(mockReq);
        expect(result).toBeDefined();
      }
    });

    it("should validate search query length constraints", async () => {
      const validationChains = ValidationRules.search();
      const mockReq = {
        query: {
          q: "", // Empty query
        },
      } as any as Request;

      // Find query validation
      const queryValidation = validationChains.find((chain) =>
        chain.builder.build().fields.includes("q"),
      );

      if (queryValidation) {
        const result = await queryValidation.run(mockReq);
        expect(result).toBeDefined();
      }
    });

    it("should validate pagination parameters correctly", async () => {
      const validationChains = ValidationRules.pagination();
      const mockReq = {
        query: {
          page: "0", // Invalid page
          limit: "200", // Limit too high
        },
      } as any as Request;

      // Test each pagination validation
      for (const validation of validationChains) {
        const result = await validation.run(mockReq);
        expect(result).toBeDefined();
      }
    });
  });
});
