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
    getEventGuests: vi.fn(),
  },
}));

import { apiClient } from "../../services/api";
import GuestApi from "../../services/guestApi";
import GuestRegistration from "../../pages/GuestRegistration";
import GuestConfirmation from "../../pages/GuestConfirmation";

describe("Guest signup happy path (no roleId -> select role)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads roles, renders form, submits, and navigates to confirmation", async () => {
    // Mock event fetch with roles
    (apiClient.getEvent as any).mockResolvedValue({
      id: "e1",
      title: "Community Event",
      // Only participant-level roles should be visible to guests
      roles: [
        { id: "r1", name: "Common Participant (on-site)", description: "" },
        { id: "r2", name: "Prepared Speaker (Zoom)", description: "" },
      ],
    });

    // Mock successful signup
    (GuestApi.signup as any).mockResolvedValue({
      registrationId: "reg1",
      eventTitle: "Community Event",
      roleName: "Common Participant (on-site)",
    });

    render(
      <MemoryRouter initialEntries={["/guest-register/e1"]}>
        <Routes>
          <Route path="/guest-register/:id" element={<GuestRegistration />} />
          <Route path="/guest-confirmation" element={<GuestConfirmation />} />
        </Routes>
      </MemoryRouter>
    );

    // Role selection appears because no roleId was in the URL
    const roleSelect = await screen.findByLabelText(
      /Pick a role to participate in:/i
    );
    // Explicitly select the first role to ensure form renders immediately
    fireEvent.change(roleSelect, { target: { value: "r1" } });

    // Form should render with default-selected first role; fill and submit
    fireEvent.change(screen.getByLabelText(/Your Full name/i), {
      target: { value: "Jane Guest" },
    });
    fireEvent.change(screen.getByLabelText(/Your Gender/i), {
      target: { value: "female" },
    });
    fireEvent.change(screen.getByLabelText(/Your Email Address/i), {
      target: { value: "jane@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Your Phone Number/i), {
      target: { value: "+1 555-1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Register/i }));

    // Expect navigation to confirmation screen
    await waitFor(() =>
      expect(screen.getByText(/Registration Successful!/i)).toBeInTheDocument()
    );

    // Ensure API calls were made
    expect(apiClient.getEvent).toHaveBeenCalledWith("e1");
    expect(GuestApi.signup).toHaveBeenCalledWith(
      "e1",
      expect.objectContaining({ roleId: "r1", fullName: "Jane Guest" })
    );
  });
});
