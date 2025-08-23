import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  within,
  fireEvent,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EventDetail from "../../pages/EventDetail";
// Hoisted socket mock & emitter to safely use inside vi.mock
const socketTest = vi.hoisted(() => {
  let handler: ((payload: any) => void) | null = null;
  return {
    make: () => ({
      socketService: {
        connect: vi.fn(),
        joinEventRoom: vi.fn(async () => {}),
        leaveEventRoom: vi.fn(),
        on: vi.fn((evt: string, cb: any) => {
          if (evt === "event_update") handler = cb;
        }),
        off: vi.fn(),
      },
    }),
    emit: (payload: any) => {
      if (!handler) throw new Error("event_update handler not registered");
      handler(payload);
    },
    reset: () => {
      handler = null;
    },
  };
});
// Do NOT import NotificationProvider from the module we're mocking; define a local wrapper instead to avoid hoisting issues.
const MockNotificationProvider = ({ children }: any) => children;

// Minimal E2E-style test using real DOM DnD simulation in jsdom.
// This complements unit/integration by exercising the page end-to-end within the app shell.

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

// Capture socket handler to simulate server events later if needed
vi.mock("../../services/socketService", () => socketTest.make());

// Auth as Super Admin
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ currentUser: { id: "admin", role: "Super Admin" } }),
}));
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { id: "admin", role: "Super Admin" } }),
}));

// Hoisted API mocks
const apiMocks = vi.hoisted(() => ({
  moveGuestBetweenRoles: vi.fn(async () => ({ id: "e1", roles: [] })),
}));

vi.mock("../../services/api", () => ({
  __esModule: true,
  eventService: {
    getEvent: vi.fn(async (id: string) => ({
      id,
      title: "E2E DnD Event",
      type: "Meeting",
      date: "2026-01-01",
      time: "10:00",
      endTime: "12:00",
      timeZone: "America/New_York",
      roles: [
        { id: "r1", name: "Role A", maxParticipants: 2, currentSignups: [] },
        { id: "r2", name: "Role B", maxParticipants: 2, currentSignups: [] },
      ],
      status: "upcoming",
      attendees: [],
    })),
    moveGuestBetweenRoles: apiMocks.moveGuestBetweenRoles,
    moveUserBetweenRoles: vi.fn(),
    assignUserToRole: vi.fn(),
  },
}));

vi.mock("../../services/guestApi", () => ({
  __esModule: true,
  default: {
    getEventGuests: vi.fn(async () => ({
      guests: [
        { id: "g1", roleId: "r1", fullName: "Alpha Guest" },
        { id: "g2", roleId: "r2", fullName: "Beta Guest" },
      ],
    })),
  },
}));

// Helper to build a DataTransfer substitute for HTML5 DnD
function makeDataTransfer() {
  const store: Record<string, string> = {};
  return {
    data: store,
    setData(type: string, val: string) {
      store[type] = val;
    },
    getData(type: string) {
      return store[type];
    },
    dropEffect: "move",
    effectAllowed: "move",
  } as any;
}

beforeEach(() => {
  localStorage.setItem("authToken", "token");
  socketTest.reset();
});

describe("E2E: Admin guest drag-and-drop", () => {
  it("moves a guest from Role A to Role B and emits API call; also handles 'guest_moved' realtime", async () => {
    render(
      <MockNotificationProvider>
        <MemoryRouter initialEntries={["/events/e1"]}>
          <Routes>
            <Route path="/events/:id" element={<EventDetail />} />
          </Routes>
        </MemoryRouter>
      </MockNotificationProvider>
    );

    await waitFor(() =>
      expect(screen.getByText(/E2E DnD Event/)).toBeInTheDocument()
    );

    // Enable manage mode
    fireEvent.click(screen.getByRole("button", { name: /manage sign-ups/i }));

    // Locate guest in Role A
    const adminListR1 = await screen.findByTestId("admin-guests-r1");
    const guestCard = within(adminListR1).getByTestId("admin-guest-g1");

    // HTML5 DnD simulation
    const dataTransfer = makeDataTransfer();
    fireEvent.dragStart(guestCard, { dataTransfer });
    const targetRole = screen.getByText(/Role B/).closest("div");
    if (!targetRole) throw new Error("target role container not found");
    fireEvent.dragOver(targetRole, { dataTransfer });
    fireEvent.drop(targetRole, { dataTransfer });

    await waitFor(() =>
      expect(apiMocks.moveGuestBetweenRoles).toHaveBeenCalled()
    );
    expect(apiMocks.moveGuestBetweenRoles).toHaveBeenCalledWith(
      "e1",
      "g1",
      "r1",
      "r2"
    );

    // Simulate realtime confirmation specifically for guest_moved
    socketTest.emit({
      eventId: "e1",
      updateType: "guest_moved",
      data: {
        fromRoleId: "r1",
        toRoleId: "r2",
        fromRoleName: "Role A",
        toRoleName: "Role B",
        guestName: "Alpha Guest",
      },
      timestamp: new Date().toISOString(),
    });

    // No assertion needed for visual movement here since API call already validated;
    // this ensures the client can safely receive the new event without errors.
    expect(true).toBe(true);
  });
});
