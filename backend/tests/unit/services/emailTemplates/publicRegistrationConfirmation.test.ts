/**
 * publicRegistrationConfirmation Email Template Unit Tests
 *
 * Tests the email template building functions.
 */

import { describe, it, expect } from "vitest";
import buildPublicRegistrationConfirmationEmail, {
  PublicRegistrationEmailParams,
} from "../../../../src/services/emailTemplates/publicRegistrationConfirmation";

describe("buildPublicRegistrationConfirmationEmail", () => {
  const baseEvent: PublicRegistrationEmailParams["event"] = {
    title: "Test Event",
    date: "2025-06-15",
    endDate: "2025-06-15",
    time: "10:00",
    endTime: "12:00",
    location: "Main Hall",
    purpose: "Test event purpose",
    timeZone: "America/Los_Angeles",
    isHybrid: false,
    zoomLink: undefined,
    meetingId: undefined,
    passcode: undefined,
    format: "In-person",
  };

  describe("subject line", () => {
    it("should generate standard confirmation subject", () => {
      const result = buildPublicRegistrationConfirmationEmail({
        event: baseEvent,
      });
      expect(result.subject).toBe("Registration Confirmed: Test Event");
    });

    it("should generate duplicate registration subject", () => {
      const result = buildPublicRegistrationConfirmationEmail({
        event: baseEvent,
        duplicate: true,
      });
      expect(result.subject).toBe("Already Registered: Test Event");
    });
  });

  describe("HTML content", () => {
    it("should include event title in HTML", () => {
      const result = buildPublicRegistrationConfirmationEmail({
        event: baseEvent,
      });
      expect(result.html).toContain("Test Event");
    });

    it("should include location in HTML", () => {
      const result = buildPublicRegistrationConfirmationEmail({
        event: baseEvent,
      });
      expect(result.html).toContain("Main Hall");
    });

    it("should include role name when provided", () => {
      const result = buildPublicRegistrationConfirmationEmail({
        event: baseEvent,
        roleName: "Speaker",
      });
      expect(result.html).toContain("Speaker");
      expect(result.html).toContain("Role:");
    });

    it("should not include role line when roleName is null", () => {
      const result = buildPublicRegistrationConfirmationEmail({
        event: baseEvent,
        roleName: null,
      });
      expect(result.html).not.toContain("Role:");
    });

    it("should include purpose when provided", () => {
      const result = buildPublicRegistrationConfirmationEmail({
        event: baseEvent,
      });
      expect(result.html).toContain("Test event purpose");
    });

    it("should include timezone note", () => {
      const result = buildPublicRegistrationConfirmationEmail({
        event: baseEvent,
      });
      expect(result.html).toContain("America/Los_Angeles");
    });

    it("should include duplicate notice when duplicate is true", () => {
      const result = buildPublicRegistrationConfirmationEmail({
        event: baseEvent,
        duplicate: true,
      });
      expect(result.html).toContain(
        "It looks like you were already registered"
      );
    });

    it("should include calendar hint", () => {
      const result = buildPublicRegistrationConfirmationEmail({
        event: baseEvent,
      });
      expect(result.html).toContain("Add this event to your calendar");
    });
  });

  describe("text content", () => {
    it("should include event title in text", () => {
      const result = buildPublicRegistrationConfirmationEmail({
        event: baseEvent,
      });
      expect(result.text).toContain("Test Event");
    });

    it("should include location in text", () => {
      const result = buildPublicRegistrationConfirmationEmail({
        event: baseEvent,
      });
      expect(result.text).toContain("Location: Main Hall");
    });

    it("should include role name in text", () => {
      const result = buildPublicRegistrationConfirmationEmail({
        event: baseEvent,
        roleName: "Attendee",
      });
      expect(result.text).toContain("Role: Attendee");
    });

    it("should include timezone in text", () => {
      const result = buildPublicRegistrationConfirmationEmail({
        event: baseEvent,
      });
      expect(result.text).toContain("Time Zone: America/Los_Angeles");
    });

    it("should include purpose description in text", () => {
      const result = buildPublicRegistrationConfirmationEmail({
        event: baseEvent,
      });
      expect(result.text).toContain("--- Description ---");
      expect(result.text).toContain("Test event purpose");
    });
  });

  describe("online event support", () => {
    it("should include Zoom link for online events", () => {
      const onlineEvent = {
        ...baseEvent,
        format: "Online",
        zoomLink: "https://zoom.us/j/123456789",
        meetingId: "123 456 789",
        passcode: "abc123",
      };

      const result = buildPublicRegistrationConfirmationEmail({
        event: onlineEvent,
      });

      expect(result.html).toContain("Join Online");
      expect(result.html).toContain("https://zoom.us/j/123456789");
      expect(result.html).toContain("123 456 789");
      expect(result.html).toContain("abc123");
    });

    it("should include virtual details in text for online events", () => {
      const onlineEvent = {
        ...baseEvent,
        format: "Online",
        zoomLink: "https://zoom.us/j/123",
        meetingId: "123",
        passcode: "pass",
      };

      const result = buildPublicRegistrationConfirmationEmail({
        event: onlineEvent,
      });

      expect(result.text).toContain("--- Online Access ---");
      expect(result.text).toContain("Zoom Link: https://zoom.us/j/123");
      expect(result.text).toContain("Meeting ID: 123");
      expect(result.text).toContain("Passcode: pass");
    });
  });

  describe("hybrid event support", () => {
    it("should include virtual section for hybrid events", () => {
      const hybridEvent = {
        ...baseEvent,
        format: "Hybrid Participation",
        isHybrid: true,
        zoomLink: "https://zoom.us/j/hybrid",
        meetingId: "HYB-123",
        passcode: "hybrid",
      };

      const result = buildPublicRegistrationConfirmationEmail({
        event: hybridEvent,
      });

      expect(result.html).toContain("Join Online");
      expect(result.html).toContain("https://zoom.us/j/hybrid");
    });

    it("should show virtual section when format contains Hybrid Participation", () => {
      const hybridEvent = {
        ...baseEvent,
        format: "Hybrid Participation",
        zoomLink: "https://zoom.us/j/123",
        meetingId: "123",
        passcode: "pass",
      };

      const result = buildPublicRegistrationConfirmationEmail({
        event: hybridEvent,
      });

      expect(result.html).toContain("Join Online");
    });
  });

  describe("date/time formatting", () => {
    it("should format single day event correctly", () => {
      const result = buildPublicRegistrationConfirmationEmail({
        event: baseEvent,
      });
      expect(result.html).toContain("2025-06-15");
      expect(result.html).toContain("10:00");
      expect(result.html).toContain("12:00");
    });

    it("should format multi-day event correctly", () => {
      const multiDayEvent = {
        ...baseEvent,
        date: "2025-06-15",
        endDate: "2025-06-17",
      };

      const result = buildPublicRegistrationConfirmationEmail({
        event: multiDayEvent,
      });

      expect(result.html).toContain("2025-06-15");
      expect(result.html).toContain("2025-06-17");
    });
  });

  describe("HTML escaping", () => {
    it("should escape HTML special characters in title", () => {
      const eventWithSpecialChars = {
        ...baseEvent,
        title: "Event <script>alert('xss')</script>",
      };

      const result = buildPublicRegistrationConfirmationEmail({
        event: eventWithSpecialChars,
      });

      expect(result.html).not.toContain("<script>");
      expect(result.html).toContain("&lt;script&gt;");
    });

    it("should escape HTML special characters in location", () => {
      const eventWithSpecialChars = {
        ...baseEvent,
        location: "Hall & Conference <Room>",
      };

      const result = buildPublicRegistrationConfirmationEmail({
        event: eventWithSpecialChars,
      });

      expect(result.html).toContain("&amp;");
      expect(result.html).toContain("&lt;Room&gt;");
    });

    it("should escape HTML special characters in purpose", () => {
      const eventWithSpecialChars = {
        ...baseEvent,
        purpose: "Purpose with \"quotes\" and 'apostrophes'",
      };

      const result = buildPublicRegistrationConfirmationEmail({
        event: eventWithSpecialChars,
      });

      expect(result.html).toContain("&quot;");
      expect(result.html).toContain("&#39;");
    });
  });

  describe("edge cases", () => {
    it("should handle event without location", () => {
      const eventNoLocation = {
        ...baseEvent,
        location: undefined,
      };

      const result = buildPublicRegistrationConfirmationEmail({
        event: eventNoLocation as any,
      });

      expect(result.html).not.toContain("Location:");
    });

    it("should handle event without purpose", () => {
      const eventNoPurpose = {
        ...baseEvent,
        purpose: undefined,
      };

      const result = buildPublicRegistrationConfirmationEmail({
        event: eventNoPurpose as any,
      });

      expect(result.text).not.toContain("--- Description ---");
    });

    it("should handle event without timezone", () => {
      const eventNoTz = {
        ...baseEvent,
        timeZone: undefined,
      };

      const result = buildPublicRegistrationConfirmationEmail({
        event: eventNoTz as any,
      });

      expect(result.html).not.toContain("Times shown in");
    });

    it("should handle meeting ID without passcode", () => {
      const eventWithMeetingOnly = {
        ...baseEvent,
        format: "Online",
        zoomLink: "https://zoom.us/j/123",
        meetingId: "123",
        passcode: "",
      };

      const result = buildPublicRegistrationConfirmationEmail({
        event: eventWithMeetingOnly,
      });

      expect(result.html).toContain("Meeting ID");
      expect(result.html).not.toContain("Passcode:");
    });

    it("should handle passcode without meeting ID", () => {
      const eventWithPasscodeOnly = {
        ...baseEvent,
        format: "Online",
        zoomLink: "https://zoom.us/j/123",
        meetingId: "",
        passcode: "secret",
      };

      const result = buildPublicRegistrationConfirmationEmail({
        event: eventWithPasscodeOnly,
      });

      expect(result.html).toContain("Passcode");
      expect(result.html).not.toContain("Meeting ID:");
    });

    it("should handle online event with only Zoom link (no meeting ID or passcode)", () => {
      const eventZoomOnly = {
        ...baseEvent,
        format: "Online",
        zoomLink: "https://zoom.us/j/123",
        meetingId: "",
        passcode: "",
      };

      const result = buildPublicRegistrationConfirmationEmail({
        event: eventZoomOnly,
      });

      expect(result.html).toContain("https://zoom.us/j/123");
    });
  });
});
