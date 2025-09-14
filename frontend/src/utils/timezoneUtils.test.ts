import { describe, it, expect } from "vitest";
import {
  formatViewerLocalTime,
  findUtcInstantFromLocal,
} from "./timezoneUtils";

// NOTE: These tests rely on the environment's Intl implementation. They assert invariants
// that should hold regardless of the host machine timezone.

describe("timezoneUtils", () => {
  it("findUtcInstantFromLocal returns a Date for valid input", () => {
    const dt = findUtcInstantFromLocal({
      date: "2025-03-29",
      time: "15:30",
      timeZone: "America/New_York",
    });
    expect(dt).toBeInstanceOf(Date);
  });

  it("formatViewerLocalTime returns HH:mm string", () => {
    const s = formatViewerLocalTime({
      date: "2025-03-29",
      time: "15:30",
      timeZone: "America/New_York",
    });
    expect(s).toMatch(/^\d{2}:\d{2}$/);
  });

  it("returns null for invalid date", () => {
    const s = formatViewerLocalTime({
      date: "invalid",
      time: "15:30",
      timeZone: "America/New_York",
    } as any);
    expect(s).toBeNull();
  });

  it("handles missing timezone by constructing local date", () => {
    const dt = findUtcInstantFromLocal({ date: "2025-03-29", time: "15:30" });
    expect(dt).toBeInstanceOf(Date);
  });
});
