import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProgramPricing from "../../../components/ProgramDetail/ProgramPricing";

describe("ProgramPricing enrollment window", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("disables enrollment when the program started more than 45 days ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-05T12:00:00.000Z"));

    render(
      <ProgramPricing
        fullPriceTicket={10000}
        hasAccess={false}
        accessReason="not_purchased"
        onEnrollClick={vi.fn()}
        period={{ startYear: "2025", startMonth: "01" }}
      />
    );

    expect(
      screen.getByRole("button", { name: /enrollment closed/i })
    ).toBeDisabled();
    expect(
      screen.getByText(
        /enrollment is closed because this program started more than 45 days ago/i
      )
    ).toBeInTheDocument();
  });

  it("keeps Enroll Now enabled during the 45-day window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-02-10T12:00:00.000Z"));

    render(
      <ProgramPricing
        fullPriceTicket={10000}
        hasAccess={false}
        accessReason="not_purchased"
        onEnrollClick={vi.fn()}
        period={{ startYear: "2025", startMonth: "Jan" }}
      />
    );

    expect(screen.getByRole("button", { name: /enroll now/i })).toBeEnabled();
  });
});
