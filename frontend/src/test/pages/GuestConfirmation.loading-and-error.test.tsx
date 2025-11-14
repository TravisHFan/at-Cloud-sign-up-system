import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import GuestConfirmation from "../../pages/GuestConfirmation";
import { apiClient } from "../../services/api";

vi.mock("../../services/api", () => ({
  apiClient: {
    getEvent: vi.fn(),
  },
}));

const mockedGetEvent = apiClient.getEvent as unknown as ReturnType<
  typeof vi.fn
>;

describe("GuestConfirmation loading and error states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithState = () => {
    return render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/guest-confirmation",
            state: {
              eventId: "evt-1",
              guest: { eventTitle: "Test Event", roleName: "Participant" },
            },
          } as any,
        ]}
      >
        <Routes>
          <Route path="/guest-confirmation" element={<GuestConfirmation />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it("shows loading indicator while fetching organizer details", async () => {
    mockedGetEvent.mockResolvedValueOnce(
      new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              id: "evt-1",
              title: "Test Event",
              organizerDetails: [],
            }),
          50
        )
      )
    );

    renderWithState();

    // Loading text appears before details
    expect(screen.getByText(/loading organizer details/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.queryByText(/loading organizer details/i)
      ).not.toBeInTheDocument();
    });
  });

  it("still renders success view even if organizer lookup fails", async () => {
    mockedGetEvent.mockRejectedValueOnce(new Error("network failure"));

    renderWithState();

    await waitFor(() => {
      expect(screen.getByText(/registration successful/i)).toBeInTheDocument();
    });
  });
});
