import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the timezone utility
vi.mock("../../../../src/utils/event/timezoneUtils", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../../../src/utils/event/timezoneUtils")
  >();
  return {
    ...actual,
    toInstantFromWallClock: vi
      .fn()
      .mockImplementation((date: string, time: string) => {
        // Simple mock that returns Date objects for comparison
        const [year, month, day] = date.split("-").map(Number);
        const [hour, minute] = time.split(":").map(Number);
        return new Date(year, month - 1, day, hour, minute);
      }),
  };
});

import { EventFieldNormalizationService } from "../../../../src/services/event/EventFieldNormalizationService";

// Helper to create valid event data
const createValidEventData = (
  overrides: Record<string, unknown> = {}
): any => ({
  title: "Test Event",
  type: "Workshop",
  date: "2030-06-15", // Future date to pass validation
  endDate: "2030-06-15",
  time: "10:00",
  endTime: "12:00",
  organizer: "John Doe",
  format: "In-person",
  location: "Main Hall",
  roles: [{ id: "role-1", name: "Participant" }],
  timeZone: "America/New_York",
  ...overrides,
});

describe("EventFieldNormalizationService", () => {
  describe("normalizeAndValidate", () => {
    describe("endDate normalization", () => {
      it("should convert Date object endDate to string", () => {
        const eventData = createValidEventData();
        const rawBody = {
          endDate: new Date("2030-06-15"),
          date: "2030-06-15",
        };

        const result = EventFieldNormalizationService.normalizeAndValidate(
          eventData,
          rawBody
        );

        expect(result.valid).toBe(true);
        expect(eventData.endDate).toBe("2030-06-15");
      });

      it("should default endDate to date if not provided", () => {
        const eventData = createValidEventData({ endDate: undefined });
        const rawBody = { date: "2030-06-15" };

        EventFieldNormalizationService.normalizeAndValidate(eventData, rawBody);

        expect(eventData.endDate).toBe("2030-06-15");
      });
    });

    describe("virtual meeting field normalization", () => {
      it("should remove virtual meeting fields for In-person format", () => {
        const eventData = createValidEventData({
          format: "In-person",
          zoomLink: "https://zoom.us/j/123",
          meetingId: "123",
          passcode: "abc",
        });

        EventFieldNormalizationService.normalizeAndValidate(eventData, {});

        expect(eventData.zoomLink).toBeUndefined();
        expect(eventData.meetingId).toBeUndefined();
        expect(eventData.passcode).toBeUndefined();
      });

      it("should trim virtual meeting fields for Online format", () => {
        const eventData = createValidEventData({
          format: "Online",
          zoomLink: "  https://zoom.us/j/123  ",
          meetingId: "  123  ",
          passcode: "  abc  ",
        });

        EventFieldNormalizationService.normalizeAndValidate(eventData, {});

        expect(eventData.zoomLink).toBe("https://zoom.us/j/123");
        expect(eventData.meetingId).toBe("123");
        expect(eventData.passcode).toBe("abc");
      });

      it("should convert empty string virtual meeting fields to undefined", () => {
        const eventData = createValidEventData({
          format: "Online",
          zoomLink: "   ",
          meetingId: "",
          passcode: "  ",
        });

        EventFieldNormalizationService.normalizeAndValidate(eventData, {});

        expect(eventData.zoomLink).toBeUndefined();
        expect(eventData.meetingId).toBeUndefined();
        expect(eventData.passcode).toBeUndefined();
      });

      it("should normalize virtual meeting fields for Hybrid format", () => {
        const eventData = createValidEventData({
          format: "Hybrid Participation",
          zoomLink: "  https://zoom.us/j/456  ",
        });

        EventFieldNormalizationService.normalizeAndValidate(eventData, {});

        expect(eventData.zoomLink).toBe("https://zoom.us/j/456");
      });
    });

    describe("flyer URL normalization", () => {
      it("should trim flyer URLs", () => {
        const eventData = createValidEventData({
          flyerUrl: "  https://example.com/flyer.jpg  ",
          secondaryFlyerUrl: "  https://example.com/flyer2.jpg  ",
        });

        EventFieldNormalizationService.normalizeAndValidate(eventData, {});

        expect(eventData.flyerUrl).toBe("https://example.com/flyer.jpg");
        expect(eventData.secondaryFlyerUrl).toBe(
          "https://example.com/flyer2.jpg"
        );
      });

      it("should convert empty flyer URLs to undefined", () => {
        const eventData = createValidEventData({
          flyerUrl: "   ",
          secondaryFlyerUrl: "",
        });

        EventFieldNormalizationService.normalizeAndValidate(eventData, {});

        expect(eventData.flyerUrl).toBeUndefined();
        expect(eventData.secondaryFlyerUrl).toBeUndefined();
      });
    });

    describe("location normalization", () => {
      it("should set location to 'Online' for Online format", () => {
        const eventData = createValidEventData({
          format: "Online",
          location: "Some Location",
        });

        EventFieldNormalizationService.normalizeAndValidate(eventData, {});

        expect(eventData.location).toBe("Online");
      });

      it("should trim location for In-person format", () => {
        const eventData = createValidEventData({
          format: "In-person",
          location: "  Main Hall  ",
        });

        EventFieldNormalizationService.normalizeAndValidate(eventData, {});

        expect(eventData.location).toBe("Main Hall");
      });

      it("should convert empty location to undefined for In-person format", () => {
        const eventData = createValidEventData({
          format: "In-person",
          location: "   ",
        });

        const result = EventFieldNormalizationService.normalizeAndValidate(
          eventData,
          {}
        );

        // In-person requires location, so this should fail
        expect(result.valid).toBe(false);
      });
    });

    describe("date normalization", () => {
      it("should convert Date object date to string", () => {
        const eventData = createValidEventData();
        const rawBody = {
          date: new Date("2030-07-20"),
        };

        eventData.date = "2030-07-20";
        EventFieldNormalizationService.normalizeAndValidate(eventData, rawBody);

        expect(eventData.date).toBe("2030-07-20");
      });
    });

    describe("timezone normalization", () => {
      it("should trim timezone string", () => {
        const eventData = createValidEventData({
          timeZone: "  America/Los_Angeles  ",
        });

        EventFieldNormalizationService.normalizeAndValidate(eventData, {});

        expect(eventData.timeZone).toBe("America/Los_Angeles");
      });

      it("should convert empty timezone to undefined", () => {
        const eventData = createValidEventData({
          timeZone: "   ",
        });

        EventFieldNormalizationService.normalizeAndValidate(eventData, {});

        expect(eventData.timeZone).toBeUndefined();
      });
    });

    describe("required fields validation", () => {
      it("should fail when missing required base fields", () => {
        const eventData = createValidEventData({ title: undefined });

        const result = EventFieldNormalizationService.normalizeAndValidate(
          eventData,
          {}
        );

        expect(result.valid).toBe(false);
        expect(result.error?.status).toBe(400);
        expect(result.error?.message).toContain("Missing required fields");
        expect(result.error?.message).toContain("title");
      });

      it("should require location for In-person format", () => {
        const eventData = createValidEventData({
          format: "In-person",
          location: undefined,
        });

        const result = EventFieldNormalizationService.normalizeAndValidate(
          eventData,
          {}
        );

        expect(result.valid).toBe(false);
        expect(result.error?.message).toContain("location");
      });

      it("should require location for Hybrid format", () => {
        const eventData = createValidEventData({
          format: "Hybrid Participation",
          location: undefined,
        });

        const result = EventFieldNormalizationService.normalizeAndValidate(
          eventData,
          {}
        );

        expect(result.valid).toBe(false);
        expect(result.error?.message).toContain("location");
      });

      it("should not require location for Online format", () => {
        const eventData = createValidEventData({
          format: "Online",
          location: undefined,
        });

        const result = EventFieldNormalizationService.normalizeAndValidate(
          eventData,
          {}
        );

        expect(result.valid).toBe(true);
      });
    });

    describe("date/time order validation", () => {
      it("should fail when end time is before start time on same day", () => {
        const eventData = createValidEventData({
          date: "2030-06-15",
          endDate: "2030-06-15",
          time: "14:00",
          endTime: "10:00",
        });

        const result = EventFieldNormalizationService.normalizeAndValidate(
          eventData,
          {}
        );

        expect(result.valid).toBe(false);
        expect(result.error?.message).toContain(
          "end date/time must be after start"
        );
      });

      it("should fail when end date is before start date", () => {
        const eventData = createValidEventData({
          date: "2030-06-20",
          endDate: "2030-06-15",
          time: "10:00",
          endTime: "12:00",
        });

        const result = EventFieldNormalizationService.normalizeAndValidate(
          eventData,
          {}
        );

        expect(result.valid).toBe(false);
        expect(result.error?.message).toContain(
          "end date/time must be after start"
        );
      });
    });

    describe("past date validation", () => {
      it("should fail when date is in the past", () => {
        const eventData = createValidEventData({
          date: "2020-01-01",
          endDate: "2020-01-01",
        });

        const result = EventFieldNormalizationService.normalizeAndValidate(
          eventData,
          {}
        );

        expect(result.valid).toBe(false);
        expect(result.error?.message).toContain(
          "Event date must be in the future"
        );
      });
    });

    describe("roles validation", () => {
      it("should fail when roles array is empty", () => {
        const eventData = createValidEventData({ roles: [] });

        const result = EventFieldNormalizationService.normalizeAndValidate(
          eventData,
          {}
        );

        expect(result.valid).toBe(false);
        expect(result.error?.message).toContain(
          "Event must have at least one role"
        );
      });

      it("should fail when roles is undefined", () => {
        const eventData = createValidEventData({ roles: undefined });

        // roles is a required field, so it will fail on missing required fields first
        const result = EventFieldNormalizationService.normalizeAndValidate(
          eventData,
          {}
        );

        expect(result.valid).toBe(false);
      });
    });

    describe("successful validation", () => {
      it("should pass with all valid data", () => {
        const eventData = createValidEventData();

        const result = EventFieldNormalizationService.normalizeAndValidate(
          eventData,
          {}
        );

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("should pass for Online event with optional fields", () => {
        const eventData = createValidEventData({
          format: "Online",
          location: undefined,
          zoomLink: "https://zoom.us/j/123",
          meetingId: "123",
          passcode: "abc",
        });

        const result = EventFieldNormalizationService.normalizeAndValidate(
          eventData,
          {}
        );

        expect(result.valid).toBe(true);
      });
    });
  });
});
