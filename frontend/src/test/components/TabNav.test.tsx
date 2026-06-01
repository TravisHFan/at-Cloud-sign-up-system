import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TabNav } from "../../components/ui";

describe("TabNav", () => {
  it("keeps the active tab visually merged with the content divider", () => {
    render(
      <TabNav
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "events", label: "Events" },
        ]}
        activeTab="overview"
        onTabChange={vi.fn()}
      />
    );

    expect(screen.getByRole("tablist")).toHaveClass(
      "border-b",
      "border-gray-200"
    );
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveClass(
      "bg-white",
      "border-b-white",
      "-mb-px",
      "relative",
      "z-10"
    );
    expect(screen.getByRole("tab", { name: "Events" })).toHaveClass(
      "bg-gray-100",
      "border-gray-200"
    );
  });
});
