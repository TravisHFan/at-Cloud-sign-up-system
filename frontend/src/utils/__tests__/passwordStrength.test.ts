import { describe, it, expect } from "vitest";
import { getPasswordStrength } from "../passwordStrength";

describe("passwordStrength utils", () => {
  describe("getPasswordStrength", () => {
    it("should return empty strength for empty password", () => {
      const result = getPasswordStrength("");

      expect(result).toEqual({ strength: 0, label: "" });
    });

    it("should score password with length >= 8 correctly", () => {
      const result = getPasswordStrength("12345678");

      expect(result.strength).toBeGreaterThan(0);
    });

    it("should detect lowercase letters", () => {
      const withLower = getPasswordStrength("abcdefgh");
      const withoutLower = getPasswordStrength("12345678");

      // Both have length (8+) and one other criteria
      expect(withLower.strength).toBe(2); // length + lower
      expect(withoutLower.strength).toBe(2); // length + numbers
    });

    it("should detect uppercase letters", () => {
      const withUpper = getPasswordStrength("ABCDEFGH");
      const noUpper = getPasswordStrength("abcdefgh");

      // Both have length + one letter type
      expect(withUpper.strength).toBe(2); // length + upper
      expect(noUpper.strength).toBe(2); // length + lower
    });

    it("should detect numbers", () => {
      const withNumber = getPasswordStrength("password1");
      const noNumber = getPasswordStrength("password");

      expect(withNumber.strength).toBe(3); // length + lower + number
      expect(noNumber.strength).toBe(2); // length + lower
    });

    it("should detect special characters", () => {
      const withSpecial = getPasswordStrength("password@");
      const noSpecial = getPasswordStrength("password");

      expect(withSpecial.strength).toBe(3); // length + lower + special
      expect(noSpecial.strength).toBe(2); // length + lower
    });
    it("should label very weak passwords correctly", () => {
      const result = getPasswordStrength("abc");

      expect(result.label).toBe("Very Weak");
      expect(result.strength).toBe(1);
    });

    it("should label weak passwords correctly", () => {
      const result = getPasswordStrength("abcdefgh");

      expect(result.label).toBe("Weak");
      expect(result.strength).toBe(2);
    });

    it("should label fair passwords correctly", () => {
      const result = getPasswordStrength("Abcdefgh");

      expect(result.label).toBe("Fair");
      expect(result.strength).toBe(3);
    });

    it("should label good passwords correctly", () => {
      const result = getPasswordStrength("Abcdefgh1");

      expect(result.label).toBe("Good");
      expect(result.strength).toBe(4);
    });

    it("should label strong passwords correctly", () => {
      const result = getPasswordStrength("Abcdefgh1@");

      expect(result.label).toBe("Strong");
      expect(result.strength).toBe(5);
    });

    it("should handle password with all criteria", () => {
      const result = getPasswordStrength("MyP@ssw0rd");

      expect(result.strength).toBe(5);
      expect(result.label).toBe("Strong");
    });

    it("should recognize all special characters from pattern", () => {
      const specialChars = ["@", "$", "!", "%", "*", "?", "&"];

      for (const char of specialChars) {
        const result = getPasswordStrength(`Password1${char}`);
        expect(result.strength).toBe(5);
      }
    });

    it("should not count other special characters", () => {
      const withOtherSpecial = getPasswordStrength("Password1#");
      const withValidSpecial = getPasswordStrength("Password1@");

      // # is not in the pattern [@$!%*?&]
      expect(withOtherSpecial.strength).toBe(4);
      expect(withValidSpecial.strength).toBe(5);
    });

    it("should handle short passwords", () => {
      const result = getPasswordStrength("Abc1@");

      // Less than 8 chars, so no length point
      expect(result.strength).toBe(4); // Upper, lower, number, special
      expect(result.label).toBe("Good");
    });

    it("should handle long but simple passwords", () => {
      const result = getPasswordStrength("aaaaaaaaaaa");

      // Length + lowercase only
      expect(result.strength).toBe(2);
      expect(result.label).toBe("Weak");
    });

    it("should handle numeric-only long passwords", () => {
      const result = getPasswordStrength("12345678");

      // Length + numbers
      expect(result.strength).toBe(2);
      expect(result.label).toBe("Weak");
    });

    it("should handle passwords with mixed case but no numbers or specials", () => {
      const result = getPasswordStrength("AbCdEfGh");

      // Length + lower + upper
      expect(result.strength).toBe(3);
      expect(result.label).toBe("Fair");
    });

    it("should handle edge case: exactly 8 characters", () => {
      const result = getPasswordStrength("Test1234");

      // Length + lower + upper + numbers
      expect(result.strength).toBe(4);
      expect(result.label).toBe("Good");
    });

    it("should handle edge case: 7 characters with all types", () => {
      const result = getPasswordStrength("Abc12@");

      // No length point (< 8), but has lower, upper, number, special
      expect(result.strength).toBe(4);
      expect(result.label).toBe("Good");
    });

    it("should handle password with repeating characters", () => {
      const result = getPasswordStrength("AAaaa111@@");

      // Still scores on variety, not uniqueness
      expect(result.strength).toBe(5);
      expect(result.label).toBe("Strong");
    });

    it("should handle password with spaces", () => {
      const result = getPasswordStrength("My Pass 123");

      // Space not in special char pattern
      expect(result.strength).toBe(4); // Length, lower, upper, numbers
    });

    it("should handle common password patterns", () => {
      const passwords = [
        { pass: "password", expected: 2 }, // length + lower
        { pass: "Password", expected: 3 }, // length + lower + upper
        { pass: "Password1", expected: 4 }, // length + lower + upper + number
        { pass: "Password1!", expected: 5 }, // all criteria
      ];

      for (const { pass, expected } of passwords) {
        const result = getPasswordStrength(pass);
        expect(result.strength).toBe(expected);
      }
    });

    it("should handle very long passwords", () => {
      const longPass = "A".repeat(100) + "bcdef1@";
      const result = getPasswordStrength(longPass);

      expect(result.strength).toBe(5);
      expect(result.label).toBe("Strong");
    });

    it("should handle single character password", () => {
      const result = getPasswordStrength("a");

      expect(result.strength).toBe(1); // Only lowercase
      expect(result.label).toBe("Very Weak");
    });

    it("should handle password with unicode characters", () => {
      const result = getPasswordStrength("Pässwörd123");

      // Should still detect length, mixed case, numbers
      expect(result.strength).toBeGreaterThanOrEqual(4);
    });

    it("should be case-sensitive for character detection", () => {
      const lowerOnly = getPasswordStrength("abcdefgh");
      const upperOnly = getPasswordStrength("ABCDEFGH");

      expect(lowerOnly.strength).toBe(2); // length + lower
      expect(upperOnly.strength).toBe(2); // length + upper
    });

    it("should handle passwords with multiple special characters", () => {
      const result = getPasswordStrength("P@ssw0rd!$");

      // Multiple specials still count as 1 point
      expect(result.strength).toBe(5);
      expect(result.label).toBe("Strong");
    });
  });
});
