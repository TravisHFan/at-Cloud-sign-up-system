/**
 * Phone Utils Tests
 *
 * Tests the phone number formatting utilities:
 * - formatPhoneInput: Sanitize user input in real-time
 * - normalizePhoneForSubmit: Prepare phone for backend validation
 */

import { describe, it, expect } from "vitest";
import { formatPhoneInput, normalizePhoneForSubmit } from "../phone";

describe("phone utils", () => {
  describe("formatPhoneInput", () => {
    it("should preserve valid characters", () => {
      const input = "+1 (555) 123-4567";
      expect(formatPhoneInput(input)).toBe("+1 (555) 123-4567");
    });

    it("should remove invalid characters", () => {
      const input = "+1 (555) 123-4567 ext#999";
      const result = formatPhoneInput(input);
      expect(result).not.toContain("#");
      expect(result).not.toContain("ext");
    });

    it("should preserve plus sign at start", () => {
      expect(formatPhoneInput("+1234567890")).toBe("+1234567890");
    });

    it("should preserve parentheses", () => {
      expect(formatPhoneInput("(555) 123-4567")).toBe("(555) 123-4567");
    });

    it("should preserve hyphens", () => {
      expect(formatPhoneInput("555-123-4567")).toBe("555-123-4567");
    });

    it("should preserve dots/periods", () => {
      expect(formatPhoneInput("555.123.4567")).toBe("555.123.4567");
    });

    it("should normalize multiple spaces to single space", () => {
      expect(formatPhoneInput("555   123   4567")).toBe("555 123 4567");
    });

    it("should trim leading and trailing spaces", () => {
      expect(formatPhoneInput("  555 123 4567  ")).toBe("555 123 4567");
    });

    it("should handle empty string", () => {
      expect(formatPhoneInput("")).toBe("");
    });

    it("should handle all digits", () => {
      expect(formatPhoneInput("1234567890")).toBe("1234567890");
    });

    it("should handle international format", () => {
      expect(formatPhoneInput("+44 20 7946 0958")).toBe("+44 20 7946 0958");
    });

    it("should remove letters", () => {
      const input = "555-CALL-NOW";
      const result = formatPhoneInput(input);
      expect(result).not.toMatch(/[A-Z]/);
      expect(result).toBe("555--");
    });

    it("should remove special symbols", () => {
      expect(formatPhoneInput("555@123#4567")).toBe("5551234567");
    });

    it("should handle tabs and newlines", () => {
      expect(formatPhoneInput("555\t123\n4567")).toBe("555 123 4567");
    });

    it("should handle non-string input gracefully", () => {
      expect(formatPhoneInput(null as any)).toBe("");
      expect(formatPhoneInput(undefined as any)).toBe("");
      expect(formatPhoneInput(123 as any)).toBe("");
    });

    it("should preserve multiple plus signs (backend will reject invalid)", () => {
      // Allow user to type, backend validates
      expect(formatPhoneInput("++1234")).toBe("++1234");
    });

    it("should handle consecutive parentheses", () => {
      expect(formatPhoneInput("((555))")).toBe("((555))");
    });

    it("should handle only special chars", () => {
      expect(formatPhoneInput("###@@@")).toBe("");
    });

    it("should preserve European format", () => {
      expect(formatPhoneInput("+33 1 23 45 67 89")).toBe("+33 1 23 45 67 89");
    });

    it("should handle extension patterns without keywords", () => {
      // User might type "123 4567 ext 999" - remove 'ext'
      expect(formatPhoneInput("123 4567 ext 999")).toBe("123 4567 999");
    });
  });

  describe("normalizePhoneForSubmit", () => {
    it("should trim spaces", () => {
      expect(normalizePhoneForSubmit("  555-123-4567  ")).toBe("555-123-4567");
    });

    it("should collapse multiple consecutive spaces", () => {
      expect(normalizePhoneForSubmit("555   123   4567")).toBe("555 123 4567");
    });

    it("should preserve single spaces", () => {
      expect(normalizePhoneForSubmit("555 123 4567")).toBe("555 123 4567");
    });

    it("should handle empty string", () => {
      expect(normalizePhoneForSubmit("")).toBe("");
    });

    it("should handle string with only spaces", () => {
      expect(normalizePhoneForSubmit("     ")).toBe("");
    });

    it("should preserve valid phone format", () => {
      expect(normalizePhoneForSubmit("+1 (555) 123-4567")).toBe(
        "+1 (555) 123-4567"
      );
    });

    it("should collapse tabs to single space", () => {
      expect(normalizePhoneForSubmit("555\t\t123\t\t4567")).toBe(
        "555 123 4567"
      );
    });

    it("should handle non-string input gracefully", () => {
      expect(normalizePhoneForSubmit(null as any)).toBe("");
      expect(normalizePhoneForSubmit(undefined as any)).toBe("");
      expect(normalizePhoneForSubmit(123 as any)).toBe("");
    });

    it("should handle newlines and mixed whitespace", () => {
      // normalizePhoneForSubmit only collapses 2+ spaces, doesn't remove newlines
      const result = normalizePhoneForSubmit("555\n  \t  123\n4567");
      // The newlines remain, but multiple spaces collapse to one
      expect(result).toContain("555");
      expect(result).toContain("123");
      expect(result).toContain("4567");
    });

    it("should not remove punctuation", () => {
      // normalizePhoneForSubmit only handles whitespace
      expect(normalizePhoneForSubmit("+1-555-123-4567")).toBe(
        "+1-555-123-4567"
      );
    });
  });

  describe("integration: formatPhoneInput + normalizePhoneForSubmit", () => {
    it("should clean and normalize user input end-to-end", () => {
      const userInput = "  +1 (555)  123-CALL  ";
      const formatted = formatPhoneInput(userInput);
      const normalized = normalizePhoneForSubmit(formatted);

      expect(formatted).toBe("+1 (555) 123-");
      expect(normalized).toBe("+1 (555) 123-");
    });

    it("should handle messy international input", () => {
      const userInput = "++44  20   7946  0958  ";
      const formatted = formatPhoneInput(userInput);
      const normalized = normalizePhoneForSubmit(formatted);

      expect(normalized).toBe("++44 20 7946 0958");
    });

    it("should produce empty string for invalid input", () => {
      const userInput = "   @@@###   ";
      const formatted = formatPhoneInput(userInput);
      const normalized = normalizePhoneForSubmit(formatted);

      expect(normalized).toBe("");
    });
  });
});
