import { describe, it, expect } from "vitest";
import { formatEventDateTimeRangeInViewerTZ } from "../../utils/eventStatsUtils";

// Helper to count regex matches
function countMatches(text: string, regex: RegExp): number {
  const m = text.match(regex);
  return m ? m.length : 0;
}

describe("formatEventDateTimeRangeInViewerTZ", () => {
  it("renders same-day as full start date+time - end time only", () => {
    const out = formatEventDateTimeRangeInViewerTZ(
      "2025-08-16",
      "09:00",
      "11:00"
    );
    // Should contain exactly one year (left side has date, right side time only)
    expect(countMatches(out, /\b\d{4}\b/g)).toBe(1);
    expect(out).toMatch(/ - /);
  });

  it("renders multi-day with full date+time on both sides", () => {
    const out = formatEventDateTimeRangeInViewerTZ(
      "2025-08-16",
      "21:00",
      "06:00",
      "America/New_York",
      "2025-08-17"
    );
    // Two years present -> two full dates (left and right)
    expect(countMatches(out, /\b\d{4}\b/g)).toBe(2);
    expect(out).toMatch(/ - /);
  });

  it("supports overnight events when endDate is after start date (earlier endTime)", () => {
    const out = formatEventDateTimeRangeInViewerTZ(
      "2025-08-16",
      "23:30",
      "01:00",
      "America/Los_Angeles",
      "2025-08-17"
    );
    // Overnight -> two full dates
    expect(countMatches(out, /\b\d{4}\b/g)).toBe(2);
  });

  it("handles DST boundary times without throwing (spring forward in America/New_York)", () => {
    const out = formatEventDateTimeRangeInViewerTZ(
      "2025-03-09",
      "01:30",
      "03:30",
      "America/New_York"
    );
    expect(out).toContain(" - ");
    // Contains weekday and month abbreviations (en-US), e.g., "Sun, Mar"
    expect(out).toMatch(/\b\w{3},\s\w{3}\b/);
  });

  it("falls back gracefully on invalid timezone", () => {
    const out = formatEventDateTimeRangeInViewerTZ(
      "2025-08-16",
      "09:00",
      "10:00",
      "Invalid/TimeZone"
    );
    // Should still render a readable range
    expect(out).toMatch(/ - /);
    // Likely only one full date on the left side
    expect(countMatches(out, /\b\d{4}\b/g)).toBe(1);
  });
});
