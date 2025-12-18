import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GracePeriodBanner } from "../../components/publish/GracePeriodBanner";
import type { EventRole } from "../../types/event";

// Helper to create a minimal valid public role for testing
const publicRole: EventRole = {
  id: "role-1",
  name: "Participant",
  description: "Test role",
  maxParticipants: 10,
  currentSignups: [],
  openToPublic: true,
};

describe("GracePeriodBanner", () => {
  it("renders nothing if event is not published", () => {
    const { container } = render(
      <GracePeriodBanner
        event={{
          publish: false,
          format: "Online",
          zoomLink: "", // missing
          meetingId: "", // missing
          passcode: "", // missing
        }}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing if all required fields are present", () => {
    const { container } = render(
      <GracePeriodBanner
        event={{
          publish: true,
          format: "Online",
          zoomLink: "https://zoom.us/j/123",
          meetingId: "123456",
          passcode: "abc123",
          roles: [publicRole],
        }}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders banner when published with missing fields (no grace period set)", () => {
    render(
      <GracePeriodBanner
        event={{
          publish: true,
          format: "Online",
          zoomLink: "",
          meetingId: "",
          passcode: "",
          roles: [publicRole],
          // No unpublishScheduledAt - banner still shows based on field check
        }}
      />
    );

    const banner = screen.getByTestId("grace-period-banner");
    expect(banner).toBeTruthy();
    expect(banner.textContent).toMatch(/Action Required/i);
    expect(banner.textContent).toMatch(/Zoom Link/i);
    expect(banner.textContent).toMatch(/Meeting ID/i);
    expect(banner.textContent).toMatch(/Passcode/i);
    expect(banner.textContent).toMatch(/Online/i);
    // Should show fallback message without countdown
    expect(banner.textContent).toMatch(
      /48-hour grace period will start after the next update/i
    );
  });

  it("renders banner with countdown when grace period is active", () => {
    const futureDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    render(
      <GracePeriodBanner
        event={{
          publish: true,
          format: "Online",
          zoomLink: "",
          meetingId: "",
          passcode: "",
          roles: [publicRole],
          unpublishScheduledAt: futureDeadline.toISOString(),
        }}
      />
    );

    const banner = screen.getByTestId("grace-period-banner");
    expect(banner).toBeTruthy();
    expect(banner.textContent).toMatch(/Action Required/i);
    expect(banner.textContent).toMatch(/24 hours until auto-unpublish/i);
    expect(banner.textContent).toMatch(/Zoom Link/i);
  });

  it("displays hours remaining correctly for 1 hour", () => {
    const oneHourFromNow = new Date(Date.now() + 1 * 60 * 60 * 1000);
    render(
      <GracePeriodBanner
        event={{
          publish: true,
          format: "In-person",
          location: "", // missing
          roles: [publicRole],
          unpublishScheduledAt: oneHourFromNow.toISOString(),
        }}
      />
    );

    const banner = screen.getByTestId("grace-period-banner");
    expect(banner.textContent).toMatch(/1 hour until auto-unpublish/i);
  });

  it("displays hours remaining correctly for multiple hours", () => {
    const tenHoursFromNow = new Date(Date.now() + 10 * 60 * 60 * 1000);
    render(
      <GracePeriodBanner
        event={{
          publish: true,
          format: "In-person",
          location: "", // missing
          roles: [publicRole],
          unpublishScheduledAt: tenHoursFromNow.toISOString(),
        }}
      />
    );

    const banner = screen.getByTestId("grace-period-banner");
    expect(banner.textContent).toMatch(/10 hours until auto-unpublish/i);
  });

  it("shows imminent warning when deadline has passed", () => {
    const pastDeadline = new Date(Date.now() - 1000); // 1 second ago
    render(
      <GracePeriodBanner
        event={{
          publish: true,
          format: "In-person",
          location: "", // missing
          roles: [publicRole],
          unpublishScheduledAt: pastDeadline.toISOString(),
        }}
      />
    );

    const banner = screen.getByTestId("grace-period-banner");
    expect(banner.textContent).toMatch(/Auto-unpublish imminent/i);
  });

  it("detects missing passcode for Online event", () => {
    render(
      <GracePeriodBanner
        event={{
          publish: true,
          format: "Online",
          zoomLink: "https://zoom.us/j/123",
          meetingId: "123456",
          passcode: "", // only passcode missing
          roles: [publicRole],
        }}
      />
    );

    const banner = screen.getByTestId("grace-period-banner");
    expect(banner.textContent).toMatch(/Passcode/i);
    expect(banner.textContent).not.toMatch(/Zoom Link/i);
    expect(banner.textContent).not.toMatch(/Meeting ID/i);
  });

  it("shows warning when no role is open to public", () => {
    const privateRole: EventRole = {
      ...publicRole,
      openToPublic: false,
    };
    render(
      <GracePeriodBanner
        event={{
          publish: true,
          format: "Online",
          zoomLink: "https://zoom.us/j/123",
          meetingId: "123456",
          passcode: "abc123",
          roles: [privateRole], // No public role
        }}
      />
    );

    const banner = screen.getByTestId("grace-period-banner");
    expect(banner.textContent).toMatch(/At least one public role/i);
  });

  it("shows warning when roles array is empty", () => {
    render(
      <GracePeriodBanner
        event={{
          publish: true,
          format: "Online",
          zoomLink: "https://zoom.us/j/123",
          meetingId: "123456",
          passcode: "abc123",
          roles: [], // Empty roles
        }}
      />
    );

    const banner = screen.getByTestId("grace-period-banner");
    expect(banner.textContent).toMatch(/At least one public role/i);
  });
});
