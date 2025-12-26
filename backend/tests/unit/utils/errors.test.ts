/**
 * errors.test.ts
 *
 * Unit tests for custom error classes.
 */
import { describe, it, expect } from "vitest";
import { ValidationError, NotFoundError } from "../../../src/utils/errors";

describe("errors", () => {
  describe("ValidationError", () => {
    it("should create a ValidationError with the given message", () => {
      const error = new ValidationError("Invalid input");

      expect(error.message).toBe("Invalid input");
    });

    it("should have name set to ValidationError", () => {
      const error = new ValidationError("Test error");

      expect(error.name).toBe("ValidationError");
    });

    it("should be an instance of Error", () => {
      const error = new ValidationError("Test error");

      expect(error).toBeInstanceOf(Error);
    });

    it("should be an instance of ValidationError", () => {
      const error = new ValidationError("Test error");

      expect(error).toBeInstanceOf(ValidationError);
    });

    it("should have a stack trace", () => {
      const error = new ValidationError("Test error");

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("ValidationError");
    });

    it("should handle empty message", () => {
      const error = new ValidationError("");

      expect(error.message).toBe("");
      expect(error.name).toBe("ValidationError");
    });

    it("should handle long message", () => {
      const longMessage = "A".repeat(1000);
      const error = new ValidationError(longMessage);

      expect(error.message).toBe(longMessage);
    });

    it("should handle special characters in message", () => {
      const message = "Invalid input: <script>alert('xss')</script>";
      const error = new ValidationError(message);

      expect(error.message).toBe(message);
    });
  });

  describe("NotFoundError", () => {
    it("should create a NotFoundError with the given message", () => {
      const error = new NotFoundError("Resource not found");

      expect(error.message).toBe("Resource not found");
    });

    it("should have name set to NotFoundError", () => {
      const error = new NotFoundError("Test error");

      expect(error.name).toBe("NotFoundError");
    });

    it("should be an instance of Error", () => {
      const error = new NotFoundError("Test error");

      expect(error).toBeInstanceOf(Error);
    });

    it("should be an instance of NotFoundError", () => {
      const error = new NotFoundError("Test error");

      expect(error).toBeInstanceOf(NotFoundError);
    });

    it("should have a stack trace", () => {
      const error = new NotFoundError("Test error");

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("NotFoundError");
    });

    it("should handle empty message", () => {
      const error = new NotFoundError("");

      expect(error.message).toBe("");
      expect(error.name).toBe("NotFoundError");
    });

    it("should handle message with entity ID", () => {
      const message = "Event with ID 123abc not found";
      const error = new NotFoundError(message);

      expect(error.message).toBe(message);
    });
  });

  describe("Error differentiation", () => {
    it("should distinguish between ValidationError and NotFoundError", () => {
      const validationError = new ValidationError("Invalid");
      const notFoundError = new NotFoundError("Not found");

      expect(validationError).toBeInstanceOf(ValidationError);
      expect(validationError).not.toBeInstanceOf(NotFoundError);

      expect(notFoundError).toBeInstanceOf(NotFoundError);
      expect(notFoundError).not.toBeInstanceOf(ValidationError);
    });

    it("should allow instanceof checks for error handling", () => {
      const errors: Error[] = [
        new ValidationError("Invalid"),
        new NotFoundError("Not found"),
        new Error("Generic error"),
      ];

      const validationErrors = errors.filter(
        (e) => e instanceof ValidationError
      );
      const notFoundErrors = errors.filter((e) => e instanceof NotFoundError);
      const otherErrors = errors.filter(
        (e) => !(e instanceof ValidationError) && !(e instanceof NotFoundError)
      );

      expect(validationErrors).toHaveLength(1);
      expect(notFoundErrors).toHaveLength(1);
      expect(otherErrors).toHaveLength(1);
    });

    it("should work with try-catch error handling pattern", () => {
      const handleError = (error: Error): number => {
        if (error instanceof ValidationError) {
          return 400;
        } else if (error instanceof NotFoundError) {
          return 404;
        }
        return 500;
      };

      expect(handleError(new ValidationError("Invalid"))).toBe(400);
      expect(handleError(new NotFoundError("Not found"))).toBe(404);
      expect(handleError(new Error("Generic"))).toBe(500);
    });
  });
});
