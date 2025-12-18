import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GracePeriodBanner } from "../../components/publish/GracePeriodBanner";

describe("GracePeriodBanner", () => {
  it("renders nothing if event is not published", () => {
    const { container } = render(
      <GracePeriodBanner
        event={{
          publish: false,
          unpublishScheduledAt: new Date(
            Date.now() + 48 * 60 * 60 * 1000
          ).toISOString(),
          unpublishWarningFields: ["zoomLink"],
        }}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing if event has no unpublishScheduledAt", () => {
    const { container } = render(
      <GracePeriodBanner
        event={{
          publish: true,
          unpublishScheduledAt: null,
        }}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing if grace period has expired", () => {
    const { container } = render(
      <GracePeriodBanner
        event={{
          publish: true,
          // Deadline in the past
          unpublishScheduledAt: new Date(Date.now() - 1000).toISOString(),
          unpublishWarningFields: ["location"],
        }}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders banner with missing fields when in grace period", () => {
    const futureDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    render(
      <GracePeriodBanner
        event={{
          publish: true,
          format: "Online",
          unpublishScheduledAt: futureDeadline.toISOString(),
          unpublishWarningFields: ["zoomLink", "meetingId", "passcode"],
        }}
      />
    );

    const banner = screen.getByTestId("grace-period-banner");
    expect(banner).toBeTruthy();
    expect(banner.textContent).toMatch(/Action Required/i);
    expect(banner.textContent).toMatch(/hour.*until auto-unpublish/i);
    expect(banner.textContent).toMatch(/Zoom Link/i);
    expect(banner.textContent).toMatch(/Meeting ID/i);
    expect(banner.textContent).toMatch(/Passcode/i);
    expect(banner.textContent).toMatch(/Online/i);
  });

  it("displays hours remaining correctly for 1 hour", () => {
    const oneHourFromNow = new Date(Date.now() + 1 * 60 * 60 * 1000);
    render(
      <GracePeriodBanner
        event={{
          publish: true,
          format: "In-person",
          unpublishScheduledAt: oneHourFromNow.toISOString(),
          unpublishWarningFields: ["location"],
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
          unpublishScheduledAt: tenHoursFromNow.toISOString(),
          unpublishWarningFields: ["location"],
        }}
      />
    );

    const banner = screen.getByTestId("grace-period-banner");
    expect(banner.textContent).toMatch(/10 hours until auto-unpublish/i);
  });

  it("renders fallback message when unpublishWarningFields is empty", () => {
    const futureDeadline = new Date(Date.now() + 12 * 60 * 60 * 1000);
    render(
      <GracePeriodBanner
        event={{
          publish: true,
          format: "Online",
          unpublishScheduledAt: futureDeadline.toISOString(),
          unpublishWarningFields: [],
        }}
      />
    );

    const banner = screen.getByTestId("grace-period-banner");
    expect(banner.textContent).toMatch(/Missing fields not specified/i);
  });
});
