import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("../../services/api", () => ({
  apiClient: {
    getEvent: vi.fn(),
  },
}));

vi.mock("../../services/guestApi", () => ({
  __esModule: true,
  default: {
    signup: vi.fn(),
  },
}));

import { apiClient } from "../../services/api";
import GuestApi from "../../services/guestApi";
import GuestRegistration from "../../pages/GuestRegistration";
import GuestConfirmation from "../../pages/GuestConfirmation";

describe("Guest signup rejection flows", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (apiClient.getEvent as any).mockResolvedValue({
      id: "e1",
      title: "Community Event",
      roles: [
        { id: "r1", name: "Greeter", description: "" },
        { id: "r2", name: "Usher", description: "" },
      ],
    });
  });

  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={["/guest/register/e1"]}>
        <Routes>
          <Route path="/guest/register/:id" element={<GuestRegistration />} />
          <Route path="/guest/confirmation" element={<GuestConfirmation />} />
        </Routes>
      </MemoryRouter>
    );

  const fillAndSubmit = async () => {
    await screen.findByLabelText(/Select role/i);
    fireEvent.change(screen.getByLabelText(/Full name/i), {
      target: { value: "Guest User" },
    });
    fireEvent.change(screen.getByLabelText(/Gender/i), {
      target: { value: "male" },
    });
    fireEvent.change(screen.getByLabelText(/^Email$/i), {
      target: { value: "guest@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Join as Guest/i }));
  };

  it("shows error when role is at full capacity", async () => {
    (GuestApi.signup as any).mockRejectedValue(
      new Error("This role is at full capacity")
    );
    renderPage();
    await fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByText(/full capacity/i)).toBeInTheDocument()
    );
    expect(screen.queryByText(/You're registered!/i)).not.toBeInTheDocument();
  });

  it("shows error for duplicate registration", async () => {
    (GuestApi.signup as any).mockRejectedValue(new Error("Already registered"));
    renderPage();
    await fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByText(/already registered/i)).toBeInTheDocument()
    );
  });

  it("shows error when rate limit exceeded", async () => {
    (GuestApi.signup as any).mockRejectedValue(
      new Error("Rate limit exceeded")
    );
    renderPage();
    await fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument()
    );
  });
});
