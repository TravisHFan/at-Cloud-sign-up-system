import { describe, it, expect } from "vitest";
import {
  toInstantFromWallClock,
  instantToWallClock,
} from "../../src/utils/event/timezoneUtils";

describe("Event time helpers (DST edge cases)", () => {
  it("rounds forward nonexistent DST time to next representable wall time (spring-forward)", () => {
    // US DST starts on 2025-03-09 in America/Los_Angeles; 02:00 -> 03:00 skip
    const tz = "America/Los_Angeles";
    const instant: Date = toInstantFromWallClock("2025-03-09", "02:30", tz);
    const wall = instantToWallClock(instant, tz);
    expect(wall.date).toBe("2025-03-09");
    // Expect time to be at or after 03:00 (e.g., 03:00) due to spring-forward gap
    expect(
      ["03:00", "03:01", "03:15", "03:30"].some((t) => wall.time >= t)
    ).toBe(true);
  });

  it("round-trips a normal representable time without DST adjustments", () => {
    const tz = "America/Los_Angeles";
    const instant: Date = toInstantFromWallClock("2025-02-10", "10:15", tz);
    const wall = instantToWallClock(instant, tz);
    expect(wall).toEqual({ date: "2025-02-10", time: "10:15" });
  });
});
