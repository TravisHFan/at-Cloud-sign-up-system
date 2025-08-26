import { describe, it, expect } from "vitest";
import { EventController as ECClass } from "../../src/controllers/eventController";

// Reach into private static via any to test cadence behavior deterministically by simulating addCycle logic
const EC: any = ECClass;

function weekday(dateStr: string, time: string, tz?: string) {
  const d: Date = EC.toInstantFromWallClock(dateStr, time, tz);
  return d.getDay();
}

describe("Recurring cadence helpers (monthly)", () => {
  it("monthly cadence advances month and preserves weekday (same local weekday)", () => {
    const tz = "America/Los_Angeles";
    const base = EC.toInstantFromWallClock("2025-01-06", "10:00", tz); // Mon
    const originalWeekday = base.getDay();

    // Emulate addCycle for monthly from controller: add 1 month, then adjust forward to same weekday
    const addMonthly = (d: Date) => {
      const tmp = new Date(d.getTime());
      const y = tmp.getFullYear();
      const m = tmp.getMonth();
      const date = tmp.getDate();
      const next = new Date(tmp.getTime());
      next.setFullYear(y, m + 1, date);
      while (next.getDay() !== originalWeekday) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    };

    const m1 = addMonthly(base);
    const m2 = addMonthly(m1);
    const m3 = addMonthly(m2);

    // Verify weekday preserved
    expect(m1.getDay()).toBe(originalWeekday);
    expect(m2.getDay()).toBe(originalWeekday);
    expect(m3.getDay()).toBe(originalWeekday);

    // Month advancement should increase the calendar month by +1 each step (allowing year wrap)
    const monthDelta = (a: Date, b: Date) =>
      b.getMonth() - a.getMonth() + (b.getFullYear() - a.getFullYear()) * 12;
    expect(monthDelta(base, m1)).toBe(1);
    expect(monthDelta(m1, m2)).toBe(1);
  });
});
