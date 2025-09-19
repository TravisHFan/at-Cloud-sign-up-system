import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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

// Participant viewer
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: {
      id: "uP",
      role: "Participant",
      roleInAtCloud: "Member",
    },
  }),
}));

// Minimal event response with two roles and no user signups
vi.mock("../../services/api", () => ({
  __esModule: true,
  eventService: {
    getEvent: vi.fn(async (id: string) => ({
      id,
      title: "Capacity Test Event (Participant)",
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

describe("Guest capacity for Participant viewer", () => {
  it("subtracts guest counts from available spots and shows guests in-slot", async () => {
    window.localStorage.setItem("authToken", "tkn");

    getEventGuestsMock.mockResolvedValueOnce({
      guests: [
        { id: "g1", roleId: "r1", fullName: "Alpha Guest" },
        { id: "g2", roleId: "r1", fullName: "Beta Guest" },
        { id: "g3", roleId: "r2", fullName: "Gamma Guest" },
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

    await waitFor(() => {
      expect(
        screen.getByText(/Capacity Test Event \(Participant\)/)
      ).toBeInTheDocument();
    });

    // In-slot guests visible to participant
    expect(screen.getByText(/Guest: Alpha Guest/)).toBeInTheDocument();
    expect(screen.getByText(/Guest: Beta Guest/)).toBeInTheDocument();
    expect(screen.getByText(/Guest: Gamma Guest/)).toBeInTheDocument();

    // Common Participant role: 2/2 full due to guests -> no Sign Up button and shows "Full"
    const roleAHeading = screen.getByRole("heading", {
      name: /Common Participant \(on-site\)/i,
    });
    const roleACard = roleAHeading.closest(
      "div.border.rounded-lg.p-4.bg-white"
    ) as HTMLElement | null;
    expect(roleACard).toBeTruthy();
    if (roleACard) {
      expect(within(roleACard).getByText(/Full/i)).toBeInTheDocument();
      expect(
        within(roleACard).queryByRole("button", { name: /Sign Up/i })
      ).toBeNull();
    }

    // Prepared Speaker role: 1 guest of 3 -> 2 spots available text should be visible
    expect(screen.getByText(/2 spots available/i)).toBeInTheDocument();
  });
});
