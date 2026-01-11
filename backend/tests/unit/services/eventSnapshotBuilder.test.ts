import { describe, it, expect } from "vitest";
import { EventSnapshotBuilder } from "../../../src/services/EventSnapshotBuilder";

describe("EventSnapshotBuilder", () => {
  describe("buildRegistrationSnapshot", () => {
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

    it("handles missing event fields with empty string defaults", () => {
      const event = {};
      const role = { name: "Attendee" };
      const snap = EventSnapshotBuilder.buildRegistrationSnapshot(event, role);

      expect(snap.title).toBe("");
      expect(snap.date).toBe("");
      expect(snap.time).toBe("");
      expect(snap.location).toBe("");
      expect(snap.type).toBe("");
      expect(snap.roleName).toBe("Attendee");
    });

    it("handles undefined event fields", () => {
      const event = {
        title: undefined,
        date: undefined,
        time: undefined,
        location: undefined,
        type: undefined,
      };
      const role = { name: "Participant", description: undefined };
      const snap = EventSnapshotBuilder.buildRegistrationSnapshot(
        event as any,
        role as any
      );

      expect(snap.title).toBe("");
      expect(snap.date).toBe("");
      expect(snap.time).toBe("");
      expect(snap.location).toBe("");
      expect(snap.type).toBe("");
      expect(snap.roleDescription).toBe("");
    });

    it("handles null event fields", () => {
      const event = {
        title: null,
        date: null,
        time: null,
        location: null,
        type: null,
      };
      const role = { name: null, description: null };
      const snap = EventSnapshotBuilder.buildRegistrationSnapshot(
        event as any,
        role as any
      );

      expect(snap.title).toBe("");
      expect(snap.roleName).toBe("");
      expect(snap.roleDescription).toBe("");
    });

    it("handles missing role object", () => {
      const event = { title: "Test Event" };
      const snap = EventSnapshotBuilder.buildRegistrationSnapshot(
        event,
        undefined as any
      );

      expect(snap.title).toBe("Test Event");
      expect(snap.roleName).toBe("");
      expect(snap.roleDescription).toBe("");
    });

    it("converts numeric values to strings", () => {
      const event = {
        title: 123,
        date: 20251201,
        time: 1000,
        location: 456,
        type: 789,
      };
      const role = { name: 101, description: 202 };
      const snap = EventSnapshotBuilder.buildRegistrationSnapshot(
        event as any,
        role as any
      );

      expect(snap.title).toBe("123");
      expect(snap.date).toBe("20251201");
      expect(snap.time).toBe("1000");
      expect(snap.location).toBe("456");
      expect(snap.type).toBe("789");
      expect(snap.roleName).toBe("101");
      expect(snap.roleDescription).toBe("202");
    });

    it("preserves special characters in fields", () => {
      const event = {
        title: "Event with <special> & 'characters'",
        date: "2025-12-01",
        time: "10:00 AM",
        location: "Room #123 (Main)",
        type: "Workshop & Seminar",
      };
      const role = { name: "Q&A Speaker", description: "Handles Q&A sessions" };
      const snap = EventSnapshotBuilder.buildRegistrationSnapshot(event, role);

      expect(snap.title).toBe("Event with <special> & 'characters'");
      expect(snap.location).toBe("Room #123 (Main)");
      expect(snap.roleName).toBe("Q&A Speaker");
    });

    it("handles very long field values", () => {
      const longText = "A".repeat(1000);
      const event = {
        title: longText,
        date: "2025-12-01",
        time: "10:00",
        location: longText,
        type: "Conference",
      };
      const role = { name: "Speaker", description: longText };
      const snap = EventSnapshotBuilder.buildRegistrationSnapshot(event, role);

      expect(snap.title).toBe(longText);
      expect(snap.location).toBe(longText);
      expect(snap.roleDescription).toBe(longText);
    });
  });

  describe("buildGuestSnapshot", () => {
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

    it("handles Date object as date input", () => {
      const eventDate = new Date("2025-06-15T14:30:00Z");
      const event = {
        title: "Guest Event",
        date: eventDate,
        location: "Room B",
      };
      const role = { name: "Guest" };
      const snap = EventSnapshotBuilder.buildGuestSnapshot(event, role);

      expect(snap.date instanceof Date).toBe(true);
      expect(snap.date.getTime()).toBe(eventDate.getTime());
    });

    it("handles missing event fields with empty string defaults", () => {
      const event = {};
      const role = { name: "Guest" };
      const snap = EventSnapshotBuilder.buildGuestSnapshot(event, role);

      expect(snap.title).toBe("");
      expect(snap.location).toBe("");
      expect(snap.roleName).toBe("Guest");
      expect(snap.date instanceof Date).toBe(true);
    });

    it("handles missing role object", () => {
      const event = { title: "Guest Event", date: "2025-12-01" };
      const snap = EventSnapshotBuilder.buildGuestSnapshot(
        event,
        undefined as any
      );

      expect(snap.title).toBe("Guest Event");
      expect(snap.roleName).toBe("");
    });

    it("handles null event fields", () => {
      const event = {
        title: null,
        date: null,
        location: null,
      };
      const role = { name: null };
      const snap = EventSnapshotBuilder.buildGuestSnapshot(
        event as any,
        role as any
      );

      expect(snap.title).toBe("");
      expect(snap.location).toBe("");
      expect(snap.roleName).toBe("");
      expect(snap.date instanceof Date).toBe(true);
    });

    it("handles undefined event fields", () => {
      const event = {
        title: undefined,
        date: undefined,
        location: undefined,
      };
      const role = { name: undefined };
      const snap = EventSnapshotBuilder.buildGuestSnapshot(
        event as any,
        role as any
      );

      expect(snap.title).toBe("");
      expect(snap.location).toBe("");
      expect(snap.roleName).toBe("");
    });

    it("parses ISO date string correctly", () => {
      const event = {
        title: "ISO Date Event",
        date: "2025-03-15T09:00:00.000Z",
        location: "Conference Room",
      };
      const role = { name: "Attendee" };
      const snap = EventSnapshotBuilder.buildGuestSnapshot(event, role);

      expect(snap.date instanceof Date).toBe(true);
      expect(snap.date.toISOString()).toBe("2025-03-15T09:00:00.000Z");
    });

    it("handles invalid date string gracefully", () => {
      const event = {
        title: "Invalid Date Event",
        date: "not-a-valid-date",
        location: "Room C",
      };
      const role = { name: "Guest" };
      const snap = EventSnapshotBuilder.buildGuestSnapshot(event, role);

      expect(snap.date instanceof Date).toBe(true);
      // Invalid date string results in Invalid Date
      expect(isNaN(snap.date.getTime())).toBe(true);
    });

    it("converts numeric date values", () => {
      const timestamp = 1735689600000; // 2025-01-01T00:00:00.000Z
      const event = {
        title: "Numeric Date Event",
        date: timestamp,
        location: "Room D",
      };
      const role = { name: "Guest" };
      const snap = EventSnapshotBuilder.buildGuestSnapshot(event as any, role);

      expect(snap.date instanceof Date).toBe(true);
      // String conversion of number creates date from that string
    });

    it("preserves special characters in string fields", () => {
      const event = {
        title: "Guest <Event> & 'Workshop'",
        date: "2025-12-01",
        location: "Room #42 (VIP)",
      };
      const role = { name: "VIP & Guest" };
      const snap = EventSnapshotBuilder.buildGuestSnapshot(event, role);

      expect(snap.title).toBe("Guest <Event> & 'Workshop'");
      expect(snap.location).toBe("Room #42 (VIP)");
      expect(snap.roleName).toBe("VIP & Guest");
    });
  });
});
