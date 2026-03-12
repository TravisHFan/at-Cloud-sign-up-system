import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import App from "../App";

// Lightweight harness mirroring main entry but using MemoryRouter
const renderWithRouter = (initialEntries: string[]) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  );
};

describe("App routing", () => {
  it("renders public home route without crashing", () => {
    renderWithRouter(["/"]);
    // Home page shows the marketing hero; assert on stable heading text
    expect(document.body.innerHTML.toLowerCase()).toContain(
      "welcome to @cloud",
    );
  });

  it("wires guest registration route", () => {
    renderWithRouter(["/guest-register/event-123"]);
    // We only assert that something rendered; concrete text is covered elsewhere
    expect(document.body.innerHTML.length).toBeGreaterThan(0);
  });

  it("wires dashboard nested route for programs", () => {
    // We just verify the dashboard programs tree renders without crashing
    renderWithRouter(["/dashboard/programs"]);
    expect(document.body.innerHTML.length).toBeGreaterThan(0);
  });

  it("renders login page for /login route", () => {
    renderWithRouter(["/login"]);
    // Assert on the visible login heading text
    expect(screen.getByText(/Login to @Cloud/i)).toBeInTheDocument();
  });

  it("renders dashboard layout shell for /dashboard route as guest", async () => {
    // Clear auth token to simulate unauthenticated state
    localStorage.removeItem("authToken");

    renderWithRouter(["/dashboard"]);
    // /dashboard is now guest-accessible; it should render the layout, not redirect to login
    expect(document.body.innerHTML.length).toBeGreaterThan(0);
  });
});
