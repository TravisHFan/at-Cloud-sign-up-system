import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import WelcomeHeader from "../../../components/common/WelcomeHeader";

// Mock the useCurrentTime hook
vi.mock("../../../hooks/useCurrentTime", () => ({
  useCurrentTime: () => ({
    greeting: "Good Morning",
    formattedDate: "Monday, January 15, 2025",
  }),
}));

describe("WelcomeHeader", () => {
  it("renders greeting from useCurrentTime hook", () => {
    render(<WelcomeHeader />);
    expect(
      screen.getByText(/Good Morning, Welcome to @Cloud Events!/)
    ).toBeDefined();
  });

  it("renders formatted date from useCurrentTime hook", () => {
    render(<WelcomeHeader />);
    expect(screen.getByText("Monday, January 15, 2025")).toBeDefined();
  });

  it("renders welcome message", () => {
    render(<WelcomeHeader />);
    expect(
      screen.getByText(
        /Welcome to @Cloud Marketplace Ministry Events Management System/
      )
    ).toBeDefined();
  });

  it("renders ministry description", () => {
    render(<WelcomeHeader />);
    expect(
      screen.getByText(
        /you can create or join events, connect with the community/
      )
    ).toBeDefined();
  });

  it("applies gradient background styling", () => {
    const { container } = render(<WelcomeHeader />);
    const headerDiv = container.querySelector(".bg-gradient-to-r");
    expect(headerDiv).toBeDefined();
    expect(headerDiv?.classList.contains("from-blue-500")).toBe(true);
    expect(headerDiv?.classList.contains("to-purple-600")).toBe(true);
  });
});
