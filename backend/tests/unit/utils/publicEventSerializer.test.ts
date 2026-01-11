/**
 * publicEventSerializer.test.ts
 *
 * Comprehensive unit tests for serializePublicEvent function.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { serializePublicEvent } from "../../../src/utils/publicEventSerializer";
import type { IEvent } from "../../../src/models/Event";
import Registration from "../../../src/models/Registration";
import GuestRegistration from "../../../src/models/GuestRegistration";

// Mock the models
vi.mock("../../../src/models/Registration", () => ({
  default: {
    aggregate: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../src/models/GuestRegistration", () => ({
  default: {
    aggregate: vi.fn().mockResolvedValue([]),
  },
}));

// Mock timezone search to return predictable values
vi.mock("../../../src/shared/time/timezoneSearch", () => ({
  findUtcInstantFromLocal: vi.fn((params: { date: string; time: string }) => {
    // Return a mock Date for predictable testing
    return new Date(`${params.date}T${params.time}:00Z`);
  }),
}));

/**
 * Helper to create a minimal mock event for testing
 */
function makeEvent(overrides: Partial<IEvent & { _id: any }> = {}): IEvent {
  return {
    _id: overrides._id || "evt123",
    title: overrides.title || "Test Event",
    purpose: overrides.purpose,
    agenda: overrides.agenda,
    disclaimer: overrides.disclaimer,
    date: overrides.date || "2025-06-15",
    endDate: overrides.endDate,
    time: overrides.time || "14:00",
    endTime: overrides.endTime || "16:00",
    timeZone: overrides.timeZone || "America/New_York",
    location: overrides.location || "Conference Room A",
    flyerUrl: overrides.flyerUrl,
    secondaryFlyerUrl: overrides.secondaryFlyerUrl,
    roles: overrides.roles || [],
    publicSlug: overrides.publicSlug || "test-event-slug",
    publish: true,
    format: overrides.format,
    pricing: overrides.pricing,
  } as unknown as IEvent;
}

