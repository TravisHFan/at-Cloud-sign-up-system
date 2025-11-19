import { describe, it, expect } from "vitest";
import { formatActorDisplay } from "../../../src/utils/systemMessageFormatUtils";

describe("systemMessageFormatUtils", () => {
  describe("formatActorDisplay", () => {
    it("should format actor with full name and role", () => {
      const actor = {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        role: "Super Admin",
      };

      const result = formatActorDisplay(actor);

      expect(result).toBe("Super Admin John Doe");
    });

    it("should handle actor with only first name", () => {
      const actor = {
        firstName: "Jane",
        email: "jane@example.com",
        role: "Admin",
      };

      const result = formatActorDisplay(actor);

      expect(result).toBe("Admin Jane");
    });

    it("should handle actor with only last name", () => {
      const actor = {
        lastName: "Smith",
        email: "smith@example.com",
        role: "Moderator",
      };

      const result = formatActorDisplay(actor);

      expect(result).toBe("Moderator Smith");
    });

    it("should fallback to email when no name provided", () => {
      const actor = {
        email: "noname@example.com",
        role: "User",
      };

      const result = formatActorDisplay(actor);

      expect(result).toBe("User noname@example.com");
    });

    it("should handle empty first and last names", () => {
      const actor = {
        firstName: "",
        lastName: "",
        email: "empty@example.com",
        role: "Guest",
      };

      const result = formatActorDisplay(actor);

      expect(result).toBe("Guest empty@example.com");
    });

    it("should trim whitespace from names", () => {
      const actor = {
        firstName: "  Alice  ",
        lastName: "  Johnson  ",
        email: "alice@example.com",
        role: "Manager",
      };

      const result = formatActorDisplay(actor);

      // Names should be joined with single space
      expect(result).toBe("Manager   Alice     Johnson  ");
    });

    it("should handle different role names", () => {
      const testCases = [
        {
          actor: {
            firstName: "Test",
            lastName: "User",
            email: "test@example.com",
            role: "Super Admin",
          },
          expected: "Super Admin Test User",
        },
        {
          actor: {
            firstName: "Test",
            lastName: "User",
            email: "test@example.com",
            role: "Admin",
          },
          expected: "Admin Test User",
        },
        {
          actor: {
            firstName: "Test",
            lastName: "User",
            email: "test@example.com",
            role: "Moderator",
          },
          expected: "Moderator Test User",
        },
        {
          actor: {
            firstName: "Test",
            lastName: "User",
            email: "test@example.com",
            role: "User",
          },
          expected: "User Test User",
        },
      ];

      for (const { actor, expected } of testCases) {
        expect(formatActorDisplay(actor)).toBe(expected);
      }
    });

    it("should handle names with special characters", () => {
      const actor = {
        firstName: "José",
        lastName: "García-Smith",
        email: "jose@example.com",
        role: "Admin",
      };

      const result = formatActorDisplay(actor);

      expect(result).toBe("Admin José García-Smith");
    });

    it("should handle very long names", () => {
      const actor = {
        firstName: "Verylongfirstname",
        lastName: "Verylonglastname",
        email: "long@example.com",
        role: "Admin",
      };

      const result = formatActorDisplay(actor);

      expect(result).toBe("Admin Verylongfirstname Verylonglastname");
    });

    it("should handle single character names", () => {
      const actor = {
        firstName: "A",
        lastName: "B",
        email: "ab@example.com",
        role: "User",
      };

      const result = formatActorDisplay(actor);

      expect(result).toBe("User A B");
    });

    it("should handle names with numbers", () => {
      const actor = {
        firstName: "User123",
        lastName: "Test456",
        email: "user@example.com",
        role: "Admin",
      };

      const result = formatActorDisplay(actor);

      expect(result).toBe("Admin User123 Test456");
    });

    it("should maintain role case sensitivity", () => {
      const testCases = [
        { role: "SUPER ADMIN", expected: "SUPER ADMIN John Doe" },
        { role: "super admin", expected: "super admin John Doe" },
        { role: "Super Admin", expected: "Super Admin John Doe" },
      ];

      for (const { role, expected } of testCases) {
        const actor = {
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          role,
        };
        expect(formatActorDisplay(actor)).toBe(expected);
      }
    });

    it("should handle undefined vs empty string for names", () => {
      const actorUndefined = {
        email: "test@example.com",
        role: "Admin",
      };

      const actorEmpty = {
        firstName: "",
        lastName: "",
        email: "test@example.com",
        role: "Admin",
      };

      expect(formatActorDisplay(actorUndefined)).toBe("Admin test@example.com");
      expect(formatActorDisplay(actorEmpty)).toBe("Admin test@example.com");
    });

    it("should handle email with special characters", () => {
      const actor = {
        email: "user+tag@example.co.uk",
        role: "User",
      };

      const result = formatActorDisplay(actor);

      expect(result).toBe("User user+tag@example.co.uk");
    });

    it("should format multiple actors consistently", () => {
      const actors = [
        {
          firstName: "Alice",
          lastName: "Smith",
          email: "alice@example.com",
          role: "Admin",
        },
        {
          firstName: "Bob",
          lastName: "Jones",
          email: "bob@example.com",
          role: "Moderator",
        },
        {
          firstName: "Carol",
          lastName: "White",
          email: "carol@example.com",
          role: "User",
        },
      ];

      const results = actors.map(formatActorDisplay);

      expect(results).toEqual([
        "Admin Alice Smith",
        "Moderator Bob Jones",
        "User Carol White",
      ]);
    });
  });
});
