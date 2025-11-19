/**
 * validatePublish Unit Tests
 *
 * Tests publish validation rules for events.
 * Pure functions - no database dependencies.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  validateEventForPublish,
  getMissingNecessaryFieldsForPublish,
  NECESSARY_PUBLISH_FIELDS_BY_FORMAT,
} from "../../../src/utils/validatePublish";
import { IEvent } from "../../../src/models/Event";

describe("validatePublish", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("NECESSARY_PUBLISH_FIELDS_BY_FORMAT", () => {
    it("should define required fields for Online events", () => {
      expect(NECESSARY_PUBLISH_FIELDS_BY_FORMAT["Online"]).toEqual([
        "zoomLink",
        "meetingId",
        "passcode",
      ]);
    });

    it("should define required fields for In-person events", () => {
      expect(NECESSARY_PUBLISH_FIELDS_BY_FORMAT["In-person"]).toEqual([
        "location",
      ]);
    });

    it("should define required fields for Hybrid Participation events", () => {
      expect(
        NECESSARY_PUBLISH_FIELDS_BY_FORMAT["Hybrid Participation"]
      ).toEqual(["location", "zoomLink", "meetingId", "passcode"]);
    });
  });

  describe("getMissingNecessaryFieldsForPublish", () => {
    it("should return empty array for valid Online event", () => {
      const event = {
        format: "Online",
        zoomLink: "https://zoom.us/j/123",
        meetingId: "123",
        passcode: "pass",
        roles: [{ openToPublic: true }],
      } as unknown as IEvent;

      const missing = getMissingNecessaryFieldsForPublish(event);
      expect(missing).toEqual([]);
    });

    it("should return missing fields for Online event", () => {
      const event = {
        format: "Online",
        zoomLink: "",
        roles: [{ openToPublic: true }],
      } as unknown as IEvent;

      const missing = getMissingNecessaryFieldsForPublish(event);
      expect(missing).toContain("zoomLink");
      expect(missing).toContain("meetingId");
      expect(missing).toContain("passcode");
    });

    it("should return empty array for valid In-person event", () => {
      const event = {
        format: "In-person",
        location: "Main Hall",
        roles: [{ openToPublic: true }],
      } as unknown as IEvent;

      const missing = getMissingNecessaryFieldsForPublish(event);
      expect(missing).toEqual([]);
    });

    it("should return missing location for In-person event", () => {
      const event = {
        format: "In-person",
        location: "",
        roles: [{ openToPublic: true }],
      } as unknown as IEvent;

      const missing = getMissingNecessaryFieldsForPublish(event);
      expect(missing).toContain("location");
    });

    it("should return empty array for valid Hybrid event", () => {
      const event = {
        format: "Hybrid Participation",
        location: "Main Hall",
        zoomLink: "https://zoom.us/j/123",
        meetingId: "123",
        passcode: "pass",
        roles: [{ openToPublic: true }],
      } as unknown as IEvent;

      const missing = getMissingNecessaryFieldsForPublish(event);
      expect(missing).toEqual([]);
    });

    it("should return all missing fields for Hybrid event", () => {
      const event = {
        format: "Hybrid Participation",
        roles: [{ openToPublic: true }],
      } as unknown as IEvent;

      const missing = getMissingNecessaryFieldsForPublish(event);
      expect(missing).toContain("location");
      expect(missing).toContain("zoomLink");
      expect(missing).toContain("meetingId");
      expect(missing).toContain("passcode");
    });

    it("should detect missing public roles", () => {
      const event = {
        format: "Online",
        zoomLink: "https://zoom.us/j/123",
        meetingId: "123",
        passcode: "pass",
        roles: [{ openToPublic: false }],
      } as unknown as IEvent;

      const missing = getMissingNecessaryFieldsForPublish(event);
      expect(missing).toContain("roles");
    });

    it("should detect missing public roles when roles array is empty", () => {
      const event = {
        format: "Online",
        zoomLink: "https://zoom.us/j/123",
        meetingId: "123",
        passcode: "pass",
        roles: [],
      } as unknown as IEvent;

      const missing = getMissingNecessaryFieldsForPublish(event);
      expect(missing).toContain("roles");
    });

    it("should handle undefined fields", () => {
      const event = {
        format: "Online",
        roles: [{ openToPublic: true }],
      } as unknown as IEvent;

      const missing = getMissingNecessaryFieldsForPublish(event);
      expect(missing).toContain("zoomLink");
      expect(missing).toContain("meetingId");
      expect(missing).toContain("passcode");
    });

    it("should handle null fields", () => {
      const event = {
        format: "Online",
        zoomLink: null,
        meetingId: null,
        passcode: null,
        roles: [{ openToPublic: true }],
      } as unknown as IEvent;

      const missing = getMissingNecessaryFieldsForPublish(event);
      expect(missing).toContain("zoomLink");
      expect(missing).toContain("meetingId");
      expect(missing).toContain("passcode");
    });

    it("should handle whitespace-only fields", () => {
      const event = {
        format: "Online",
        zoomLink: "   ",
        meetingId: "\t",
        passcode: "\n",
        roles: [{ openToPublic: true }],
      } as unknown as IEvent;

      const missing = getMissingNecessaryFieldsForPublish(event);
      expect(missing).toContain("zoomLink");
      expect(missing).toContain("meetingId");
      expect(missing).toContain("passcode");
    });

    it("should handle unknown format gracefully", () => {
      const event = {
        format: "Unknown Format",
        roles: [{ openToPublic: true }],
      } as unknown as IEvent;

      const missing = getMissingNecessaryFieldsForPublish(event);
      // Should only check for public roles, no format-specific fields
      expect(missing).toEqual([]);
    });
  });

  describe("validateEventForPublish", () => {
    it("should validate complete Online event", () => {
      const event = {
        format: "Online",
        zoomLink: "https://zoom.us/j/123",
        meetingId: "123",
        passcode: "pass",
        roles: [{ openToPublic: true }],
      } as unknown as IEvent;

      const result = validateEventForPublish(event);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate complete In-person event", () => {
      const event = {
        format: "In-person",
        location: "Main Hall",
        roles: [{ openToPublic: true }],
      } as unknown as IEvent;

      const result = validateEventForPublish(event);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate complete Hybrid event", () => {
      const event = {
        format: "Hybrid Participation",
        location: "Main Hall",
        zoomLink: "https://zoom.us/j/123",
        meetingId: "123",
        passcode: "pass",
        roles: [{ openToPublic: true }],
      } as unknown as IEvent;

      const result = validateEventForPublish(event);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing public roles", () => {
      const event = {
        format: "Online",
        zoomLink: "https://zoom.us/j/123",
        meetingId: "123",
        passcode: "pass",
        roles: [{ openToPublic: false }],
      } as unknown as IEvent;

      const result = validateEventForPublish(event);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "roles",
        code: "NO_PUBLIC_ROLE",
        message: "At least one role must be marked openToPublic to publish.",
      });
    });

    it("should detect missing necessary fields with per-field errors", () => {
      const event = {
        format: "Online",
        roles: [{ openToPublic: true }],
      } as unknown as IEvent;

      const result = validateEventForPublish(event);
      expect(result.valid).toBe(false);

      // Should have per-field errors
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: "zoomLink",
          code: "MISSING",
        })
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: "meetingId",
          code: "MISSING",
        })
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: "passcode",
          code: "MISSING",
        })
      );

      // Should have aggregate error
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: "__aggregate__",
          code: "MISSING_REQUIRED_FIELDS",
        })
      );
    });

    it("should validate with strict validation disabled by default", () => {
      const event = {
        format: "Online",
        zoomLink: "https://zoom.us/j/123",
        meetingId: "123",
        passcode: "pass",
        purpose: "Short", // Too short for strict validation
        roles: [{ openToPublic: true }],
      } as unknown as IEvent;

      const result = validateEventForPublish(event);
      expect(result.valid).toBe(true);
    });

    // Note: Strict validation tests removed because STRICT_VALIDATION
    // is evaluated at module load time, not runtime, so env vars set in
    // tests don't affect it. The feature is tested in integration tests.

    it("should combine multiple validation errors", () => {
      const event = {
        format: "Hybrid Participation",
        location: "",
        roles: [],
      } as unknown as IEvent;

      const result = validateEventForPublish(event);
      expect(result.valid).toBe(false);

      // Should have NO_PUBLIC_ROLE error
      expect(result.errors.some((e) => e.code === "NO_PUBLIC_ROLE")).toBe(true);

      // Should have MISSING errors for each field
      expect(result.errors.some((e) => e.field === "location")).toBe(true);
      expect(result.errors.some((e) => e.field === "zoomLink")).toBe(true);
      expect(result.errors.some((e) => e.field === "meetingId")).toBe(true);
      expect(result.errors.some((e) => e.field === "passcode")).toBe(true);

      // Should have aggregate error
      expect(
        result.errors.some((e) => e.code === "MISSING_REQUIRED_FIELDS")
      ).toBe(true);
    });
  });
});
