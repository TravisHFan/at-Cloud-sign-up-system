/**
 * Tests for Zoom link optional functionality
 * Feature 1: Remove Zoom link as required field for online event creation
 */
import { describe, it, expect } from "vitest";
import { validateEventField } from "../../utils/eventValidationUtils";

describe("Zoom Link Optional Validation", () => {
  describe("Online Events", () => {
    it("should accept empty zoom link for online events", () => {
      const result = validateEventField("zoomLink", "", { format: "Online" });
      expect(result.isValid).toBe(true);
      expect(result.message).toBe("Zoom link can be added later");
      expect(result.color).toBe("text-blue-500");
    });

    it("should accept undefined zoom link for online events", () => {
      const result = validateEventField("zoomLink", undefined, {
        format: "Online",
      });
      expect(result.isValid).toBe(true);
      expect(result.message).toBe("Zoom link can be added later");
      expect(result.color).toBe("text-blue-500");
    });

    it("should validate provided zoom link for online events", () => {
      const result = validateEventField(
        "zoomLink",
        "https://zoom.us/j/123456789",
        { format: "Online" }
      );
      expect(result.isValid).toBe(true);
      expect(result.message).toBe("Zoom link provided");
      expect(result.color).toBe("text-green-500");
    });

    it("should reject invalid zoom link format for online events", () => {
      const result = validateEventField("zoomLink", "invalid-url", {
        format: "Online",
      });
      expect(result.isValid).toBe(false);
      expect(result.message).toBe(
        "Please provide a valid URL starting with http:// or https://"
      );
      expect(result.color).toBe("text-red-500");
    });
  });

  describe("Hybrid Events", () => {
    it("should accept empty zoom link for hybrid events", () => {
      const result = validateEventField("zoomLink", "", {
        format: "Hybrid Participation",
      });
      expect(result.isValid).toBe(true);
      expect(result.message).toBe("Zoom link can be added later");
      expect(result.color).toBe("text-blue-500");
    });

    it("should validate provided zoom link for hybrid events", () => {
      const result = validateEventField(
        "zoomLink",
        "https://meet.google.com/abc-def-ghi",
        { format: "Hybrid Participation" }
      );
      expect(result.isValid).toBe(true);
      expect(result.message).toBe("Zoom link provided");
      expect(result.color).toBe("text-green-500");
    });
  });

  describe("In-person Events", () => {
    it("should not require zoom link for in-person events", () => {
      const result = validateEventField("zoomLink", "", {
        format: "In-person",
      });
      expect(result.isValid).toBe(true);
      expect(result.message).toBe(
        "Zoom link not required for in-person events"
      );
      expect(result.color).toBe("text-gray-500");
    });

    it("should accept provided zoom link for in-person events", () => {
      const result = validateEventField("zoomLink", "https://zoom.us/j/123", {
        format: "In-person",
      });
      expect(result.isValid).toBe(true);
      expect(result.message).toBe(
        "Zoom link not required for in-person events"
      );
      expect(result.color).toBe("text-gray-500");
    });
  });
});
