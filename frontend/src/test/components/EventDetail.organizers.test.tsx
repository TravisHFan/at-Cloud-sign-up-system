import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import EventDetail from "../../pages/EventDetail";
import { eventService } from "../../services/api";

vi.mock("../../services/api", () => ({
  eventService: {
    getEvent: vi.fn(),
  },
  // Provide authService to satisfy AuthContext imports used by TestWrapper
  authService: {
    getProfile: vi.fn().mockRejectedValue(new Error("No token")),
    logout: vi.fn(),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
  return {
    ...actual,
    useParams: () => ({ id: "evt-1" }),
  };
});

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      <NotificationProvider>{children}</NotificationProvider>
    </AuthProvider>
  </BrowserRouter>
);

describe("EventDetail - Organizer separation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows primary Organizer separate from Co-organizers and preserves order", async () => {
    // Build event payload with createdBy (main) and two co-organizers
    vi.mocked(eventService.getEvent).mockResolvedValue({
      id: "evt-1",
      title: "Org Split",
      type: "Conference",
      format: "In-person",
      date: "2025-01-01",
      endDate: "2025-01-01",
      time: "10:00",
      endTime: "12:00",
      timeZone: "America/Los_Angeles",
      organizer: "Fallback Organizer",
      createdBy: {
        id: "u-main",
        firstName: "Main",
        lastName: "Owner",
        role: "Administrator",
        email: "main@example.com",
        phone: "555-1111",
        gender: "female",
        avatar: null,
      },
      organizerDetails: [
        {
          userId: "u-co1",
          name: "Alice Alpha",
          role: "Leader",
          email: "a@example.com",
          phone: "555-2222",
          avatar: null,
          gender: "female",
        },
        {
          userId: "u-co2",
          name: "Bob Beta",
          role: "Administrator",
          email: "b@example.com",
          phone: "555-3333",
          avatar: null,
          gender: "male",
        },
      ],
      purpose: "",
      agenda: "",
      location: "Room 1",
      roles: [],
      signedUp: 0,
      totalSlots: 0,
      createdAt: new Date().toISOString(),
      status: "upcoming",
    });

    render(
      <TestWrapper>
        <EventDetail />
      </TestWrapper>
    );

    // Wait for title
    await waitFor(() => {
      expect(screen.getAllByText(/Org Split/)[0]).toBeInTheDocument();
    });

    // Primary organizer section label
    expect(
      screen.getByText(/Organizer Contact Information/)
    ).toBeInTheDocument();
    expect(screen.getByText(/^Organizer$/)).toBeInTheDocument();

    // Main organizer name is shown
    expect(screen.getByText(/Main Owner/)).toBeInTheDocument();

    // Co-organizers label
    expect(screen.getByText(/^Co-organizers$/)).toBeInTheDocument();

    // Co-organizer names in provided order: Alice first, Bob second
    const co1 = screen.getByText("Alice Alpha");
    const co2 = screen.getByText("Bob Beta");
    expect(co1).toBeInTheDocument();
    expect(co2).toBeInTheDocument();

    // Order check using DOM tree traversal (co1 should appear before co2)
    const coGrid =
      co1.closest(".grid") || co1.parentElement?.parentElement?.parentElement;
    if (coGrid) {
      const text = coGrid.textContent || "";
      expect(text.indexOf("Alice Alpha")).toBeLessThan(
        text.indexOf("Bob Beta")
      );
    }
  });
});
