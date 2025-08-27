import { describe, it, expect } from "vitest";
import { EventSnapshotBuilder } from "../../../src/services/EventSnapshotBuilder";

describe("EventSnapshotBuilder", () => {
  it("builds Registration snapshot with required fields and strings", () => {
    const event = {
      title: "My Event",
      date: "2025-12-01",
      time: "10:00",
      location: "Main Hall",
      type: "Conference",
    };
    const role = { name: "Speaker", description: "Talks" };
    const snap = EventSnapshotBuilder.buildRegistrationSnapshot(event, role);
    expect(snap).toEqual({
      title: "My Event",
      date: "2025-12-01",
      time: "10:00",
      location: "Main Hall",
      type: "Conference",
      roleName: "Speaker",
      roleDescription: "Talks",
    });
  });

  it("builds Guest snapshot with date as Date and roleName", () => {
    const event = {
      title: "Guest Event",
      date: "2025-12-01",
      location: "Room A",
    };
    const role = { name: "Guest Participant" };
    const snap = EventSnapshotBuilder.buildGuestSnapshot(event, role);
    expect(snap.title).toBe("Guest Event");
    expect(snap.location).toBe("Room A");
    expect(snap.roleName).toBe("Guest Participant");
    expect(snap.date instanceof Date).toBe(true);
  });
});
