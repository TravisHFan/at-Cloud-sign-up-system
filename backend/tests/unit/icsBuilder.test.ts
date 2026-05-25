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
    const unfolded = content.replace(/\r\n[ \t]/g, "");
    expect(unfolded).toMatch(/General access\\; bring questions/);
    // Check escaped commas after unfolding folded ICS lines
    expect(unfolded).toMatch(/lines: one\\, two/);
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

  it("folds long content lines for calendar client compatibility", () => {
    const { content } = buildRegistrationICS({
      event: {
        ...baseEvent,
        title:
          "A very detailed community training event with a title long enough to require folding",
        purpose:
          "This description is intentionally long so strict iCalendar clients receive a folded content line instead of one oversized physical line. It includes commas, semicolons; and a newline\nfor escaping.",
        location:
          "12345 Very Long Venue Name, Building With A Long Name, Room With A Long Name, City",
        zoomLink:
          "https://example.com/meetings/very-long-calendar-link-that-should-be-folded-for-strict-clients",
      } as any,
      role: {
        name: "Participant with an unusually descriptive role name",
        description:
          "Role instructions that are long enough to contribute to the description folding behavior.",
      },
      attendeeEmail: "user3@example.com",
    });

    const physicalLines = content.split("\r\n").filter(Boolean);
    expect(physicalLines.some((line) => line.startsWith(" "))).toBe(true);
    for (const line of physicalLines) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }

    const unfolded = content.replace(/\r\n[ \t]/g, "");
    expect(unfolded).toContain(
      "SUMMARY:A very detailed community training event",
    );
    expect(unfolded).toContain("commas\\, semicolons\\;");
    expect(unfolded).toContain("newline\\nfor escaping");
    expect(unfolded).toContain("URL:https://example.com/meetings/");
  });
});
