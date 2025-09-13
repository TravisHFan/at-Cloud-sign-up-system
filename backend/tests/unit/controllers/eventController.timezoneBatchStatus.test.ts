import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Reuse existing mocking style by mocking the models module.
vi.mock("../../../src/models", () => {
  return {
    Event: Object.assign(vi.fn(), {
      find: vi.fn(),
      findByIdAndUpdate: vi.fn(),
    }),
  };
});

vi.mock("../../../src/services", () => ({
  CachePatterns: {
    invalidateEventCache: vi.fn(),
    invalidateAnalyticsCache: vi.fn(),
  },
}));

import { EventController } from "../../../src/controllers/eventController";
import { Event } from "../../../src/models";
import { CachePatterns } from "../../../src/services";

// Helper to build a mock ObjectId-like value (string works for our expectation usage)
const mockId = "507f1f77bcf86cd799439011"; // valid hex length 24

/**
 * Regression test: ensure batch status updater keeps an America/Los_Angeles event
 * with local time now inside (inclusive start, exclusive end) window classified as ongoing.
 * Scenario: Event 2025-08-11 16:00-18:00 America/Los_Angeles. At 16:45 PDT (23:45Z) status should remain ongoing.
 */

describe("updateAllEventStatusesHelper timezone regression", () => {
  const pacificMidWindowUtc = new Date("2025-08-12T00:45:00Z"); // 2025-08-11 17:45 PDT? Wait DST check: PDT offset -07, so 23:45Z = 16:45 PDT. Use 23:45Z.
  const targetNow = new Date("2025-08-12T00:45:00Z");
  // Actually 2025-08-11T23:45:00Z corresponds to 16:45 PDT (UTC-7). Correcting timestamp.
  const correctTargetNow = new Date("2025-08-11T23:45:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(correctTargetNow);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps event ongoing at 16:45 local when end is 18:00", async () => {
    // Arrange: existing stored status is upcoming to force an update if miscomputed.
    const events = [
      {
        _id: mockId as any,
        date: "2025-08-11",
        endDate: "2025-08-11",
        time: "16:00",
        endTime: "18:00",
        status: "upcoming", // prior stored value (e.g. before window started)
        timeZone: "America/Los_Angeles",
      },
    ];

    // Mock Event.find returning chain supporting select().lean()
    (Event.find as any).mockReturnValue({
      select: vi.fn().mockImplementation((fields: string) => {
        // Ensure the projection now includes timeZone field
        expect(fields.split(/\s+/).includes("timeZone")).toBe(true);
        return {
          lean: vi.fn().mockResolvedValue(events),
        };
      }),
    });

    // Capture updates performed
    const updates: Array<{ id: any; update: any }> = [];
    // Provide a lightweight mock compatible with expected signature (returning a thenable-like or plain value)
    (Event.findByIdAndUpdate as any).mockImplementation(
      (id: any, update: any) => {
        updates.push({ id, update });
        events[0].status = update.status;
        return { exec: () => Promise.resolve({}) } as any;
      }
    );

    // Act
    const updatedCount = await (
      EventController as any
    ).updateAllEventStatusesHelper();

    // Assert
    expect(updatedCount).toBe(1); // It should perform an update because stored was 'upcoming' but should now be 'ongoing'
    expect(updates).toHaveLength(1);
    expect(updates[0].update.status).toBe("ongoing");
    expect(CachePatterns.invalidateEventCache).toHaveBeenCalledWith(mockId);
    expect(CachePatterns.invalidateAnalyticsCache).toHaveBeenCalled();
  });
});
