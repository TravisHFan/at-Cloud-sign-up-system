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
        { id: "r1", name: "Role A", maxParticipants: 2, currentSignups: [] },
        { id: "r2", name: "Role B", maxParticipants: 3, currentSignups: [] },
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
  it("does not fetch or display guests and omits admin-only hints", async () => {
    // Ensure token present so sockets init safely
    window.localStorage.setItem("authToken", "tkn");

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

    // No admin-only Guests section
    expect(screen.queryByText(/Guests:/i)).toBeNull();

    // No "includes guests" capacity hint
    expect(screen.queryByText(/includes guests/i)).toBeNull();

    // Invite-a-guest buttons should be enabled (no guest-based disabling for non-admin)
    const inviteButtons = screen.getAllByRole("button", {
      name: /Invite a guest to this role/i,
    });
    expect(inviteButtons[0]).not.toBeDisabled();
    expect(inviteButtons[1]).not.toBeDisabled();

    // Guest list API not called for non-admin viewers
    expect(getEventGuestsMock).not.toHaveBeenCalled();
  });
});
