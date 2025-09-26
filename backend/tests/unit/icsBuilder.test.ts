import { describe, it, expect } from "vitest";
import { buildRegistrationICS } from "../../src/services/ICSBuilder";

// Minimal fake event shape satisfying the Pick<> in builder
const baseEvent = {
  _id: "evt123",
  title: "Sample Event",
  date: "2025-10-01",
  endDate: "2025-10-01",
  time: "18:00",
  endTime: "19:30",
  location: "Online / Zoom",
  purpose: "Deep dive into features, lines: one, two",
  timeZone: "UTC",
};

describe("buildRegistrationICS", () => {
  it("produces a valid minimal VCALENDAR with role info", () => {
    const { filename, content } = buildRegistrationICS({
      event: baseEvent as any,
      role: {
        name: "Attendee",
        description: "General access; bring questions",
      },
      attendeeEmail: "user@example.com",
    });

    expect(filename).toMatch(/\.ics$/);
    expect(content).toContain("BEGIN:VCALENDAR");
    expect(content).toContain("END:VCALENDAR");
    expect(content).toContain("BEGIN:VEVENT");
    expect(content).toMatch(/SUMMARY:Sample Event/);
    expect(content).toMatch(/Attendee/);
    expect(content).toMatch(/DESCRIPTION:/);
    // Escaping checks (comma + semicolon + newline -> \n)
    expect(content).toMatch(/General access\\; bring questions/);
    // Purpose line keeps commas escaped and remains on one line; check escaped commas
    expect(content).toMatch(/lines: one\\, two/);
    expect(content).toMatch(/LOCATION:Online \/ Zoom/);
  });

  it("omits role details when no role provided", () => {
    const { content } = buildRegistrationICS({
      event: baseEvent as any,
      role: null,
      attendeeEmail: "user2@example.com",
    });
    expect(content).toMatch(/SUMMARY:Sample Event\r?\n/);
  });
});
