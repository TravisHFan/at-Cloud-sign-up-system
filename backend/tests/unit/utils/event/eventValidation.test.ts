/**
 * Event Validation Utilities Unit Tests
 *
 * Tests validation logic for event roles and pricing:
 * - validateRoles: role name, uniqueness, maxParticipants constraints
 * - validatePricing: free vs paid event validation
 */

import { describe, it, expect } from "vitest";
import {
  validateRoles,
  validatePricing,
} from "../../../../src/utils/event/eventValidation";

describe("eventValidation - Unit Tests", () => {
  describe("validateRoles", () => {
    describe("valid cases", () => {
      it("should accept valid roles with proper names and capacity", () => {
        const result = validateRoles([
          { name: "Participant", maxParticipants: 50 },
          { name: "Speaker", maxParticipants: 10 },
        ]);

        expect(result.valid).toBe(true);
      });

      it("should accept minimum capacity of 1", () => {
        const result = validateRoles([{ name: "VIP", maxParticipants: 1 }]);

        expect(result.valid).toBe(true);
      });

      it("should accept maximum capacity of 500", () => {
        const result = validateRoles([
          { name: "General", maxParticipants: 500 },
        ]);

        expect(result.valid).toBe(true);
      });

      it("should accept single role", () => {
        const result = validateRoles([
          { name: "Attendee", maxParticipants: 100 },
        ]);

        expect(result.valid).toBe(true);
      });

      it("should accept empty roles array", () => {
        const result = validateRoles([]);

        expect(result.valid).toBe(true);
      });
    });

    describe("role name validation", () => {
      it("should reject empty role name", () => {
        const result = validateRoles([{ name: "", maxParticipants: 10 }]);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors).toContain("Role name is required");
        }
      });

      it("should reject whitespace-only role name", () => {
        const result = validateRoles([{ name: "   ", maxParticipants: 10 }]);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors).toContain("Role name is required");
        }
      });

      it("should reject duplicate role names", () => {
        const result = validateRoles([
          { name: "Speaker", maxParticipants: 10 },
          { name: "Speaker", maxParticipants: 20 },
        ]);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors).toContain(
            "Duplicate role not allowed: Speaker"
          );
        }
      });

      it("should detect multiple duplicates", () => {
        const result = validateRoles([
          { name: "Role A", maxParticipants: 10 },
          { name: "Role B", maxParticipants: 10 },
          { name: "Role A", maxParticipants: 10 },
          { name: "Role B", maxParticipants: 10 },
        ]);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors.length).toBe(2);
        }
      });
    });

    describe("maxParticipants validation", () => {
      it("should reject zero capacity", () => {
        const result = validateRoles([
          { name: "Participant", maxParticipants: 0 },
        ]);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors[0]).toMatch(
            /maxParticipants must be a positive integer/
          );
        }
      });

      it("should reject negative capacity", () => {
        const result = validateRoles([
          { name: "Participant", maxParticipants: -10 },
        ]);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors[0]).toMatch(
            /maxParticipants must be a positive integer/
          );
        }
      });

      it("should reject capacity over 500", () => {
        const result = validateRoles([
          { name: "Large Event", maxParticipants: 501 },
        ]);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors[0]).toMatch(/exceeds maximum allowed capacity/);
        }
      });

      it("should reject NaN capacity", () => {
        const result = validateRoles([
          { name: "Participant", maxParticipants: NaN },
        ]);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors[0]).toMatch(
            /maxParticipants must be a positive integer/
          );
        }
      });

      it("should reject non-number capacity", () => {
        const result = validateRoles([
          { name: "Participant", maxParticipants: "50" as any },
        ]);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors[0]).toMatch(
            /maxParticipants must be a positive integer/
          );
        }
      });
    });

    describe("multiple errors", () => {
      it("should collect all errors from multiple invalid roles", () => {
        const result = validateRoles([
          { name: "", maxParticipants: 10 },
          { name: "Good Role", maxParticipants: 0 },
          { name: "Too Big", maxParticipants: 1000 },
        ]);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors.length).toBeGreaterThanOrEqual(3);
        }
      });
    });
  });

  describe("validatePricing", () => {
    describe("free events", () => {
      it("should accept undefined pricing (defaults to free)", () => {
        const result = validatePricing(undefined);
        expect(result.valid).toBe(true);
      });

      it("should accept null pricing", () => {
        const result = validatePricing(null as any);
        expect(result.valid).toBe(true);
      });

      it("should accept explicit isFree: true", () => {
        const result = validatePricing({ isFree: true });
        expect(result.valid).toBe(true);
      });

      it("should accept isFree: true with undefined price", () => {
        const result = validatePricing({ isFree: true, price: undefined });
        expect(result.valid).toBe(true);
      });

      it("should reject free event with price set", () => {
        const result = validatePricing({ isFree: true, price: 50 });

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe("Free events should not have a price");
        }
      });

      it("should accept empty pricing object (defaults to free)", () => {
        const result = validatePricing({});
        expect(result.valid).toBe(true);
      });
    });

    describe("paid events", () => {
      it("should accept valid paid event with price", () => {
        const result = validatePricing({ isFree: false, price: 25 });
        expect(result.valid).toBe(true);
      });

      it("should accept minimum price of $1", () => {
        const result = validatePricing({ isFree: false, price: 1 });
        expect(result.valid).toBe(true);
      });

      it("should accept maximum price of $10000", () => {
        const result = validatePricing({ isFree: false, price: 10000 });
        expect(result.valid).toBe(true);
      });

      it("should reject paid event without price", () => {
        const result = validatePricing({ isFree: false });

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe("Price is required for paid events");
        }
      });

      it("should reject paid event with null price", () => {
        const result = validatePricing({ isFree: false, price: null as any });

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe("Price is required for paid events");
        }
      });

      it("should reject price below minimum", () => {
        const result = validatePricing({ isFree: false, price: 0.5 });

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe("Minimum price is $1 for paid events");
        }
      });

      it("should reject zero price", () => {
        const result = validatePricing({ isFree: false, price: 0 });

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe("Minimum price is $1 for paid events");
        }
      });

      it("should reject negative price", () => {
        const result = validatePricing({ isFree: false, price: -10 });

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe("Minimum price is $1 for paid events");
        }
      });

      it("should reject price over maximum", () => {
        const result = validatePricing({ isFree: false, price: 10001 });

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe("Maximum price is $10,000");
        }
      });

      it("should reject NaN price", () => {
        const result = validatePricing({ isFree: false, price: NaN });

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe("Price must be a valid number");
        }
      });

      it("should reject non-number price", () => {
        const result = validatePricing({ isFree: false, price: "50" as any });

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe("Price must be a valid number");
        }
      });
    });
  });
});
