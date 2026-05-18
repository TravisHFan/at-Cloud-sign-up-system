import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProgramPricing from "../../../components/ProgramDetail/ProgramPricing";

describe("ProgramPricing enrollment window", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("disables enrollment after the program end month has finished", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 1, 1, 0, 0, 0, 0));

    render(
      <ProgramPricing
        fullPriceTicket={10000}
        hasAccess={false}
        accessReason="not_purchased"
        onEnrollClick={vi.fn()}
        period={{
          startYear: "2025",
          startMonth: "01",
          endYear: "2025",
          endMonth: "01",
        }}
      />
    );

    expect(
      screen.getByRole("button", { name: /enrollment closed/i })
    ).toBeDisabled();
    expect(
      screen.getByText(
        /enrollment is closed because this program has finished/i
      )
    ).toBeInTheDocument();
  });

  it("keeps Enroll Now enabled through the last day of the program end month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 31, 12, 0, 0, 0));

    render(
      <ProgramPricing
        fullPriceTicket={10000}
        hasAccess={false}
        accessReason="not_purchased"
        onEnrollClick={vi.fn()}
        period={{
          startYear: "2025",
          startMonth: "Jan",
          endYear: "2025",
          endMonth: "Jan",
        }}
      />
    );

    expect(screen.getByRole("button", { name: /enroll now/i })).toBeEnabled();
  });
});
