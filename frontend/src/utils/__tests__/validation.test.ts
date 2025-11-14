/**
 * Unit tests for validation utilities
 */
import { describe, it, expect } from "vitest";
import { commonValidations } from "../validation";

describe("Validation Utils", () => {
  describe("username validation", () => {
    it("should validate a correct username", async () => {
      const result = await commonValidations.username.isValid("john_doe123");
      expect(result).toBe(true);
    });

    it("should reject username shorter than 3 characters", async () => {
      const result = await commonValidations.username.isValid("ab");
      expect(result).toBe(false);
    });

    it("should reject username longer than 20 characters", async () => {
      const result = await commonValidations.username.isValid("a".repeat(21));
      expect(result).toBe(false);
    });

    it("should reject username with special characters", async () => {
      const result = await commonValidations.username.isValid("john@doe");
      expect(result).toBe(false);
    });

    it("should accept username with underscores", async () => {
      const result = await commonValidations.username.isValid("john_doe");
      expect(result).toBe(true);
    });

    it("should reject empty username", async () => {
      const result = await commonValidations.username.isValid("");
      expect(result).toBe(false);
    });
  });

  describe("firstName validation", () => {
    it("should validate a correct first name", async () => {
      const result = await commonValidations.firstName.isValid("John");
      expect(result).toBe(true);
    });

    it("should reject first name shorter than 2 characters", async () => {
      const result = await commonValidations.firstName.isValid("J");
      expect(result).toBe(false);
    });

    it("should reject first name longer than 50 characters", async () => {
      const result = await commonValidations.firstName.isValid("a".repeat(51));
      expect(result).toBe(false);
    });

    it("should reject empty first name", async () => {
      const result = await commonValidations.firstName.isValid("");
      expect(result).toBe(false);
    });
  });

  describe("lastName validation", () => {
    it("should validate a correct last name", async () => {
      const result = await commonValidations.lastName.isValid("Doe");
      expect(result).toBe(true);
    });

    it("should reject last name shorter than 2 characters", async () => {
      const result = await commonValidations.lastName.isValid("D");
      expect(result).toBe(false);
    });

    it("should reject last name longer than 50 characters", async () => {
      const result = await commonValidations.lastName.isValid("a".repeat(51));
      expect(result).toBe(false);
    });

    it("should reject empty last name", async () => {
      const result = await commonValidations.lastName.isValid("");
      expect(result).toBe(false);
    });
  });

  describe("email validation", () => {
    it("should validate a correct email", async () => {
      const result = await commonValidations.email.isValid("test@example.com");
      expect(result).toBe(true);
    });

    it("should reject invalid email format", async () => {
      const result = await commonValidations.email.isValid("invalid-email");
      expect(result).toBe(false);
    });

    it("should reject email without @", async () => {
      const result = await commonValidations.email.isValid("testexample.com");
      expect(result).toBe(false);
    });

    it("should reject email without domain", async () => {
      const result = await commonValidations.email.isValid("test@");
      expect(result).toBe(false);
    });

    it("should reject empty email", async () => {
      const result = await commonValidations.email.isValid("");
      expect(result).toBe(false);
    });

    it("should reject email longer than 100 characters", async () => {
      const longEmail = "a".repeat(90) + "@example.com";
      const result = await commonValidations.email.isValid(longEmail);
      expect(result).toBe(false);
    });
  });

  describe("phone validation", () => {
    it("should validate a correct phone number", async () => {
      const result = await commonValidations.phone.isValid("+12345678901");
      expect(result).toBe(true);
    });

    it("should allow undefined phone", async () => {
      const result = await commonValidations.phone.isValid(undefined);
      expect(result).toBe(true);
    });

    it("should reject invalid phone format", async () => {
      const result = await commonValidations.phone.isValid("abc123");
      expect(result).toBe(false);
    });

    it("should accept phone without + prefix", async () => {
      const result = await commonValidations.phone.isValid("12345678901");
      expect(result).toBe(true);
    });

    it("should reject empty string due to regex pattern", async () => {
      // notRequired() allows undefined/null but empty string still validates against the regex
      const result = await commonValidations.phone.isValid("");
      expect(result).toBe(false);
    });
  });

  describe("gender validation", () => {
    it("should validate male gender", async () => {
      const result = await commonValidations.gender.isValid("male");
      expect(result).toBe(true);
    });

    it("should validate female gender", async () => {
      const result = await commonValidations.gender.isValid("female");
      expect(result).toBe(true);
    });

    it("should reject invalid gender", async () => {
      const result = await commonValidations.gender.isValid("other");
      expect(result).toBe(false);
    });

    it("should reject empty gender", async () => {
      const result = await commonValidations.gender.isValid("");
      expect(result).toBe(false);
    });
  });

  describe("password validation", () => {
    it("should validate a correct password", async () => {
      const result = await commonValidations.password.isValid("Password123");
      expect(result).toBe(true);
    });

    it("should reject password shorter than 8 characters", async () => {
      const result = await commonValidations.password.isValid("Pass123");
      expect(result).toBe(false);
    });

    it("should reject password without lowercase letter", async () => {
      const result = await commonValidations.password.isValid("PASSWORD123");
      expect(result).toBe(false);
    });

    it("should reject password without uppercase letter", async () => {
      const result = await commonValidations.password.isValid("password123");
      expect(result).toBe(false);
    });

    it("should reject password without number", async () => {
      const result = await commonValidations.password.isValid("PasswordABC");
      expect(result).toBe(false);
    });

    it("should reject empty password", async () => {
      const result = await commonValidations.password.isValid("");
      expect(result).toBe(false);
    });
  });

  describe("isAtCloudLeader validation", () => {
    it("should validate Yes option", async () => {
      const result = await commonValidations.isAtCloudLeader.isValid("Yes");
      expect(result).toBe(true);
    });

    it("should validate No option", async () => {
      const result = await commonValidations.isAtCloudLeader.isValid("No");
      expect(result).toBe(true);
    });

    it("should reject other values", async () => {
      const result = await commonValidations.isAtCloudLeader.isValid("Maybe");
      expect(result).toBe(false);
    });

    it("should reject empty value", async () => {
      const result = await commonValidations.isAtCloudLeader.isValid("");
      expect(result).toBe(false);
    });
  });

  describe("homeAddress validation", () => {
    it("should validate a correct home address", async () => {
      const result = await commonValidations.homeAddress.isValid("123 Main St");
      expect(result).toBe(true);
    });

    it("should allow empty home address (not required)", async () => {
      const result = await commonValidations.homeAddress.isValid("");
      expect(result).toBe(true);
    });

    it("should reject home address longer than 200 characters", async () => {
      const result = await commonValidations.homeAddress.isValid(
        "a".repeat(201)
      );
      expect(result).toBe(false);
    });

    it("should allow undefined home address", async () => {
      const result = await commonValidations.homeAddress.isValid(undefined);
      expect(result).toBe(true);
    });
  });

  describe("company validation", () => {
    it("should validate a correct company name", async () => {
      const result = await commonValidations.company.isValid("ACME Corp");
      expect(result).toBe(true);
    });

    it("should allow empty company (not required)", async () => {
      const result = await commonValidations.company.isValid("");
      expect(result).toBe(true);
    });

    it("should reject company name longer than 100 characters", async () => {
      const result = await commonValidations.company.isValid("a".repeat(101));
      expect(result).toBe(false);
    });

    it("should allow undefined company", async () => {
      const result = await commonValidations.company.isValid(undefined);
      expect(result).toBe(true);
    });
  });

  describe("eventTitle validation", () => {
    it("should validate a correct event title", async () => {
      const result = await commonValidations.eventTitle.isValid(
        "Summer Workshop"
      );
      expect(result).toBe(true);
    });

    it("should reject event title shorter than 3 characters", async () => {
      const result = await commonValidations.eventTitle.isValid("Ab");
      expect(result).toBe(false);
    });

    it("should reject event title longer than 100 characters", async () => {
      const result = await commonValidations.eventTitle.isValid(
        "a".repeat(101)
      );
      expect(result).toBe(false);
    });

    it("should reject empty event title", async () => {
      const result = await commonValidations.eventTitle.isValid("");
      expect(result).toBe(false);
    });
  });

  describe("eventDescription validation", () => {
    it("should validate a correct event description", async () => {
      const result = await commonValidations.eventDescription.isValid(
        "This is a great workshop for everyone to learn new skills"
      );
      expect(result).toBe(true);
    });

    it("should reject event description shorter than 10 characters", async () => {
      const result = await commonValidations.eventDescription.isValid("Short");
      expect(result).toBe(false);
    });

    it("should reject event description longer than 1000 characters", async () => {
      const result = await commonValidations.eventDescription.isValid(
        "a".repeat(1001)
      );
      expect(result).toBe(false);
    });

    it("should reject empty event description", async () => {
      const result = await commonValidations.eventDescription.isValid("");
      expect(result).toBe(false);
    });
  });

  describe("currentPassword validation", () => {
    it("should validate a current password", async () => {
      const result = await commonValidations.currentPassword.isValid(
        "password123"
      );
      expect(result).toBe(true);
    });

    it("should reject empty current password", async () => {
      const result = await commonValidations.currentPassword.isValid("");
      expect(result).toBe(false);
    });
  });
});
