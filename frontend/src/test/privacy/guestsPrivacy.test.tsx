import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EventDetail from "../../pages/EventDetail";
import { NotificationProvider } from "../../contexts/NotificationModalContext";

// Mock Guest API and track calls
const getEventGuestsMock = vi.fn();
vi.mock("../../services/guestApi", () => ({
  __esModule: true,
  default: {
    getEventGuests: (...args: any[]) => getEventGuestsMock(...args),
  },
}));

// Mock socket service noop
vi.mock("../../services/socketService", () => ({
  socketService: {
    connect: vi.fn(),
    joinEventRoom: vi.fn(async () => {}),
    leaveEventRoom: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

// Quiet toasts
vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: () => ({
    success: () => {},
    error: () => {},
    info: () => {},
    warning: () => {},
  }),
  NotificationProvider: ({ children }: any) => children,
}));

// Non-admin viewer (Participant)
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: {
      id: "uP",
      role: "Participant",
      roleInAtCloud: "Member",
    },
  }),
}));

// Minimal event response with two roles and no signups
vi.mock("../../services/api", () => ({
  __esModule: true,
  eventService: {
    getEvent: vi.fn(async (id: string) => ({
      id,
      title: "Privacy Test Event",
      type: "Meeting",
      date: "2025-12-01",
      time: "10:00",
      endTime: "11:00",
      timeZone: "America/New_York",
      roles: [
        {
          id: "r1",
          name: "Common Participant (on-site)",
          maxParticipants: 2,
          currentSignups: [],
        },
        {
          id: "r2",
          name: "Prepared Speaker (on-site)",
          maxParticipants: 3,
          currentSignups: [],
        },
      ],
      totalSignups: 0,
      totalSlots: 5,
      createdBy: { id: "u1" },
      createdAt: new Date().toISOString(),
      description: "desc",
      isHybrid: false,
      status: "upcoming",
      attendees: [],
    })),
  },
}));

describe("Guest privacy for non-admin viewers", () => {
  it("shows guests in-slot without contact details and omits admin-only hints", async () => {
    // Ensure token present so sockets init safely
    window.localStorage.setItem("authToken", "tkn");

    // Non-admins now fetch guest list to render in-slot names (no contact details)
    getEventGuestsMock.mockResolvedValueOnce({
      guests: [
        {
          id: "g1",
          roleId: "r1",
          fullName: "Alpha Guest",
          email: "a@e.com",
          phone: "+1 555",
        },
        {
          id: "g2",
          roleId: "r1",
          fullName: "Beta Guest",
          email: "b@e.com",
          phone: "+1 555",
        },
        {
          id: "g3",
          roleId: "r2",
          fullName: "Gamma Guest",
          email: "c@e.com",
          phone: "+1 555",
        },
      ],
    });

    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/events/e1"]}>
          <Routes>
            <Route path="/events/:id" element={<EventDetail />} />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    // Wait for event load
    await waitFor(() => {
      expect(screen.getByText(/Privacy Test Event/)).toBeInTheDocument();
    });

    // Fetch called for guests
    expect(getEventGuestsMock).toHaveBeenCalledWith("e1");

    // No admin-only Guests section heading
    expect(screen.queryByText(/Guests:/i)).toBeNull();

    // In-slot guest names are visible to non-admins
    expect(screen.getByText(/Guest: Alpha Guest/)).toBeInTheDocument();
    expect(screen.getByText(/Guest: Beta Guest/)).toBeInTheDocument();
    expect(screen.getByText(/Guest: Gamma Guest/)).toBeInTheDocument();

    // Contact details must be hidden for non-admins
    expect(screen.queryByText(/a@e.com/i)).toBeNull();
    expect(screen.queryByText(/\+1 555/i)).toBeNull();

    // No "includes guests" capacity hint for non-admins
    expect(screen.queryByText(/includes guests/i)).toBeNull();

    // Common Participant role is full due to 2 guests (max 2) -> invite disabled for first role; Prepared Speaker has 1/3 -> enabled
    const inviteButtons = screen.getAllByRole("button", {
      name: /Invite a guest to this role/i,
    });
    expect(inviteButtons[0]).toBeDisabled();
    expect(inviteButtons[1]).not.toBeDisabled();
  });
});
