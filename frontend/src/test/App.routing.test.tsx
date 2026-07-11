import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import App from "../App";
import { API_BASE_URL } from "../services/api";

// Lightweight harness mirroring main entry but using MemoryRouter
const renderWithRouter = (initialEntries: string[]) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  );
};

describe("App routing", () => {
  it("renders public home route without crashing", async () => {
    renderWithRouter(["/"]);
    expect(await screen.findByText("Welcome to @Cloud")).toBeInTheDocument();
  });

  it("wires guest registration route", async () => {
    renderWithRouter(["/guest-register/event-123"]);
    expect(await screen.findByText("Invalid Access")).toBeInTheDocument();
  });

  it("wires dashboard nested route for programs", async () => {
    localStorage.removeItem("authToken");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    } as Response);

    renderWithRouter(["/dashboard/programs"]);
    expect(
      await screen.findByRole("heading", { name: "Other Programs" }),
    ).toBeInTheDocument();

    fetchSpy.mockRestore();
  });

  it("renders login page for /login route", async () => {
    localStorage.removeItem("authToken");
    renderWithRouter(["/login"]);
    expect(await screen.findByText(/Login to @Cloud/i)).toBeInTheDocument();
  });

  it("renders email verification from root query token", async () => {
    localStorage.removeItem("authToken");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, alreadyVerified: true }),
    } as Response);

    renderWithRouter(["/?verifyEmailToken=query-token"]);

    expect(
      await screen.findByText(/email verification/i),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        `${API_BASE_URL}/auth/verify-email/query-token`,
        expect.objectContaining({ method: "GET" })
      );
    });

    fetchSpy.mockRestore();
  });

  it("renders dashboard layout shell for /dashboard route as guest", async () => {
    // Clear auth token to simulate unauthenticated state
    localStorage.removeItem("authToken");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    } as Response);

    renderWithRouter(["/dashboard"]);
    expect(
      await screen.findByRole("heading", { name: "EMBA Program" }),
    ).toBeInTheDocument();

    fetchSpy.mockRestore();
  });
});
