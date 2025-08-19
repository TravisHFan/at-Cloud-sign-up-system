import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// Mock only the low-level api client; use the REAL GuestApi to exercise its error mapping
vi.mock("../../services/api", () => ({
  apiClient: {
    getEvent: vi.fn(),
    guestSignup: vi.fn(),
  },
}));

import { apiClient } from "../../services/api";
import GuestRegistration from "../../pages/GuestRegistration";
import GuestConfirmation from "../../pages/GuestConfirmation";

describe("Guest signup Single-Event Access UI message", () => {
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
    fireEvent.change(screen.getByLabelText(/Phone/i), {
      target: { value: "+1 555-9898" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Join as Guest/i }));
  };

  it("shows friendly message when blocked by active registration across events", async () => {
    // Simulate backend raw error; real GuestApi maps to friendly message
    (apiClient.guestSignup as any).mockRejectedValue(
      new Error(
        "A guest with this email already has an active registration for another event"
      )
    );

    renderPage();
    await fillAndSubmit();

    await waitFor(() =>
      expect(
        screen.getByText(
          /You already have an active guest registration\. Cancel it first or use a different email\./i
        )
      ).toBeInTheDocument()
    );
  });
});
