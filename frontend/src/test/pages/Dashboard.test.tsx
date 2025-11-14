import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Dashboard from "../../pages/Dashboard";

describe("Dashboard", () => {
  it("renders the main dashboard sections", () => {
    render(<Dashboard />);

    expect(
      screen.getByRole("heading", { name: /welcome to @cloud!/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /upcoming events/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /past events/i })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/use the sidebar to navigate to different sections./i)
    ).toBeInTheDocument();
  });
});
