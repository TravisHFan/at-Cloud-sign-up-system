import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PublicEvent from "../../pages/PublicEvent";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// Mock api client singleton: component imports default, test imports named
vi.mock("../../services/api", () => {
  const mockApiClient = {
    getPublicEvent: vi.fn().mockResolvedValue({
      title: "Public Test Event",
      start: new Date().toISOString(),
      end: new Date(Date.now() + 3600000).toISOString(),
      location: "Online",
      roles: [
        {
          roleId: "r1",
          name: "Attendee",
          description: "General access",
          maxParticipants: 10,
          capacityRemaining: 9,
        },
      ],
      slug: "public-test-event",
    }),
    registerForPublicEvent: vi.fn().mockResolvedValue({
      registrationId: "reg123",
      duplicate: false,
      message: "Registered successfully",
    }),
  };
  return { __esModule: true, apiClient: mockApiClient, default: mockApiClient };
});

import { apiClient } from "../../services/api";

function renderWithSlug(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/p/${slug}`]}>
      <Routes>
        <Route path="/p/:slug" element={<PublicEvent />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PublicEvent registration form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads event and registers successfully", async () => {
    renderWithSlug("public-test-event");

    // Wait for event load
    await screen.findByText("Public Test Event");

    // Select role
    const selectBtn = screen.getByRole("button", { name: "Select" });
    fireEvent.click(selectBtn);

    // Fill form
    fireEvent.change(screen.getByLabelText(/Full Name/i), {
      target: { value: "Jane Tester" },
    });
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: "jane@example.com" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Submit Registration" })
    );

    await waitFor(() => {
      expect(screen.getByText(/Registered successfully/i)).toBeInTheDocument();
    });

    expect((apiClient as any).registerForPublicEvent).toHaveBeenCalledWith(
      "public-test-event",
      expect.objectContaining({
        roleId: "r1",
        attendee: expect.objectContaining({ email: "jane@example.com" }),
      })
    );
  });

  it("shows duplicate message when API returns duplicate", async () => {
    (apiClient as any).registerForPublicEvent.mockResolvedValueOnce({
      registrationId: "reg123",
      duplicate: true,
      message: "Already registered",
    });

    renderWithSlug("public-test-event");
    await screen.findByText("Public Test Event");

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.change(screen.getByLabelText(/Full Name/i), {
      target: { value: "Jane Tester" },
    });
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: "jane@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Submit Registration" })
    );

    // Heading should match exact phrase
    await screen.findByText(/^Already registered$/i);
    // Descriptive duplicate paragraph should also render
    expect(
      screen.getByText(/You were already registered for this role/i)
    ).toBeInTheDocument();
  });
});
