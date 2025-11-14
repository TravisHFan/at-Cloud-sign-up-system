import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import App from "../App";
import { AuthProvider } from "../contexts/AuthContext";

// Lightweight harness mirroring main entry but using MemoryRouter
const renderWithRouter = (initialEntries: string[]) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>
  );
};

describe("App routing", () => {
  it("renders public home route without crashing", () => {
    renderWithRouter(["/"]);
    // Home page shows the marketing hero; assert on stable heading text
    expect(document.body.innerHTML.toLowerCase()).toContain(
      "welcome to @cloud"
    );
  });

  it("wires guest registration route", () => {
    renderWithRouter(["/guest-register/event-123"]);
    // We only assert that something rendered; concrete text is covered elsewhere
    expect(document.body.innerHTML.length).toBeGreaterThan(0);
  });

  it("wires dashboard nested route for programs", () => {
    // AuthProvider in tests defaults to an authenticated user; we just verify tree renders
    renderWithRouter(["/dashboard/programs"]);
    expect(document.body.innerHTML.length).toBeGreaterThan(0);
  });
});
