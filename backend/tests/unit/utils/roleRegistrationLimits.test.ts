/**
 * Role Registration Limits Unit Tests
 *
 * Tests role-based registration limit functions:
 * - getMaxRolesPerEvent: Get max roles based on authorization
 * - getMaxRolesDescription: Get user-friendly description of limits
 */

import { describe, it, expect } from "vitest";
import {
  getMaxRolesPerEvent,
  getMaxRolesDescription,
  type UserAuthorization,
} from "../../../src/utils/roleRegistrationLimits";

describe("roleRegistrationLimits", () => {
  describe("getMaxRolesPerEvent", () => {
    describe("admin users", () => {
      it("should return Infinity for Super Admin", () => {
        expect(getMaxRolesPerEvent("Super Admin")).toBe(Infinity);
      });

      it("should return Infinity for Administrator", () => {
        expect(getMaxRolesPerEvent("Administrator")).toBe(Infinity);
      });
    });

    describe("authenticated users", () => {
      it("should return 5 for Leader", () => {
        expect(getMaxRolesPerEvent("Leader")).toBe(5);
      });

      it("should return 4 for Guest Expert", () => {
        expect(getMaxRolesPerEvent("Guest Expert")).toBe(4);
      });

      it("should return 3 for Participant", () => {
        expect(getMaxRolesPerEvent("Participant")).toBe(3);
      });
    });

    describe("unauthenticated/unknown users", () => {
      it("should return 1 for null authorization", () => {
        expect(getMaxRolesPerEvent(null)).toBe(1);
      });

      it("should return 1 for undefined authorization", () => {
        expect(getMaxRolesPerEvent(undefined)).toBe(1);
      });

      it("should return 1 for unknown authorization", () => {
        expect(getMaxRolesPerEvent("Unknown Role" as UserAuthorization)).toBe(
          1
        );
      });
    });
  });

  describe("getMaxRolesDescription", () => {
    it("should return unlimited message for Super Admin", () => {
      expect(getMaxRolesDescription("Super Admin")).toBe(
        "You have unlimited role registrations"
      );
    });

    it("should return unlimited message for Administrator", () => {
      expect(getMaxRolesDescription("Administrator")).toBe(
        "You have unlimited role registrations"
      );
    });

    it("should return limit message for Leader", () => {
      expect(getMaxRolesDescription("Leader")).toBe("maximum is 5");
    });

    it("should return limit message for Guest Expert", () => {
      expect(getMaxRolesDescription("Guest Expert")).toBe("maximum is 4");
    });

    it("should return limit message for Participant", () => {
      expect(getMaxRolesDescription("Participant")).toBe("maximum is 3");
    });

    it("should return limit message for null", () => {
      expect(getMaxRolesDescription(null)).toBe("maximum is 1");
    });

    it("should return limit message for undefined", () => {
      expect(getMaxRolesDescription(undefined)).toBe("maximum is 1");
    });
  });
});
