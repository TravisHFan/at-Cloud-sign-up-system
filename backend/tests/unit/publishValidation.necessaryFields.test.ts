import { describe, it, expect } from "vitest";
import {
  getMissingNecessaryFieldsForPublish,
  validateEventForPublish,
  NECESSARY_PUBLISH_FIELDS_BY_FORMAT,
} from "../../src/utils/validatePublish";

// Minimal event factory (fields not under test can be dummies)
function makeEvent(partial: Partial<any> = {}): any {
  return {
    title: "Test Event",
    type: "Webinar",
    date: "2025-12-01",
    endDate: "2025-12-01",
    time: "10:00",
    endTime: "11:00",
    location: partial.location ?? "Room 1",
    organizer: "Organizer",
    createdBy: "507f1f77bcf86cd799439011", // dummy ObjectId string
    roles: [
      {
        id: "r1",
        name: "Attendee",
        description: "Attend",
        maxParticipants: 10,
        openToPublic: true,
      },
    ],
    format: partial.format ?? "Online",
    zoomLink: partial.zoomLink,
    meetingId: partial.meetingId,
    passcode: partial.passcode,
    purpose:
      partial.purpose ??
      "This is a sufficiently long purpose statement for testing publishing rules.",
    timeZone: partial.timeZone ?? "America/Los_Angeles",
    publish: false,
    ...partial,
  };
}

describe("getMissingNecessaryFieldsForPublish", () => {
  it("returns all virtual fields missing for Online", () => {
    const ev = makeEvent({
      format: "Online",
      zoomLink: "",
      meetingId: undefined,
      passcode: null,
    });
    expect(getMissingNecessaryFieldsForPublish(ev)).toEqual([
      "zoomLink",
      "meetingId",
      "passcode",
    ]);
  });

  it("returns location missing for In-person", () => {
    const ev = makeEvent({ format: "In-person", location: "   " });
    expect(getMissingNecessaryFieldsForPublish(ev)).toEqual(["location"]);
  });

  it("returns hybrid combination missing subset only", () => {
    const ev = makeEvent({
      format: "Hybrid Participation",
      location: "Main Hall",
      zoomLink: "https://zoom.us/j/123",
      meetingId: "   ",
      passcode: undefined,
    });
    expect(getMissingNecessaryFieldsForPublish(ev)).toEqual([
      "meetingId",
      "passcode",
    ]);
  });

  it("returns empty when all satisfied for each format", () => {
    const online = makeEvent({
      format: "Online",
      zoomLink: "https://zoom.example/abc",
      meetingId: "123456",
      passcode: "code",
    });
    const inPerson = makeEvent({ format: "In-person", location: "Auditorium" });
    const hybrid = makeEvent({
      format: "Hybrid Participation",
      location: "Hall A",
      zoomLink: "https://zoom.example/xyz",
      meetingId: "7890",
      passcode: "p1",
    });
    expect(getMissingNecessaryFieldsForPublish(online)).toEqual([]);
    expect(getMissingNecessaryFieldsForPublish(inPerson)).toEqual([]);
    expect(getMissingNecessaryFieldsForPublish(hybrid)).toEqual([]);
  });
});

describe("validateEventForPublish integration with necessary fields", () => {
  it("produces MISSING_REQUIRED_FIELDS aggregate and per-field errors", () => {
    const ev = makeEvent({
      format: "Online",
      zoomLink: "",
      meetingId: undefined,
      passcode: undefined,
    });
    const result = validateEventForPublish(ev as any);
    expect(result.valid).toBe(false);
    const aggregate = result.errors.find(
      (e) => e.code === "MISSING_REQUIRED_FIELDS"
    );
    expect(aggregate).toBeTruthy();
    const missingFields = result.errors
      .filter((e) => e.code === "MISSING" && e.field !== "__aggregate__")
      .map((e) => e.field)
      .sort();
    expect(missingFields).toEqual(["meetingId", "passcode", "zoomLink"].sort());
  });

  it("is valid when all necessary fields present (Online)", () => {
    const ev = makeEvent({
      format: "Online",
      zoomLink: "https://zoom.us/j/abc",
      meetingId: "111222",
      passcode: "pass",
    });
    const result = validateEventForPublish(ev as any);
    expect(result.valid).toBe(true);
  });
});

describe("NECESSARY_PUBLISH_FIELDS_BY_FORMAT sanity", () => {
  it("contains expected keys", () => {
    expect(Object.keys(NECESSARY_PUBLISH_FIELDS_BY_FORMAT).sort()).toEqual(
      ["Hybrid Participation", "In-person", "Online"].sort()
    );
  });
});
