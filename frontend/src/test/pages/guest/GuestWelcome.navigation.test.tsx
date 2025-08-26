import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import GuestWelcome from "../../../pages/guest/GuestWelcome";

// Mock the events hook to return a small set of upcoming events
vi.mock("../../../hooks/useEventsApi", () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;

  return {
    __esModule: true,
    useEvents: () => ({
      events: [
        {
          id: "e-choose-role-1",
          title: "Sample Event One",
          type: "Workshop",
          date: dateStr,
          time: "09:00",
          endTime: "10:00",
          timeZone: "America/New_York",
          location: "Online",
          organizer: "Org",
          hostedBy: "Org",
          purpose: "",
          agenda: "",
          format: "Online",
          disclaimer: "",
          roles: [],
          signedUp: 0,
          totalSlots: 0,
          createdBy: "system",
          createdAt: `${dateStr}T00:00:00.000Z`,
          status: "upcoming",
        },
      ],
      loading: false,
      error: null,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalEvents: 1,
        hasNext: false,
        hasPrev: false,
      },
      refreshEvents: vi.fn(),
      loadPage: vi.fn(),
      searchEvents: vi.fn(),
      filterEvents: vi.fn(),
    }),
  };
});

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe("GuestWelcome - Upcoming Events navigation", () => {
  it("navigates to /guest/register/:id when an upcoming event item is clicked", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/guest-dashboard/welcome"]}>
        <Routes>
          <Route
            path="/guest-dashboard/welcome"
            element={
              <>
                <GuestWelcome />
                <LocationDisplay />
              </>
            }
          />
          <Route path="/guest/register/:id" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    );

    // Ensure the mocked event appears
    const eventItem = await screen.findByText(/Sample Event One/i);
    await user.click(eventItem);

    // After clicking, we should navigate to the guest registration route with the event id
    const location = await screen.findByTestId("location");
    expect(location).toHaveTextContent("/guest/register/e-choose-role-1");
  });
});
