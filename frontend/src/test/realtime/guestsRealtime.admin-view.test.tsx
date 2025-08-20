import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EventDetail from "../../pages/EventDetail";
import { NotificationProvider } from "../../contexts/NotificationModalContext";

// Capture handler for socket event_update
let capturedHandler: ((data: any) => void) | null = null;

beforeEach(() => {
  // Ensure a token exists so EventDetail registers socket listeners
  window.localStorage.setItem("authToken", "test-token");
  capturedHandler = null;
});

// Mock Guest API to return initial guests by role
vi.mock("../../services/guestApi", () => ({
  __esModule: true,
  default: {
    getEventGuests: vi.fn(async () => ({
      guests: [
        {
          id: "g1",
          roleId: "r1",
          fullName: "Alpha Guest",
          email: "a@e.com",
          phone: "+1 111",
        },
        {
          id: "g2",
          roleId: "r1",
          fullName: "Beta Guest",
          email: "b@e.com",
          phone: "+1 222",
        },
      ],
    })),
    resendManageLink: vi.fn(),
    adminCancelGuest: vi.fn(),
    adminUpdateGuest: vi.fn(),
  },
}));

// Mock socket service to capture and trigger event_update
vi.mock("../../services/socketService", () => ({
  socketService: {
    connect: vi.fn(),
    joinEventRoom: vi.fn(async () => {}),
    leaveEventRoom: vi.fn(),
    on: vi.fn((event: string, handler: (data: any) => void) => {
      if (event === "event_update") capturedHandler = handler;
    }),
    off: vi.fn(),
  },
}));

// Quiet toasts and provide provider passthrough
vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: () => ({
    success: () => {},
    error: () => {},
    info: () => {},
    warning: () => {},
  }),
  NotificationProvider: ({ children }: any) => children,
}));

// Mock auth as admin
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: {
      id: "admin",
      role: "Administrator",
      roleInAtCloud: "Administrator",
    },
  }),
}));

// Mock event service
const getEventMock = vi.fn(async (id: string) => ({
  id,
  title: "Realtime Test Event",
  type: "Meeting",
  date: "2025-12-01",
  time: "10:00",
  endTime: "11:00",
  timeZone: "America/New_York",
  roles: [
    { id: "r1", name: "Role A", maxParticipants: 2, currentSignups: [] },
    { id: "r2", name: "Role B", maxParticipants: 2, currentSignups: [] },
  ],
  totalSignups: 0,
  totalSlots: 4,
  createdBy: { id: "u1" },
  createdAt: new Date().toISOString(),
  description: "desc",
  isHybrid: false,
  status: "upcoming",
  attendees: [],
}));

vi.mock("../../services/api", () => ({
  __esModule: true,
  eventService: {
    getEvent: (id: string) => getEventMock(id),
    signUpForEvent: vi.fn(),
    updateWorkshopGroupTopic: vi.fn(),
    cancelSignup: vi.fn(),
    removeUserFromRole: vi.fn(),
    moveUserBetweenRoles: vi.fn(),
    deleteEvent: vi.fn(),
    updateEvent: vi.fn(),
    assignUserToRole: vi.fn(),
  },
}));

describe("EventDetail admin realtime guest updates", () => {
  it("removes a guest on guest_cancellation and keeps list stable on guest_updated", async () => {
    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/events/e1"]}>
          <Routes>
            <Route path="/events/:id" element={<EventDetail />} />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    // Initial load: two guests in Role A, button disabled (full by guests)
    await waitFor(() => {
      expect(screen.getAllByText(/Guests:/i).length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Alpha Guest")).toBeInTheDocument();
    expect(screen.getByText("Beta Guest")).toBeInTheDocument();

    const inviteButtons = screen.getAllByRole("button", {
      name: /Invite a guest to this role/i,
    });
    // Role A should be disabled (2/2 via guests), Role B enabled
    expect(inviteButtons[0]).toBeDisabled();
    expect(inviteButtons[1]).not.toBeDisabled();

    // Fire a guest_updated event (no change expected visually)
    await act(async () => {
      capturedHandler?.({
        eventId: "e1",
        updateType: "guest_updated",
        data: { roleId: "r1", guestName: "Alpha Guest" },
        timestamp: new Date().toISOString(),
      });
    });

    // Still both present
    expect(await screen.findByText("Alpha Guest")).toBeInTheDocument();
    expect(screen.getByText("Beta Guest")).toBeInTheDocument();

    // Fire a guest_cancellation for Alpha Guest
    await act(async () => {
      capturedHandler?.({
        eventId: "e1",
        updateType: "guest_cancellation",
        data: { roleId: "r1", guestName: "Alpha Guest" },
        timestamp: new Date().toISOString(),
      });
    });

    // Alpha should be removed; Role A invite button becomes enabled (1/2)
    await waitFor(() => {
      expect(screen.queryByText("Alpha Guest")).toBeNull();
    });
    expect(screen.getByText("Beta Guest")).toBeInTheDocument();

    const inviteButtonsAfter = screen.getAllByRole("button", {
      name: /Invite a guest to this role/i,
    });
    expect(inviteButtonsAfter[0]).not.toBeDisabled();
    expect(inviteButtonsAfter[1]).not.toBeDisabled();
  });
});