describe("serializePublicEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Registration.aggregate).mockResolvedValue([]);
    vi.mocked(GuestRegistration.aggregate).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("basic fields serialization", () => {
    it("serializes event id correctly", async () => {
      const event = makeEvent({ _id: "abc123" });
      const result = await serializePublicEvent(event);
      expect(result.id).toBe("abc123");
    });

    it("serializes and sanitizes title", async () => {
      const event = makeEvent({ title: "  Test   Event   Title  " });
      const result = await serializePublicEvent(event);
      expect(result.title).toBe("Test Event Title");
    });

    it("truncates long titles to 200 characters", async () => {
      const longTitle = "A".repeat(300);
      const event = makeEvent({ title: longTitle });
      const result = await serializePublicEvent(event);
      expect(result.title.length).toBe(200);
    });

    it("serializes date and time fields", async () => {
      const event = makeEvent({
        date: "2025-07-20",
        time: "09:30",
        endTime: "11:30",
        endDate: "2025-07-21",
        timeZone: "Europe/London",
      });
      const result = await serializePublicEvent(event);
      expect(result.date).toBe("2025-07-20");
      expect(result.time).toBe("09:30");
      expect(result.endTime).toBe("11:30");
      expect(result.endDate).toBe("2025-07-21");
      expect(result.timeZone).toBe("Europe/London");
    });

    it("omits endDate if same as date", async () => {
      const event = makeEvent({
        date: "2025-07-20",
        endDate: undefined,
      });
      const result = await serializePublicEvent(event);
      expect(result.endDate).toBeUndefined();
    });

    it("serializes location with fallback to Online", async () => {
      // Create event without location default by explicitly setting null/undefined
      const event = {
        ...makeEvent(),
        location: null,
      } as unknown as IEvent;
      const result = await serializePublicEvent(event);
      expect(result.location).toBe("Online");
    });

    it("serializes provided location", async () => {
      const event = makeEvent({ location: "  Building A, Room 101  " });
      const result = await serializePublicEvent(event);
      expect(result.location).toBe("Building A, Room 101");
    });

    it("serializes publicSlug", async () => {
      const event = makeEvent({ publicSlug: "my-custom-slug" });
      const result = await serializePublicEvent(event);
      expect(result.slug).toBe("my-custom-slug");
    });

    it("handles missing publicSlug", async () => {
      // Explicitly set publicSlug to undefined/null after creation
      const event = {
        ...makeEvent(),
        publicSlug: undefined,
      } as unknown as IEvent;
      const result = await serializePublicEvent(event);
      expect(result.slug).toBe("");
    });

    it("serializes format field", async () => {
      const event = makeEvent({ format: "Hybrid Participation" });
      const result = await serializePublicEvent(event);
      expect(result.format).toBe("Hybrid Participation");
    });
  });

  describe("flyer URL serialization", () => {
    it("serializes flyerUrl when present", async () => {
      const event = makeEvent({
        flyerUrl: "https://example.com/flyer.png",
      });
      const result = await serializePublicEvent(event);
      expect(result.flyerUrl).toBe("https://example.com/flyer.png");
    });

    it("serializes secondaryFlyerUrl when present", async () => {
      const event = makeEvent({
        secondaryFlyerUrl: "https://example.com/flyer2.png",
      });
      const result = await serializePublicEvent(event);
      expect(result.secondaryFlyerUrl).toBe("https://example.com/flyer2.png");
    });

    it("omits flyerUrl when not present", async () => {
      const event = makeEvent({ flyerUrl: undefined });
      const result = await serializePublicEvent(event);
      expect(result.flyerUrl).toBeUndefined();
    });
  });

  describe("text sanitization (purpose, agenda, disclaimer)", () => {
    it("preserves newlines in purpose", async () => {
      const event = makeEvent({
        purpose: "Line 1\nLine 2\nLine 3",
      });
      const result = await serializePublicEvent(event);
      expect(result.purpose).toBe("Line 1\nLine 2\nLine 3");
    });

    it("normalizes CRLF to LF in agenda", async () => {
      const event = makeEvent({
        agenda: "Step 1\r\nStep 2\r\nStep 3",
      });
      const result = await serializePublicEvent(event);
      expect(result.agenda).toBe("Step 1\nStep 2\nStep 3");
    });

    it("collapses multiple spaces within lines", async () => {
      const event = makeEvent({
        agenda: "Word1   Word2    Word3",
      });
      const result = await serializePublicEvent(event);
      expect(result.agenda).toBe("Word1 Word2 Word3");
    });

    it("trims whitespace from each line", async () => {
      const event = makeEvent({
        agenda: "  Line 1  \n  Line 2  ",
      });
      const result = await serializePublicEvent(event);
      expect(result.agenda).toBe("Line 1\nLine 2");
    });

    it("truncates text to 2000 characters", async () => {
      const longText = "A".repeat(3000);
      const event = makeEvent({ purpose: longText });
      const result = await serializePublicEvent(event);
      expect(result.purpose?.length).toBe(2000);
    });

    it("handles undefined purpose", async () => {
      const event = makeEvent({ purpose: undefined });
      const result = await serializePublicEvent(event);
      expect(result.purpose).toBeUndefined();
    });

    it("handles empty purpose", async () => {
      const event = makeEvent({ purpose: "" });
      const result = await serializePublicEvent(event);
      expect(result.purpose).toBeUndefined();
    });

    it("serializes disclaimer with sanitization", async () => {
      const event = makeEvent({
        disclaimer: "  Important   notice  \n  Please read  ",
      });
      const result = await serializePublicEvent(event);
      expect(result.disclaimer).toBe("Important notice\nPlease read");
    });
  });

  describe("pricing serialization", () => {
    it("defaults to free when no pricing object", async () => {
      const event = makeEvent({ pricing: undefined });
      const result = await serializePublicEvent(event);
      expect(result.pricing).toEqual({ isFree: true });
    });

    it("serializes free event correctly", async () => {
      const event = makeEvent({
        pricing: { isFree: true, price: 0 } as any,
      });
      const result = await serializePublicEvent(event);
      expect(result.pricing?.isFree).toBe(true);
      expect(result.pricing?.price).toBe(0);
    });

    it("serializes paid event correctly", async () => {
      const event = makeEvent({
        pricing: { isFree: false, price: 1500 } as any,
      });
      const result = await serializePublicEvent(event);
      expect(result.pricing?.isFree).toBe(false);
      expect(result.pricing?.price).toBe(1500);
    });

    it("treats event with price but isFree not false as paid", async () => {
      const event = makeEvent({
        pricing: { price: 2500 } as any, // isFree not explicitly set
      });
      const result = await serializePublicEvent(event);
      expect(result.pricing?.isFree).toBe(false);
      expect(result.pricing?.price).toBe(2500);
    });

    it("treats event with isFree true and zero price as free", async () => {
      const event = makeEvent({
        pricing: { isFree: true, price: 0 } as any,
      });
      const result = await serializePublicEvent(event);
      expect(result.pricing?.isFree).toBe(true);
    });
  });

  describe("roles serialization", () => {
    it("filters to only public roles", async () => {
      const event = makeEvent({
        roles: [
          {
            id: "r1",
            name: "Public Role",
            openToPublic: true,
            maxParticipants: 10,
          },
          {
            id: "r2",
            name: "Private Role",
            openToPublic: false,
            maxParticipants: 5,
          },
        ] as any,
      });
      const result = await serializePublicEvent(event);
      expect(result.roles.length).toBe(1);
      expect(result.roles[0].name).toBe("Public Role");
    });

    it("calculates capacity remaining correctly", async () => {
      vi.mocked(Registration.aggregate).mockResolvedValue([
        { _id: "r1", count: 3 },
      ]);
      vi.mocked(GuestRegistration.aggregate).mockResolvedValue([
        { _id: "r1", count: 2 },
      ]);

      const event = makeEvent({
        roles: [
          {
            id: "r1",
            name: "Test Role",
            openToPublic: true,
            maxParticipants: 10,
            description: "A role",
          },
        ] as any,
      });
      const result = await serializePublicEvent(event);
      // 10 max - 3 users - 2 guests = 5 remaining
      expect(result.roles[0].capacityRemaining).toBe(5);
    });

    it("does not go below zero for capacity", async () => {
      vi.mocked(Registration.aggregate).mockResolvedValue([
        { _id: "r1", count: 15 },
      ]);

      const event = makeEvent({
        roles: [
          {
            id: "r1",
            name: "Test Role",
            openToPublic: true,
            maxParticipants: 10,
          },
        ] as any,
      });
      const result = await serializePublicEvent(event);
      expect(result.roles[0].capacityRemaining).toBe(0);
    });

    it("sanitizes role name and truncates to 100 chars", async () => {
      const longName = "B".repeat(150);
      const event = makeEvent({
        roles: [
          {
            id: "r1",
            name: `  ${longName}  `,
            openToPublic: true,
            maxParticipants: 10,
          },
        ] as any,
      });
      const result = await serializePublicEvent(event);
      expect(result.roles[0].name.length).toBe(100);
    });

    it("sanitizes role description preserving newlines", async () => {
      const event = makeEvent({
        roles: [
          {
            id: "r1",
            name: "Test Role",
            description: "Line 1\nLine 2",
            openToPublic: true,
            maxParticipants: 10,
          },
        ] as any,
      });
      const result = await serializePublicEvent(event);
      expect(result.roles[0].description).toBe("Line 1\nLine 2");
    });

    it("handles missing role description", async () => {
      const event = makeEvent({
        roles: [
          {
            id: "r1",
            name: "Test Role",
            openToPublic: true,
            maxParticipants: 10,
          },
        ] as any,
      });
      const result = await serializePublicEvent(event);
      expect(result.roles[0].description).toBe("");
    });

    it("handles empty roles array", async () => {
      const event = makeEvent({ roles: [] });
      const result = await serializePublicEvent(event);
      expect(result.roles).toEqual([]);
    });

    it("handles undefined roles", async () => {
      const event = makeEvent({ roles: undefined as any });
      const result = await serializePublicEvent(event);
      expect(result.roles).toEqual([]);
    });
  });

  describe("start/end ISO datetime generation", () => {
    it("generates start and end ISO strings", async () => {
      const event = makeEvent({
        date: "2025-06-15",
        time: "14:00",
        endTime: "16:00",
      });
      const result = await serializePublicEvent(event);
      expect(result.start).toBe("2025-06-15T14:00:00.000Z");
      expect(result.end).toBe("2025-06-15T16:00:00.000Z");
    });

    it("uses endDate for end time when provided", async () => {
      const event = makeEvent({
        date: "2025-06-15",
        endDate: "2025-06-16",
        time: "22:00",
        endTime: "02:00",
      });
      const result = await serializePublicEvent(event);
      expect(result.end).toContain("2025-06-16");
    });

    it("falls back to raw date/time when findUtcInstantFromLocal returns null", async () => {
      // Override the mock to return null for this test
      const { findUtcInstantFromLocal } = await import(
        "../../../src/shared/time/timezoneSearch"
      );
      vi.mocked(findUtcInstantFromLocal).mockReturnValue(null);

      const event = makeEvent({
        date: "2025-06-15",
        endDate: "2025-06-16",
        time: "14:00",
        endTime: "18:00",
      });
      const result = await serializePublicEvent(event);
      // Should fall back to simple ISO string construction
      expect(result.start).toBe("2025-06-15T14:00:00Z");
      expect(result.end).toBe("2025-06-16T18:00:00Z");
    });
  });
});
