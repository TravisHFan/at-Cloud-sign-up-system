import { describe, it, expect } from "vitest";
import { friendlyGuestError, friendlyGenericError } from "../errorMessages";

describe("errorMessages utils", () => {
  describe("friendlyGuestError", () => {
    it("should handle 429 rate limit error", () => {
      const error = { status: 429 };
      const result = friendlyGuestError(error);

      expect(result).toBe(
        "You're submitting too fast. Please wait a bit before trying again."
      );
    });

    it("should handle 429 via response object", () => {
      const error = { response: { status: 429 } };
      const result = friendlyGuestError(error);

      expect(result).toBe(
        "You're submitting too fast. Please wait a bit before trying again."
      );
    });

    it("should handle 409 duplicate registration", () => {
      const error = { status: 409 };
      const result = friendlyGuestError(error);

      expect(result).toBe(
        "This guest has reached the 3-role limit for this event."
      );
    });

    it("should handle duplicate message pattern", () => {
      const error = { message: "Guest is already registered" };
      const result = friendlyGuestError(error);

      expect(result).toBe(
        "This guest has reached the 3-role limit for this event."
      );
    });

    it("should handle 3-role limit message", () => {
      const error = { message: "Guest has reached 3-role limit" };
      const result = friendlyGuestError(error);

      expect(result).toBe(
        "This guest has reached the 3-role limit for this event."
      );
    });

    it("should handle capacity full error", () => {
      const error = {
        status: 400,
        message: "Role is at full capacity",
      };
      const result = friendlyGuestError(error);

      expect(result).toBe("This role is full. Please choose another role.");
    });

    it("should handle role full message via response data", () => {
      const error = {
        status: 400,
        response: { data: { message: "Role full, cannot register" } },
      };
      const result = friendlyGuestError(error);

      expect(result).toBe("This role is full. Please choose another role.");
    });
    it("should return custom message when available", () => {
      const error = { message: "Custom error message" };
      const result = friendlyGuestError(error);

      expect(result).toBe("Custom error message");
    });

    it("should prioritize direct message over response data message", () => {
      const error = {
        message: "Direct message",
        response: { data: { message: "Response message" } },
      };
      const result = friendlyGuestError(error);

      // Direct message has priority in the message extraction
      expect(result).toBe("Direct message");
    });
    it("should return fallback for unknown errors", () => {
      const error = { status: 500 };
      const result = friendlyGuestError(error);

      expect(result).toBe("Something went wrong. Please try again.");
    });

    it("should handle null error", () => {
      const result = friendlyGuestError(null);

      expect(result).toBe("Something went wrong. Please try again.");
    });

    it("should handle undefined error", () => {
      const result = friendlyGuestError(undefined);

      expect(result).toBe("Something went wrong. Please try again.");
    });

    it("should handle empty object error", () => {
      const result = friendlyGuestError({});

      expect(result).toBe("Something went wrong. Please try again.");
    });

    it("should handle case-insensitive duplicate patterns", () => {
      const testCases = [
        { message: "DUPLICATE entry" },
        { message: "Duplicate registration" },
        { message: "Already Registered" },
      ];

      for (const error of testCases) {
        const result = friendlyGuestError(error);
        expect(result).toBe(
          "This guest has reached the 3-role limit for this event."
        );
      }
    });

    it("should handle case-insensitive capacity patterns", () => {
      const testCases = [
        { status: 400, message: "CAPACITY reached" },
        { status: 400, message: "Role is FULL" },
        { status: 400, message: "Full capacity" },
      ];

      for (const error of testCases) {
        const result = friendlyGuestError(error);
        expect(result).toBe("This role is full. Please choose another role.");
      }
    });

    it("should handle network errors", () => {
      const error = { message: "Network request failed" };
      const result = friendlyGuestError(error);

      expect(result).toBe("Network request failed");
    });

    it("should handle errors with both status prioritizing direct status", () => {
      const error = {
        status: 429,
        response: { status: 500 },
      };
      const result = friendlyGuestError(error);

      // Should prioritize direct status
      expect(result).toBe(
        "You're submitting too fast. Please wait a bit before trying again."
      );
    });
    it("should handle string errors", () => {
      const result = friendlyGuestError("Simple error string");

      expect(result).toBe("Something went wrong. Please try again.");
    });
  });

  describe("friendlyGenericError", () => {
    it("should return error message when available", () => {
      const error = { message: "Custom error" };
      const result = friendlyGenericError(error, "Fallback message");

      expect(result).toBe("Custom error");
    });

    it("should return response data message when available", () => {
      const error = {
        response: { data: { message: "Server error message" } },
      };
      const result = friendlyGenericError(error, "Fallback");

      expect(result).toBe("Server error message");
    });

    it("should prioritize direct message over response message", () => {
      const error = {
        message: "Direct message",
        response: { data: { message: "Response message" } },
      };
      const result = friendlyGenericError(error, "Fallback");

      expect(result).toBe("Direct message");
    });

    it("should return fallback when no message available", () => {
      const error = {};
      const result = friendlyGenericError(error, "Fallback message");

      expect(result).toBe("Fallback message");
    });

    it("should return fallback for null error", () => {
      const result = friendlyGenericError(null, "Fallback");

      expect(result).toBe("Fallback");
    });

    it("should return fallback for undefined error", () => {
      const result = friendlyGenericError(undefined, "Fallback");

      expect(result).toBe("Fallback");
    });

    it("should handle empty messages", () => {
      const error = { message: "" };
      const result = friendlyGenericError(error, "Fallback");

      expect(result).toBe("Fallback");
    });

    it("should handle whitespace-only messages", () => {
      const error = { message: "   " };
      const result = friendlyGenericError(error, "Fallback");

      expect(result).toBe("   ");
    });

    it("should handle different fallback messages", () => {
      const error = {};

      expect(friendlyGenericError(error, "Try again")).toBe("Try again");
      expect(friendlyGenericError(error, "Failed to load")).toBe(
        "Failed to load"
      );
      expect(friendlyGenericError(error, "Unknown error")).toBe(
        "Unknown error"
      );
    });

    it("should handle nested response structures", () => {
      const error = {
        response: {
          data: {
            message: "Nested error message",
          },
        },
      };
      const result = friendlyGenericError(error, "Fallback");

      expect(result).toBe("Nested error message");
    });

    it("should handle missing data in response", () => {
      const error = {
        response: {},
      };
      const result = friendlyGenericError(error, "Fallback");

      expect(result).toBe("Fallback");
    });
  });
});
