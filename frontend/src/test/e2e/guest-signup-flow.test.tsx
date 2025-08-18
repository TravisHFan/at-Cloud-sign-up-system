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
      roles: [
        { id: "r1", name: "Greeter", description: "" },
        { id: "r2", name: "Usher", description: "" },
      ],
    });

    // Mock successful signup
    (GuestApi.signup as any).mockResolvedValue({
      registrationId: "reg1",
      eventTitle: "Community Event",
      roleName: "Greeter",
    });

    render(
      <MemoryRouter initialEntries={["/guest/register/e1"]}>
        <Routes>
          <Route path="/guest/register/:id" element={<GuestRegistration />} />
          <Route path="/guest/confirmation" element={<GuestConfirmation />} />
        </Routes>
      </MemoryRouter>
    );

    // Role selection appears because no roleId was in the URL
    await screen.findByLabelText(/Select role/i);

    // Form should render with default-selected first role; fill and submit
    fireEvent.change(screen.getByLabelText(/Full name/i), {
      target: { value: "Jane Guest" },
    });
    fireEvent.change(screen.getByLabelText(/^Email$/i), {
      target: { value: "jane@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Join as Guest/i }));

    // Expect navigation to confirmation screen
    await waitFor(() =>
      expect(screen.getByText(/You're registered!/i)).toBeInTheDocument()
    );

    // Ensure API calls were made
    expect(apiClient.getEvent).toHaveBeenCalledWith("e1");
    expect(GuestApi.signup).toHaveBeenCalledWith(
      "e1",
      expect.objectContaining({ roleId: "r1", fullName: "Jane Guest" })
    );
  });
});
