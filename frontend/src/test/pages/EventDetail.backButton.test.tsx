import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import EventDetail from "../../pages/EventDetail";

// Mock the eventService
vi.mock("../../services/api", () => ({
  eventService: {
    getEvent: vi.fn(() =>
      Promise.resolve({
        id: "test-event-123",
        title: "Test Event",
        type: "Workshop",
        date: "2025-10-15",
        time: "14:00",
        endTime: "16:00",
        timeZone: "America/New_York",
        location: "Test Location",
        organizer: "Test Organizer",
        hostedBy: "Test Host",
        organizerDetails: [],
        purpose: "Test purpose",
        agenda: "Test agenda",
        format: "In-Person",
        disclaimer: null,
        flyerUrl: null,
        roles: [],
        status: "active",
        publish: false,
        publicSlug: null,
        publishedAt: null,
      })
    ),
  },
}));

// Mock the socketService
vi.mock("../../services/socketService", () => ({
  socketService: {
    connect: vi.fn(),
    joinEventRoom: vi.fn(async () => {}),
    leaveEventRoom: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

// Mock the useAuth hook
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: {
      id: "test-user-id",
      role: "Participant",
      firstName: "Test",
      lastName: "User",
    },
  }),
}));

// Mock notification context
vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: () => ({
    success: () => {},
    error: () => {},
    info: () => {},
    warning: () => {},
  }),
  NotificationProvider: ({ children }: any) => children,
}));

// Mock navigate and capture calls
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: "test-event-123" }),
    useLocation: () => ({ pathname: "/dashboard/event/test-event-123" }),
  };
});

describe("EventDetail - Back/Go Back Button", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window.history.length to indicate there's history
    Object.defineProperty(window, "history", {
      value: { length: 2 },
      writable: true,
    });
  });

  it("uses browser back navigation when referrer is from dashboard page", async () => {
    // Mock document.referrer to simulate coming from upcoming events page
    Object.defineProperty(document, "referrer", {
      value: "http://localhost:3000/dashboard/upcoming",
      writable: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/event/test-event-123"]}>
        <Routes>
          <Route path="/dashboard/event/:id" element={<EventDetail />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for the event to load
    await waitFor(() => {
      expect(screen.getByText("Test Event")).toBeInTheDocument();
    });

    // Find and click the back button
    const backButton = screen.getByRole("button", { name: /⬅️（go back）/i });
    fireEvent.click(backButton);

    // Verify browser back navigation is used
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it("falls back to /dashboard/upcoming when referrer is not from dashboard", async () => {
    // Mock document.referrer to simulate coming from external page
    Object.defineProperty(document, "referrer", {
      value: "http://external-site.com/some-page",
      writable: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/event/test-event-123"]}>
        <Routes>
          <Route path="/dashboard/event/:id" element={<EventDetail />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for the event to load
    await waitFor(() => {
      expect(screen.getByText("Test Event")).toBeInTheDocument();
    });

    // Find and click the back button
    const backButton = screen.getByRole("button", { name: /⬅️（go back）/i });
    fireEvent.click(backButton);

    // Verify fallback to upcoming events
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/upcoming");
  });

  it("works correctly for each dashboard page referrer", async () => {
    const dashboardPages = [
      "/dashboard/upcoming",
      "/dashboard/passed",
      "/dashboard/my-events",
      "/dashboard/published-events",
    ];

    for (const page of dashboardPages) {
      vi.clearAllMocks();

      // Mock document.referrer for current dashboard page
      Object.defineProperty(document, "referrer", {
        value: `http://localhost:3000${page}`,
        writable: true,
      });

      render(
        <MemoryRouter initialEntries={["/dashboard/event/test-event-123"]}>
          <Routes>
            <Route path="/dashboard/event/:id" element={<EventDetail />} />
          </Routes>
        </MemoryRouter>
      );

      // Wait for the event to load
      await waitFor(() => {
        expect(screen.getByText("Test Event")).toBeInTheDocument();
      });

      // Find and click the back button
      const backButton = screen.getByRole("button", { name: /⬅️（go back）/i });
      fireEvent.click(backButton);

      // Verify browser back navigation is used for dashboard pages
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    }
  });

  it("has proper title attribute for accessibility", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/event/test-event-123"]}>
        <Routes>
          <Route path="/dashboard/event/:id" element={<EventDetail />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for the event to load
    await waitFor(() => {
      expect(screen.getByText("Test Event")).toBeInTheDocument();
    });

    // Find the back button and check its title attribute
    const backButton = screen.getByRole("button", { name: /⬅️（go back）/i });
    expect(backButton).toHaveAttribute("title", "⬅️（go back）");
  });
});
