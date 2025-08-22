import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UpcomingEvents from "../../pages/UpcomingEvents";
import PassedEvents from "../../pages/PassedEvents";
import { NotificationProvider } from "../../contexts/NotificationModalContext";

// Stub out useAuth to avoid AuthProvider requirements and side effects
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: null,
    isAuthenticated: false,
    isLoading: false,
    canCreateEvents: false,
    canManageUsers: false,
    hasRole: () => false,
  }),
}));

// Silence socketService usage in any children by providing a no-op mock
vi.mock("../../services/socketService", () => ({
  socketService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    joinEventRoom: vi.fn(),
    leaveEventRoom: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

// Mock API service used by pages
vi.mock("../../services/api", () => {
  const eventService = {
    // Upcoming page fetches both upcoming and ongoing
    getEvents: vi.fn(async ({ status }: { status: string }) => {
      if (status === "upcoming") {
        return {
          events: [
            {
              id: "evt-future-1",
              title: "Future Fellowship",
              date: "2025-08-20",
              time: "10:00",
              endTime: "12:00",
              location: "Hall A",
              organizer: "Team",
              roles: [],
              signedUp: 0,
              totalSlots: 5,
              createdBy: "u1",
              createdAt: new Date().toISOString(),
              format: "In-person",
              status: "active",
            },
          ],
        };
      }
      if (status === "ongoing") {
        return { events: [] };
      }
      if (status === "completed") {
        return { events: [mockCompletedEvent] };
      }
      if (status === "cancelled") {
        return { events: [] };
      }
      return { events: [] };
    }),
  };
  const authService = {
    getProfile: vi.fn(async () => {
      const err: any = new Error("Authentication failed.");
      err.status = 401;
      throw err;
    }),
    login: vi.fn(async () => {
      return { token: "t", user: { id: "u1", role: "Participant" } } as any;
    }),
    logout: vi.fn(async () => {}),
  };
  return { eventService, authService };
});

const mockCompletedEvent = {
  id: "evt-passed-1",
  title: "Morning Prayer",
  date: "2025-08-10",
  time: "08:00",
  endTime: "09:00",
  location: "Chapel",
  organizer: "Ministry",
  roles: [],
  signedUp: 2,
  totalSlots: 10,
  createdBy: "u1",
  createdAt: new Date().toISOString(),
  format: "In-person",
  status: "completed",
};

describe("Events pages - moving events after end time", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not show completed events in Upcoming and shows them in Past Events", async () => {
    // No need to mock timers; service responses control which page shows items

    // Render Upcoming page first
    const { unmount } = render(
      <MemoryRouter initialEntries={["/upcoming"]}>
        <NotificationProvider>
          <UpcomingEvents />
        </NotificationProvider>
      </MemoryRouter>
    );

    // Upcoming should NOT include the completed event
    await waitFor(() => {
      expect(screen.queryByText(/Morning Prayer/i)).not.toBeInTheDocument();
    });

    // Unmount Upcoming before rendering Past
    unmount();

    // Now, render Past Events page
    render(
      <MemoryRouter initialEntries={["/passed"]}>
        <NotificationProvider>
          <PassedEvents />
        </NotificationProvider>
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: /Past Events/i })
    ).toBeInTheDocument();
    // Disambiguate: the calendar also includes a small chip with the same text
    const headings = await screen.findAllByRole("heading", {
      name: /Morning Prayer/i,
    });
    // The card title is an h3; pick the one with semantic heading and larger text
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });
});
