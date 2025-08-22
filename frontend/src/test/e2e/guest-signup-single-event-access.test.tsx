import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// Mock only the low-level api client; use the REAL GuestApi behavior
vi.mock("../../services/api", () => ({
  apiClient: {
    getEvent: vi.fn(),
    guestSignup: vi.fn(),
  },
}));

import { apiClient } from "../../services/api";
import GuestRegistration from "../../pages/GuestRegistration";
import GuestConfirmation from "../../pages/GuestConfirmation";

describe("Guest signup allows one registration per event (no global block)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const renderPage = (eventId: string) => {
    (apiClient.getEvent as any).mockResolvedValue({
      id: eventId,
      title: `Event ${eventId}`,
      roles: [
        { id: "r1", name: "Common Participant (on-site)", description: "" },
        { id: "r2", name: "Prepared Speaker (Zoom)", description: "" },
      ],
    });
    return render(
      <MemoryRouter initialEntries={[`/guest/register/${eventId}`]}>
        <Routes>
          <Route path="/guest/register/:id" element={<GuestRegistration />} />
          <Route path="/guest/confirmation" element={<GuestConfirmation />} />
        </Routes>
      </MemoryRouter>
    );
  };

  const fillAndSubmit = async () => {
    // Select a role first so the form renders
    const roleSelect = await screen.findByLabelText(/Available Roles/i);
    fireEvent.change(roleSelect, { target: { value: "r1" } });
    fireEvent.change(screen.getByLabelText(/Full name/i), {
      target: { value: "Guest User" },
    });
    fireEvent.change(screen.getByLabelText(/Gender/i), {
      target: { value: "male" },
    });
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: "guest@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Phone Number/i), {
      target: { value: "+1 555-9898" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Join as Guest/i }));
  };

  it("allows registering the same guest email for different events", async () => {
    // First event signup succeeds
    (apiClient.guestSignup as any).mockResolvedValueOnce({ id: "g1" });
    renderPage("e1");
    await fillAndSubmit();
    expect(
      await screen.findByText(/Registration Successful!/i)
    ).toBeInTheDocument();

    // Second event signup with same email also succeeds (per-event rule)
    (apiClient.guestSignup as any).mockResolvedValueOnce({ id: "g2" });
    renderPage("e2");
    await fillAndSubmit();
    expect(
      await screen.findByText(/Registration Successful!/i)
    ).toBeInTheDocument();
  });
});
